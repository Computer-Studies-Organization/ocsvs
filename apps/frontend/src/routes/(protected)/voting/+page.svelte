<script lang='ts'>
  import { onMount } from 'svelte'
  import { allCandidates } from '$lib/api/candidates'
  import { getCurrentElection } from '$lib/api/elections'
  import { listPositions } from '$lib/api/positions'
  import { getMyElectionVotes, submitElectionVotes } from '$lib/api/votes'
  import {
    allPositionsVoted,
    createVotingState,
    getSelectedCount,
    getSelectedVotes,
    goNext,
    goPrevious,
    isFirstPosition,
    isLastPosition,
    selectCandidate,
    type TStepperPosition,
  } from '$lib/voting-stepper-logic'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import type { TElection, TPosition } from '$lib/types'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { ArrowLeft, ArrowRight, Vote } from 'lucide-svelte'

  let election = $state<TElection | null>(null)
  let positions = $state<TStepperPosition[]>([])
  let votingState = $state(createVotingState([]))
  let isLoading = $state(true)
  let isSubmitting = $state(false)
  let error = $state('')
  let submitMessage = $state('')
  let hasVoted = $state(false)

  const currentPosition = $derived(positions[votingState.currentPositionIndex])

  async function load() {
    isLoading = true
    error = ''
    try {
      const current = await getCurrentElection()
      if (!current) {
        election = null
        return
      }
      election = current
      const [allPos, candidatesRes] = await Promise.all([
        listPositions(current.id),
        allCandidates({ electionId: current.id }),
      ])
      const positionsFromBackend: TPosition[] = allPos
      positions = positionsFromBackend
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(p => ({
          id: p.id,
          name: p.name,
          displayOrder: p.displayOrder,
          candidates: candidatesRes.data
            .filter(c => c.positionId === p.id)
            .map(c => ({ id: c.id, fullName: c.fullName })),
        }))
        .filter(p => p.candidates.length > 0)
      votingState = createVotingState(positions)
      const my = await getMyElectionVotes()
      if (my.electionId === current.id && my.votes.length > 0) {
        hasVoted = true
      }
    }
    catch (e: unknown) {
      error = extractErrorMessage(e, 'Failed to load election')
    }
    finally {
      isLoading = false
    }
  }

  onMount(load)

  async function submit() {
    if (!election)
      return
    isSubmitting = true
    error = ''
    submitMessage = ''
    try {
      const votes = getSelectedVotes(votingState)
      await submitElectionVotes(election.id, votes)
      submitMessage = 'Vote submitted successfully!'
      hasVoted = true
    }
    catch (e: unknown) {
      error = extractErrorMessage(e, 'Failed to submit vote')
    }
    finally {
      isSubmitting = false
    }
  }
</script>

{#if isLoading}
  <div class='flex min-h-[60vh] items-center justify-center'>
    <Spinner size={40} />
  </div>
{:else if error}
  <div class='p-8 text-center'>
    <p class='text-red-400'>{error}</p>
  </div>
{:else if !election}
  <div class='flex min-h-[60vh] items-center justify-center p-8'>
    <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
      <Vote size={48} class='mx-auto mb-4 text-slate-400' />
      <h1 class='text-2xl font-bold text-slate-100'>No active election</h1>
      <p class='mt-2 text-slate-400'>No active election right now. Check back later.</p>
    </div>
  </div>
{:else if hasVoted}
  <div class='flex min-h-[60vh] items-center justify-center p-8'>
    <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
      <Vote size={48} class='mx-auto mb-4 text-emerald-400' />
      <h1 class='text-2xl font-bold text-slate-100'>Thank you for voting!</h1>
      <p class='mt-2 text-slate-400'>Your vote in "{election.name}" has been recorded.</p>
      <a href='/results' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
    </div>
  </div>
{:else}
  <div class='mx-auto max-w-3xl p-6'>
    <h1 class='text-3xl font-black text-slate-100'>{election.name}</h1>
    {#if election.description}
      <p class='mt-2 text-slate-400'>{election.description}</p>
    {/if}

    {#if currentPosition}
      <div class='mt-8 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
        <h2 class='text-xl font-bold text-slate-100'>{currentPosition.name}</h2>
        <p class='mt-1 text-sm text-slate-400'>Select one candidate.</p>
        <div class='mt-6 space-y-3'>
          {#each currentPosition.candidates as c (c.id)}
            <button
              type='button'
              onclick={() => (votingState = selectCandidate(votingState, currentPosition.id, c.id))}
              class='flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all'
              style:background={votingState.selectedVotes[currentPosition.id] === c.id ? 'oklch(0.30 0.08 250)' : 'oklch(0.22 0.025 250)'}
              style:border-color={votingState.selectedVotes[currentPosition.id] === c.id ? 'oklch(0.55 0.15 250)' : 'oklch(0.30 0.025 250)'}
            >
              <span class='font-semibold text-slate-100'>{c.fullName}</span>
              {#if votingState.selectedVotes[currentPosition.id] === c.id}
                <span class='text-blue-400'>Selected</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class='mt-6 flex items-center justify-between'>
      <button
        type='button'
        onclick={() => (votingState = goPrevious(votingState))}
        disabled={isFirstPosition(votingState)}
        class='flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-slate-100 disabled:opacity-50'
      >
        <ArrowLeft size={18} /> Previous
      </button>
      <p class='text-sm text-slate-400'>{getSelectedCount(votingState)} / {positions.length} selected</p>
      {#if isLastPosition(votingState, positions.length)}
        <button
          type='button'
          onclick={submit}
          disabled={!allPositionsVoted(votingState, positions) || isSubmitting}
          class='flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50'
        >
          {isSubmitting ? 'Submitting…' : 'Submit votes'}
        </button>
      {:else}
        <button
          type='button'
          onclick={() => (votingState = goNext(votingState, positions.length))}
          class='flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white'
        >
          Next <ArrowRight size={18} />
        </button>
      {/if}
    </div>

    {#if submitMessage}
      <p class='mt-4 text-center text-emerald-400'>{submitMessage}</p>
    {/if}
  </div>
{/if}
