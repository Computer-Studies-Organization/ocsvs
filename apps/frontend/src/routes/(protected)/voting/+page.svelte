<script lang='ts'>
  import { onMount } from 'svelte'
  import { allCandidates } from '$lib/api/candidates'
  import { getVotingState } from '$lib/api/elections'
  import { listPositions } from '$lib/api/positions'
  import { submitElectionVotes } from '$lib/api/votes'
  import {
    deriveVotingPageState,
    type TVotingPageState,
  } from '$lib/voting-page-state'
  import {
    allPositionsVoted,
    getSelectedVotes,
    goNext,
    goPrevious,
    isFirstPosition,
    isLastPosition,
    selectCandidate,
    withVoting,
  } from '$lib/voting-stepper-logic'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { authStore } from '$lib/stores/auth'
  import { UserRole, type TCandidate, type TPosition, type TVotingState } from '$lib/types'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { ArrowLeft, ArrowRight, Calendar, CheckCircle, Info, Vote } from 'lucide-svelte'

  let apiState = $state<TVotingState | null>(null)
  let positions = $state<TPosition[] | null>(null)
  let candidates = $state<TCandidate[] | null>(null)
  let loadError = $state<string | null>(null)
  let isSubmitting = $state(false)

  const isAdmin = $derived($authStore.user?.user?.role === UserRole.ADMIN)

  let pageState = $state<TVotingPageState>({ kind: 'loading' })
  $effect(() => {
    pageState = deriveVotingPageState({ apiState, positions, candidates, loadError, isAdmin })
  })

  async function load() {
    loadError = null
    apiState = null
    positions = null
    candidates = null
    try {
      const state = await getVotingState()
      apiState = state
      if (state.open) {
        const [candsRes, posRes] = await Promise.all([
          allCandidates({ electionId: state.open.id }),
          listPositions(state.open.id),
        ])
        candidates = candsRes.data
        positions = posRes
      }
    }
    catch (e: unknown) {
      loadError = extractErrorMessage(e, 'Failed to load election')
    }
  }

  onMount(load)

  async function submit() {
    if (pageState.kind !== 'stepper') return
    isSubmitting = true
    loadError = null
    try {
      await submitElectionVotes(pageState.election.id, getSelectedVotes(pageState.voting))
      await load()
    }
    catch (e: unknown) {
      loadError = extractErrorMessage(e, 'Failed to submit vote')
    }
    finally {
      isSubmitting = false
    }
  }

  function selectAt(positionId: string, candidateId: string) {
    if (pageState.kind !== 'stepper') return
    pageState = withVoting(pageState, selectCandidate(pageState.voting, positionId, candidateId))
  }

  function next() {
    if (pageState.kind !== 'stepper') return
    pageState = withVoting(pageState, goNext(pageState.voting, pageState.positions.length))
  }

  function previous() {
    if (pageState.kind !== 'stepper') return
    pageState = withVoting(pageState, goPrevious(pageState.voting))
  }

  function formatTimestamp(unixSeconds: number): string {
    const date = new Date(unixSeconds * 1000)
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  function formatCountdown(unixSeconds: number): string {
    const ms = unixSeconds * 1000 - Date.now()
    if (ms <= 0) return 'opening now'
    const days = Math.floor(ms / 86_400_000)
    if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
    const hours = Math.floor(ms / 3_600_000)
    if (hours > 0) return `in ${hours} hour${hours === 1 ? '' : 's'}`
    return 'soon'
  }
</script>

{#if pageState.kind === 'loading'}
  <div class='flex min-h-[60vh] items-center justify-center'>
    <Spinner size={40} />
  </div>
{:else if pageState.kind === 'error'}
  <div class='p-8 text-center'>
    <p class='text-red-400'>{pageState.message}</p>
  </div>
{:else if pageState.kind === 'empty'}
  <div class='flex min-h-[60vh] items-center justify-center p-8'>
    <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
      {#if pageState.variant === 'next-draft' && pageState.nextDraft}
        {@const d = pageState.nextDraft}
        <Calendar size={48} class='mx-auto mb-4 text-sky-400' />
        <h1 class='text-2xl font-bold text-slate-100'>Next election: {d.name}</h1>
        <p class='mt-2 text-slate-400'>Opens {d.opensAt ? `${formatTimestamp(d.opensAt)} — ${formatCountdown(d.opensAt)}` : 'Date TBD'}.</p>
      {:else if pageState.variant === 'last-closed' && pageState.lastClosed}
        {@const c = pageState.lastClosed}
        {@const totalVotes = c.results.reduce((s, r) => s + r.totalVotes, 0)}
        <CheckCircle size={48} class='mx-auto mb-4 text-emerald-400' />
        <h1 class='text-2xl font-bold text-slate-100'>{c.name} has ended</h1>
        <p class='mt-2 text-slate-400'>{totalVotes} votes cast across {c.results.length} positions.</p>
        <a href='/results' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
      {:else if pageState.variant === 'both' && pageState.nextDraft && pageState.lastClosed}
        {@const d = pageState.nextDraft}
        {@const c = pageState.lastClosed}
        <Info size={48} class='mx-auto mb-4 text-slate-300' />
        <h1 class='text-2xl font-bold text-slate-100'>No active election</h1>
        <p class='mt-2 text-slate-400'>
          Latest: {c.name} (ended {formatTimestamp(c.closesAt)}). Next: {d.name} opens {d.opensAt ? formatTimestamp(d.opensAt) : 'Date TBD'}.
        </p>
        <a href='/results' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
      {:else}
        <Vote size={48} class='mx-auto mb-4 text-slate-400' />
        <h1 class='text-2xl font-bold text-slate-100'>No elections scheduled</h1>
        <p class='mt-2 text-slate-400'>Check back later.</p>
      {/if}
    </div>
  </div>
  {#if pageState.isAdmin}
    <div class='mx-auto max-w-md px-8 pb-8'>
      <div class='border-t border-white/10 pt-4'>
        <p class='text-xs font-semibold uppercase tracking-wider text-slate-500'>Admin actions</p>
        <a href='/admin/elections' class='mt-2 inline-block text-blue-400 hover:underline'>
          Open election management →
        </a>
      </div>
    </div>
  {/if}
{:else if pageState.kind === 'voted'}
  <div class='flex min-h-[60vh] items-center justify-center p-8'>
    <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
      <Vote size={48} class='mx-auto mb-4 text-emerald-400' />
      <h1 class='text-2xl font-bold text-slate-100'>Thank you for voting!</h1>
      <p class='mt-2 text-slate-400'>Your vote in "{pageState.election.name}" has been recorded.</p>
      <a href='/results' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
    </div>
  </div>
{:else}
  {@const currentPosition = pageState.positions[pageState.voting.currentPositionIndex]}
  <div class='mx-auto max-w-3xl p-6'>
    <h1 class='text-3xl font-black text-slate-100'>{pageState.election.name}</h1>
    {#if pageState.election.description}
      <p class='mt-2 text-slate-400'>{pageState.election.description}</p>
    {/if}

    {#if currentPosition}
      <div class='mt-8 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
        <h2 class='text-xl font-bold text-slate-100'>{currentPosition.name}</h2>
        <p class='mt-1 text-sm text-slate-400'>Select one candidate.</p>
        <div class='mt-6 space-y-3'>
          {#each currentPosition.candidates as c (c.id)}
            <button
              type='button'
              onclick={() => selectAt(currentPosition.id, c.id)}
              class='flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all'
              style:background={pageState.voting.selectedVotes[currentPosition.id] === c.id ? 'oklch(0.30 0.08 250)' : 'oklch(0.22 0.025 250)'}
              style:border-color={pageState.voting.selectedVotes[currentPosition.id] === c.id ? 'oklch(0.55 0.15 250)' : 'oklch(0.30 0.025 250)'}
            >
              <span class='font-semibold text-slate-100'>{c.fullName}</span>
              {#if pageState.voting.selectedVotes[currentPosition.id] === c.id}
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
        onclick={previous}
        disabled={isFirstPosition(pageState.voting)}
        class='flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-slate-100 disabled:opacity-50'
      >
        <ArrowLeft size={18} /> Previous
      </button>
      <p class='text-sm text-slate-400'>{Object.values(pageState.voting.selectedVotes).filter(id => id !== null).length} / {pageState.positions.length} selected</p>
      {#if isLastPosition(pageState.voting, pageState.positions.length)}
        <button
          type='button'
          onclick={submit}
          disabled={!allPositionsVoted(pageState.voting, pageState.positions) || isSubmitting}
          class='flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50'
        >
          {isSubmitting ? 'Submitting…' : 'Submit votes'}
        </button>
      {:else}
        <button
          type='button'
          onclick={next}
          class='flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white'
        >
          Next <ArrowRight size={18} />
        </button>
      {/if}
    </div>
  </div>
{/if}
