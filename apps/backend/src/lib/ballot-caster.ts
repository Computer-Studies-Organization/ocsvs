import type { Database } from "@/database/repositories/database.type";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { userRepo } from "@/database/repositories/users.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { voteRepo } from "@/database/repositories/votes.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { votes } from "@/database/schema";
import { isUniqueConstraintError } from "@/lib/errors";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export interface BallotSelection {
  candidateId: string;
  positionId: string;
}

export interface CastBallotInput {
  accountId: string; // Account ID of the authenticated Student
  electionId: string; // The Election being voted in
  selections: BallotSelection[]; // Array of selected candidates per position
}

export type BallotCastingError =
  | {
      code: "USER_NOT_FOUND";
      message: typeof ERROR_MESSAGES.USER_NOT_FOUND;
      status: typeof httpStatusCodes.BAD_REQUEST;
    }
  | {
      code: "ELECTION_NOT_FOUND";
      message: typeof ERROR_MESSAGES.ELECTION_NOT_FOUND;
      status: typeof httpStatusCodes.NOT_FOUND;
    }
  | {
      code: "ELECTION_NOT_OPEN";
      message: typeof ERROR_MESSAGES.ELECTION_NOT_OPEN;
      status: typeof httpStatusCodes.CONFLICT;
    }
  | {
      code: "VOTE_ALREADY_CAST";
      message: typeof ERROR_MESSAGES.VOTE_ALREADY_CAST;
      status: typeof httpStatusCodes.CONFLICT;
    }
  | {
      code: "INVALID_CANDIDATE";
      message: typeof ERROR_MESSAGES.INVALID_CANDIDATE;
      status: typeof httpStatusCodes.BAD_REQUEST;
    }
  | {
      code: "CANDIDATE_NOT_FOUND";
      message: typeof ERROR_MESSAGES.CANDIDATE_NOT_FOUND;
      status: typeof httpStatusCodes.NOT_FOUND;
    }
  | {
      code: "DUPLICATE_POSITION_VOTE";
      message: typeof ERROR_MESSAGES.DUPLICATE_POSITION_VOTE;
      status: typeof httpStatusCodes.UNPROCESSABLE_ENTITY;
    };

