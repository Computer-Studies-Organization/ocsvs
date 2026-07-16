<script lang="ts">
  import type { TStepperPosition } from '$lib/voting-stepper-logic'
  import { GitCommit, GitMerge, Check, AlertCircle } from 'lucide-svelte'

  let {
    positions,
    currentPositionIndex,
    selectedVotes,
    ongoToPosition,
  }: {
    positions: TStepperPosition[]
    currentPositionIndex: number
    selectedVotes: Record<string, string | null>
    ongoToPosition: (idx: number) => void
  } = $props()

  // Computed properties
  const totalPositions = $derived(positions.length)
  const isReview = $derived(currentPositionIndex === totalPositions)
  const selectedCount = $derived(
    positions.filter((p) => selectedVotes[p.id] !== null).length
  )
  const allVoted = $derived(selectedCount === totalPositions)
  const progressPercent = $derived(
    totalPositions > 0 ? Math.round((selectedCount / totalPositions) * 100) : 0
  )

  const activePositionName = $derived(
    isReview ? 'Review Ballot' : positions[currentPositionIndex]?.name || ''
  )

  // Git commit-like messages for each step
  function getCommitMessage(pos: TStepperPosition): string {
    const selectedId = selectedVotes[pos.id]
    if (!selectedId) return 'unstashed changes'
    const candidate = pos.candidates.find((c) => c.id === selectedId)
    return `commit: ${candidate ? candidate.fullName : 'voted'}`
  }
</script>

<!-- Mobile Progress Sticky Banner -->
<div class="sticky top-0 z-30 -mx-6 mb-6 border-b border-slate-800 bg-slate-950/85 py-3.5 px-6 backdrop-blur-md md:hidden">
  <div class="flex items-center justify-between">
    <div class="flex flex-col">
      <span class="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        CSO_VOTE://step-{isReview ? 'review' : currentPositionIndex + 1}
      </span>
      <h3 class="text-sm font-bold text-slate-200">
        {activePositionName}
      </h3>
    </div>
    <div class="flex flex-col items-end">
      <span class="font-mono text-xs font-bold text-blue-400">
        {progressPercent}% compiled
      </span>
      <span class="text-[10px] text-slate-500">
        {selectedCount}/{totalPositions} stashed
      </span>
    </div>
  </div>
  <div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
    <div
      class="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-500 transition-all duration-300"
      style:width="{progressPercent}%"
    ></div>
  </div>
</div>

<!-- Desktop Git Commit Pipeline Stepper -->
<div class="relative hidden w-full flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md md:flex mb-8">
  <div class="relative flex items-center justify-between px-4">
    <!-- Connecting Git Pipeline Track Line -->
    <div class="absolute left-10 right-10 top-[22px] h-0.5 -translate-y-1/2 bg-slate-800"></div>
    <div
      class="absolute left-10 top-[22px] h-0.5 -translate-y-1/2 bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 transition-all duration-500 ease-out"
      style:width="calc({progressPercent}% - 20px)"
    ></div>

    <!-- Timeline Nodes -->
    {#each positions as pos, idx (pos.id)}
      {@const voted = selectedVotes[pos.id] !== null}
      {@const isActive = currentPositionIndex === idx}
      
      <button
        type="button"
        onclick={() => ongoToPosition(idx)}
        class="group relative z-10 flex flex-col items-center focus:outline-none cursor-pointer"
        aria-label="Go to {pos.name} selection"
      >
        <!-- Circle indicator -->
        <div
          class="flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300"
          class:bg-slate-950={!isActive && !voted}
          class:border-slate-800={!isActive && !voted}
          class:border-blue-500={isActive && !voted}
          class:bg-blue-950={isActive && !voted}
          class:shadow-[0_0_12px_rgba(59,130,246,0.3)]={isActive}
          class:border-emerald-500={voted}
          class:bg-emerald-950={voted && !isActive}
          class:bg-emerald-900={voted && isActive}
        >
          {#if voted}
            <Check size={16} class="text-emerald-400" />
          {:else}
            <GitCommit size={18} class={isActive ? 'text-blue-400' : 'text-slate-500'} />
          {/if}
        </div>

        <!-- Details label -->
        <div class="absolute top-14 flex w-32 flex-col items-center text-center">
          <span
            class="font-mono text-[10px] uppercase tracking-wider transition-colors duration-200"
            class:text-blue-400={isActive}
            class:text-emerald-400={voted && !isActive}
            class:text-slate-500={!isActive && !voted}
          >
            {pos.name}
          </span>
          <span class="mt-0.5 line-clamp-1 font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors">
            {getCommitMessage(pos)}
          </span>
        </div>
      </button>
    {/each}

    <!-- Final Review Node -->
    <button
      type="button"
      onclick={() => ongoToPosition(totalPositions)}
      class="group relative z-10 flex flex-col items-center focus:outline-none cursor-pointer"
      aria-label="Go to Review step"
    >
      <div
        class="flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300"
        class:bg-slate-950={!isReview}
        class:border-slate-800={!isReview && !allVoted}
        class:border-blue-500={isReview && !allVoted}
        class:bg-blue-950={isReview && !allVoted}
        class:shadow-[0_0_12px_rgba(59,130,246,0.3)]={isReview}
        class:border-emerald-500={allVoted}
        class:bg-emerald-950={allVoted && !isReview}
        class:bg-emerald-900={allVoted && isReview}
      >
        {#if allVoted}
          <GitMerge size={18} class="text-emerald-400 animate-pulse" />
        {:else}
          <AlertCircle size={18} class={isReview ? 'text-blue-400' : 'text-slate-500'} />
        {/if}
      </div>
      <div class="absolute top-14 flex w-32 flex-col items-center text-center">
        <span
          class="font-mono text-[10px] uppercase tracking-wider transition-colors"
          class:text-blue-400={isReview}
          class:text-emerald-400={allVoted && !isReview}
          class:text-slate-500={!isReview && !allVoted}
        >
          Review
        </span>
        <span class="mt-0.5 line-clamp-1 font-mono text-[9px] text-slate-500">
          {allVoted ? 'merge: ready' : `${totalPositions - selectedCount} conflict(s)`}
        </span>
      </div>
    </button>
  </div>

  <!-- Padding spacer for labels -->
  <div class="h-10"></div>
</div>
