<script lang='ts'>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { getElection, listResults, getVotingState } from '$lib/api/elections'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import type { TElection, TResults } from '$lib/types'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import { ArrowLeft, BarChart3, Info, Trophy, Vote } from 'lucide-svelte'

  let election = $state<TElection | null>(null)
  let results = $state<TResults>([])
  let hasVoted = $state(false)
  let isLoading = $state(true)
  let error = $state('')

  const electionId = $derived(page.params.electionId)

  async function load() {
    if (!electionId) return
    isLoading = true
    error = ''
    try {
      // 1. Fetch election details
      const e = await getElection(electionId)
      election = e

      if (e.status === 'closed' || e.status === 'archived') {
        // Closed/Archived elections are public immediately
        results = await listResults(electionId)
      } else if (e.status === 'open') {
        // Open elections: Check if the user has voted
        const votingState = await getVotingState()
        hasVoted = votingState.myVotes.electionId === electionId && votingState.myVotes.votes.length > 0
        if (hasVoted) {
          results = await listResults(electionId)
        }
      }
    }
    catch (err: unknown) {
      error = extractErrorMessage(err, 'Failed to load election details')
    }
    finally {
      isLoading = false
    }
  }

  async function poll() {
    if (!electionId || election?.status !== 'open' || !hasVoted) return
    try {
      const [res, e] = await Promise.all([
        listResults(electionId),
        getElection(electionId)
      ])
      results = res
      election = e
    } catch (err) {
      // Fail silently (polling is best-effort; errors are expected on temporary network blips)
    }
  }

  // 5-second polling effect for open elections
  $effect(() => {
    if (election?.status !== 'open' || !hasVoted) return

    const intervalId = setInterval(poll, 5000)
    return () => clearInterval(intervalId)
  })

  onMount(load)
</script>

<div class='relative min-h-[100dvh] w-full overflow-hidden bg-slate-900 text-slate-100'>
  <!-- Ambient glow -->
  <div class='pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px]'></div>
  <div class='pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-rose-600/10 blur-[100px]'></div>

  <div class='relative z-10 mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8'>
    <!-- Header -->
    <header class='relative flex flex-col gap-4 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-start sm:justify-between'>
      <div class='space-y-2'>
        {#if election}
          <div class='flex items-center gap-3'>
            <StatusBadge status={election.status} />
            {#if election.status === 'open'}
              <span class='inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-400'>
                <span class='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse'></span>
                Live Polling
              </span>
            {/if}
          </div>
          <h1 class='text-2xl font-black tracking-tight text-slate-50 sm:text-3xl'>{election.name}</h1>
          {#if election.description}
            <p class='text-sm text-slate-400'>{election.description}</p>
          {/if}
        {:else}
          <h1 class='text-2xl font-black tracking-tight text-slate-50 sm:text-3xl'>Election Results</h1>
        {/if}
      </div>

      <div class='flex sm:self-start'>
        <button
          onclick={() => goto('/elections')}
          class='inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 cursor-pointer'
        >
          <ArrowLeft size={16} />
          Back to list
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class='flex-1 space-y-6'>
      {#if isLoading}
        <div class='flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl'>
          <Spinner size={32} />
          <p class='text-slate-400'>Loading election details…</p>
        </div>
      {:else if error}
        <div class='rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center text-red-400 shadow-2xl'>
          <p>{error}</p>
        </div>
      {:else if !election}
        <div class='flex min-h-[40vh] items-center justify-center p-8'>
          <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
            <Info size={48} class='mx-auto mb-4 text-slate-500' />
            <h2 class='text-xl font-bold text-slate-100'>Election not found</h2>
            <p class='mt-2 text-slate-400'>The election you are looking for does not exist or has been deleted.</p>
          </div>
        </div>
      {:else if election.status === 'open' && !hasVoted}
        <!-- Unvoted user view for open election -->
        <div class='flex min-h-[40vh] items-center justify-center p-8'>
          <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl backdrop-blur-xl'>
            <Vote size={48} class='mx-auto mb-4 text-sky-400' />
            <h2 class='text-2xl font-bold text-slate-100'>Voting required</h2>
            <p class='mt-2 text-slate-400'>
              Results for active elections are only visible after you have cast your vote to ensure election fairness.
            </p>
            <button
              onclick={() => goto('/voting')}
              class='mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-500/25 cursor-pointer'
            >
              Go to Voting
            </button>
          </div>
        </div>
      {:else if results.length === 0}
        <div class='rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
          <BarChart3 size={48} class='mx-auto mb-4 text-slate-500' />
          <h2 class='text-xl font-bold text-slate-100'>No votes cast yet</h2>
          <p class='mt-2 text-slate-400'>No ballots have been submitted for this election.</p>
        </div>
      {:else}
        <!-- Display Results -->
        <div class='space-y-6'>
          {#each results as position (position.positionId)}
            {@const sortedCandidates = position.candidates.slice().sort((a, b) => b.voteCount - a.voteCount)}
            {@const winner = sortedCandidates[0]}
            {@const isTie = sortedCandidates.length > 1 && sortedCandidates[0].voteCount === sortedCandidates[1].voteCount}

            <div class='rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl sm:p-8'>
              <!-- Position Header -->
              <div class='mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-4'>
                <div>
                  <h3 class='text-lg font-bold text-slate-100 sm:text-xl'>{position.positionName}</h3>
                  <p class='mt-1 text-xs text-slate-400'>
                    {position.totalVotes} total {position.totalVotes === 1 ? 'vote' : 'votes'}
                  </p>
                </div>
                {#if election.status !== 'open'}
                  {#if !isTie && winner && winner.voteCount > 0}
                    <div class='flex items-center gap-2 rounded-full bg-emerald-500/25 px-3 py-1 border border-emerald-500/30'>
                      <Trophy size={14} class='text-emerald-400' />
                      <span class='text-xs font-semibold text-emerald-300'>{winner.fullName}</span>
                    </div>
                  {:else if isTie && winner && winner.voteCount > 0}
                    <div class='flex items-center gap-2 rounded-full bg-amber-500/25 px-3 py-1 border border-amber-500/30'>
                      <Trophy size={14} class='text-amber-400' />
                      <span class='text-xs font-semibold text-amber-300'>Tie</span>
                    </div>
                  {/if}
                {/if}
              </div>

              <!-- Candidates list -->
              <div class='space-y-4'>
                {#each sortedCandidates as candidate, idx (candidate.candidateId)}
                  {@const isLeading = !isTie && idx === 0 && candidate.voteCount > 0}
                  {@const isTied = isTie && candidate.voteCount === winner?.voteCount && candidate.voteCount > 0}
                  {@const showTrophy = election.status !== 'open' && (isLeading || isTied)}

                  <div class="flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:gap-4 sm:p-5
                    {showTrophy ? 'border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' : 'border-white/5 bg-slate-950/40'}">
                    
                    <div class='min-w-0 flex-1'>
                      <div class='mb-2 flex items-center gap-2'>
                        <h4 class="text-base font-semibold sm:text-lg {showTrophy ? 'text-emerald-300' : 'text-slate-100'}">
                          {candidate.fullName}
                        </h4>
                        {#if showTrophy}
                          <Trophy size={16} class='text-emerald-400' />
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
                          class="h-full rounded-full transition-all duration-300 {showTrophy ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'}"
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
    </main>
  </div>
</div>
