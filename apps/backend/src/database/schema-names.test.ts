import { z } from "@hono/zod-openapi";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, TARGET_TYPES } from "@/lib/constants/audit-actions";
import { AuditLogEntrySchema, AuditLogListResponse, UserApiSchema } from "./openapi-schemas";
import {
  DbSelectUserSchema,
  auditLog,
  candidates,
  elections,
  loginAttempts,
  partyLists,
  positions,
  sessions,
  users,
  votes,
} from "./schema";

describe("user schema exports", () => {
  it("uses distinct names for database and API user schemas", () => {
    expect(DbSelectUserSchema).toBeDefined();
    expect(UserApiSchema).toBeDefined();
  });

  it("keeps integer storage in the database schema and does not leak hasVoted into the API", () => {
    const baseUser = {
      createdAt: 1,
      updatedAt: 1,
      id: "user-1",
      accountId: "account-1",
      studentId: "2023-12345",
      firstName: "John",
      lastName: "Doe",
      yearLevel: "3rd Year",
      course: "BSCS",
    };

    // DB select: only the persisted integer columns; no hasVoted in DB or API
    const dbRow = DbSelectUserSchema.parse(baseUser);
    expect(dbRow).toEqual(baseUser);
    expect((dbRow as { hasVoted?: unknown }).hasVoted).toBeUndefined();

    // API schema: also has no hasVoted (votes table is the source of truth)
    const apiRow = UserApiSchema.parse(baseUser);
    expect((apiRow as { hasVoted?: unknown }).hasVoted).toBeUndefined();
  });

  it("produces an OpenAPI-capable zod schema for API routes", () => {
    expect(UserApiSchema).toBeInstanceOf(z.ZodObject);
  });
});

describe("election management schema", () => {
  it("exports the new elections, positions, and partyLists tables", () => {
    expect(elections).toBeDefined();
    expect(positions).toBeDefined();
    expect(partyLists).toBeDefined();
  });

  it("configures case-insensitive unique indexes for both party list name and code", () => {
    const { indexes } = getTableConfig(partyLists);
    const indexNames = indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain("idx_party_lists_election_name");
    expect(indexNames).toContain("idx_party_lists_election_code");
  });
});

describe("lookup indexes", () => {
  it("defines indexes for the account, position, and candidate lookup paths", () => {
    expect(getTableConfig(users).indexes.map((idx) => idx.config.name)).toContain(
      "idx_users_account_id",
    );
    expect(getTableConfig(sessions).indexes.map((idx) => idx.config.name)).toContain(
      "idx_sessions_account_id",
    );
    expect(getTableConfig(candidates).indexes.map((idx) => idx.config.name)).toContain(
      "idx_candidates_position_id",
    );
    expect(getTableConfig(votes).indexes.map((idx) => idx.config.name)).toContain(
      "idx_votes_candidate_id",
    );
  });
});

// === audit log ===
// Mirrors the per-table invariants established above for `user`/`elections`:
//   1. The Drizzle `auditLog` table is exported and has the expected columns.
//   2. The OpenAPI schema's camelCase keys line up 1:1 with the Drizzle column
//      names (the API layer never re-shapes the row).
//   3. The list-response wrapper exposes only `items` + `nextCursor`.
//   4. Every action string in the AUDIT_ACTIONS enum is accepted by the
//      OpenAPI `action` field (which is typed as a plain string).
describe("audit_log schema", () => {
  const expectedColumns = [
    "id",
    "createdAt",
    "action",
    "targetType",
    "targetId",
    "actorAccountIdSnapshot",
    "actorUsernameSnapshot",
    "description",
  ] as const;

  it("exports the auditLog Drizzle table with the 8 expected columns", () => {
    expect(auditLog).toBeDefined();
    const columnKeys = Object.keys(auditLog).sort();
    expect(columnKeys).toEqual([...expectedColumns].sort());
    expect(columnKeys).toHaveLength(8);
  });

  it("exposes AuditLogEntrySchema with 8 camelCase fields matching Drizzle columns 1:1", () => {
    expect(AuditLogEntrySchema).toBeInstanceOf(z.ZodObject);
    const apiKeys = Object.keys(AuditLogEntrySchema.shape).sort();
    expect(apiKeys).toEqual([...expectedColumns].sort());
    expect(apiKeys).toHaveLength(8);

    // Every Drizzle column must have a corresponding OpenAPI field and vice
    // versa — a stray snake_case key on either side would silently break the
    // schema/row contract that the repository relies on.
    for (const col of expectedColumns) {
      expect(apiKeys).toContain(col);
    }
  });

  it("exposes AuditLogListResponse with exactly `items` and `nextCursor`", () => {
    expect(AuditLogListResponse).toBeInstanceOf(z.ZodObject);
    const keys = Object.keys(AuditLogListResponse.shape).sort();
    expect(keys).toEqual(["items", "nextCursor"]);

    const itemsField = AuditLogListResponse.shape.items;
    expect(itemsField).toBeInstanceOf(z.ZodArray);
    const itemSchema = (itemsField as z.ZodArray<z.ZodTypeAny>).element;
    expect(itemSchema).toBe(AuditLogEntrySchema);

    const nextCursorField = AuditLogListResponse.shape.nextCursor;
    expect(nextCursorField).toBeInstanceOf(z.ZodNullable);
  });

  it("accepts every AUDIT_ACTIONS value through the OpenAPI `action` field", () => {
    const actionValues = AUDIT_ACTIONS.options;
    expect(actionValues).toHaveLength(19);

    const sampleRow = {
      id: "f0e1d2c3-b4a5-4687-8901-23456789abcd",
      createdAt: 1719400000,
      targetType: "election" as const,
      targetId: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
      actorAccountIdSnapshot: "acc_456def",
      actorUsernameSnapshot: "admin.jane",
      description: "draft → open",
    };

    for (const action of actionValues) {
      const parsed = AuditLogEntrySchema.parse({ ...sampleRow, action });
      expect(parsed.action).toBe(action);
    }
  });

  it("accepts every TARGET_TYPES value through the OpenAPI `targetType` field", () => {
    const sampleRow = {
      id: "f0e1d2c3-b4a5-4687-8901-23456789abcd",
      createdAt: 1719400000,
      action: "party.create",
      targetId: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
      actorAccountIdSnapshot: "acc_456def",
      actorUsernameSnapshot: "admin.jane",
      description: "Created party 'Innovators' (INNOV) in election 'CSO Election'",
    };

    for (const targetType of TARGET_TYPES.options) {
      const parsed = AuditLogEntrySchema.parse({ ...sampleRow, targetType });
      expect(parsed.targetType).toBe(targetType);
    }
  });

  it("produces an OpenAPI-capable zod schema for the list response", () => {
    expect(AuditLogListResponse).toBeInstanceOf(z.ZodObject);
  });
});
// === end audit log ===

describe("login_attempts schema", () => {
  const expectedColumns = ["id", "identifier", "attemptedAt", "ipAddress"] as const;

  it("exports the loginAttempts Drizzle table with the 4 expected columns", () => {
    expect(loginAttempts).toBeDefined();
    const columnKeys = Object.keys(loginAttempts).sort();
    expect(columnKeys).toEqual([...expectedColumns].sort());
    expect(columnKeys).toHaveLength(4);
  });
});
