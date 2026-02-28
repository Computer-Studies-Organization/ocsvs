import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ArrowRight, BarChart3, Loader2Icon, Trophy } from 'lucide-react'
import { useVoteResultsQuery } from '@/hooks/voteHooks'
import { UserData } from '@/hooks/userHooks'

export const Route = createFileRoute('/admin-dashboard/view-results/')({
  component: RouteComponent,
})

function RouteComponent() {
  const userData = UserData()
  const navigate = useNavigate()
  const { data: resultsData, isLoading, isError } = useVoteResultsQuery()

  const results = useMemo(() => {
    if (!resultsData?.results || !Array.isArray(resultsData.results)) {
      return []
    }
    return resultsData.results
  }, [resultsData])

  // Calculate percentages for each candidate
  const resultsWithPercentages = useMemo(() => {
    return results.map((positionResult) => {
      const totalVotes = positionResult.candidates.reduce(
        (sum, candidate) => sum + candidate.voteCount,
        0
      )

      const candidatesWithPercentages = positionResult.candidates.map((candidate) => {
        const percentage = totalVotes > 0 
          ? Math.round((candidate.voteCount / totalVotes) * 100 * 100) / 100 
          : 0
        
        return {
          ...candidate,
          percentage,
        }
      })

      // Sort by vote count descending
      candidatesWithPercentages.sort((a, b) => b.voteCount - a.voteCount)

      return {
        ...positionResult,
        candidates: candidatesWithPercentages,
        totalVotes,
      }
    })
  }, [results])

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-900">
      {/* Background orbs - same as admin dashboard */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-red-600/20 blur-[100px]" />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        {/* Header */}
        <header className="relative flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4">
          <div className="space-y-3">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                Election Results
              </p>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                Vote Results
              </h1>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Real-time Election Statistics
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
              <p className="text-sm text-slate-200">
                Welcome,{' '}
                <span className="font-semibold text-slate-50">
                  {userData?.user?.username || 'Admin'}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                View detailed vote counts and percentages for each candidate by position.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="absolute right-0 flex items-start justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: '/admin-dashboard' })}
              className={cn(
                'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg',
                'bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-slate-500/80 focus:ring-offset-2 focus:ring-offset-slate-900',
                'transition-all duration-150'
              )}
              aria-label="Back to Admin Dashboard"
            >
              <div className='flex items-center gap-1.5'>
                <ArrowRight size={16} />
              </div>
            </button>
          </div>
        </header>

        {/* Statistics Summary */}
        {resultsData?.meta && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/20 p-2">
                  <BarChart3 className="text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Total Votes</p>
                  <p className="text-xl font-bold text-slate-50">{resultsData.meta.totalVotes}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/20 p-2">
                  <Trophy className="text-emerald-400" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Positions</p>
                  <p className="text-xl font-bold text-slate-50">{resultsData.meta.totalPositions}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 space-y-6">
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
              <div className="flex items-center justify-center gap-3">
                <Loader2Icon className="animate-spin text-blue-400" size={24} />
                <p className="text-sm sm:text-base text-slate-400">
                  Loading results...
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-8 shadow-2xl">
              <p className="text-sm sm:text-base text-red-400 text-center">
                Failed to load results. Please try again later.
              </p>
            </div>
          ) : resultsWithPercentages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
              <p className="text-sm sm:text-base text-slate-400 text-center">
                No results available yet. Votes will appear here once the election begins.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {resultsWithPercentages.map((positionResult, index) => {
                const winner = positionResult.candidates[0] // First candidate (sorted by votes)
                const isTie = positionResult.candidates.length > 1 && 
                  positionResult.candidates[0].voteCount === positionResult.candidates[1].voteCount

                return (
                  <div
                    key={`${positionResult.position}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-2xl"
                  >
                    <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4 gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-md sm:text-xl font-bold text-slate-100">
                          {positionResult.position}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {positionResult.totalVotes} total {positionResult.totalVotes === 1 ? 'vote' : 'votes'}
                        </p>
                      </div>
                      {!isTie && winner && winner.voteCount > 0 && (
                        <div className="flex-shrink-0 flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1">
                          <Trophy className="text-emerald-400" size={16} />
                          <span className="text-xs sm:text-sm font-medium text-emerald-300">
                            {winner.candidateName}
                          </span>
                        </div>
                      )}
                      {isTie && (
                        <div className="flex-shrink-0 flex items-center gap-2 rounded-full bg-yellow-500/20 px-3 py-1">
                          <Trophy className="text-yellow-400" size={16} />
                          <span className="text-xs sm:text-sm font-medium text-yellow-300">
                            Tie
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {positionResult.candidates.map((candidate, candidateIndex) => {
                        const isWinner = !isTie && candidateIndex === 0 && candidate.voteCount > 0
                        const isTied = isTie && candidate.voteCount === winner?.voteCount

                        return (
                          <div
                            key={candidate.candidateId}
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border p-4 sm:p-5 transition-all",
                              isWinner || isTied
                                ? "border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                                : "border-white/10 bg-slate-900/40"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className={cn(
                                  "text-base sm:text-lg font-semibold",
                                  isWinner || isTied ? "text-emerald-300" : "text-slate-100"
                                )}>
                                  {candidate.candidateName}
                                </h4>
                                {(isWinner || isTied) && (
                                  <Trophy className="text-emerald-400" size={18} />
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-400">
                                <span>
                                  <span className="font-semibold text-slate-300">{candidate.voteCount}</span> votes
                                </span>
                                <span>
                                  <span className="font-semibold text-slate-300">{candidate.percentage}%</span> of total
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full sm:w-48 flex-shrink-0">
                              <div className="mb-1 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                                <span>Vote percentage</span>
                                <span className="font-semibold text-slate-100">
                                  {candidate.percentage}%
                                </span>
                              </div>
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    isWinner || isTied
                                      ? "bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400"
                                      : "bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
                                  )}
                                  style={{
                                    width: `${Math.min(100, Math.max(0, candidate.percentage))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
