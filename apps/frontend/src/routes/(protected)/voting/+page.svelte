<script lang='ts'>
  import { submitElectionVotes } from '$lib/api/votes'
  import { invalidate } from '$app/navigation'
  import { appCache } from '$lib/cache'
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
    isReviewStep,
    selectCandidate,
    withVoting,
  } from '$lib/voting-stepper-logic'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast'
  import { authStore } from '$lib/stores/auth'
  import { UserRole, type TCandidate, type TPosition, type TVotingState } from '$lib/types'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import { Calendar, CheckCircle, Info, Vote } from 'lucide-svelte'
  import Countdown from '$lib/components/ui/countdown.svelte'
  import VotingCandidateCard from '$lib/components/ui/voting-candidate-card.svelte'
  import BallotReview from '$lib/components/ui/ballot-review.svelte'
  import StepperNavigation from '$lib/components/ui/stepper-navigation.svelte'

  let { data } = $props()
  let apiState = $derived<TVotingState | null>(data.votingState)
  let positions = $derived<TPosition[] | null>(data.positions)
  let candidates = $derived<TCandidate[] | null>(data.candidates)
  let loadError = $state<string | null>(null)
  let isSubmitting = $state(false)

  const isAdmin = $derived($authStore.user?.user?.role === UserRole.ADMIN || $authStore.user?.user?.role === UserRole.SUPER_ADMIN)

  let pageState = $state<TVotingPageState>({ kind: 'loading' })

  // Re-derive page state from API data, but preserve the user's in-progress
  // selections when the open election hasn't changed (e.g. auto-refresh).
  $effect(() => {
    const next = deriveVotingPageState({ apiState, positions, candidates, loadError, isAdmin })
    if (
      next.kind === 'stepper' &&
      pageState.kind === 'stepper' &&
      next.election.id === pageState.election.id
    ) {
      // Same election still open: keep current voting progress, only refresh positions/candidates.
      pageState = { ...next, voting: pageState.voting }
      return
    }
    pageState = next
  })

  let lastAutoFetch = 0
  async function guardedAutoRefresh() {
    const nowMs = Date.now()
    if (nowMs - lastAutoFetch < 10000) {
      return
    }
    lastAutoFetch = nowMs
    try {
      await appCache.get('votingState', {}).fetch(true)
      await invalidate('app:voting')
    }
    catch (e) {
      console.error('Failed to auto-refresh voting state', e)
    }
  }

  async function submit() {
    if (pageState.kind !== 'stepper') return
    isSubmitting = true
    loadError = null
    try {
      await submitElectionVotes(pageState.election.id, getSelectedVotes(pageState.voting))
      await appCache.get('votingState', {}).fetch(true)
      appCache.invalidate({ params: { electionId: pageState.election.id } })
      await invalidate('app:voting')
      addToast('success', 'Vote submitted')
    }
    catch (e: unknown) {
      loadError = extractErrorMessage(e, 'Failed to submit vote')
      addToast('error', extractErrorMessage(e, 'Failed to submit vote'))
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

  function goToPosition(idx: number) {
    if (pageState.kind !== 'stepper') return
    pageState.voting.currentPositionIndex = idx
  }

  function formatTimestamp(unixSeconds: number): string {
    const date = new Date(unixSeconds * 1000)
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }


</script>

{#if pageState.kind === 'loading'}
  <div class='mx-auto max-w-3xl p-6'>
    <SkeletonCard />
    <div class='mt-6 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
      <div class='flex items-start justify-between gap-3 mb-3'>
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <div class='mt-6 space-y-3'>
        {#each Array(3) as _}
          <div class='flex items-center gap-3 rounded-xl border border-white/10 p-4'>
            <div class='h-10 w-10 animate-pulse rounded-full bg-slate-800'></div>
            <div class='h-4 flex-1 animate-pulse rounded bg-slate-800'></div>
          </div>
        {/each}
      </div>
      <div class='mt-6 flex items-center justify-between'>
        <div class='h-10 w-24 animate-pulse rounded-xl bg-slate-800'></div>
        <div class='h-4 w-16 animate-pulse rounded bg-slate-800'></div>
        <div class='h-10 w-32 animate-pulse rounded-xl bg-blue-600/50'></div>
      </div>
    </div>
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
        <p class='mt-2 text-slate-400'>Opens {d.opensAt ? formatTimestamp(d.opensAt) : 'Date TBD'}.</p>
        {#if d.opensAt}
          <Countdown
            targetUnixSeconds={d.opensAt}
            prefix="Opens in "
            class="text-sky-400 text-sm font-semibold justify-center mt-2"
            onZero={guardedAutoRefresh}
          />
        {/if}
      {:else if pageState.variant === 'last-closed' && pageState.lastClosed}
        {@const c = pageState.lastClosed}
        {@const totalVotes = c.results.reduce((s, r) => s + r.totalVotes, 0)}
        <CheckCircle size={48} class='mx-auto mb-4 text-emerald-400' />
        <h1 class='text-2xl font-bold text-slate-100'>{c.name} has ended</h1>
        <p class='mt-2 text-slate-400'>{totalVotes} votes cast across {c.results.length} positions.</p>
        <a href='/elections/{c.id}' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
      {:else if pageState.variant === 'both' && pageState.nextDraft && pageState.lastClosed}
        {@const d = pageState.nextDraft}
        {@const c = pageState.lastClosed}
        <Info size={48} class='mx-auto mb-4 text-slate-300' />
        <h1 class='text-2xl font-bold text-slate-100'>No active election</h1>
        <p class='mt-2 text-slate-400'>
          Latest: {c.name} (ended {formatTimestamp(c.closesAt)}). Next: {d.name} opens {d.opensAt ? formatTimestamp(d.opensAt) : 'Date TBD'}.
        </p>
        <a href='/elections/{c.id}' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
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
      <a href='/elections/{pageState.election.id}' class='mt-6 inline-block text-blue-400 hover:underline'>View results →</a>
    </div>
  </div>
{:else}
  {@const totalPositions = pageState.positions.length}
  {@const isReview = isReviewStep(pageState.voting, totalPositions)}
  {@const currentPosition = pageState.positions[pageState.voting.currentPositionIndex]}
  <div class='mx-auto max-w-3xl p-6'>
    <div class='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
      <div>
        <h1 class='text-3xl font-black text-slate-100'>{pageState.election.name}</h1>
        {#if pageState.election.description}
          <p class='mt-2 text-slate-400'>{pageState.election.description}</p>
        {/if}
      </div>
      {#if pageState.election.closesAt}
        <Countdown
          targetUnixSeconds={pageState.election.closesAt}
          prefix="Closes in "
          class="text-amber-400 bg-amber-500/5 border border-amber-500/20 px-3.5 py-1.5 rounded-xl self-start sm:self-center"
          onZero={async () => {
            await guardedAutoRefresh()
            addToast('info', 'This election has closed.')
          }}
        />
      {/if}
    </div>

    {#if !isReview}
      {#if currentPosition}
        <div class='mt-8 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
          <h2 class='text-xl font-bold text-slate-100'>{currentPosition.name}</h2>
          <p class='mt-1 text-sm text-slate-400'>Select one candidate.</p>
          <div class='mt-6 space-y-3'>
            {#each currentPosition.candidates as c (c.id)}
              <VotingCandidateCard
                candidate={c}
                selected={pageState.voting.selectedVotes[currentPosition.id] === c.id}
                onclick={() => selectAt(currentPosition.id, c.id)}
              />
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      <BallotReview
        positions={pageState.positions}
        selectedVotes={pageState.voting.selectedVotes}
        ongoToPosition={goToPosition}
      />
    {/if}

    <StepperNavigation
      currentPositionIndex={pageState.voting.currentPositionIndex}
      isSubmitting={isSubmitting}
      isReview={isReview}
      selectedVotesCount={Object.values(pageState.voting.selectedVotes).filter(id => id !== null).length}
      totalPositions={totalPositions}
      onprevious={previous}
      onnext={next}
      onsubmit={submit}
      canSubmit={allPositionsVoted(pageState.voting, pageState.positions)}
    />
  </div>
{/if}
