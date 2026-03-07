import type { AppRouteHandler } from '@/lib/types/app-types'
import type {
  getCandidateVoteCountRoute,
  getMyVoteStatusRoute,
  getVoteResultsRoute,
  submitVoteRoute,
  withdrawVoteRoute,
} from '@/routes/votes/routes'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { candidates, users, votes } from '@/database/schema'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const submitVote: AppRouteHandler<typeof submitVoteRoute> = async (c) => {
  const { votes: voteItems } = c.req.valid('json')
  const authUser = c.get('authUser')
  const { db } = createDb(c)

  // Get the user associated with this account
  const user = await db
    .select()
    .from(users)
    .where(eq(users.accountId, authUser.id))
    .get()

  if (!user) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.BAD_REQUEST,
    )
  }

  // Check hasVoted flag first (quick check)
  if (user.hasVoted === 1) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_ALREADY_CAST },
      httpStatusCodes.CONFLICT,
    )
  }

  // Extract candidate IDs
  const candidateIds = voteItems.map(v => v.candidateId)

  // Validate all candidates exist and are active
  const candidatesResult = await db
    .select()
    .from(candidates)
    .where(
      and(
        inArray(candidates.id, candidateIds),
        eq(candidates.isActive, 1),
      ),
    )
    .all()

  if (candidatesResult.length !== candidateIds.length) {
    return c.json(
      { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Check for duplicate positions (user can only vote for one candidate per position)
  const positions = new Set(candidatesResult.map(c => c.position))
  if (positions.size !== candidatesResult.length) {
    return c.json(
      { message: ERROR_MESSAGES.DUPLICATE_POSITION_VOTE },
      httpStatusCodes.UNPROCESSABLE_ENTITY,
    )
  }

  // Double-check no existing votes (in case hasVoted flag is out of sync)
  const existingVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.userId, user.id))
    .all()

  if (existingVotes.length > 0) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_ALREADY_CAST },
      httpStatusCodes.CONFLICT,
    )
  }

  const now = Date.now()
  const insertedVotes: typeof votes.$inferInsert[] = []
  const candidatesById = new Map(candidatesResult.map(candidate => [candidate.id, candidate]))

  // Create vote records
  for (const voteItem of voteItems) {
    const candidate = candidatesById.get(voteItem.candidateId)
    if (!candidate) {
      return c.json(
        { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
        httpStatusCodes.NOT_FOUND,
      )
    }

    const voteId = crypto.randomUUID()
    insertedVotes.push({
      id: voteId,
      userId: user.id,
      candidateId: voteItem.candidateId,
      position: candidate.position,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Insert all votes and update user's hasVoted flag
  // Note: In production with D1, you'd want to use a transaction
  await db.batch([
    db.insert(votes).values(insertedVotes),
    db.update(users)
      .set({ hasVoted: 1, updatedAt: now })
      .where(eq(users.id, user.id)),
  ])

  // Get the created votes
  const createdVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.userId, user.id))
    .all()

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
  const user = await db
    .select()
    .from(users)
    .where(eq(users.accountId, authUser.id))
    .get()

  if (!user) {
    return c.json(
      { hasVoted: false, votes: [] },
      httpStatusCodes.OK,
    )
  }

  // Get all votes for this user
  const userVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.userId, user.id))
    .all()

  const hasVoted = user.hasVoted === 1

  return c.json(
    {
      hasVoted,
      votes: userVotes,
    },
    httpStatusCodes.OK,
  )
}

export const getVoteResults: AppRouteHandler<typeof getVoteResultsRoute> = async (c) => {
  if (c.var.authUser.role !== 'admin') {
    return c.json(
      { message: ERROR_MESSAGES.FORBIDDEN },
      httpStatusCodes.FORBIDDEN,
    )
  }

  const { db } = createDb(c)

  // Get all candidates with their vote counts
  const candidatesWithVotes = await db
    .select({
      candidateId: candidates.id,
      candidateName: candidates.fullName,
      position: candidates.position,
      voteCount: count(votes.id),
    })
    .from(candidates)
    .leftJoin(votes, eq(candidates.id, votes.candidateId))
    .where(eq(candidates.isActive, 1))
    .groupBy(candidates.id, candidates.fullName, candidates.position)
    .orderBy(desc(count(votes.id)))
    .all()

  // Group by position
  const resultsMap = new Map<string, typeof candidatesWithVotes>()
  candidatesWithVotes.forEach((item) => {
    if (!resultsMap.has(item.position)) {
      resultsMap.set(item.position, [])
    }
    resultsMap.get(item.position)!.push(item)
  })

  // Format results
  const results = Array.from(resultsMap.entries()).map(([position, positionCandidates]) => ({
    position,
    candidates: positionCandidates,
  }))

  // Sort positions alphabetically
  results.sort((a, b) => a.position.localeCompare(b.position))

  // Calculate totals
  const totalVotes = candidatesWithVotes.reduce((sum, item) => sum + Number(item.voteCount), 0)

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
  if (c.var.authUser.role !== 'admin') {
    return c.json(
      { message: ERROR_MESSAGES.FORBIDDEN },
      httpStatusCodes.FORBIDDEN,
    )
  }

  const { id } = c.req.valid('param')
  const { db } = createDb(c)

  // Check if candidate exists
  const candidate = await db
    .select()
    .from(candidates)
    .where(and(
      eq(candidates.id, id),
      eq(candidates.isActive, 1),
    ))
    .get()

  if (!candidate) {
    return c.json(
      { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Get vote count for this candidate
  const result = await db
    .select({ voteCount: count() })
    .from(votes)
    .where(eq(votes.candidateId, id))
    .get()

  const voteCount = result?.voteCount ?? 0

  return c.json(
    {
      candidateId: id,
      candidateName: candidate.fullName,
      position: candidate.position,
      voteCount,
    },
    httpStatusCodes.OK,
  )
}

export const withdrawVote: AppRouteHandler<typeof withdrawVoteRoute> = async (c) => {
  const authUser = c.get('authUser')
  const { db } = createDb(c)

  // Get the user associated with this account
  const user = await db
    .select()
    .from(users)
    .where(eq(users.accountId, authUser.id))
    .get()

  if (!user) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.BAD_REQUEST,
    )
  }

  // Check if user has voted
  const existingVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.userId, user.id))
    .all()

  if (existingVotes.length === 0) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  const now = Date.now()

  // Delete all votes for this user and reset hasVoted flag
  await db.batch([
    db.delete(votes).where(eq(votes.userId, user.id)),
    db.update(users)
      .set({ hasVoted: 0, updatedAt: now })
      .where(eq(users.id, user.id)),
  ])

  return c.json(
    { message: ERROR_MESSAGES.VOTE_WITHDRAWN_SUCCESSFULLY },
    httpStatusCodes.OK,
  )
}
