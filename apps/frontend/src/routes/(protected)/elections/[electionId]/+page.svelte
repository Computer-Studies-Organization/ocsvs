<script lang='ts'>
  import { appCache } from '$lib/cache'
  import {
    refreshElectionAndResults,
    refreshResultsAfterClose,
    startResultsPolling,
  } from '$lib/results-polling'
  import type { TElectionStatus, TElectionTurnout, TResults } from '$lib/types'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import { ArrowLeft, BarChart3, Info, Vote } from 'lucide-svelte'
  import ResultsPanel from '$lib/components/results/results-panel.svelte'

  let { data } = $props()
  const initialElection = $derived(data.election)
  const electionEntry = $derived(
    initialElection ? appCache.get('election', { id: initialElection.id }) : null,
  )
  const election = $derived(electionEntry?.data ?? initialElection)
  const resultsEntry = $derived(
    election ? appCache.get('results', { electionId: election.id }) : null,
  )
  const results = $derived<TResults>(resultsEntry?.data?.results ?? data.results ?? [])
  const turnout = $derived<TElectionTurnout | null>(resultsEntry?.data?.turnout ?? data.turnout ?? null)
  const hasVoted = $derived(data.hasVoted)
  let now = $state(Math.floor(Date.now() / 1000))
  const effectiveStatus = $derived(getEffectiveElectionStatus(election, now))

  $effect(() => {
    const interval = setInterval(() => {
      now = Math.floor(Date.now() / 1000)
    }, 5000)
    return () => clearInterval(interval)
  })

  async function poll(force = false) {
    if (!force && (effectiveStatus !== 'open' || document.hidden)) return
    try {
      await refreshElectionAndResults(
        () => electionEntry?.fetch(true),
        () => (force || hasVoted ? resultsEntry?.fetch(true) : undefined),
      )
    } catch {
      // Fail silently (polling is best-effort)
    }
  }

  let previousEffectiveStatus: TElectionStatus | null = null

  $effect(() => {
    const status = effectiveStatus
    previousEffectiveStatus = refreshResultsAfterClose(
      previousEffectiveStatus,
      status,
      () => poll(true),
    )

    if (status !== 'open') return

    return startResultsPolling(() => poll(), () => status === 'open')
  })
</script>

<svelte:head>
  <title>{election ? `${election.name} | Results` : 'Election Detail'} | CSO Voting System</title>
</svelte:head>

<div class='w-full mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8'>
  <!-- Header -->
  <header class='relative flex flex-col gap-4 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-start sm:justify-between'>
    <div class='space-y-2'>
      <div class='flex items-center gap-3'>
        <StatusBadge status={effectiveStatus} />
        {#if effectiveStatus === 'open'}
          <span class='inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-400'>
            <span class='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse'></span>
            Live Polling
          </span>
        {/if}
      </div>
      <h1 class='text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl'>{election.name}</h1>
      {#if election.description}
        <p class='text-sm text-slate-400'>{election.description}</p>
      {/if}
    </div>

    <div class='flex sm:self-start'>
      <a
        href='/elections'
        class='inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700'
      >
        <ArrowLeft size={16} />
        Back to list
      </a>
    </div>
  </header>

  <!-- Main Content Area -->
  <main class='flex-1 space-y-8'>
    {#if !election}
      <div class='flex min-h-[40vh] items-center justify-center p-4 sm:p-8'>
        <div class='w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 sm:p-8 text-center shadow-2xl'>
          <Info size={48} class='mx-auto mb-4 text-slate-500' />
          <h2 class='text-xl font-bold text-slate-100'>Election not found</h2>
          <p class='mt-2 text-sm text-slate-400'>The election you are looking for does not exist or has been deleted.</p>
        </div>
      </div>
    {:else if effectiveStatus === 'open' && !hasVoted}
      <!-- Unvoted user view for open election -->
      <div class='flex min-h-[40vh] items-center justify-center p-4 sm:p-8'>
        <div class='w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl'>
          <Vote size={48} class='mx-auto mb-4 text-sky-400' />
          <h2 class='text-xl sm:text-2xl font-bold text-slate-100'>Voting required</h2>
          <p class='mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed'>
            Results for active elections are only visible after you have cast your vote to ensure election fairness.
          </p>
          <a
            href='/voting'
            class='mt-6 min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-500/25 active:scale-95'
          >
            Go to Voting
          </a>
        </div>
      </div>
    {:else if results.length === 0}
      <div class='rounded-2xl border border-white/10 bg-slate-900/80 p-6 sm:p-8 text-center shadow-2xl'>
        <BarChart3 size={48} class='mx-auto mb-4 text-slate-500' />
        <h2 class='text-xl font-bold text-slate-100'>No votes cast yet</h2>
        <p class='mt-2 text-sm text-slate-400'>No ballots have been submitted for this election.</p>
      </div>
    {:else}
      <ResultsPanel {election} {results} {turnout} status={effectiveStatus} />
    {/if}
  </main>
</div>
