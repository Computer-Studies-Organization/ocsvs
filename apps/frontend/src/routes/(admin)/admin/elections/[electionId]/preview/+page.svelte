<script lang='ts'>
  import {
    createVotingState,
    getSelectedCount,
    type TStepperPosition,
    type TStepperVotingState,
  } from '$lib/voting-stepper-logic'
  import { buildStepperPositions } from '$lib/voting-page-state'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { TCandidate, TPartyList, TPosition } from '$lib/types'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import BallotStepper from '$lib/components/ui/ballot-stepper.svelte'
  import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Eye,
    Info,
    RotateCcw,
  } from 'lucide-svelte'

  let { data } = $props()
  const election = $derived(data.election)
  const rawPositions = $derived<TPosition[]>(data.positions || [])
  const rawCandidates = $derived<TCandidate[]>(data.candidates || [])
  const partyLists = $derived<TPartyList[]>(data.partyLists || [])

  const displayStatus = $derived(getEffectiveElectionStatus(election))

  // Inactive candidates are excluded from active voter stepper
  const activeCandidates = $derived(rawCandidates.filter((c) => c.isActive !== 0))
  const stepperPositions = $derived<TStepperPosition[]>(
    buildStepperPositions(rawPositions, activeCandidates),
  )

  // Empty positions pre-flight diagnostic (positions with no active candidates)
  const emptyPositions = $derived(
    rawPositions.filter(
      (p) => !activeCandidates.some((c) => c.positionId === p.id),
    ),
  )

  let voting = $state<TStepperVotingState>(createVotingState([]))
  let simulationCompleted = $state(false)

  // Initialize/re-initialize voting state when stepper positions change
  $effect.pre(() => {
    voting = createVotingState(stepperPositions)
  })

  function updateVoting(next: TStepperVotingState) {
    voting = next
  }

  function notifyParty(party: TPartyList) {
    addToast('info', `Fast-filled candidates for ${party.name} slate (Simulation)`)
  }

  function resetPreview() {
    voting = createVotingState(stepperPositions)
    simulationCompleted = false
    addToast('info', 'Ballot preview reset')
  }

  function handleSimulatedSubmit() {
    simulationCompleted = true
    addToast('success', 'Ballot simulation completed successfully!')
  }

</script>

<svelte:head>
  <title>Preview: {election.name} | CSO Admin</title>
</svelte:head>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100 pb-16'>
  <!-- Header / Navigation Bar -->
  <div class='border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30'>
    <div class='mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3'>
      <div class='flex items-center gap-3 flex-wrap'>
        <a
          href={`/admin/elections/${election.id}`}
          class='inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors'
        >
          <ArrowLeft size={16} />
          Back to election
        </a>
        <span class='text-slate-600'>|</span>
        <span class='text-sm font-bold text-slate-200 truncate max-w-xs sm:max-w-md'>{election.name}</span>
        <StatusBadge status={displayStatus} />
      </div>

      <div class='flex items-center gap-2'>
        <button
          type='button'
          onclick={resetPreview}
          aria-label='Reset preview selections'
          class='inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer'
        >
          <RotateCcw size={14} />
          Reset ballot
        </button>
      </div>
    </div>
  </div>

  <div class='mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6'>
    <!-- Preview Context Banner -->
    <div
      class="flex items-start gap-3 rounded-2xl border p-4 shadow-lg {displayStatus === 'draft' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : displayStatus === 'open' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-700/60 bg-slate-900/50 text-slate-300'}"
    >
      <Eye size={20} class='mt-0.5 shrink-0' />
      <div class='space-y-1 text-xs sm:text-sm'>
        <p class='font-bold uppercase tracking-wider text-[11px]'>
          {#if displayStatus === 'draft'}
            Draft Ballot Preview
          {:else if displayStatus === 'open'}
            Live Ballot Preview
          {:else}
            Historical Ballot Archive
          {/if}
          &bull; Sandbox Mode
        </p>
        <p class='opacity-90 leading-relaxed'>
          You are previewing the exact voter ballot interface. All selections made here are strictly client-side—no votes will be submitted or recorded in the database.
        </p>
      </div>
    </div>

    <!-- Pre-Flight Diagnostic Warning for Empty Positions -->
    {#if emptyPositions.length > 0}
      <div class='flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-200 text-xs sm:text-sm shadow-md'>
        <AlertCircle size={20} class='mt-0.5 shrink-0 text-rose-400' />
        <div class='space-y-1'>
          <p class='font-bold text-rose-300'>
            Pre-Flight Warning: {emptyPositions.length} {emptyPositions.length === 1 ? 'position has' : 'positions have'} no active candidates
          </p>
          <p class='text-rose-200/80 leading-relaxed'>
            The voter stepper automatically skips empty positions. The following position{emptyPositions.length === 1 ? '' : 's'} will not appear to voters on the ballot:
            <span class='font-semibold text-rose-100'>{emptyPositions.map((p) => p.name).join(', ')}</span>.
          </p>
        </div>
      </div>
    {/if}

    {#if stepperPositions.length === 0}
      <!-- Empty Ballot State -->
      <div class='rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center shadow-xl'>
        <Info size={48} class='mx-auto mb-4 text-slate-500' />
        <h2 class='text-xl font-bold text-slate-100'>No active ballot positions</h2>
        <p class='mt-2 text-sm text-slate-400 max-w-md mx-auto'>
          This election does not yet have any positions with active candidates to preview. Add positions and assign candidates in election management.
        </p>
        <a
          href={`/admin/elections/${election.id}`}
          class='mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-500/25'
        >
          Manage election positions
        </a>
      </div>
    {:else if simulationCompleted}
      <!-- Simulation Completion Screen -->
      <div class='rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-md space-y-6'>
        <div class='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'>
          <CheckCircle2 size={36} />
        </div>

        <div class='space-y-2'>
          <h2 class='text-2xl font-bold text-slate-100'>Ballot Simulation Complete!</h2>
          <p class='text-sm text-slate-400 max-w-lg mx-auto'>
            All ballot steps and selections were successfully completed. In live voting, this ballot would now be anonymously recorded in the database.
          </p>
        </div>

        <div class='rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left max-w-md mx-auto space-y-2'>
          <p class='text-xs font-mono font-bold uppercase tracking-wider text-slate-500'>Simulation Summary</p>
          <div class='text-xs text-slate-300 space-y-1.5'>
            <p>&bull; Positions evaluated: <span class='font-bold text-slate-100'>{stepperPositions.length}</span></p>
            <p>&bull; Candidates selected: <span class='font-bold text-emerald-400'>{getSelectedCount(voting)}</span></p>
            <p>&bull; Election status: <span class='font-bold text-slate-100 uppercase'>{displayStatus}</span></p>
          </div>
        </div>

        <div class='flex flex-wrap items-center justify-center gap-3 pt-2'>
          <button
            type='button'
            onclick={resetPreview}
            class='min-h-11 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-500/25 cursor-pointer'
          >
            <RotateCcw size={16} />
            Restart simulation
          </button>
          <a
            href={`/admin/elections/${election.id}`}
            class='min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white'
          >
            Back to management
          </a>
        </div>
      </div>
    {:else}
      <BallotStepper
        positions={stepperPositions}
        {partyLists}
        electionId={election.id}
        {voting}
        compact
        showStepLabel
        openPartyPlatformInNewTab
        onvotingchange={updateVoting}
        onapplyparty={notifyParty}
        onsubmit={handleSimulatedSubmit}
      />
    {/if}
  </div>
</div>
