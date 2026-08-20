<script lang='ts'>
  import { untrack } from 'svelte'
  import { submitElectionVotes } from '$lib/api/votes'
  import { invalidate } from '$app/navigation'
  import { appCache } from '$lib/cache'
  import { submitVoteWithReconciliation } from '$lib/vote-submission'
  import {
    deriveVotingPageState,
    preserveVotingState,
    type TVotingPageState,
  } from '$lib/voting-page-state'
  import {
    allPositionsVoted,
    clearSelection,
    getSelectedCount,
    getSelectedVotes,
    goNext,
    goPrevious,
    isFirstPosition,
    isReviewStep,
    selectCandidate,
    selectPartySlate,
    withVoting,
  } from '$lib/voting-stepper-logic'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { formatTimestamp } from '$lib/utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { captureException } from '$lib/telemetry'
  import { authStore } from '$lib/stores/auth.svelte'
  import { UserRole, type TPartyList, type TPosition, type TVotingCandidate, type TVotingState } from '$lib/types'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import { Calendar, CheckCircle, Flag, Info, Vote, X, Zap } from 'lucide-svelte'
  import Countdown from '$lib/components/ui/countdown.svelte'
  import VotingCandidateCard from '$lib/components/ui/voting-candidate-card.svelte'
  import BallotReview from '$lib/components/ui/ballot-review.svelte'
  import StepperNavigation from '$lib/components/ui/stepper-navigation.svelte'
  import StepperProgress from '$lib/components/ui/stepper-progress.svelte'

  let { data } = $props()
  const apiState = $derived<TVotingState | null>(data.votingState)
  const positions = $derived<TPosition[] | null>(data.positions)
  const candidates = $derived<TVotingCandidate[] | null>(data.candidates)
  const partyLists = $derived<TPartyList[]>(data.partyLists || [])
  let runtimeError = $state<string | null>(null)
  const loadError = $derived(data.loadError ?? runtimeError)
  let isSubmitting = $state(false)

  const isAdmin = $derived(authStore.user?.role === UserRole.ADMIN || authStore.user?.role === UserRole.SUPER_ADMIN)

  let pageState = $state<TVotingPageState>({ kind: 'loading' })

  // Re-derive page state from API data, but preserve the user's in-progress
  // selections when the open election hasn't changed (e.g. auto-refresh).
  $effect.pre(() => {
    const next = deriveVotingPageState({ apiState, positions, candidates, loadError, isAdmin })
    const current = untrack(() => pageState)
    pageState = preserveVotingState(next, current)
  })

  let lastAutoFetch = 0
  async function guardedAutoRefresh() {
    const nowMs = Date.now()
    if (nowMs - lastAutoFetch < 10000) {
      return
    }
    lastAutoFetch = nowMs
    try {
      await appCache.get('votingState', { includeBallot: true }).fetch(true)
      await invalidate('app:voting')
    }
    catch (e) {
      captureException(e)
      console.error('Failed to auto-refresh voting state', e)
    }
  }

  async function submit() {
    if (pageState.kind !== 'stepper') return
    const electionId = pageState.election.id
    const votes = getSelectedVotes(pageState.voting)
    isSubmitting = true
    runtimeError = null
    try {
      await submitVoteWithReconciliation(
        electionId,
        () => submitElectionVotes(electionId, votes),
        () => appCache.get('votingState', { includeBallot: true }).fetch(true),
      )
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:voting')
      addToast('success', 'Vote submitted')
    }
    catch (e: unknown) {
      runtimeError = extractErrorMessage(e, 'Failed to submit vote')
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

  function clearAt(positionId: string) {
    if (pageState.kind !== 'stepper') return
    pageState = withVoting(pageState, clearSelection(pageState.voting, positionId))
  }

  function applyPartySlate(party: TPartyList) {
    if (pageState.kind !== 'stepper') return
    pageState = withVoting(pageState, selectPartySlate(pageState.voting, pageState.positions, party.id))
    addToast('info', `Fast-filled candidates for ${party.name} slate`)
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
        {#each Array(3) as _, i (i)}
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
  <div class='flex min-h-[60vh] flex-col items-center justify-center p-8'>
    <div class='w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center shadow-2xl backdrop-blur-md'>
      {#if pageState.variant === 'next-draft' && pageState.nextDraft}
        {@const d = pageState.nextDraft}
        <div class="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Calendar size={14} class="text-blue-400" />
          <span>Next election</span>
        </div>
        <h1 class='text-2xl font-bold tracking-tight text-slate-100 mt-2'>{d.name}</h1>
        {#if d.opensAt}
          <Countdown
            targetUnixSeconds={d.opensAt}
            prefix="Opens in "
            class="text-sky-400 text-sm font-semibold justify-center mt-2"
            onZero={guardedAutoRefresh}
          />
        {/if}

        <hr class='my-6 border-white/10' />

        <div class='rounded-xl border border-white/5 bg-slate-950/40 p-4 text-left'>
          <span class='text-xs font-semibold uppercase tracking-wider text-slate-500 block'>Schedule</span>
          <span class='mt-1 block text-sm font-bold text-slate-200'>
            {formatTimestamp(d.opensAt)}
          </span>
        </div>
      {:else if pageState.variant === 'last-closed' && pageState.lastClosed}
        {@const c = pageState.lastClosed}
        {@const totalVotes = c.results.reduce((s, r) => s + r.totalVotes, 0)}
        <div class="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <CheckCircle size={14} class="text-emerald-400" />
          <span>Past election</span>
        </div>
        <h1 class='text-2xl font-bold tracking-tight text-slate-100 mt-2'>{c.name}</h1>
        <p class='mt-2 text-sm text-slate-400'>{totalVotes} votes cast across {c.results.length} positions.</p>
        
        <hr class='my-6 border-white/10' />

        <div class='grid grid-cols-2 gap-4 text-left'>
          <div class='rounded-xl border border-white/5 bg-slate-950/40 p-4'>
            <span class='text-xs font-semibold uppercase tracking-wider text-slate-500 block'>Schedule</span>
            <span class='mt-1 block text-sm font-bold text-slate-200'>
              Ended {formatTimestamp(c.closesAt)}
            </span>
          </div>
          <div class='rounded-xl border border-white/5 bg-slate-950/40 p-4 flex flex-col justify-between'>
            <span class='text-xs font-semibold uppercase tracking-wider text-slate-500 block'>Results</span>
            <a href='/elections/{c.id}' class='mt-1 block text-sm font-bold text-blue-400 hover:underline'>
              View results →
            </a>
          </div>
        </div>
      {:else if pageState.variant === 'both' && pageState.nextDraft && pageState.lastClosed}
        {@const d = pageState.nextDraft}
        {@const c = pageState.lastClosed}
        <div class="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Info size={14} class="text-slate-400" />
          <span>Elections overview</span>
        </div>
        <h1 class='text-2xl font-bold tracking-tight text-slate-100 mt-2'>No active election</h1>
        <p class='mt-2 text-sm text-slate-400'>
          Latest: {c.name} (ended {formatTimestamp(c.closesAt)}). Next: {d.name} opens {formatTimestamp(d.opensAt)}.
        </p>

        <hr class='my-6 border-white/10' />

        <div class='grid grid-cols-2 gap-4 text-left'>
          <div class='rounded-xl border border-white/5 bg-slate-950/40 p-4'>
            <span class='text-xs font-semibold uppercase tracking-wider text-slate-500 block'>Next Up</span>
            <span class='mt-1 block text-sm font-bold text-slate-200'>{d.name}</span>
          </div>
          <div class='rounded-xl border border-white/5 bg-slate-950/40 p-4 flex flex-col justify-between'>
            <span class='text-xs font-semibold uppercase tracking-wider text-slate-500 block'>Past Election</span>
            <a href='/elections/{c.id}' class='mt-1 block text-sm font-bold text-blue-400 hover:underline'>
              View results →
            </a>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Vote size={14} class="text-slate-400" />
          <span>Status</span>
        </div>
        <h1 class='text-2xl font-bold tracking-tight text-slate-100 mt-2'>No elections scheduled</h1>
        <p class='mt-2 text-sm text-slate-400'>Check back later.</p>
      {/if}
    </div>

    {#if pageState.isAdmin}
      <div class='w-full max-w-md mt-8'>
        <div class='border-t border-white/10 pt-6'>
          <p class='text-xs font-semibold uppercase tracking-wider text-slate-500'>Admin actions</p>
          <a href='/admin/elections' class='mt-2 inline-block text-blue-400 hover:underline font-medium text-sm'>
            Open election management →
          </a>
          <p class='mt-3 text-xs text-slate-500 leading-relaxed'>
            As an administrator, you can create, configure, or transition elections from the management portal. Voters will only see the ballot interface when an election is actively open.
          </p>
        </div>
      </div>
    {/if}
  </div>
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

    {#if partyLists.length > 0}
      <div class='mt-6 rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4 backdrop-blur-md'>
        <div class='flex items-center gap-2 mb-3'>
          <Zap size={16} class='text-amber-400' />
          <span class='text-xs font-bold uppercase tracking-wider text-slate-300'>Slate Fast-Fill</span>
          <span class='text-xs text-slate-400'>(Pre-select candidates for a full party slate)</span>
        </div>
        <div class='flex flex-wrap items-center gap-2.5'>
          {#each partyLists as party (party.id)}
            <button
              type='button'
              onclick={() => applyPartySlate(party)}
              class='flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md'
              style='background: {party.color ? party.color + '20' : 'rgba(59,130,246,0.15)'}; border-color: {party.color || '#3B82F6'}; color: {party.color || '#60A5FA'}'
            >
              <Flag size={14} />
              Fill {party.code} Slate
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <StepperProgress
      positions={pageState.positions}
      currentPositionIndex={pageState.voting.currentPositionIndex}
      selectedVotes={pageState.voting.selectedVotes}
      ongoToPosition={goToPosition}
    />

    {#if !isReview}
      {#if currentPosition}
        <div class='mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md'>
          <h2 class='text-xl font-bold text-slate-100'>{currentPosition.name}</h2>
          <p class='mt-1 text-sm text-slate-400'>Select one candidate.</p>
          <div class='mt-6 grid grid-cols-1 gap-4 md:grid-cols-2'>
            {#each currentPosition.candidates as c (c.id)}
              <VotingCandidateCard
                candidate={c}
                partyLists={partyLists}
                selected={pageState.voting.selectedVotes[currentPosition.id] === c.id}
                onclick={() => selectAt(currentPosition.id, c.id)}
              />
            {/each}
          </div>
          {#if pageState.voting.selectedVotes[currentPosition.id] !== null}
            <div class='mt-4 flex justify-end'>
              <button
                type='button'
                onclick={() => clearAt(currentPosition.id)}
                aria-label="Clear selection for {currentPosition.name}"
                class='min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-rose-500/50 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40 cursor-pointer'
              >
                <X size={14} /> Clear selection
              </button>
            </div>
          {/if}
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
      selectedVotesCount={getSelectedCount(pageState.voting)}
      totalPositions={totalPositions}
      onprevious={previous}
      onnext={next}
      onsubmit={submit}
      canSubmit={allPositionsVoted(pageState.voting, pageState.positions)}
      isCurrentSelected={currentPosition ? pageState.voting.selectedVotes[currentPosition.id] !== null : false}
    />
    <div class="h-24 md:hidden"></div>
  </div>
{/if}
