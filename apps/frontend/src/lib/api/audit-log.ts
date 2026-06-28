import { apiFetch } from "./client";

export interface AuditLogEntry {
  id: string;
  createdAt: number;
  action: string;
  targetType: "election" | "position" | "candidate" | "user";
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
