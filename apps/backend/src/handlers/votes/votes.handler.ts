import type { AppRouteHandler } from '@/lib/types/app-types'
import type {
  getCandidateVoteCountRoute,
  getMyVoteStatusRoute,
  getVoteResultsRoute,
  submitVoteRoute,
  withdrawVoteRoute,
} from '@/routes/votes/routes'
import { eq } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { candidateRepo } from '@/database/repositories/candidates.repository'
import { userRepo } from '@/database/repositories/users.repository'
import { voteRepo } from '@/database/repositories/votes.repository'
import { users, votes } from '@/database/schema'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const submitVote: AppRouteHandler<typeof submitVoteRoute> = async (c) => {
  const { votes: voteItems } = c.req.valid('json')
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

  // Check hasVoted flag first (quick check)
  if (user.hasVoted === 1) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_ALREADY_CAST },
      httpStatusCodes.CONFLICT,
    )
  }

  // Extract candidate IDs
  const candidateIds = voteItems.map((v: { candidateId: string }) => v.candidateId)

  // Batch validate all candidates are active
  const candidateMap = await candidateRepo.findActiveByIds(db, candidateIds)
  if (candidateMap.size !== candidateIds.length) {
    return c.json(
      { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Check for duplicate positions (user can only vote for one candidate per position)
  const positions = new Set<string>()
  for (const candidate of candidateMap.values()) {
    if (positions.has(candidate.position)) {
      return c.json(
        { message: ERROR_MESSAGES.DUPLICATE_POSITION_VOTE },
        httpStatusCodes.UNPROCESSABLE_ENTITY,
      )
    }
    positions.add(candidate.position)
  }

  // Double-check no existing votes (in case hasVoted flag is out of sync)
  const hasExistingVotes = await voteRepo.existsForUser(db, user.id)

  if (hasExistingVotes) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_ALREADY_CAST },
      httpStatusCodes.CONFLICT,
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const insertedVotes: typeof votes.$inferInsert[] = []

  // Create vote records
  for (const voteItem of voteItems) {
    const candidate = candidateMap.get(voteItem.candidateId)
    if (!candidate) {
      // Defensive: should not happen given earlier check
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

  // Insert all votes and update user's hasVoted flag (atomic D1 batch)
  await db.batch([
    db.insert(votes).values(insertedVotes),
    db.update(users)
      .set({ hasVoted: 1, updatedAt: now })
      .where(eq(users.id, user.id)),
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
      { hasVoted: false, votes: [] },
      httpStatusCodes.OK,
    )
  }

  // Get all votes for this user
  const userVotes = await voteRepo.findByUserId(db, user.id)

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
  const { db } = createDb(c)

  // Get all active candidates with their vote counts via repository
  const candidatesWithVotes = await candidateRepo.listWithVoteCount(db)

  // Group by position
  const resultsMap = new Map<string, { candidateId: string, candidateName: string, position: string, voteCount: number }[]>()
  candidatesWithVotes.forEach((item: { candidateId: string, candidateName: string, position: string, voteCount: number }) => {
    const arr = resultsMap.get(item.position) || []
    arr.push(item)
    resultsMap.set(item.position, arr)
  })

  // Format results
  const results = Array.from(resultsMap.entries()).map(([position, positionCandidates]) => ({
    position,
    candidates: positionCandidates,
  }))

  // Sort positions alphabetically
  results.sort((a, b) => a.position.localeCompare(b.position))

  // Calculate totals
  const totalVotes = candidatesWithVotes.reduce(
    (sum: number, item: { candidateId: string, candidateName: string, position: string, voteCount: number }) =>
      sum + Number(item.voteCount),
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

  // Check if candidate exists and is active; we also need fullName
  const candidate = await candidateRepo.getForAdminView(db, id)
  if (!candidate) {
    return c.json(
      { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Get vote count for this candidate
  const voteCount = await voteRepo.countByCandidateId(db, id)

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
  const user = await userRepo.findByAccountId(db, authUser.id)

  if (!user) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.BAD_REQUEST,
    )
  }

  // Check if user has voted
  const hasExistingVotes = await voteRepo.existsForUser(db, user.id)

  if (!hasExistingVotes) {
    return c.json(
      { message: ERROR_MESSAGES.VOTE_NOT_FOUND },
      httpStatusCodes.NOT_FOUND,
    )
  }

  const now = Math.floor(Date.now() / 1000)

  // Delete all votes for this user and reset hasVoted flag (atomic D1 batch)
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
