import { ERROR_MESSAGES } from "./constants/error-messages";
import type { TElectionStatus } from "@/database/schema";

const TRANSITIONS: ReadonlyArray<readonly [TElectionStatus, TElectionStatus]> = [
  ["draft", "open"],
  ["open", "closed"],
  ["closed", "archived"],
  ["closed", "draft"],
];

export type TransitionErrorCode =
  | "INVALID_TRANSITION"
  | "ELECTION_HAS_NO_POSITIONS"
  | "ELECTION_HAS_POSITION_WITHOUT_CANDIDATE"
  | "INVALID_TRANSITION_BODY"
  | "ELECTION_NOT_FOUND"
  | "ANOTHER_ELECTION_IS_OPEN"
  | "ELECTION_TRANSITION_CONFLICT"
  | "ELECTION_NOT_OPEN"
  | "ELECTION_EXTENSION_NOT_LATER"
  | "ELECTION_EXTENSION_CONFLICT"
  | "ELECTION_HAS_BALLOTS"
  | "ELECTION_NOT_IN_DRAFT";

export class TransitionError extends Error {
  readonly code: TransitionErrorCode;
  readonly status: 400 | 404 | 409;
  constructor(code: TransitionErrorCode, status: 400 | 404 | 409) {
    super(ERROR_MESSAGES[code]);
    this.code = code;
    this.status = status;
    this.name = "TransitionError";
  }
}

export function canTransition(from: TElectionStatus, to: TElectionStatus): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function isElectionEditable(status: string): boolean {
  return status === "draft";
}

export interface TransitionBody {
  opensAt?: number;
  closesAt?: number;
}

export interface ElectionTimeWindow {
  status: string;
  opensAt: number | null;
  closesAt: number | null;
}

export function getEffectiveElectionStatus(
  election: ElectionTimeWindow,
  now = Math.floor(Date.now() / 1000),
): TElectionStatus {
  if (election.status !== "open") return election.status as TElectionStatus;
  if (election.opensAt === null || election.closesAt === null) return "draft";
  if (now < election.opensAt) return "draft";
  if (now > election.closesAt) return "closed";
  return "open";
}

export function isElectionCurrentlyOpen(
  election: ElectionTimeWindow,
  now = Math.floor(Date.now() / 1000),
): boolean {
  return getEffectiveElectionStatus(election, now) === "open";
}

export function assertTransition(
  from: TElectionStatus,
  to: TElectionStatus,
  body: TransitionBody,
  positionCount: number,
  positionsWithActiveCandidates = positionCount,
): void {
  if (!canTransition(from, to)) {
    throw new TransitionError("INVALID_TRANSITION", 409);
  }
  if (from === "draft" && to === "open") {
    if (positionCount === 0) {
      throw new TransitionError("ELECTION_HAS_NO_POSITIONS", 409);
    }
    if (positionsWithActiveCandidates !== positionCount) {
      throw new TransitionError("ELECTION_HAS_POSITION_WITHOUT_CANDIDATE", 409);
    }
    const { opensAt, closesAt } = body;
    if (typeof opensAt !== "number" || typeof closesAt !== "number" || closesAt <= opensAt) {
      throw new TransitionError("INVALID_TRANSITION_BODY", 400);
    }
  }
}
