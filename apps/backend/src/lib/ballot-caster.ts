import type { BatchItem } from "drizzle-orm/batch";
import type { Database, DbClient } from "@/database/repositories/database.type";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { electionRepo } from "@/database/repositories/election.repository";
import { voteRepo } from "@/database/repositories/votes.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { ballotSnapshots, voterElectionParticipation, votes } from "@/database/schema";
import { isUniqueConstraintError } from "@/lib/errors";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { decodeHmacSecret } from "@/middleware/env";

export const PARTICIPATION_TIMESTAMP_SENTINEL = 0;

export async function computeLegacyVoterHash(
  electionId: string,
  studentId: string | undefined,
): Promise<string> {
  const identifier = (studentId ?? "").trim().toLowerCase();
  if (!identifier) {
    throw new Error("studentId must be a non-empty string for voter hash computation");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`voter-hash:${electionId}:${identifier}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeVoterHash(
  electionId: string,
  studentId: string | undefined,
  hmacSecret: string,
): Promise<string> {
  const identifier = (studentId ?? "").trim().toLowerCase();
  if (!identifier) {
    throw new Error("studentId must be a non-empty string for voter hash computation");
  }
  const decodedKey = decodeHmacSecret(hmacSecret);
  const keyData = new Uint8Array(decodedKey);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"],
  );
  const data = encoder.encode(`voter-hash:${electionId}:${identifier}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `v1:${hexHash}`;
}

export async function computeVoterParticipationHashes(
  electionId: string,
  studentId: string | undefined,
  hmacSecret: string,
  previousHmacSecrets: string[] = [],
): Promise<string[]> {
  const hashes = [await computeVoterHash(electionId, studentId, hmacSecret)];
  hashes.push(
    ...(await Promise.all(
      previousHmacSecrets.map((secret) => computeVoterHash(electionId, studentId, secret)),
    )),
  );
  // Keep matching pre-HMAC participation rows until their records naturally age out.
  hashes.push(await computeLegacyVoterHash(electionId, studentId));
  return hashes;
}

export function normalizePreviousHmacSecrets(raw: unknown): string[] {
  if (typeof raw === "string")
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return Array.isArray(raw)
    ? raw.filter((secret): secret is string => typeof secret === "string")
    : [];
}

export async function hasVoterParticipated(
  db: DbClient,
  electionId: string,
  studentId: string | undefined,
  hmacSecret: string | undefined,
  previousHmacSecrets: string[] = [],
  legacyUserId?: string,
): Promise<boolean> {
  const hasLegacyLink = legacyUserId
    ? voteRepo.existsForUserInElection(db, legacyUserId, electionId)
    : Promise.resolve(false);
  if (!hmacSecret || !studentId?.trim()) return hasLegacyLink;
  const hashes = await computeVoterParticipationHashes(
    electionId,
    studentId,
    hmacSecret,
    previousHmacSecrets,
  );
  const [hasParticipation, legacyLink] = await Promise.all([
    voteRepo.hasVoterHashParticipated(db, electionId, hashes),
    hasLegacyLink,
  ]);
  return hasParticipation || legacyLink;
}

export interface BallotSelection {
  candidateId: string;
  positionId: string;
}

export interface CastBallotInput {
  accountId: string; // Account ID of the authenticated Student
  electionId: string; // The Election being voted in
  selections: BallotSelection[]; // Array of selected candidates per position
  hmacSecret: string; // Secret key for HMAC voter hash
  previousHmacSecrets?: string[]; // Previous secrets for key rotation support
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
    }
  | {
      code: "INCOMPLETE_BALLOT";
      message: typeof ERROR_MESSAGES.INCOMPLETE_BALLOT;
      status: typeof httpStatusCodes.BAD_REQUEST;
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

export class DrizzleBallotCaster {
  // Kept on Database because db.batch is used internally (which cannot compose/run on a transaction handle).
  async cast(
    db: Database,
    input: CastBallotInput,
  ): Promise<Result<CastBallotResult, BallotCastingError>> {
    const now = Math.floor(Date.now() / 1000);

    try {
      // 1. Resolve student
      const user = await voterAccountStore.findByAccountId(db, input.accountId);
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

      // 3. New ballots use durable participation; the legacy link guard remains
      // until the operator backfill has converted old rows.
      const hashesToCheck = user.studentId?.trim()
        ? await computeVoterParticipationHashes(
            input.electionId,
            user.studentId,
            input.hmacSecret,
            input.previousHmacSecrets,
          )
        : [];
      const [hasLegacyLink, hasParticipated] = await Promise.all([
        // Compatibility guard until the operator backfill has converted legacy links.
        voteRepo.existsForUserInElection(db, user.id, input.electionId),
        hashesToCheck.length > 0
          ? voteRepo.hasVoterHashParticipated(db, input.electionId, hashesToCheck)
          : Promise.resolve(false),
      ]);

      if (hasLegacyLink || hasParticipated) {
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
        const [activeCandidates, validPositions] = await Promise.all([
          candidateRepo.findActiveByIds(db, candidateIds),
          positionRepo.listByElection(db, input.electionId),
        ]);
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

        if (positionIds.size !== validPositionIds.size) {
          return {
            success: false,
            error: {
              code: "INCOMPLETE_BALLOT",
              message: ERROR_MESSAGES.INCOMPLETE_BALLOT,
              status: httpStatusCodes.BAD_REQUEST,
            },
          };
        }
      }

      if (!user.studentId?.trim()) {
        return {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: ERROR_MESSAGES.USER_NOT_FOUND,
            status: httpStatusCodes.BAD_REQUEST,
          },
        };
      }

      // 8. Atomic transaction
      const recordsToInsert = input.selections.map((sel) => ({
        id: crypto.randomUUID(),
        // Legacy nullable column retained for compatibility; new ballots are anonymous at write time.
        userId: null,
        candidateId: sel.candidateId,
        positionId: sel.positionId,
        electionId: input.electionId,
        createdAt: now,
        updatedAt: now,
      }));

      if (recordsToInsert.length > 0) {
        const snapshotId = crypto.randomUUID();
        // NOTE: The ballot_snapshots and voter_election_participation inserts are kept atomic
        // with the votes insert inside db.batch. The votes_require_open_election trigger also
        // enforces the election window at the write boundary. The voter_election_participation
        // unique constraint (idx_voter_election_participation_unique) enforces durable
        // double-vote prevention even across user hard-deletes.
        const batchStatements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
          db.insert(votes).values(recordsToInsert),
          db.insert(ballotSnapshots).values({ id: snapshotId, electionId: input.electionId }),
        ];

        const currentHash = hashesToCheck[0];
        if (currentHash) {
          batchStatements.push(
            db.insert(voterElectionParticipation).values({
              id: crypto.randomUUID(),
              electionId: input.electionId,
              voterHash: currentHash,
              // Never persist ballot timing beside an identity-derived hash.
              createdAt: PARTICIPATION_TIMESTAMP_SENTINEL,
            }),
          );
        }

        await db.batch(batchStatements);
      }

      return {
        success: true,
        data: { votes: recordsToInsert },
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("ELECTION_NOT_OPEN")) {
        return {
          success: false,
          error: {
            code: "ELECTION_NOT_OPEN",
            message: ERROR_MESSAGES.ELECTION_NOT_OPEN,
            status: httpStatusCodes.CONFLICT,
          },
        };
      }
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

export const ballotCaster = new DrizzleBallotCaster();
