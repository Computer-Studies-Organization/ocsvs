import type { TElection, TElectionStatus } from "$lib/types";

const TRANSITIONS: ReadonlyArray<readonly [TElectionStatus, TElectionStatus]> = [
  ["draft", "open"],
  ["open", "closed"],
  ["closed", "archived"],
  ["closed", "draft"],
];

export function getEffectiveElectionStatus(
  election: Pick<TElection, "status" | "opensAt" | "closesAt">,
  now = Math.floor(Date.now() / 1000),
): TElectionStatus {
  if (election.status !== "open") return election.status;
  if (election.opensAt === null || election.closesAt === null) return "draft";
  if (now < election.opensAt) return "draft";
  if (now > election.closesAt) return "closed";
  return "open";
}

export function canTransition(from: TElectionStatus, to: TElectionStatus): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function toLocalDateTime(timestamp: number | null): string {
  if (timestamp === null) return "";
  const date = new Date(timestamp * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function fromLocalDateTime(value: string): number | null {
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
}
