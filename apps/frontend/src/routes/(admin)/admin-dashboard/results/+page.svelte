<script lang='ts'>
  import type { TVoteCount, TVoteResults, TVoteResultsResponse } from '$lib/types'
  import { goto } from '$app/navigation'
  import { getVoteResults } from '$lib/api/votes'
  import { authStore } from '$lib/stores/auth'
  import { ArrowLeft, BarChart3, Loader, Trophy } from 'lucide-svelte'
  import { onMount } from 'svelte'

  interface CandidateWithPct extends TVoteCount { percentage: number }
  interface PositionResult extends TVoteResults {
    candidates: CandidateWithPct[]
    totalVotes: number
  }

  let resultsData = $state<TVoteResultsResponse | null>(null)
  let isLoading = $state(true)
  let isError = $state(false)

  const user = $derived($authStore.user)

  const resultsWithPercentages = $derived.by<PositionResult[]>(() => {
    if (!resultsData?.results)
      return []
    return resultsData.results.map((pos) => {
      const totalVotes = pos.candidates.reduce((s, c) => s + c.voteCount, 0)
      const withPct = pos.candidates.map(c => ({
        ...c,
        percentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 10000) / 100 : 0,
      })).sort((a, b) => b.voteCount - a.voteCount)
      return { ...pos, candidates: withPct, totalVotes }
    })
  })

  onMount(async () => {
    try {
      resultsData = await getVoteResults()
    }
    catch {
      isError = true
    }
    finally {
      isLoading = false
    }
  })
</script>

<div class='relative min-h-[100dvh] w-full overflow-hidden bg-slate-900 text-slate-100'>
  <!-- Ambient glow -->
  <div class='pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-blue-600/20 blur-[100px]'></div>
  <div class='pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-rose-600/20 blur-[100px]'></div>

  <div class='relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8'>
    <!-- Header -->
    <header class='relative flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4'>
      <div class='space-y-3'>
        <div>
          <p class='inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/90'>
            <span class='h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]'></span>
            Election Results
          </p>
        </div>
        <div>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl'>Vote Results</h1>
          <p class='mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500'>Real-time Election Statistics</p>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <p class='text-sm text-slate-200'>Welcome, <span class='font-semibold text-slate-50'>{user?.user?.username || 'Admin'}</span></p>
          <p class='mt-1 text-xs text-slate-400'>View detailed vote counts and percentages for each candidate by position.</p>
        </div>
      </div>

      <div class='absolute right-0'>
        <button
          onclick={() => goto('/admin-dashboard')}
          class='inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 cursor-pointer'
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
    </header>

    <!-- Summary -->
    {#if resultsData?.meta}
      <div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <div class='flex items-center gap-3'>
            <div class='rounded-lg bg-blue-500/20 p-2'><BarChart3 size={20} class='text-blue-400' /></div>
            <div>
              <p class='text-xs uppercase tracking-wide text-slate-400'>Total Votes</p>
              <p class='text-xl font-bold text-slate-50'>{resultsData.meta.totalVotes}</p>
            </div>
          </div>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <div class='flex items-center gap-3'>
            <div class='rounded-lg bg-emerald-500/20 p-2'><Trophy size={20} class='text-emerald-400' /></div>
            <div>
              <p class='text-xs uppercase tracking-wide text-slate-400'>Positions</p>
              <p class='text-xl font-bold text-slate-50'>{resultsData.meta.totalPositions}</p>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Results -->
    <div class='flex-1 space-y-6'>
      {#if isLoading}
        <div class='flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl'>
          <Loader class='animate-spin text-blue-400' size={24} />
          <p class='text-slate-400'>Loading results…</p>
        </div>
      {:else if isError}
        <div class='rounded-2xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-xl'>
          <p class='text-center text-red-400'>Failed to load results. Please try again later.</p>
        </div>
      {:else if resultsWithPercentages.length === 0}
        <div class='rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl'>
          <p class='text-center text-slate-400'>No results available yet. Votes will appear here once the election begins.</p>
        </div>
      {:else}
        <div class='space-y-8'>
          {#each resultsWithPercentages as pos (pos.position)}
            {@const winner = pos.candidates[0]}
            {@const isTie = pos.candidates.length > 1 && pos.candidates[0].voteCount === pos.candidates[1].voteCount}
            <div class='rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8'>
              <!-- Position header -->
              <div class='mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-4'>
                <div class='min-w-0 flex-1'>
                  <h3 class='text-md font-bold text-slate-100 sm:text-xl'>{pos.position}</h3>
                  <p class='mt-1 text-xs text-slate-400'>{pos.totalVotes} total {pos.totalVotes === 1 ? 'vote' : 'votes'}</p>
                </div>
                {#if !isTie && winner && winner.voteCount > 0}
                  <div class='flex flex-shrink-0 items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1'>
                    <Trophy size={16} class='text-emerald-400' />
                    <span class='text-xs font-medium text-emerald-300 sm:text-sm'>{winner.candidateName}</span>
                  </div>
                {:else if isTie}
                  <div class='flex flex-shrink-0 items-center gap-2 rounded-full bg-yellow-500/20 px-3 py-1'>
                    <Trophy size={16} class='text-yellow-400' />
                    <span class='text-xs font-medium text-yellow-300 sm:text-sm'>Tie</span>
                  </div>
                {/if}
              </div>

              <!-- Candidates -->
              <div class='space-y-4'>
                {#each pos.candidates as candidate, i (candidate.candidateId)}
                  {@const isWinner = !isTie && i === 0 && candidate.voteCount > 0}
                  {@const isTied = isTie && candidate.voteCount === winner?.voteCount}
                  <div class="flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:gap-4 sm:p-5
                    {isWinner || isTied ? 'border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' : 'border-white/10 bg-slate-900/40'}">
                    <div class='min-w-0 flex-1'>
                      <div class='mb-2 flex items-center gap-2'>
                        <h4 class="text-base font-semibold sm:text-lg {isWinner || isTied ? 'text-emerald-300' : 'text-slate-100'}">
                          {candidate.candidateName}
                        </h4>
                        {#if isWinner || isTied}
                          <Trophy size={18} class='text-emerald-400' />
                        {/if}
                      </div>
                      <div class='flex items-center gap-4 text-xs text-slate-400 sm:text-sm'>
                        <span><span class='font-semibold text-slate-300'>{candidate.voteCount}</span> votes</span>
                        <span><span class='font-semibold text-slate-300'>{candidate.percentage}%</span> of total</span>
                      </div>
                    </div>
                    <!-- Progress bar -->
                    <div class='w-full flex-shrink-0 sm:w-48'>
                      <div class='mb-1 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs'>
                        <span>Vote percentage</span>
                        <span class='font-semibold text-slate-100'>{candidate.percentage}%</span>
                      </div>
                      <div class='h-2.5 w-full overflow-hidden rounded-full bg-slate-800'>
                        <div
                          class="h-full rounded-full transition-all duration-300 {isWinner || isTied ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'}"
                          style='width: {Math.min(100, Math.max(0, candidate.percentage))}%'
                        ></div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
