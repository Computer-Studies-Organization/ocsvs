<script lang="ts">
  import type { TResultsCandidate } from '$lib/types'
  import CandidateAvatar from '$lib/components/ui/candidate-avatar.svelte'
  import VoteProgressBar from '$lib/components/ui/vote-progress-bar.svelte'
  import { Trophy, Scale, Award, Info } from 'lucide-svelte'

  interface PositionResultProp {
    positionId: string
    positionName: string
    totalVotes: number
    candidates: TResultsCandidate[]
  }

  let {
    position,
    isFinal = true,
    electionId,
  }: {
    position: PositionResultProp
    isFinal?: boolean
    electionId?: string
  } = $props()

  const sortedCandidates = $derived(
    [...position.candidates].sort((a, b) => b.voteCount - a.voteCount)
  )
  const topCandidate = $derived(sortedCandidates[0])
  const secondCandidate = $derived(sortedCandidates[1])
  const hasVotes = $derived(topCandidate && topCandidate.voteCount > 0)
  const isTie = $derived(
    sortedCandidates.length > 1 &&
    topCandidate &&
    topCandidate.voteCount > 0 &&
    topCandidate.voteCount === secondCandidate?.voteCount
  )
  const tiedCandidates = $derived(
    isTie
      ? sortedCandidates.filter((candidate) => candidate.voteCount === topCandidate?.voteCount)
      : [],
  )
  const isUnopposed = $derived(sortedCandidates.length === 1 && hasVotes)
</script>

<article
  id="position-{position.positionId}"
  class="scroll-mt-6 rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-5 shadow-xl backdrop-blur sm:p-7"
  data-testid="position-card-{position.positionId}"
>
  <!-- Position Header -->
  <div class="mb-5 flex flex-col gap-2 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0">
      <h3 class="text-xl font-black tracking-tight text-slate-50 sm:text-2xl">
        {position.positionName}
      </h3>
      <p class="mt-0.5 text-xs text-slate-400">
        {position.totalVotes} {position.totalVotes === 1 ? 'ballot counted' : 'ballots counted'}
      </p>
    </div>

    <!-- Status Badge -->
    <div class="flex items-center gap-2">
      {#if isTie}
        <span class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300">
          <Scale size={13} />
          Contested Tie
        </span>
      {:else if isUnopposed}
        <span class="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-blue-300">
          <Award size={13} />
          {isFinal ? 'Elected Unopposed' : 'Leading Unopposed'}
        </span>
      {:else if hasVotes}
        <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-300">
          <Trophy size={13} />
          {topCandidate.fullName} {isFinal ? 'Elected' : 'Leading'}
        </span>
      {:else}
        <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/70 px-3.5 py-1 text-xs font-medium text-slate-400">
          Awaiting Votes
        </span>
      {/if}
    </div>
  </div>

  <!-- Tie Alert Notice if applicable -->
  {#if isTie}
    <div class="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
      <Info size={16} class="mt-0.5 shrink-0 text-amber-400" />
      <p>
        <strong class="font-bold">Tie Detected:</strong>
        {tiedCandidates.map((candidate) => candidate.fullName).join(', ')} all received {topCandidate?.voteCount} votes. A runoff or constitutional tie-breaker applies.
      </p>
    </div>
  {/if}

  <!-- Candidates List -->
  {#if sortedCandidates.length === 0}
    <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-500">
      No candidates registered for this position.
    </div>
  {:else}
    <div class="space-y-4">
      {#each sortedCandidates as candidate, idx (candidate.candidateId)}
        {@const isCandidateWinner = hasVotes && !isTie && idx === 0}
        {@const isCandidateTied = isTie && candidate.voteCount === topCandidate?.voteCount}

        <div
          class="relative flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-all sm:flex-nowrap sm:gap-6 sm:p-5
          {isCandidateWinner
            ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-950/30 via-slate-900/70 to-slate-900/50 shadow-lg shadow-emerald-500/5'
            : isCandidateTied
              ? 'border-amber-500/40 bg-amber-950/20'
              : 'border-slate-800/80 bg-slate-900/50'}"
        >
          <!-- Avatar + Rank/Winner Badge -->
          <div class="relative shrink-0">
            <CandidateAvatar
              src={candidate.imageUrl}
              alt={candidate.fullName}
              sizeClass="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28"
              class="rounded-2xl border-2 {isCandidateWinner ? 'border-emerald-500/70 shadow-lg shadow-emerald-500/10' : 'border-slate-700/70'}"
            />
            {#if isCandidateWinner}
              <div class="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-md ring-3 ring-slate-900">
                <Trophy size={14} class="stroke-[3]" />
              </div>
            {:else}
              <div class="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-800 text-xs sm:text-sm font-bold text-slate-300 border border-slate-700 ring-3 ring-slate-900">
                {idx + 1}
              </div>
            {/if}
          </div>

          <!-- Candidate Details -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="min-w-0 flex-1 line-clamp-2 text-base font-bold leading-snug sm:truncate sm:text-xl {isCandidateWinner ? 'text-emerald-300' : 'text-slate-100'}">
                {candidate.fullName}
              </p>
              {#if isCandidateWinner}
                <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400 sm:px-2.5 sm:text-xs">
                  <Trophy size={12} />
                  {isFinal ? 'Winner' : 'Leading'}
                </span>
              {/if}
            </div>

            <div class="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
              {#if candidate.partyName || candidate.partyCode}
                {#if candidate.partyId && electionId}
                  <a
                    href="/elections/{electionId}/parties/{candidate.partyId}"
                    aria-label="View {candidate.partyName || candidate.partyCode} platform"
                    class="inline-flex items-center gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    style={candidate.partyColor ? `color: ${candidate.partyColor}` : undefined}
                  >
                    {#if candidate.partyColor}
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2" style="background-color: {candidate.partyColor}"></span>
                    {/if}
                    {candidate.partyName || candidate.partyCode} {#if candidate.partyCode && candidate.partyName}({candidate.partyCode}){/if}
                  </a>
                {:else}
                  <span
                    class="inline-flex items-center gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs"
                    style={candidate.partyColor ? `color: ${candidate.partyColor}` : undefined}
                  >
                    {#if candidate.partyColor}
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2" style="background-color: {candidate.partyColor}"></span>
                    {/if}
                    {candidate.partyName || candidate.partyCode} {#if candidate.partyCode && candidate.partyName}({candidate.partyCode}){/if}
                  </span>
                {/if}
              {:else}
                <span class="text-[11px] text-slate-500 sm:text-xs">Independent</span>
              {/if}
            </div>
          </div>

          <!-- Vote Stats & Bar -->
          <div class="order-last w-full flex-shrink-0 sm:order-none sm:w-64 md:w-80">
            <div class="mb-2 flex items-baseline justify-between text-xs sm:text-sm">
              <span class="font-semibold text-slate-300">
                {candidate.voteCount} {candidate.voteCount === 1 ? 'vote' : 'votes'}
              </span>
              <span class="text-base sm:text-lg font-black {isCandidateWinner ? 'text-emerald-400' : 'text-slate-200'}">
                {candidate.percentage}%
              </span>
            </div>

            <VoteProgressBar
              percentage={candidate.percentage}
              gradient={isCandidateWinner
                ? 'from-emerald-500 via-teal-400 to-emerald-300'
                : isCandidateTied
                  ? 'from-amber-500 to-yellow-400'
                  : 'from-slate-600 to-slate-400'}
            />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</article>
