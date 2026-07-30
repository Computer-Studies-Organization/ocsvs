import { apiFetch } from "./client";

export const AUDIT_ACTIONS = [
  "election.create",
  "election.update",
  "election.transition",
  "position.create",
  "position.update",
  "position.delete",
  "candidate.create",
  "candidate.update",
  "candidate.deactivate",
  "party.create",
  "party.update",
  "party.delete",
  "user.update",
  "user.create",
  "user.bulk_import",
  "user.soft_delete",
  "user.restore",
  "user.hard_delete",
  "user.unlock",
] as const;

export const AUDIT_TARGET_TYPES = ["election", "position", "candidate", "party", "user"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export interface AuditLogEntry {
  id: string;
  createdAt: number;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  actorAccountIdSnapshot: string;
  actorUsernameSnapshot: string;
  description: string | null;
}

export interface AuditLogFilters {
  action?: string;
  targetType?: string;
  targetId?: string;
  actorId?: string;
  since?: number;
  until?: number;
  cursor?: string;
  limit?: number;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

export function getAuditTargetFallbackName(
  entry: Pick<AuditLogEntry, "targetType" | "targetId" | "description">,
): string {
  if (entry.targetType !== "party" || !entry.description) {
    return entry.targetId;
  }

  const partySnapshot = /party '(.+?)' \(([^)]+)\)/.exec(entry.description);
  return partySnapshot ? `${partySnapshot[1]} (${partySnapshot[2]})` : entry.targetId;
}

export async function fetchAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (filters.action) params.append("action", filters.action);
  if (filters.targetType) params.append("targetType", filters.targetType);
  if (filters.targetId) params.append("targetId", filters.targetId);
  if (filters.actorId) params.append("actorId", filters.actorId);
  if (filters.since !== undefined) params.append("since", String(filters.since));
  if (filters.until !== undefined) params.append("until", String(filters.until));
  if (filters.cursor) params.append("cursor", filters.cursor);
  if (filters.limit !== undefined) params.append("limit", String(filters.limit));

  const qs = params.toString();
  return apiFetch<AuditLogResponse>(`/audit-log${qs ? `?${qs}` : ""}`);
}
