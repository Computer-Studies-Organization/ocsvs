<script lang="ts">
  import type { TElection, TElectionStatus, TElectionTurnout } from '$lib/types'
  import { Users, Vote, Award, Radio, ShieldCheck } from 'lucide-svelte'
  import VoteProgressBar from '$lib/components/ui/vote-progress-bar.svelte'

  let {
    election = null,
    turnout = null,
    totalPositions = 0,
    status,
  }: {
    election?: TElection | null
    turnout?: TElectionTurnout | null
    totalPositions?: number
    status: TElectionStatus
  } = $props()

  const isOpen = $derived(status === 'open')

  const turnoutPercentage = $derived(turnout?.turnoutPercentage ?? null)
  const totalEligible = $derived(turnout?.totalEligibleVoters ?? null)
  const totalBallots = $derived(turnout?.totalBallotsCast ?? null)
  const hasTurnout = $derived(turnoutPercentage !== null)
  const hasBallots = $derived(totalBallots !== null)
  const progressPercentage = $derived(Math.max(0, Math.min(100, turnoutPercentage ?? 0)))
</script>

<div class="space-y-3.5" data-testid="turnout-banner">
  <!-- Status Chip Bar -->
  <div class="flex flex-wrap items-center justify-between gap-2.5">
    {#if isOpen}
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
        <Radio size={14} class="animate-pulse text-emerald-400" />
        Live Unofficial Count (Voting In Progress)
      </div>
    {:else}
      <div class="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
        <ShieldCheck size={14} class="text-sky-400" />
        Official Final Results
      </div>
    {/if}

    {#if election?.closesAt}
      <span class="text-xs text-slate-400">
        {#if isOpen}
          Closes at {new Date(election.closesAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {:else}
          Ended on {new Date(election.closesAt * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        {/if}
      </span>
    {/if}
  </div>

  <!-- Metric Cards Grid -->
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
    <!-- Turnout Rate -->
    <div class="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 shadow-md backdrop-blur">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Voter Turnout</span>
        <div class="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400">
          <Users size={16} />
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-2">
        <span class="text-2xl font-black text-slate-50 sm:text-3xl">{hasTurnout ? `${turnoutPercentage}%` : 'Unavailable'}</span>
        {#if hasTurnout && totalEligible !== null && totalBallots !== null && totalEligible > 0}
          <span class="text-xs text-slate-400">
            ({totalBallots} of {totalEligible})
          </span>
        {/if}
      </div>
      <!-- Turnout Progress Bar -->
      <div class="mt-2.5">
        <VoteProgressBar percentage={progressPercentage} gradient="from-emerald-500 to-teal-400" />
      </div>
    </div>

    <!-- Total Ballots -->
    <div class="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 shadow-md backdrop-blur">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Ballots Cast</span>
        <div class="rounded-lg bg-sky-500/15 p-1.5 text-sky-400">
          <Vote size={16} />
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-2">
        <span class="text-2xl font-black text-slate-50 sm:text-3xl">{hasBallots ? totalBallots : 'Unavailable'}</span>
        <span class="text-xs text-slate-400">{hasBallots ? 'submitted' : 'not available'}</span>
      </div>
      <p class="mt-2 text-[11px] text-slate-500">
        Anonymously cast and verified ballots
      </p>
    </div>

    <!-- Positions Counted -->
    <div class="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 shadow-md backdrop-blur">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Positions</span>
        <div class="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400">
          <Award size={16} />
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-2">
        <span class="text-2xl font-black text-slate-50 sm:text-3xl">{totalPositions}</span>
        <span class="text-xs text-slate-400">contested races</span>
      </div>
      <p class="mt-2 text-[11px] text-slate-500">
        Official student council seats
      </p>
    </div>
  </div>
</div>
