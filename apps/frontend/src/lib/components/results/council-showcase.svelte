<script lang="ts">
  import type { TResults } from '$lib/types'
  import CandidateAvatar from '$lib/components/ui/candidate-avatar.svelte'
  import { Trophy, Scale, Award, ArrowRight } from 'lucide-svelte'

  let {
    results = [],
    isFinal = true,
    electionId,
  }: {
    results: TResults
    isFinal?: boolean
    electionId?: string
  } = $props()

  const winners = $derived.by(() => {
    return results.map((pos) => {
      const sorted = [...pos.candidates].sort((a, b) => b.voteCount - a.voteCount)
      const top = sorted[0]
      const second = sorted[1]
      const isTie = sorted.length > 1 && top && top.voteCount > 0 && top.voteCount === second?.voteCount
      const isUnopposed = sorted.length === 1 && top && top.voteCount > 0
      const hasVotes = top && top.voteCount > 0

      return {
        positionId: pos.positionId,
        positionName: pos.positionName,
        topCandidate: top,
        tiedCandidates: isTie
          ? sorted.filter((candidate) => candidate.voteCount === top?.voteCount)
          : [],
        isTie,
        isUnopposed,
        hasVotes,
        totalVotes: pos.totalVotes,
      }
    })
  })

</script>

{#if winners.length > 0}
  <section class="space-y-4" aria-labelledby="council-showcase-heading">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 shadow-sm">
          <Trophy size={18} />
        </div>
        <div>
          <h2 id="council-showcase-heading" class="text-lg font-extrabold tracking-tight text-slate-100 sm:text-xl">
            {isFinal ? 'Newly Elected Officers' : 'Current Leaders'}
          </h2>
        </div>
      </div>
      <span class="text-xs font-semibold text-slate-400">
        {winners.length} {winners.length === 1 ? 'position' : 'positions'}
      </span>
    </div>

    <!-- Scrollable container on mobile, responsive grid on desktop -->
    <div
      class="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-3"
      data-testid="council-showcase"
    >
      {#each winners as item (item.positionId)}
        <div
          class="group relative flex w-[280px] shrink-0 snap-start flex-col items-center justify-between rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-950/95 p-5 sm:p-6 text-center shadow-xl backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 sm:w-auto pointer-events-none"
        >
          <a
            href="#position-{item.positionId}"
            aria-label="View {item.positionName} race"
            class="absolute inset-0 z-0 rounded-3xl pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          ></a>
          <!-- Top: Position & Status -->
          <div class="mb-3 flex w-full items-center justify-between gap-2">
            <span class="truncate text-xs font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-200">
              {item.positionName}
            </span>
            {#if item.isTie}
              <span class="shrink-0 flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                <Scale size={11} />
                Tie
              </span>
            {:else if item.isUnopposed}
              <span class="shrink-0 flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
                <Award size={11} />
                Unopposed
              </span>
            {:else if item.hasVotes}
              <span class="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <Trophy size={11} />
                {isFinal ? 'Elected' : 'Leading'}
              </span>
            {:else}
              <span class="shrink-0 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
                Pending
              </span>
            {/if}
          </div>

          <!-- Center Portrait: Large Image -->
          <div class="relative my-2">
            <CandidateAvatar
              src={item.topCandidate?.imageUrl}
              alt={item.isTie ? 'Tied candidates' : item.topCandidate?.fullName || 'Candidate'}
              sizeClass="h-28 w-28 sm:h-32 sm:w-32 md:h-36 md:w-36"
              class="rounded-3xl border-3 {item.hasVotes && !item.isTie ? 'border-emerald-500/70 shadow-xl shadow-emerald-500/15 ring-4 ring-emerald-500/10' : 'border-slate-700/80'}"
            />
            {#if item.hasVotes && !item.isTie}
              <div class="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg ring-4 ring-slate-900">
                <Trophy size={15} class="stroke-[3]" />
              </div>
            {/if}
          </div>

          <!-- Candidate Details: Full Name, Party, Percentage -->
          <div class="mt-3 flex w-full flex-col items-center">
            {#if item.isTie && item.tiedCandidates.length > 0}
              <h3 class="text-base sm:text-lg font-black tracking-tight text-amber-200 leading-tight">
                Contested Tie
              </h3>
              <ul class="mt-2 space-y-1 text-sm font-semibold text-slate-200">
                {#each item.tiedCandidates as candidate (candidate.candidateId)}
                  <li>{candidate.fullName}</li>
                {/each}
              </ul>
              <span class="mt-2 inline-flex items-center rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-black text-amber-300 shadow-sm">
                {item.tiedCandidates[0]?.percentage}% each
              </span>
            {:else if item.hasVotes && item.topCandidate}
              <h3 class="text-base sm:text-lg font-black tracking-tight text-slate-100 group-hover:text-emerald-300 line-clamp-2 leading-tight">
                {item.topCandidate.fullName}
              </h3>

              <div class="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
                {#if item.topCandidate.partyName || item.topCandidate.partyCode}
                  {#if item.topCandidate.partyId && electionId}
                    <a
                      href="/elections/{electionId}/parties/{item.topCandidate.partyId}"
                      aria-label="View {item.topCandidate.partyName || item.topCandidate.partyCode} platform"
                      onclick={(event) => event.stopPropagation()}
                      class="relative z-20 inline-flex pointer-events-auto items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-xs bg-slate-800/90 border border-slate-700/60 shadow-sm hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      style={item.topCandidate.partyColor ? `color: ${item.topCandidate.partyColor}; border-color: ${item.topCandidate.partyColor}40` : undefined}
                    >
                      {#if item.topCandidate.partyColor}
                        <span class="h-2 w-2 rounded-full shrink-0" style="background-color: {item.topCandidate.partyColor}"></span>
                      {/if}
                      {item.topCandidate.partyCode || item.topCandidate.partyName}
                    </a>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-xs bg-slate-800/90 border border-slate-700/60 shadow-sm"
                      style={item.topCandidate.partyColor ? `color: ${item.topCandidate.partyColor}; border-color: ${item.topCandidate.partyColor}40` : undefined}
                    >
                      {#if item.topCandidate.partyColor}
                        <span class="h-2 w-2 rounded-full shrink-0" style="background-color: {item.topCandidate.partyColor}"></span>
                      {/if}
                      {item.topCandidate.partyCode || item.topCandidate.partyName}
                    </span>
                  {/if}
                {:else}
                  <span class="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 bg-slate-800/80 border border-slate-700/60">Independent</span>
                {/if}

                <span class="inline-flex items-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-black text-emerald-400 shadow-sm">
                  {item.topCandidate.percentage}%
                </span>
              </div>
            {:else}
              <p class="text-sm font-medium text-slate-500">No votes yet</p>
              <p class="text-xs text-slate-600">Awaiting ballots</p>
            {/if}
          </div>

          <!-- Bottom link affordance -->
          <div class="mt-4 flex w-full items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-medium text-slate-500 group-hover:text-slate-300">
            <span>{item.totalVotes} {item.totalVotes === 1 ? 'vote' : 'votes'}</span>
            <span aria-hidden="true" class="inline-flex items-center gap-1 text-emerald-400 font-bold">
              View race <ArrowRight size={13} />
            </span>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
