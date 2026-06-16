import type { AppRouteHandler } from '@/lib/types/app-types'
import type {
  getCandidateVoteCountRoute,
  getMyVoteStatusRoute,
  getVoteResultsRoute,
  submitVoteRoute,
} from '@/routes/votes/routes'
import { eq } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { candidateRepo } from '@/database/repositories/candidates.repository'
import { userRepo } from '@/database/repositories/users.repository'
import { voteRepo } from '@/database/repositories/votes.repository'
import { positions, votes } from '@/database/schema'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const submitVote: AppRouteHandler<typeof submitVoteRoute> = async (c) => {
  const { electionId, votes: voteItems } = c.req.valid('json')
  const authUser = c.get('authUser')
  const { db } = createDb(c)

  // Get the user associated with this account
  const user = await userRepo.findByAccountId(db, authUser.id)

  if (!user) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.BAD_REQUEST,
    )
  }

  // Source of truth for "has voted" is the votes table (unique index on
  // (user_id, position_id, election_id)). The legacy users.has_voted column
  // is gone.
  const hasExistingVotes = await voteRepo.existsForUserInElection(db, user.id, electionId)

  if (hasExistingVotes) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_ALREADY_CAST },
      httpStatusCodes.CONFLICT,
    )
  }

  // Extract candidate IDs
  const candidateIds = voteItems.map(v => v.candidateId)

  // Batch validate all candidates are active
  const candidateMap = await candidateRepo.findActiveByIds(db, candidateIds)
  if (candidateMap.size !== candidateIds.length) {
    return c.json(
      { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Defensive check: the request body says (candidateId, positionId) per vote,
  // and the database row for that candidate must carry the same positionId.
  // This catches a client mistake without a round-trip; the DB unique index
  // `(user_id, position_id, election_id)` is the source of truth.
  const positions = new Set<string>()
  for (const voteItem of voteItems) {
    const candidate = candidateMap.get(voteItem.candidateId)
    if (!candidate || candidate.positionId !== voteItem.positionId) {
      return c.json(
        { message: ERROR_MESSAGES.INVALID_CANDIDATE },
        httpStatusCodes.BAD_REQUEST,
      )
    }
    if (positions.has(candidate.positionId)) {
      return c.json(
        { message: ERROR_MESSAGES.DUPLICATE_POSITION_VOTE },
        httpStatusCodes.UNPROCESSABLE_ENTITY,
      )
    }
    positions.add(candidate.positionId)
  }

  const now = Math.floor(Date.now() / 1000)
  const insertedVotes: typeof votes.$inferInsert[] = voteItems.map((voteItem) => {
    const voteId = crypto.randomUUID()
    return {
      id: voteId,
      userId: user.id,
      candidateId: voteItem.candidateId,
      positionId: voteItem.positionId,
      electionId,
      createdAt: now,
      updatedAt: now,
    }
  })

  // Atomic insert. The (user_id, position_id, election_id) unique index on
  // `votes` prevents double-voting per position; an attempt to vote twice will
  // surface as a unique-constraint violation from libSQL.
  await db.batch([
    db.insert(votes).values(insertedVotes),
  ])

  // Get the created votes
  const createdVotes = await voteRepo.findByUserId(db, user.id)

  return c.json(
    {
      message: ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY,
      votes: createdVotes,
    },
    httpStatusCodes.OK,
  )
}

export const getMyVoteStatus: AppRouteHandler<typeof getMyVoteStatusRoute> = async (c) => {
  const authUser = c.get('authUser')
  const { db } = createDb(c)

  // Get the user associated with this account
  const user = await userRepo.findByAccountId(db, authUser.id)

  if (!user) {
    return c.json(
      { electionId: null, votes: [] },
      httpStatusCodes.OK,
    )
  }

  // Get all votes for this user. electionId is derived from the first vote's
  // election_id; null if the user has not voted.
  const userVotes = await voteRepo.findByUserId(db, user.id)
  const electionId = userVotes.length > 0 ? userVotes[0].electionId : null

  return c.json(
    {
      electionId,
      votes: userVotes.map(v => ({
        candidateId: v.candidateId,
        positionId: v.positionId,
      })),
    },
    httpStatusCodes.OK,
  )
}

export const getVoteResults: AppRouteHandler<typeof getVoteResultsRoute> = async (c) => {
  const { db } = createDb(c)

  // Get all active candidates with their vote counts via repository
  const candidatesWithVotes = await candidateRepo.listWithVoteCount(db)

  // Group by position
  const resultsMap = new Map<string, {
    positionId: string
    positionName: string
    candidates: { candidateId: string, candidateName: string, positionId: string, positionName: string, voteCount: number }[]
  }>()
  candidatesWithVotes.forEach((item) => {
    const arr = resultsMap.get(item.positionId) ?? {
      positionId: item.positionId,
      positionName: item.positionName,
      candidates: [],
    }
    arr.candidates.push(item)
    resultsMap.set(item.positionId, arr)
  })

  // Format results
  const results = Array.from(resultsMap.values())

  // Sort positions by name for stable output
  results.sort((a, b) => a.positionName.localeCompare(b.positionName))

  // Calculate totals
  const totalVotes = candidatesWithVotes.reduce(
    (sum, item) => sum + Number(item.voteCount),
    0,
  )

  return c.json(
    {
      results,
      meta: {
        totalVotes,
        totalPositions: results.length,
      },
    },
    httpStatusCodes.OK,
  )
}

export const getCandidateVoteCount: AppRouteHandler<typeof getCandidateVoteCountRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const { db } = createDb(c)

  // Check if candidate exists (active or inactive — count includes both)
  const candidate = await candidateRepo.getForAdminView(db, id, { includeInactive: true })
  if (!candidate) {
    return c.json(
      { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Look up the position name for the response
  const position = await db
    .select({ name: positions.name })
    .from(positions)
    .where(eq(positions.id, candidate.positionId))
    .get()

  // Get vote count for this candidate
  const voteCount = await voteRepo.countByCandidateId(db, id)

  return c.json(
    {
      candidateId: id,
      candidateName: candidate.fullName,
      positionId: candidate.positionId,
      positionName: position?.name ?? '',
      voteCount,
    },
    httpStatusCodes.OK,
  )
}
