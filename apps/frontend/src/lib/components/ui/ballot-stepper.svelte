<script lang='ts'>
  import {
    allPositionsVoted,
    clearSelection,
    getSelectedCount,
    goNext,
    goPrevious,
    isReviewStep,
    selectCandidate,
    selectPartySlate,
    type TStepperPosition,
    type TStepperVotingState,
  } from '$lib/voting-stepper-logic'
  import type { TPartyList } from '$lib/types'
  import { Flag, X, Zap } from 'lucide-svelte'
  import VotingCandidateCard from './voting-candidate-card.svelte'
  import BallotReview from './ballot-review.svelte'
  import StepperNavigation from './stepper-navigation.svelte'
  import StepperProgress from './stepper-progress.svelte'

  let {
    electionId,
    positions,
    partyLists,
    voting,
    isSubmitting = false,
    compact = false,
    showStepLabel = false,
    openPartyPlatformInNewTab = false,
    onvotingchange,
    onapplyparty = () => {},
    onsubmit,
  }: {
    electionId: string
    positions: TStepperPosition[]
    partyLists: TPartyList[]
    voting: TStepperVotingState
    isSubmitting?: boolean
    compact?: boolean
    showStepLabel?: boolean
    openPartyPlatformInNewTab?: boolean
    onvotingchange: (voting: TStepperVotingState) => void
    onapplyparty?: (party: TPartyList) => void
    onsubmit: () => void
  } = $props()

  const totalPositions = $derived(positions.length)
  const isReview = $derived(isReviewStep(voting, totalPositions))
  const currentPosition = $derived(positions[voting.currentPositionIndex])

  function selectAt(positionId: string, candidateId: string) {
    onvotingchange(selectCandidate(voting, positionId, candidateId))
  }

  function clearAt(positionId: string) {
    onvotingchange(clearSelection(voting, positionId))
  }

  function applyParty(party: TPartyList) {
    onvotingchange(selectPartySlate(voting, positions, party.id))
    onapplyparty(party)
  }

  function next() {
    onvotingchange(goNext(voting, totalPositions))
  }

  function previous() {
    onvotingchange(goPrevious(voting))
  }

  function goToPosition(idx: number) {
    onvotingchange({ ...voting, currentPositionIndex: idx })
  }
</script>

<div class={compact ? 'space-y-6' : ''}>
  {#if partyLists.length > 0}
    <div class={compact ? 'rounded-2xl border border-sky-500/20 bg-sky-950/20 p-3.5 sm:p-4 backdrop-blur-md' : 'mt-6 rounded-2xl border border-sky-500/20 bg-sky-950/20 p-3.5 sm:p-4 backdrop-blur-md'}>
      <div class='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3'>
        <div class='flex items-center gap-2'>
          <Zap size={16} class='text-amber-400 shrink-0' />
          <span class='text-xs font-bold uppercase tracking-wider text-slate-200'>Slate Fast-Fill</span>
        </div>
        <span class='text-[11px] text-slate-400'>Pre-select candidates for a full party slate</span>
      </div>
      <div class='flex flex-wrap items-center gap-2.5'>
        {#each partyLists as party (party.id)}
          <div class='flex flex-wrap items-center gap-2 w-full sm:w-auto'>
            <button
              type='button'
              onclick={() => applyParty(party)}
              class='min-h-11 flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md'
              style='background: {party.color ? party.color + '20' : 'rgba(59,130,246,0.15)'}; border-color: {party.color || '#3B82F6'}; color: {party.color || '#60A5FA'}'
            >
              <Flag size={14} />
              Fill {party.code} Slate
            </button>
            <a
              href={`/elections/${electionId}/parties/${party.id}`}
              target={openPartyPlatformInNewTab ? '_blank' : undefined}
              rel={openPartyPlatformInNewTab ? 'noreferrer' : undefined}
              class='min-h-11 inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white active:scale-95'
            >
              View platform
            </a>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <StepperProgress
    {positions}
    currentPositionIndex={voting.currentPositionIndex}
    selectedVotes={voting.selectedVotes}
    ongoToPosition={goToPosition}
  />

  {#if !isReview}
    {#if currentPosition}
      <div class={compact ? 'rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-6 shadow-xl backdrop-blur-md' : 'mt-6 sm:mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-6 shadow-xl backdrop-blur-md'}>
        {#if showStepLabel}
          <div class='flex items-start justify-between gap-3 mb-1'>
            <h2 class='text-lg sm:text-xl font-bold text-slate-100'>{currentPosition.name}</h2>
            <span class='font-mono text-xs text-slate-400'>Step {voting.currentPositionIndex + 1} of {totalPositions}</span>
          </div>
        {:else}
          <h2 class='text-lg sm:text-xl font-bold text-slate-100'>{currentPosition.name}</h2>
        {/if}
        <p class={showStepLabel ? 'text-xs sm:text-sm text-slate-400' : 'mt-1 text-xs sm:text-sm text-slate-400'}>Select one candidate for this position.</p>

        <div class='mt-4 sm:mt-6 flex flex-col gap-3.5 sm:gap-4'>
          {#each currentPosition.candidates as candidate (candidate.id)}
            <VotingCandidateCard
              {candidate}
              {partyLists}
              {electionId}
              selected={voting.selectedVotes[currentPosition.id] === candidate.id}
              onclick={() => selectAt(currentPosition.id, candidate.id)}
            />
          {/each}
        </div>

        {#if voting.selectedVotes[currentPosition.id] !== null}
          <div class='mt-4 flex justify-end'>
            <button
              type='button'
              onclick={() => clearAt(currentPosition.id)}
              aria-label={`Clear selection for ${currentPosition.name}`}
              class='min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-rose-500/50 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40 cursor-pointer active:scale-95'
            >
              <X size={14} /> Clear selection
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <BallotReview
      {positions}
      selectedVotes={voting.selectedVotes}
      ongoToPosition={goToPosition}
    />
  {/if}

  <StepperNavigation
    currentPositionIndex={voting.currentPositionIndex}
    {isSubmitting}
    {isReview}
    selectedVotesCount={getSelectedCount(voting)}
    {totalPositions}
    onprevious={previous}
    onnext={next}
    onsubmit={onsubmit}
    canSubmit={allPositionsVoted(voting, positions)}
    isCurrentSelected={currentPosition ? voting.selectedVotes[currentPosition.id] !== null : false}
  />
  <div class='h-24 md:hidden' style='height: calc(5.5rem + env(safe-area-inset-bottom, 0px));'></div>
</div>
