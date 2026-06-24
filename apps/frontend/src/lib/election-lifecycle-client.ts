import type { TElectionStatus } from "$lib/types";

const TRANSITIONS: ReadonlyArray<readonly [TElectionStatus, TElectionStatus]> = [
  ["draft", "open"],
  ["open", "closed"],
  ["closed", "archived"],
  ["closed", "draft"],
];

export function canTransition(from: TElectionStatus, to: TElectionStatus): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}
