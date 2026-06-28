import type { Database } from "./database.type";
import { and, desc, eq, gte, lt, lte, or, type SQL } from "drizzle-orm";
import { auditLog } from "@/database/schema";
import type { AuditAction, TargetType } from "@/lib/constants/audit-actions";

/**
 * Public row shape returned by `auditLogRepo` methods.
 *
 * Mirrors the columns of the `auditLog` Drizzle table (snake-case DB columns
 * mapped to camelCase JS keys). The `action` and `targetType` fields are
 * typed as plain `string` here so this repository stays decoupled from the
 * Zod enum in `@/lib/constants/audit-actions` at the type level; the Zod
 * enum is still enforced at write-time via the `entry` argument of `insert`
 * and at read-time by the route validators.
 */
export type AuditLogRow = {
  id: string;
  createdAt: number;
  action: string;
  targetType: string;
  targetId: string;
  actorAccountIdSnapshot: string;
  actorUsernameSnapshot: string;
  description: string | null;
};

export interface AuditLogEntry {
  action: AuditAction;
  targetType: TargetType;
  targetId: string;
  actorAccountIdSnapshot: string;
  actorUsernameSnapshot: string;
  description?: string | null;
}

export interface AuditLogListFilters {
  actorId?: string;
  action?: AuditAction;
  targetType?: TargetType;
  targetId?: string;
  since?: number;
  until?: number;
  cursor?: string;
  limit?: number;
}

export interface AuditLogListResult {
  items: AuditLogRow[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Encode `{ createdAt, id }` as a URL-safe base64 of `${createdAt}:${id}`.
 *
 * Exported with a leading underscore to signal "internal" — tests may still
 * import it directly to round-trip without going through the public API.
 */
export function _encodeCursor(c: { createdAt: number; id: string }): string {
  return Buffer.from(`${c.createdAt}:${c.id}`, "utf-8").toString("base64url");
}

/**
 * Decode a cursor produced by `_encodeCursor` back to `{ createdAt, id }`.
 *
 * Throws `Error` on malformed input (caller — typically a route handler's
 * Zod validator — should already have rejected bad input, so this is just
 * a defensive guard for the repository).
 */
export function _decodeCursor(s: string): { createdAt: number; id: string } {
  const raw = Buffer.from(s, "base64url").toString("utf-8");
  const sep = raw.indexOf(":");
  if (sep <= 0) throw new Error("invalid cursor");
  const createdAt = Number(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (!Number.isFinite(createdAt) || id.length === 0) throw new Error("invalid cursor");
  return { createdAt, id };
}

function clampLimit(raw: number | undefined): number {
  const n = raw ?? DEFAULT_LIMIT;
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

export const auditLogRepo = {
  /**
   * Append a new audit-log entry. Generates `id` (UUID v4) and `createdAt`
   * (unix seconds) on the application side; the `description` column is
   * nullable and is only included in the INSERT when a non-null value is
   * supplied so the DB default of NULL applies otherwise.
   *
   * Returns the generated `{ id, createdAt }` so callers (handlers) can echo
   * them back in the response without a follow-up SELECT.
   */
  async insert(db: Database, entry: AuditLogEntry): Promise<{ id: string; createdAt: number }> {
    const id = crypto.randomUUID();
    const createdAt = Math.floor(Date.now() / 1000);

    const values: typeof auditLog.$inferInsert = {
      id,
      createdAt,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      actorAccountIdSnapshot: entry.actorAccountIdSnapshot,
      actorUsernameSnapshot: entry.actorUsernameSnapshot,
    };
    if (entry.description !== undefined && entry.description !== null) {
      values.description = entry.description;
    }

    await db.insert(auditLog).values(values).run();
    return { id, createdAt };
  },

  /**
   * Paginated global list of audit-log rows, ordered by `(createdAt desc, id desc)`.
   *
   * Cursor encoding: URL-safe base64 of `${createdAt}:${id}` (see
   * `_encodeCursor` / `_decodeCursor`). The cursor predicate selects the
   * "next page" strictly past the last row of the previous page:
   *
   *   (createdAt < c.createdAt) OR (createdAt = c.createdAt AND id < c.id)
   *
   * `nextCursor` is non-null iff `items.length === limit` (the page is
   * full and a next page may exist). We deliberately do not fetch `limit+1`
   * because Drizzle's `.limit()` is the single source of truth for row
   * count and there's no ambiguity — a short page means "no more rows".
   */
  async list(db: Database, filters: AuditLogListFilters = {}): Promise<AuditLogListResult> {
    const limit = clampLimit(filters.limit);

    const conditions: SQL[] = [];
    if (filters.actorId) {
      conditions.push(eq(auditLog.actorAccountIdSnapshot, filters.actorId));
    }
    if (filters.action) {
      conditions.push(eq(auditLog.action, filters.action));
    }
    if (filters.targetType) {
      conditions.push(eq(auditLog.targetType, filters.targetType));
    }
    if (filters.targetId) {
      conditions.push(eq(auditLog.targetId, filters.targetId));
    }
    if (filters.since !== undefined) {
      conditions.push(gte(auditLog.createdAt, filters.since));
    }
    if (filters.until !== undefined) {
      conditions.push(lte(auditLog.createdAt, filters.until));
    }
    if (filters.cursor) {
      const c = _decodeCursor(filters.cursor);
      conditions.push(
        or(
          lt(auditLog.createdAt, c.createdAt),
          and(eq(auditLog.createdAt, c.createdAt), lt(auditLog.id, c.id)),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = (await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit)
      .all()) as AuditLogRow[];

    let nextCursor: string | null = null;
    if (items.length === limit) {
      const last = items[items.length - 1];
      nextCursor = _encodeCursor({ createdAt: last.createdAt, id: last.id });
    }

    return { items, nextCursor };
  },

  /**
   * Unbounded list of all audit-log rows for a given `(targetType, targetId)`,
   * ordered by `(createdAt desc, id desc)`.
   *
   * NOTE: This method does NOT paginate and does NOT cap the result set.
   * Per-resource audit trails are expected to be small (dozens, not millions,
   * of rows per resource over the lifetime of an election cycle), so the
   * per-resource read API can stream everything in one shot. Callers that
   * surface this to end users should be aware that pathological resources
   * (e.g. a long-lived `user` that has been edited thousands of times) will
   * produce a large response. If that becomes a concern, switch to the same
   * cursor-based pagination used by `list()`.
   */
  async listByTarget(
    db: Database,
    targetType: TargetType,
    targetId: string,
    limit?: number,
  ): Promise<AuditLogRow[]> {
    const clampedLimit = clampLimit(limit);
    return (await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.targetType, targetType), eq(auditLog.targetId, targetId)))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(clampedLimit)
      .all()) as AuditLogRow[];
  },
};
