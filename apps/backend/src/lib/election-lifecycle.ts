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
  | "INVALID_TRANSITION_BODY"
  | "ELECTION_NOT_FOUND"
  | "ANOTHER_ELECTION_IS_OPEN"
  | "ELECTION_TRANSITION_CONFLICT";

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

export interface TransitionBody {
  opensAt?: number;
  closesAt?: number;
}

export function assertTransition(
  from: TElectionStatus,
  to: TElectionStatus,
  body: TransitionBody,
  positionCount: number,
): void {
  if (!canTransition(from, to)) {
    throw new TransitionError("INVALID_TRANSITION", 409);
  }
  if (from === "draft" && to === "open") {
    if (positionCount === 0) {
      throw new TransitionError("ELECTION_HAS_NO_POSITIONS", 409);
    }
    const { opensAt, closesAt } = body;
    if (typeof opensAt !== "number" || typeof closesAt !== "number" || closesAt <= opensAt) {
      throw new TransitionError("INVALID_TRANSITION_BODY", 400);
    }
  }
}
