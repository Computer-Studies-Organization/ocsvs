<script lang="ts">
  import { appCache } from '$lib/cache'
  import {
    refreshElectionAndResults,
    refreshResultsAfterClose,
    startResultsPolling,
  } from '$lib/results-polling'
  import type { TPartyList, TElectionStatus, TElectionTurnout, TResults } from '$lib/types'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import { ArrowLeft, BarChart3, ChevronRight } from 'lucide-svelte'
  import ResultsPanel from '$lib/components/results/results-panel.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'

  let { data } = $props()

  const initialElection = $derived(data.election)
  const electionEntry = $derived(
    initialElection ? appCache.get('election', { id: initialElection.id }) : null,
  )
  const election = $derived(electionEntry?.data ?? initialElection)
  const resultsEntry = $derived(
    appCache.get('results', { electionId: election.id })
  )
  const results = $derived<TResults>(resultsEntry.data?.results ?? data.results ?? [])
  const turnout = $derived<TElectionTurnout | null>(resultsEntry.data?.turnout ?? data.turnout ?? null)
  const partyLists = $derived<TPartyList[]>(data.partyLists ?? [])
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
      await refreshElectionAndResults(
        () => electionEntry?.fetch(true),
        () => resultsEntry.fetch(true),
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
      {#if partyLists.length > 0}
        <section class="space-y-4 rounded-3xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-xl backdrop-blur sm:p-7" aria-labelledby="party-platforms-heading">
          <div class="border-b border-slate-800/80 pb-3">
            <h2 id="party-platforms-heading" class="text-lg font-extrabold tracking-tight text-slate-100 sm:text-xl">
              Party Platforms
            </h2>
            <p class="mt-1 text-sm text-slate-400">Read each party's platform and priorities.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            {#each partyLists as party (party.id)}
              <a
                href="/elections/{election.id}/parties/{party.id}"
                class="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 transition hover:border-slate-600 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="rounded-md border px-2 py-0.5 text-[11px] font-bold"
                    style="color: {party.color || '#60A5FA'}; border-color: {party.color || '#334155'}"
                  >
                    {party.code}
                  </span>
                  <span class="font-bold text-slate-100">{party.name}</span>
                </div>
                <p class="mt-2 text-sm leading-relaxed text-slate-400">{party.description || 'View party platform'}</p>
              </a>
            {/each}
          </div>
        </section>
      {/if}

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
