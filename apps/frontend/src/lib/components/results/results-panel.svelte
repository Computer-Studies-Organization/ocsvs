<script lang="ts">
  import type { TElection, TElectionStatus, TElectionTurnout, TResults } from '$lib/types'
  import { BarChart3 } from 'lucide-svelte'
  import CouncilShowcase from './council-showcase.svelte'
  import PositionResultCard from './position-result-card.svelte'
  import TurnoutBanner from './turnout-banner.svelte'

  let {
    election = null,
    results = [],
    turnout = null,
    status,
  }: {
    election?: TElection | null
    results: TResults
    turnout?: TElectionTurnout | null
    status: TElectionStatus
  } = $props()

  const isFinal = $derived(status === 'closed' || status === 'archived')
</script>

<div class="space-y-8">
  <TurnoutBanner {election} {turnout} totalPositions={results.length} {status} />

  <CouncilShowcase {results} {isFinal} electionId={election?.id} />

  <section class="space-y-4" aria-labelledby="results-breakdown-heading">
    <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
      <div class="flex items-center gap-2">
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
          <BarChart3 size={16} />
        </div>
        <h2 id="results-breakdown-heading" class="text-base font-bold tracking-tight text-slate-100 sm:text-lg">
          Race-by-Race Breakdown
        </h2>
      </div>
      <span class="text-xs text-slate-400">Ranked by total votes</span>
    </div>

    <div class="space-y-4 sm:space-y-6">
      {#each results as position (position.positionId)}
        <PositionResultCard {position} {isFinal} electionId={election?.id} />
      {/each}
    </div>
  </section>
</div>
