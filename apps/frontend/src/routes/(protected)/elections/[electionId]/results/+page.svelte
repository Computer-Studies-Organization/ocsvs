<script lang="ts">
  import { appCache } from '$lib/cache'
  import { refreshResultsAfterClose, startResultsPolling } from '$lib/results-polling'
  import type { TElectionStatus, TElectionTurnout, TResults } from '$lib/types'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import { ArrowLeft, BarChart3, ChevronRight } from 'lucide-svelte'
  import ResultsPanel from '$lib/components/results/results-panel.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'

  let { data } = $props()

  const election = $derived(data.election)
  const resultsEntry = $derived(
    appCache.get('results', { electionId: election.id })
  )
  const results = $derived<TResults>(resultsEntry.data?.results ?? data.results ?? [])
  const turnout = $derived<TElectionTurnout | null>(resultsEntry.data?.turnout ?? data.turnout ?? null)
  let now = $state(Math.floor(Date.now() / 1000))
  const effectiveStatus = $derived(getEffectiveElectionStatus(election, now))

  $effect(() => {
    const interval = setInterval(() => {
      now = Math.floor(Date.now() / 1000)
    }, 5000)
    return () => clearInterval(interval)
  })

  async function poll(force = false) {
    if ((!force && effectiveStatus !== 'open') || (!force && document.hidden)) return
    try {
      await resultsEntry.fetch(true)
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
  <title>{election?.name ?? 'Election'} Results | CSO Voting System</title>
</svelte:head>

<div class="min-h-[100dvh] bg-slate-950 text-slate-100">
  <div class="mx-auto max-w-5xl px-3.5 py-4 sm:px-6 sm:py-8">
    <!-- Breadcrumb & Header -->
    <header class="space-y-4 border-b border-slate-800/80 pb-6">
      <nav aria-label="Breadcrumbs" class="flex items-center gap-1.5 text-xs text-slate-400">
        <a
          href="/elections"
          class="transition hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Elections
        </a>
        <ChevronRight size={14} class="text-slate-600" />
        <a
          href="/elections/{election.id}"
          class="truncate max-w-[200px] transition hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:max-w-none"
        >
          {election.name}
        </a>
        <ChevronRight size={14} class="text-slate-600" />
        <span class="font-semibold text-slate-200" aria-current="page">Results</span>
      </nav>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
            {election.name}
          </h1>
        </div>

        <div class="flex items-center gap-2">
          <a
            href="/elections/{election.id}"
            class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-sm backdrop-blur transition hover:border-slate-600 hover:bg-slate-800 hover:text-white sm:text-sm"
          >
            <ArrowLeft size={16} />
            Election Overview
          </a>
        </div>
      </div>
    </header>

    <!-- Main Results Content -->
    <main class="mt-6 space-y-8">
      {#if results.length === 0}
        <EmptyState
          icon={BarChart3}
          title="No results available yet"
          description="Results for this election will appear once votes are cast and tabulated."
          cta="Back to elections"
          oncta={() => (window.location.href = '/elections')}
        />
      {:else}
        <ResultsPanel {election} {results} {turnout} status={effectiveStatus} />
      {/if}
    </main>
  </div>
</div>
