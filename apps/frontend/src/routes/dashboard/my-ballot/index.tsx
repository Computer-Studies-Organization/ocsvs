import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ProtectedRoute } from '@/middleware'
import { useAllCandidates } from '@/data'
import { ArrowRight, CheckCircle2, Loader2Icon, LockKeyhole } from 'lucide-react'
import { useMyVotesQuery } from '@/hooks/voteHooks'
import { useMemo } from 'react'
import type { TCandidate } from '@/@types'

export const Route = createFileRoute('/dashboard/my-ballot/')({
  component: () => (
    <ProtectedRoute>
      <MyBallotComponent />
    </ProtectedRoute>
  ),
})

function MyBallotComponent() {
  const navigate = useNavigate()
  const candidates = useAllCandidates()
  const { data: voteStatus, isLoading, isError } = useMyVotesQuery()

  // Match votes with candidate data and group by position
  const votesWithCandidates = useMemo(() => {
    if (!voteStatus?.votes || !candidates.length) return []

    return voteStatus.votes
      .map((vote) => {
        const candidate = candidates.find((c) => c.id === vote.candidateId)
        return candidate ? { vote, candidate } : null
      })
      .filter((item): item is { vote: typeof voteStatus.votes[0]; candidate: TCandidate } => item !== null)
      .sort((a, b) => {
        // Sort by position name
        return a.candidate.position.localeCompare(b.candidate.position)
      })
  }, [voteStatus?.votes, candidates])

  // Group by position
  const votesByPosition = useMemo(() => {
    const grouped = new Map<string, typeof votesWithCandidates>()
    
    votesWithCandidates.forEach((item) => {
      const position = item.candidate.position
      const existing = grouped.get(position) || []
      grouped.set(position, [...existing, item])
    })

    return Array.from(grouped.entries()).map(([position, votes]) => ({
      position,
      votes,
    }))
  }, [votesWithCandidates])

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950/95 flex items-center justify-center">
        <Loader2Icon className="animate-spin text-blue-400" size={40} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-[100dvh] bg-slate-950/95 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load your ballot</p>
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const hasVotes = voteStatus?.hasVoted && votesWithCandidates.length > 0

  return (
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
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                My Ballot
              </h1>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Your Voting Summary
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
              <p className="text-sm text-slate-200">
                {hasVotes
                  ? `You have voted for ${votesWithCandidates.length} position${votesWithCandidates.length > 1 ? 's' : ''}`
                  : 'You have not submitted any votes yet'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 md:px-4 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <ArrowRight size={18} />
            <span className="hidden md:inline">Back to Dashboard</span>
          </button>
        </header>

        {/* CONTENT */}
        <main>
          {!hasVotes ? (
            <section className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-lg shadow-slate-950/60 backdrop-blur">
              <div className="text-center space-y-4">
                <p className="text-lg text-slate-400">You haven't voted yet.</p>
                <p className="text-sm text-slate-500">
                  Go to the voting dashboard to cast your votes.
                </p>
                <button
                  onClick={() => navigate({ to: '/dashboard' })}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-600 transition"
                >
                  Go to Voting Dashboard
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              {votesByPosition.map(({ position, votes }) => (
                <div
                  key={position}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/60 backdrop-blur"
                >
                  <div className="mb-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
                      Position
                    </p>
                    <h2 className="text-lg font-semibold text-slate-50 sm:text-xl mt-1">
                      {position}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {votes.map(({ vote, candidate }) => (
                      <div
                        key={vote.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="text-emerald-400" size={20} />
                            <p className="text-sm font-semibold text-slate-50">
                              {candidate.fullName}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {candidate.position}
                          </p>
                          <p className="text-[11px] italic text-slate-300/85">
                            "{candidate.manifesto}"
                          </p>
                        </div>

                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                          Your Vote
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </main>

        {/* FOOTER */}
        <footer className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-slate-800/80 pt-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-2">
            <LockKeyhole size={11} />
            <span>Your votes are confidential and securely recorded.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
