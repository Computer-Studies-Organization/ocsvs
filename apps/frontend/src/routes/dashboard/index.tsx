import type React from 'react'
import type { TCandidate, TPositionGroup } from '@/@types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Loader2Icon,
  LockKeyhole,
  LogOut,
  Settings,
  Shield,
  Undo2,
  Vote,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { UserRole } from '@/@types'
import { useAllCandidates } from '@/data'
import { useLogoutUserMutation, UserData } from '@/hooks/userHooks'
import { useMyVotesQuery, useSubmitVotesMutation } from '@/hooks/voteHooks'
import { useToast } from '@/lib/toast'
import { ProtectedRoute } from '@/middleware'
import { POSITIONS } from '../admin-dashboard'

export const Route = createFileRoute('/dashboard/')({
  component: () => (
    <ProtectedRoute>
      <RouteComponent />
    </ProtectedRoute>
  ),
})

function RouteComponent() {
  const candidates = useAllCandidates()
  const userData = UserData()
  const navigate = useNavigate()
  const logoutUserMutation = useLogoutUserMutation()
  const submitVotesMutation = useSubmitVotesMutation()
  const { data: voteStatus } = useMyVotesQuery()
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { showToast } = useToast()

  const hasVoted = voteStatus?.hasVoted ?? false

  const positionGroups = useMemo<TPositionGroup[]>(() => {
    const candidatesByPositionMap = new Map<string, TCandidate[]>()

    candidates.forEach((candidate) => {
      const positionName = candidate.position || 'Unknown'
      const candidatesForPosition = candidatesByPositionMap.get(positionName) ?? []
      candidatesForPosition.push(candidate)
      candidatesByPositionMap.set(positionName, candidatesForPosition)
    })

    // Create position groups from the map
    const groupedPositions = Array.from(candidatesByPositionMap.entries()).map(
      ([positionName, candidatesForPosition]) => ({
        id: positionName.toLowerCase().replace(/\s+/g, '-'),
        title: positionName,
        description: positionName,
        candidates: candidatesForPosition,
      }),
    )

    // Sort positions according to POSITIONS array order
    return groupedPositions.sort((positionGroupA, positionGroupB) => {
      const positionIndexA = POSITIONS.findIndex(pos => pos.value === positionGroupA.title)
      const positionIndexB = POSITIONS.findIndex(pos => pos.value === positionGroupB.title)

      // If position is not in POSITIONS array, put it at the end
      if (positionIndexA === -1 && positionIndexB === -1)
        return 0
      if (positionIndexA === -1)
        return 1
      if (positionIndexB === -1)
        return -1

      return positionIndexA - positionIndexB
    })
  }, [candidates])

  const [selectedCandidateIdsByPositionId, setSelectedCandidateIdsByPositionId] = useState<Record<string, string | null>>(() => {
    return positionGroups.reduce(
      (accumulator: Record<string, string | null>, positionGroup: TPositionGroup) => ({
        ...accumulator,
        [positionGroup.id]: null,
      }),
      {} as Record<string, string | null>,
    )
  })

  const [currentPositionIndex, setCurrentPositionIndex] = useState(0)

  const currentPositionGroup = positionGroups[currentPositionIndex]
  const isFirstPosition = currentPositionIndex === 0
  const isLastPosition = currentPositionIndex === positionGroups.length - 1
  const hasCurrentPositionVote = currentPositionGroup ? selectedCandidateIdsByPositionId[currentPositionGroup.id] !== null : false

  const handleSelectCandidate = (positionId: string, candidateId: string) => {
    if (hasVoted)
      return // Prevent selection if already voted
    setSelectedCandidateIdsByPositionId(previousVotes => ({ ...previousVotes, [positionId]: candidateId }))
  }

  const handleSubmitVotes = async () => {
    setIsLoading(true)
    const candidateIds = Object.values(selectedCandidateIdsByPositionId).filter(
      (id): id is string => id !== null,
    )

    try {
      await submitVotesMutation.mutateAsync(candidateIds)
      showToast({ message: 'Votes submitted successfully! Your selections have been saved.', type: 'success' })
      setTimeout(() => {
        navigate({ to: '/dashboard/my-ballot' })
      }, 2000)
    }
    catch (error) {
      console.error('Failed to submit votes:', error)
      showToast({ message: 'Failed to submit votes. Please try again.', type: 'error' })
    }
    setIsLoading(false)
  }

  const areAllPositionsVoted = positionGroups.every(
    (positionGroup: TPositionGroup) => selectedCandidateIdsByPositionId[positionGroup.id] !== null,
  )

  const handleLogoutUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await logoutUserMutation.mutateAsync()
  }

  return (
    <>
      {(isLoading || submitVotesMutation.isPending) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <Loader2Icon className="animate-spin text-blue-400" size={40} />
        </div>
      )}

      <div className="min-h-[100dvh] bg-slate-950/95">
        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500" />

        {/* Background glow */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 left-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-6 md:px-6 lg:px-8">
          {/* HEADER */}
          <header className="relative mb-5 flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4">
            <div className="space-y-3">
              <div>
                {hasVoted
                  ? (
                      <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/90">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                        Voting completed
                      </p>
                    )
                  : (
                      <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/90">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                        Secure voting session
                      </p>
                    )}
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                  Official Student Ballot
                </h1>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                  Digital Voting System
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 w-95 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
                <p className="text-sm text-slate-200">
                  Welcome,
                  {' '}
                  <span className="font-semibold text-slate-50">
                    {userData?.user?.username || 'Voter'}
                  </span>
                </p>
                {hasVoted
                  ? (
                      <p className="mt-1 text-xs text-emerald-400">
                        <span className="font-semibold">Voting completed!</span>
                        {' '}
                        You have already submitted your ballot. View your selections in
                        {' '}
                        <button
                          onClick={() => navigate({ to: '/dashboard/my-ballot' })}
                          className="font-semibold text-emerald-300 underline hover:text-emerald-200"
                        >
                          My Ballot
                        </button>
                        .
                      </p>
                    )
                  : (
                      <p className="mt-1 text-xs text-slate-400">
                        Please review each position carefully and select
                        {' '}
                        <span className="font-semibold text-slate-200">one nominee per role</span>
                        .
                        You can change your choices anytime before submitting your ballot.
                      </p>
                    )}
              </div>
            </div>

            {/* Settings / profile */}
            <div className="absolute right-0 flex items-start justify-end">
              <div className="relative">
                <button
                  onClick={() => setIsSettingsOpen(prev => !prev)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-300 shadow-sm shadow-slate-900/60 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-50"
                >
                  <Settings size={18} />
                </button>

                {isSettingsOpen && (
                  <div className="absolute z-50 right-0 top-11 w-60 rounded-xl border border-slate-800/80 bg-slate-950/95 p-1.5 text-sm text-slate-100 shadow-xl shadow-slate-950/70 backdrop-blur">
                    <div className="px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Account
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-200">
                        {userData?.user?.username || 'Authenticated voter'}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-slate-800/80" />

                    {userData?.user?.role === UserRole.ADMIN && (
                      <button
                        onClick={() => navigate({ to: '/admin-dashboard' })}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 hover:bg-slate-900/90"
                      >
                        <span>Admin Dashboard</span>
                        <Shield size={18} className="text-amber-300" />
                      </button>
                    )}

                    <button
                      onClick={() => navigate({ to: '/settings' })}
                      className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 hover:bg-slate-900/90"
                    >
                      <span>Profile Settings</span>
                      <Settings size={18} className="text-sky-400" />
                    </button>

                    <button
                      onClick={() => navigate({ to: '/dashboard/my-ballot' })}
                      className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 hover:bg-slate-900/90"
                    >
                      <span>My Ballot</span>
                      <Vote size={18} className="text-sky-400" />
                    </button>

                    <div className="my-1 h-px bg-slate-800/80" />

                    <form onSubmit={handleLogoutUser} method="post">
                      <button
                        disabled={logoutUserMutation.isPending}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-400 hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>Logout</span>
                        <LogOut size={16} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-slate-800/60 bg-gradient-to-r from-slate-900/90 to-slate-800/50 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Completed
                </span>
                <span className="mt-1 text-2xl font-bold text-emerald-400">
                  {Object.values(selectedCandidateIdsByPositionId).filter(Boolean).length}
                </span>
                <span className="text-[10px] text-slate-500">
                  of
                  {' '}
                  {positionGroups.length}
                  {' '}
                  positions
                </span>
              </div>
            </div>
            <div className="h-12 w-px bg-slate-700/50" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Remaining
              </span>
              <span className="mt-1 text-2xl font-bold text-sky-400">
                {positionGroups.length - Object.values(selectedCandidateIdsByPositionId).filter(Boolean).length}
              </span>
              <span className="text-[10px] text-slate-500">
                positions to vote
              </span>
            </div>
          </div>

          {/* CONTENT */}
          <main className="grid flex-1 gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
            <section className="flex min-h-[60vh] flex-col rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/60 backdrop-blur">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
                    Position
                    {' '}
                    {currentPositionIndex + 1}
                    {' '}
                    of
                    {' '}
                    {positionGroups.length}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
                    {currentPositionGroup?.title || ''}
                  </h2>
                  <p className="max-w-xl text-xs text-slate-400">
                    {currentPositionGroup?.description || ''}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {hasCurrentPositionVote && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Choice saved
                    </span>
                  )}
                </div>
              </div>

              {/* CANDIDATES */}
              <div className="space-y-3">
                {currentPositionGroup?.candidates.map((candidate: TCandidate) => {
                  const isCandidateSelected
                    = selectedCandidateIdsByPositionId[currentPositionGroup.id] === candidate.id

                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      disabled={hasVoted}
                      onClick={() =>
                        handleSelectCandidate(currentPositionGroup.id, candidate.id)}
                      className={`group flex w-full items-start justify-between gap-4 rounded-xl border px-4 py-4 text-left transition-all ${hasVoted
                        ? 'cursor-not-allowed opacity-60 border-slate-800/80 bg-slate-900/80'
                        : isCandidateSelected
                          ? 'border-sky-400/80 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
                          : 'border-slate-800/80 bg-slate-900/80 hover:border-sky-500/60 hover:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold text-slate-50">
                          {candidate.fullName}
                        </p>
                        <p className="text-[11px] -mt-1.5 sm:text-xs text-slate-400">
                          {candidate.position}
                        </p>
                        <p className="text-[11px] italic text-slate-300/85">
                          "
                          {candidate.manifesto}
                          "
                        </p>
                      </div>

                      {isCandidateSelected && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                          Voted
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Navigation actions */}
              <div className="mt-auto pt-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!isFirstPosition && (
                    <button
                      type="button"
                      disabled={hasVoted}
                      onClick={() => setCurrentPositionIndex(previousIndex => previousIndex - 1)}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition ${hasVoted
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <Undo2 size={18} />
                      Previous position
                    </button>
                  )}

                  {!isLastPosition
                    ? (
                        <button
                          type="button"
                          disabled={!hasCurrentPositionVote || hasVoted}
                          onClick={() => setCurrentPositionIndex(previousIndex => previousIndex + 1)}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${hasCurrentPositionVote && !hasVoted
                            ? 'bg-sky-500 text-white shadow-md shadow-sky-500/40 hover:bg-sky-600'
                            : 'cursor-not-allowed bg-slate-800 text-slate-500'
                          }`}
                        >
                          Next position
                          <ArrowRight size={18} />
                        </button>
                      )
                    : (
                        <button
                          type="button"
                          disabled={!areAllPositionsVoted || submitVotesMutation.isPending || hasVoted}
                          onClick={handleSubmitVotes}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${areAllPositionsVoted && !submitVotesMutation.isPending && !hasVoted
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40 hover:bg-emerald-600'
                            : 'cursor-not-allowed bg-slate-800 text-slate-500'
                          }`}
                        >
                          {submitVotesMutation.isPending
                            ? (
                                <>
                                  <Loader2Icon className="animate-spin" size={18} />
                                  Submitting...
                                </>
                              )
                            : hasVoted
                              ? (
                                  'Already Voted'
                                )
                              : (
                                  'Submit ballot'
                                )}
                        </button>
                      )}
                </div>

                <div className="mt-3 text-center text-[11px] text-slate-500">
                  {hasVoted
                    ? (
                        <span className="text-emerald-400">
                          Voting is complete. You can view your ballot in
                          {' '}
                          <button
                            onClick={() => navigate({ to: '/dashboard/my-ballot' })}
                            className="font-semibold text-emerald-300 underline hover:text-emerald-200"
                          >
                            My Ballot
                          </button>
                          .
                        </span>
                      )
                    : isLastPosition
                      ? (
                          'Review your selections. You can see a full summary in My Ballot before final submission.'
                        )
                      : (
                          'You must select a nominee to continue to the next position.'
                        )}
                </div>
              </div>
            </section>

            {/* Right: Summary / info */}
            <aside className="flex flex-col gap-3">
              <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 text-xs text-slate-300 shadow-lg shadow-slate-950/60 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Voting guidelines
                </p>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span>
                      Select
                      {' '}
                      <span className="font-semibold text-slate-100">one nominee</span>
                      {' '}
                      for each position.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span>
                      You can review and change your selections before submitting your ballot.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span>
                      Once submitted, your ballot is
                      {' '}
                      <span className="font-semibold text-slate-100">final</span>
                      {' '}
                      and cannot be changed.
                    </span>
                  </li>
                  {hasVoted && (
                    <li className="flex items-start gap-2">
                      <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="text-amber-300">
                        <span className="font-semibold">You have already voted.</span>
                        {' '}
                        Voting is now disabled.
                      </span>
                    </li>
                  )}
                </ul>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
                  <LockKeyhole size={14} />
                  <p>
                    All votes are confidential and securely recorded by the system.
                  </p>
                </div>
              </section>
            </aside>
          </main>

          {/* FOOTER */}
          <footer className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-[10px] text-slate-500 sm:flex-row">
            <div className="flex items-center gap-2">
              <LockKeyhole size={11} />
              <span>Session secured and monitored to prevent duplicate voting.</span>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
