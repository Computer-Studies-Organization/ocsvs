/**
 * Backfill durable HMAC participation records, unlink legacy vote owners, and
 * scrub ballot timestamps.
 *
 * Dry-run (default): pnpm db:anonymize-votes
 * Apply: HMAC_SECRET='...' pnpm db:anonymize-votes -- --apply
 *
 * Deploy the anonymous ballot writer first, take a backup, apply this command,
 * then rerun the dry-run and expect zero linked rows.
 *
 * The apply path is intentionally irreversible. Take a database backup first;
 * the only rollback is restoring that backup. Vote rows, aggregate tallies, and
 * turnout snapshots are preserved, while legacy user_id links and ballot timing
 * are cleared in the same transaction that inserts their election-scoped HMAC
 * participation records.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { count, eq, isNotNull } from "drizzle-orm";
import "dotenv/config";
import {
  computeVoterHash,
  PARTICIPATION_TIMESTAMP_SENTINEL,
  VOTE_TIMESTAMP_SENTINEL,
} from "../src/lib/ballot-caster";
import { ballotSnapshots, users, voterElectionParticipation, votes } from "../src/database/schema";

const apply = process.argv.includes("--apply");
const url = process.env.TURSO_DATABASE_URL;
const hmacSecret = process.env.HMAC_SECRET;

if (!url) throw new Error("TURSO_DATABASE_URL is required");
if (apply && !hmacSecret) throw new Error("HMAC_SECRET is required with --apply");

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const db = drizzle(client);

const summary = await db.transaction(async (tx) => {
  const linked = await tx
    .select({
      userId: votes.userId,
      electionId: votes.electionId,
      studentId: users.studentId,
    })
    .from(votes)
    .innerJoin(users, eq(votes.userId, users.id))
    .where(isNotNull(votes.userId))
    .groupBy(votes.userId, votes.electionId, users.studentId)
    .all();

  const linkedVotes = await tx
    .select({ count: count() })
    .from(votes)
    .where(isNotNull(votes.userId))
    .get();

  if (!apply) {
    return { pairs: linked.length, votes: Number(linkedVotes?.count ?? 0) };
  }

  for (const row of linked) {
    const voterHash = await computeVoterHash(row.electionId, row.studentId, hmacSecret!);
    await tx
      .insert(voterElectionParticipation)
      .values({
        id: crypto.randomUUID(),
        electionId: row.electionId,
        voterHash,
        createdAt: PARTICIPATION_TIMESTAMP_SENTINEL,
      })
      .onConflictDoNothing()
      .run();
  }

  await tx
    .update(voterElectionParticipation)
    .set({ createdAt: PARTICIPATION_TIMESTAMP_SENTINEL })
    .run();
  await tx
    .update(votes)
    .set({ userId: null, createdAt: VOTE_TIMESTAMP_SENTINEL, updatedAt: VOTE_TIMESTAMP_SENTINEL })
    .run();
  await tx.update(ballotSnapshots).set({ createdAt: VOTE_TIMESTAMP_SENTINEL }).run();
  return { pairs: linked.length, votes: Number(linkedVotes?.count ?? 0) };
});

console.log(
  `${apply ? "Anonymized" : "Would anonymize"} ${summary.votes} vote row(s) across ${summary.pairs} voter/election pair(s).`,
);
await client.close();
