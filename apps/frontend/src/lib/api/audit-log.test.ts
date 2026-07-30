import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  getAuditTargetFallbackName,
  type AuditLogEntry,
} from "./audit-log";

describe("audit log frontend contract", () => {
  it("includes party actions and targets", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining(["party.create", "party.update", "party.delete"]),
    );
    expect(AUDIT_TARGET_TYPES).toContain("party");
  });

  it("derives a stable party label from the audit snapshot description", () => {
    const entry: AuditLogEntry = {
      id: "audit-1",
      createdAt: 1,
      action: "party.delete",
      targetType: "party",
      targetId: "party-1",
      actorAccountIdSnapshot: "admin-1",
      actorUsernameSnapshot: "admin",
      description: "Deleted party 'Innovators' (INNOV)",
    };

    expect(getAuditTargetFallbackName(entry)).toBe("Innovators (INNOV)");
  });

  it("derives a stable party label when party name contains an apostrophe", () => {
    const entry: AuditLogEntry = {
      id: "audit-2",
      createdAt: 1,
      action: "party.create",
      targetType: "party",
      targetId: "party-2",
      actorAccountIdSnapshot: "admin-1",
      actorUsernameSnapshot: "admin",
      description: "Created party 'Students' Alliance' (SA) in election 'CSO 2026'",
    };

    expect(getAuditTargetFallbackName(entry)).toBe("Students' Alliance (SA)");
  });

  it("falls back to targetId when party description is malformed or missing parens", () => {
    const entry: AuditLogEntry = {
      id: "audit-3",
      createdAt: 1,
      action: "party.delete",
      targetType: "party",
      targetId: "party-3",
      actorAccountIdSnapshot: "admin-1",
      actorUsernameSnapshot: "admin",
      description: "Deleted party Innovators without code snapshot",
    };

    expect(getAuditTargetFallbackName(entry)).toBe("party-3");
  });
});
