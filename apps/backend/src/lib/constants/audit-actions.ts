/**
 * Canonical vocabulary for the admin audit log.
 *
 * Two Zod enums are exported from this module:
 *   - `AUDIT_ACTIONS`  — every dotted `<resource>.<verb>` action that an admin
 *                        write handler may emit. Used as the `action` column
 *                        value when calling `auditLogRepo.insert(...)` and as
 *                        the Zod validator for the `action` query filter on
 *                        `GET /audit-log`.
 *   - `TARGET_TYPES`   — the set of resource kinds that the audit log may
 *                        reference. Used as the `targetType` column value on
 *                        insert and as a query filter.
 *
 * Why plain `zod` (not `@hono/zod-openapi`):
 *   This file lives under `lib/constants/` and is consumed by non-route code
 *   paths (the audit-log repository, handler call sites, and the read API's
 *   Zod query validator). Pulling `@hono/zod-openapi`'s `z` in here would drag
 *   OpenAPI metadata support into a constants file unnecessarily. The OpenAPI
 *   route schema for the audit-log read API (added in a later step) will
 *   re-export these enums or mirror them under `database/openapi-schemas.ts`.
 *
 * Adding a new admin write action:
 *   1. Append the dotted string to `AUDIT_ACTIONS` below.
 *   2. Add the corresponding handler call site (step 5+) that invokes
 *      `auditLogRepo.insert(db, { action, ... })` with the new value.
 *   3. Add a Vitest invariant assertion (step 8) so the enum stays in sync
 *      with the action literals actually emitted by handlers.
 */
import { z } from "zod";

export const AUDIT_ACTIONS = z.enum([
  "election.create",
  "election.update",
  "election.transition",
  "position.create",
  "position.update",
  "position.delete",
  "candidate.create",
  "candidate.update",
  "candidate.deactivate",
  "user.update",
  "user.create",
  "user.soft_delete",
  "user.restore",
  "user.hard_delete",
]);
export type AuditAction = z.infer<typeof AUDIT_ACTIONS>;

export const TARGET_TYPES = z.enum(["election", "position", "candidate", "user"]);
export type TargetType = z.infer<typeof TARGET_TYPES>;
