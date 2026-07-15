import { apiFetch, type ApiFetchOptions } from "./client";
import type { AuditLogEntry } from "./audit-log";

export interface ActiveElectionStats {
  id: string;
  name: string;
  opensAt: number | null;
  closesAt: number | null;
  votedCount: number;
  votersCount: number;
  turnoutPct: number;
}

export interface AdminStats {
  votersCount: number;
  electionsCount: number;
  activeElection: ActiveElectionStats | null;
  recentLogs: AuditLogEntry[];
}

export async function fetchAdminStats(options?: ApiFetchOptions): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats", options);
}
