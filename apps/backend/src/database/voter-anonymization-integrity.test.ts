import { readFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, afterEach, afterAll } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/database/schema";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { electionRepo } from "@/database/repositories/election.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { voteRepo } from "@/database/repositories/votes.repository";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { DrizzleBallotCaster } from "@/lib/ballot-caster";
import { userLifecycleCoordinator } from "@/lib/user-lifecycle-coordinator";
import { ElectionLifecycleCoordinator } from "@/lib/election-lifecycle-coordinator";
import { electionQueries } from "@/database/queries/election.queries";
import { eq, sql } from "drizzle-orm";

describe("Case 13: Voter Deletion Turnout & Anonymization Integrity", () => {
  const dbPath = resolve(process.cwd(), "voter-anonymization-integrity-test.db");
  let activeClient: Client | null = null;

  const cleanup = () => {
    if (activeClient) {
      try {
        activeClient.close();
      } catch (err) {
        console.error("Client close error:", err);
      }
      activeClient = null;
    }
    if (existsSync(dbPath)) {
      try {
        unlinkSync(dbPath);
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    }
  };

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    cleanup();
  });

  it("anonymizes votes without reducing candidate vote counts or total election turnout", async () => {
    cleanup();

    // 1. Setup file-based database and run migrations
    activeClient = createClient({ url: `file:${dbPath}` });
    const client = activeClient;
    await client.execute("PRAGMA foreign_keys = ON");

    // Read and run migrations in order
    const migrationsDir = resolve(__dirname, "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const sqlContent = readFileSync(resolve(migrationsDir, file), "utf8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((chunk) =>
          chunk
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n")
            .trim(),
        )
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          await client.execute(stmt);
        } catch (e) {
          console.error(`Error executing statement in ${file}:`, e, "\nStatement:", stmt);
          throw e;
        }
      }
    }

    const db = drizzle(client, { schema });

    // 2. Seed Admin, Super Admin, and an Election
    const adminAccountId = crypto.randomUUID();
    await voterAccountStore.create(db, {
      accountId: adminAccountId,
      username: "admin_user",
      email: "admin@cso.org",
      passwordHash: "dummy-hash",
      studentId: "A24-0001",
      firstName: "Admin",
      lastName: "User",
      course: "BSCS",
      yearLevel: "4th Year",
      role: "super_admin",
    });

    const now = Math.floor(Date.now() / 1000);
    const electionId = await electionRepo.create(db, {
      name: "CSO Officers General Election",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });

    // Transition election to 'open' status
    await electionRepo.updateStatus(db, electionId, {
      existingStatus: "draft",
      status: "open",
    });

    const positionId = await positionRepo.create(db, {
      electionId,
      name: "President",
      displayOrder: 1,
    });

    const candidateAccountId = crypto.randomUUID();
    await voterAccountStore.create(db, {
      accountId: candidateAccountId,
      username: "candidate_alice",
      email: "alice@cso.org",
      passwordHash: "dummy-hash",
      studentId: "C24-1111",
      firstName: "Alice",
      lastName: "Smith",
      course: "BSCS",
      yearLevel: "3rd Year",
      role: "user",
    });

    const candidateId = await candidateRepo.create(db, {
      fullName: "Alice Smith",
      accountId: candidateAccountId,
      positionId,
      manifesto: "Vote for Alice!",
    });

    // 3. Step 1: Note current election turnout & vote tallies in Results
    let results = await electionQueries.getResults(db, electionId);
    let presidentPosition = results.find((r) => r.positionId === positionId);
    expect(presidentPosition).toBeDefined();
    expect(presidentPosition?.totalVotes).toBe(0);
    let candidateResult = presidentPosition?.candidates.find((c) => c.candidateId === candidateId);
    expect(candidateResult?.voteCount).toBe(0);

    // Also check ballot snapshots (turnout count)
    const initialTurnout = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.ballotSnapshots)
      .where(eq(schema.ballotSnapshots.electionId, electionId))
      .get();
    expect(initialTurnout?.count ?? 0).toBe(0);

    // 4. Step 2: Register/log in as a new student voter, cast a ballot, and verify turnout increases by +1
    const voterRegistration = await userLifecycleCoordinator.register(db, {
      firstName: "Bob",
      lastName: "Jones",
      email: "bob@cso.org",
      username: "bobjones",
      password: "StrongPassword123!",
      studentId: "S24-2222",
      course: "BSCS",
      yearLevel: "2nd Year",
      role: "user",
    });

    const ballotCaster = new DrizzleBallotCaster();
    const castResult = await ballotCaster.cast(db, {
      accountId: voterRegistration.accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });
    expect(castResult.success).toBe(true);

    // Verify turnout increases by +1
    results = await electionQueries.getResults(db, electionId);
    presidentPosition = results.find((r) => r.positionId === positionId);
    expect(presidentPosition?.totalVotes).toBe(1);
    candidateResult = presidentPosition?.candidates.find((c) => c.candidateId === candidateId);
    expect(candidateResult?.voteCount).toBe(1);

    const postVoteTurnout = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.ballotSnapshots)
      .where(eq(schema.ballotSnapshots.electionId, electionId))
      .get();
    expect(postVoteTurnout?.count).toBe(1);

    // Verify user has cast a vote in the votes table
    const dbUser = await voterAccountStore.findByAccountId(db, voterRegistration.accountId);
    expect(dbUser).toBeDefined();
    const userVotes = await voteRepo.findByUserAndElection(db, dbUser!.id, electionId);
    expect(userVotes).toHaveLength(1);
    expect(userVotes[0].userId).toBe(dbUser!.id);

    // 5. Step 3: Log in as Super Admin and perform a Hard Delete on that student voter account
    const superAdminActor = {
      id: adminAccountId,
      username: "admin_user",
      role: "super_admin" as const,
    };

    // Attempting hard delete while election is open should fail
    await expect(
      userLifecycleCoordinator.hardDelete(db, dbUser!.id, superAdminActor),
    ).rejects.toThrowError(expect.objectContaining({ code: "ELECTION_IS_OPEN", statusCode: 400 }));

    // Close election to allow administrative hard delete
    await db
      .update(schema.elections)
      .set({ status: "closed" })
      .where(eq(schema.elections.id, electionId))
      .run();
    await userLifecycleCoordinator.hardDelete(db, dbUser!.id, superAdminActor);

    // 6. Step 4: Check election turnout and candidate counts again
    // Expected Result: Total turnout and candidate vote counts remain 100% intact,
    // while the deleted user's userId on the votes table is set to NULL (anonymized).

    // Let's query election results again
    results = await electionQueries.getResults(db, electionId);
    presidentPosition = results.find((r) => r.positionId === positionId);
    expect(presidentPosition?.totalVotes).toBe(1); // STILL 1!
    candidateResult = presidentPosition?.candidates.find((c) => c.candidateId === candidateId);
    expect(candidateResult?.voteCount).toBe(1); // STILL 1!

    // Ballot snapshots (turnout) still 1
    const postDeleteTurnout = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.ballotSnapshots)
      .where(eq(schema.ballotSnapshots.electionId, electionId))
      .get();
    expect(postDeleteTurnout?.count).toBe(1);

    // User should not exist anymore
    const deletedUser = await voterAccountStore.findByAccountId(db, voterRegistration.accountId);
    expect(deletedUser).toBeNull();

    // Check the votes table directly
    const dbVotes = await db.select().from(schema.votes).all();
    expect(dbVotes).toHaveLength(1);
    expect(dbVotes[0].userId).toBeNull(); // Anonymized!
    expect(dbVotes[0].candidateId).toBe(candidateId);
    expect(dbVotes[0].positionId).toBe(positionId);
    expect(dbVotes[0].electionId).toBe(electionId);
  });

  it("Case 17: prevents hard-deleting a student account if they are currently nominated as a candidate", async () => {
    cleanup();

    // 1. Setup file-based database and run migrations
    activeClient = createClient({ url: `file:${dbPath}` });
    const client = activeClient;
    await client.execute("PRAGMA foreign_keys = ON");

    // Read and run migrations in order
    const migrationsDir = resolve(__dirname, "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const sqlContent = readFileSync(resolve(migrationsDir, file), "utf8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((chunk) =>
          chunk
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n")
            .trim(),
        )
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await client.execute(stmt);
      }
    }

    const db = drizzle(client, { schema });

    // 2. Seed Admin, Super Admin, and a Draft Election
    const adminAccountId = crypto.randomUUID();
    await voterAccountStore.create(db, {
      accountId: adminAccountId,
      username: "admin_user",
      email: "admin@cso.org",
      passwordHash: "dummy-hash",
      studentId: "A24-0001",
      firstName: "Admin",
      lastName: "User",
      course: "BSCS",
      yearLevel: "4th Year",
      role: "super_admin",
    });

    const now = Math.floor(Date.now() / 1000);
    const electionId = await electionRepo.create(db, {
      name: "CSO Officers General Election",
      opensAt: now + 3600, // draft/future election
      closesAt: now + 7200,
    });

    const positionId = await positionRepo.create(db, {
      electionId,
      name: "President",
      displayOrder: 1,
    });

    // 3. Register a student user who will be nominated as a candidate
    const studentUser = await userLifecycleCoordinator.register(db, {
      firstName: "Charlie",
      lastName: "Brown",
      email: "charlie@cso.org",
      username: "charliebrown",
      password: "StrongPassword123!",
      studentId: "S24-3333",
      course: "BSCS",
      yearLevel: "3rd Year",
      role: "user",
    });

    // Nominate them as a candidate
    await candidateRepo.create(db, {
      fullName: "Charlie Brown",
      accountId: studentUser.accountId,
      positionId,
      manifesto: "Charlie for President!",
    });

    // Verify they are listed as a candidate
    const dbUser = await voterAccountStore.findByAccountId(db, studentUser.accountId);
    expect(dbUser).toBeDefined();

    const isCandidate = await candidateRepo.isCandidate(db, studentUser.accountId);
    expect(isCandidate).toBe(true);

    // 4. Attempt to hard delete the student account as Super Admin
    const superAdminActor = {
      id: adminAccountId,
      username: "admin_user",
      role: "super_admin" as const,
    };

    // Expect the hard delete to throw/fail with the proper candidate block message
    await expect(
      userLifecycleCoordinator.hardDelete(db, dbUser!.id, superAdminActor),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "USER_IS_CANDIDATE",
        statusCode: 400,
      }),
    );

    // Verify the user still exists in the database
    const checkUser = await voterAccountStore.findByAccountId(db, studentUser.accountId);
    expect(checkUser).toBeDefined();
    expect(checkUser?.id).toBe(dbUser!.id);
  });

  it("Case 18: verifies that administrative actions dynamically append write-once audit logs", async () => {
    cleanup();

    // 1. Setup file-based database and run migrations
    activeClient = createClient({ url: `file:${dbPath}` });
    const client = activeClient;
    await client.execute("PRAGMA foreign_keys = ON");

    // Read and run migrations in order
    const migrationsDir = resolve(__dirname, "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const sqlContent = readFileSync(resolve(migrationsDir, file), "utf8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((chunk) =>
          chunk
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n")
            .trim(),
        )
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await client.execute(stmt);
      }
    }

    const db = drizzle(client, { schema });

    // 2. Log in/create Admin actor
    const adminAccountId = crypto.randomUUID();
    const adminUsername = "admin_voter_deletion_audit";
    await voterAccountStore.create(db, {
      accountId: adminAccountId,
      username: adminUsername,
      email: "superadmin_audit@cso.org",
      passwordHash: "dummy-hash",
      studentId: "A24-9999",
      firstName: "Admin",
      lastName: "Auditor",
      course: "BSCS",
      yearLevel: "4th Year",
      role: "super_admin",
    });

    const adminActor = {
      id: adminAccountId,
      username: adminUsername,
    };

    // Before doing any admin action, audit logs should be empty
    const baselineLogs = await auditLogRepo.list(db);
    expect(baselineLogs.items).toHaveLength(0);

    // 3. Perform an administrative action: create a draft election using ElectionLifecycleCoordinator
    const now = Math.floor(Date.now() / 1000);
    const electionId = await ElectionLifecycleCoordinator.create(
      db,
      {
        name: "CSO Auditor Election 2026",
        opensAt: now + 3600,
        closesAt: now + 7200,
      },
      adminActor,
    );

    // 4. Retrieve/check Audit Logs
    const postActionLogs = await auditLogRepo.list(db);
    expect(postActionLogs.items).toHaveLength(1);

    const logEntry = postActionLogs.items[0];
    expect(logEntry.id).toBeDefined();
    // Verify UUID format
    expect(logEntry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(logEntry.createdAt).toBeGreaterThanOrEqual(now);
    expect(logEntry.actorAccountIdSnapshot).toBe(adminAccountId);
    expect(logEntry.actorUsernameSnapshot).toBe(adminUsername);
    expect(logEntry.action).toBe("election.create");
    expect(logEntry.targetType).toBe("election");
    expect(logEntry.targetId).toBe(electionId);
  });

  it("prevents double voting when a hard-deleted voter is re-imported with a new user ID", async () => {
    cleanup();

    activeClient = createClient({ url: `file:${dbPath}` });
    const client = activeClient;
    await client.execute("PRAGMA foreign_keys = ON");

    const migrationsDir = resolve(__dirname, "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const sqlContent = readFileSync(resolve(migrationsDir, file), "utf8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((chunk) =>
          chunk
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n")
            .trim(),
        )
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await client.execute(stmt);
      }
    }

    const db = drizzle(client, { schema });

    const adminAccountId = crypto.randomUUID();
    await voterAccountStore.create(db, {
      accountId: adminAccountId,
      username: "admin_user",
      email: "admin@cso.org",
      passwordHash: "dummy-hash",
      studentId: "A24-0000",
      firstName: "Admin",
      lastName: "User",
      course: "BSCS",
      yearLevel: "4th Year",
      role: "super_admin",
    });

    const now = Math.floor(Date.now() / 1000);
    const electionId = await electionRepo.create(db, {
      name: "Durable Participation Election",
      opensAt: now - 60,
      closesAt: now + 3600,
    });
    await db
      .update(schema.elections)
      .set({ status: "open" })
      .where(eq(schema.elections.id, electionId))
      .run();

    const positionId = await positionRepo.create(db, {
      electionId,
      name: "President",
      displayOrder: 1,
    });

    const candidateAccountId = crypto.randomUUID();
    await voterAccountStore.create(db, {
      accountId: candidateAccountId,
      username: "candidate1",
      email: "candidate1@cso.org",
      passwordHash: "dummy-hash",
      studentId: "A24-1111",
      firstName: "Candidate",
      lastName: "One",
      course: "BSCS",
      yearLevel: "3rd Year",
      role: "user",
    });

    const candidateId = await candidateRepo.create(db, {
      accountId: candidateAccountId,
      positionId,
      fullName: "Candidate One",
      manifesto: "Test manifesto",
    });

    // 1. Register voter
    const studentId = "2026-8888";
    const voterReg = await userLifecycleCoordinator.register(db, {
      username: "voter_durable",
      email: "voter_durable@cso.org",
      password: "password123",
      studentId,
      firstName: "Voter",
      lastName: "Durable",
      course: "BSCS",
      yearLevel: "1st Year",
    });

    // 2. Cast initial vote
    const caster = new DrizzleBallotCaster();
    const voteRes = await caster.cast(db, {
      accountId: voterReg.accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });
    expect(voteRes.success).toBe(true);

    // 3. Temporarily close election to allow administrative hard delete
    const superAdminActor = {
      id: adminAccountId,
      username: "admin_user",
      role: "super_admin" as const,
    };
    await db
      .update(schema.elections)
      .set({ status: "draft" })
      .where(eq(schema.elections.id, electionId))
      .run();
    const voter = await voterAccountStore.findByAccountId(db, voterReg.accountId);
    await userLifecycleCoordinator.hardDelete(db, voter!.id, superAdminActor);

    // Re-open election
    await db
      .update(schema.elections)
      .set({ status: "open" })
      .where(eq(schema.elections.id, electionId))
      .run();

    // 4. Re-import/re-register the student with the exact same studentId (creates new account/user ID)
    const reimportedVoter = await userLifecycleCoordinator.register(db, {
      username: "voter_durable_reimported",
      email: "voter_durable_reimported@cso.org",
      password: "password123",
      studentId,
      firstName: "Voter",
      lastName: "Durable",
      course: "BSCS",
      yearLevel: "1st Year",
    });

    expect(reimportedVoter.accountId).not.toBe(voterReg.accountId);

    // 5. Attempting to recast ballot with new account/user ID must fail
    const recastRes = await caster.cast(db, {
      accountId: reimportedVoter.accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });

    expect(recastRes.success).toBe(false);
    if (!recastRes.success) {
      expect(recastRes.error.code).toBe("VOTE_ALREADY_CAST");
    }
  });
});