export interface VoteRecord {
  id: string;
  userId: string | null;
  candidateId: string;
  positionId: string;
  electionId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CastBallotResult {
  votes: VoteRecord[];
}

export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export interface BallotCastingModule {
  cast(db: Database, input: CastBallotInput): Promise<Result<CastBallotResult, BallotCastingError>>;
}

export class DrizzleBallotCaster implements BallotCastingModule {
  async cast(
    db: Database,
    input: CastBallotInput,
  ): Promise<Result<CastBallotResult, BallotCastingError>> {
    const now = Math.floor(Date.now() / 1000);

    try {
      // 1. Resolve student
      const user = await userRepo.findByAccountId(db, input.accountId);
      if (!user) {
        return {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: ERROR_MESSAGES.USER_NOT_FOUND,
            status: httpStatusCodes.BAD_REQUEST,
          },
        };
      }

      // 2. Validate election
      const election = await electionRepo.findById(db, input.electionId);
      if (!election) {
        return {
          success: false,
          error: {
            code: "ELECTION_NOT_FOUND",
            message: ERROR_MESSAGES.ELECTION_NOT_FOUND,
            status: httpStatusCodes.NOT_FOUND,
          },
        };
      }

      if (
        election.status !== "open" ||
        election.opensAt === null ||
        election.closesAt === null ||
        now < election.opensAt ||
        now > election.closesAt
      ) {
        return {
          success: false,
          error: {
            code: "ELECTION_NOT_OPEN",
            message: ERROR_MESSAGES.ELECTION_NOT_OPEN,
            status: httpStatusCodes.CONFLICT,
          },
        };
      }

      // 3. Double-voting check
      const hasVoted = await voteRepo.existsForUserInElection(db, user.id, input.electionId);
      if (hasVoted) {
        return {
          success: false,
          error: {
            code: "VOTE_ALREADY_CAST",
            message: ERROR_MESSAGES.VOTE_ALREADY_CAST,
            status: httpStatusCodes.CONFLICT,
          },
        };
      }

      // 4. Reject empty selections
      if (input.selections.length === 0) {
        return {
          success: false,
          error: {
            code: "INVALID_CANDIDATE",
            message: ERROR_MESSAGES.INVALID_CANDIDATE,
            status: httpStatusCodes.BAD_REQUEST,
          },
        };
      }

      // 5. Resolve and validate candidates
      const candidateIds = input.selections.map((s) => s.candidateId);
      if (candidateIds.length > 0) {
        const activeCandidates = await candidateRepo.findActiveByIds(db, candidateIds);
        if (activeCandidates.size !== candidateIds.length) {
          return {
            success: false,
            error: {
              code: "CANDIDATE_NOT_FOUND",
              message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
              status: httpStatusCodes.NOT_FOUND,
            },
          };
        }

        // 6. Check positional integrity & duplicate votes
        const positionIds = new Set<string>();
        for (const selection of input.selections) {
          const candidate = activeCandidates.get(selection.candidateId);
          if (!candidate || candidate.positionId !== selection.positionId) {
            return {
              success: false,
              error: {
                code: "INVALID_CANDIDATE",
                message: ERROR_MESSAGES.INVALID_CANDIDATE,
                status: httpStatusCodes.BAD_REQUEST,
              },
            };
          }
          if (positionIds.has(selection.positionId)) {
            return {
              success: false,
              error: {
                code: "DUPLICATE_POSITION_VOTE",
                message: ERROR_MESSAGES.DUPLICATE_POSITION_VOTE,
                status: httpStatusCodes.UNPROCESSABLE_ENTITY,
              },
            };
          }
          positionIds.add(selection.positionId);
        }

        // 7. Check that positions belong to the election
        const validPositions = await positionRepo.listByElection(db, input.electionId);
        const validPositionIds = new Set(validPositions.map((p) => p.id));
        for (const pid of positionIds) {
          if (!validPositionIds.has(pid)) {
            return {
              success: false,
              error: {
                code: "INVALID_CANDIDATE",
                message: ERROR_MESSAGES.INVALID_CANDIDATE,
                status: httpStatusCodes.BAD_REQUEST,
              },
            };
          }
        }
      }

      // 8. Atomic transaction
      const recordsToInsert = input.selections.map((sel) => ({
        id: crypto.randomUUID(),
        userId: user.id,
        candidateId: sel.candidateId,
        positionId: sel.positionId,
        electionId: input.electionId,
        createdAt: now,
        updatedAt: now,
      }));

      if (recordsToInsert.length > 0) {
        await db.batch([db.insert(votes).values(recordsToInsert)]);
      }

      // 9. Fetch created votes
      const createdVotes = await voteRepo.findByUserAndElection(db, user.id, input.electionId);

      return {
        success: true,
        data: { votes: createdVotes },
      };
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return {
          success: false,
          error: {
            code: "VOTE_ALREADY_CAST",
            message: ERROR_MESSAGES.VOTE_ALREADY_CAST,
            status: httpStatusCodes.CONFLICT,
          },
        };
      }
      throw err;
    }
  }
}

export class FakeBallotCaster implements BallotCastingModule {
  private simulateError: BallotCastingError | null = null;
  private mockVotes: VoteRecord[] = [];

  setSimulatedError(error: BallotCastingError) {
    this.simulateError = error;
  }

  setMockVotes(votes: VoteRecord[]) {
    this.mockVotes = votes;
  }

  async cast(
    _db: Database,
    _input: CastBallotInput,
  ): Promise<Result<CastBallotResult, BallotCastingError>> {
    if (this.simulateError) {
      return { success: false, error: this.simulateError };
    }
    return {
      success: true,
      data: { votes: this.mockVotes },
    };
  }
}

export const ballotCaster: BallotCastingModule = new DrizzleBallotCaster();
