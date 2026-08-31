<script lang="ts">
  import type { TStepperPosition } from '$lib/voting-stepper-logic'
  import { GitCommit, GitMerge, Check, AlertCircle } from 'lucide-svelte'
  import { onMount } from 'svelte'

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
  const filledPercent = $derived(
    totalPositions > 0 ? (selectedCount / totalPositions) * 100 : 0
  )

  const activePositionName = $derived(
    isReview ? 'Review ballot' : positions[currentPositionIndex]?.name || ''
  )

  let scrollContainer: HTMLDivElement | null = $state(null)
  let canScrollLeft = $state(false)
  let canScrollRight = $state(false)

  function checkScroll() {
    if (!scrollContainer) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer
    canScrollLeft = scrollLeft > 10
    canScrollRight = scrollLeft < scrollWidth - clientWidth - 10
  }

  onMount(() => {
    checkScroll()
    const handleResize = () => checkScroll()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })

  $effect(() => {
    const activeIdx = isReview ? totalPositions : currentPositionIndex
    if (scrollContainer) {
      const targetNode = scrollContainer.querySelector<HTMLElement>(`[data-step-index="${activeIdx}"]`)
      if (targetNode) {
        targetNode.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
      }
      checkScroll()
    }
  })

  // Selection messages for each step
  function getCommitMessage(pos: TStepperPosition): string {
    const selectedId = selectedVotes[pos.id]
    if (!selectedId) return 'no selection'
    const candidate = pos.candidates.find((c) => c.id === selectedId)
    return `selected: ${candidate ? candidate.fullName : 'selected'}`
  }
</script>

<!-- Mobile Progress Sticky Banner -->
<div class="sticky top-[calc(4rem+1px)] sm:top-[calc(4.25rem+1px)] z-30 -mx-4 mb-6 border-b border-slate-800/90 bg-slate-950/95 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 md:hidden shadow-lg shadow-black/40">
  <div class="flex items-center justify-between gap-3">
    <div class="flex flex-col min-w-0 flex-1">
      <span class="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {isReview ? 'Review ballot' : `Step ${currentPositionIndex + 1} of ${totalPositions}`}
      </span>
      <h3 class="truncate text-sm font-bold text-slate-100">
        {activePositionName}
      </h3>
    </div>
    <div class="flex flex-col items-end shrink-0">
      <span class="font-mono text-xs font-bold text-blue-400">
        {progressPercent}% completed
      </span>
      <span class="text-[10px] text-slate-400">
        {selectedCount}/{totalPositions} selected
      </span>
    </div>
  </div>

  <div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/5">
    <div
      class="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-500 transition-all duration-300"
      style:width="{progressPercent}%"
    ></div>
  </div>

  <!-- Mobile Horizontal Quick-Jump Step Strip -->
  <nav class="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" aria-label="Ballot steps">
    {#each positions as pos, idx (pos.id)}
      {@const voted = selectedVotes[pos.id] !== null}
      {@const isActive = currentPositionIndex === idx && !isReview}
      <button
        type="button"
        aria-current={isActive ? 'step' : undefined}
        aria-label="Go to {pos.name} ({voted ? 'Selected' : 'Not selected'})"
        onclick={() => ongoToPosition(idx)}
        class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer border {isActive
          ? 'border-blue-500 bg-blue-600/25 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.35)]'
          : voted
            ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'}"
      >
        {#if voted}
          <Check size={13} class="text-emerald-400 shrink-0" />
        {:else}
          <span class="text-[11px] font-bold opacity-75">{idx + 1}.</span>
        {/if}
        <span class="max-w-[70px] truncate text-[11px]">{pos.name}</span>
      </button>
    {/each}

    <!-- Final Review Step on Mobile -->
    <button
      type="button"
      aria-current={isReview ? 'step' : undefined}
      aria-label="Go to Review step ({allVoted ? 'Ready' : 'Incomplete'})"
      onclick={() => ongoToPosition(totalPositions)}
      class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer border {isReview
        ? 'border-blue-500 bg-blue-600/25 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.35)]'
        : allVoted
          ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'}"
    >
      {#if allVoted}
        <GitMerge size={13} class="text-emerald-400 shrink-0" />
      {:else}
        <AlertCircle size={13} class="text-slate-500 shrink-0" />
      {/if}
      <span class="text-[11px]">Review</span>
    </button>
  </nav>
</div>

<!-- Desktop Git Commit Pipeline Stepper -->
<div class="relative hidden w-full flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md md:flex mb-8 overflow-hidden">
  <!-- Left Edge Gradient Mask -->
  <div
    class="pointer-events-none absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent transition-opacity duration-300 z-20"
    class:opacity-0={!canScrollLeft}
    class:opacity-100={canScrollLeft}
    aria-hidden="true"
  ></div>

  <!-- Right Edge Gradient Mask -->
  <div
    class="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950/90 via-slate-950/40 to-transparent transition-opacity duration-300 z-20"
    class:opacity-0={!canScrollRight}
    class:opacity-100={canScrollRight}
    aria-hidden="true"
  ></div>

  <!-- Scrollable Track Container -->
  <div
    bind:this={scrollContainer}
    onscroll={checkScroll}
    class="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-3 pt-1"
  >
    <div class="relative flex w-max min-w-full items-start justify-between px-4">
      <!-- Connecting Git Pipeline Track Line -->
      <div class="absolute left-10 right-10 top-[22px] h-0.5 -translate-y-1/2 bg-slate-800">
        <div
          class="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 transition-all duration-500 ease-out"
          style:width="{filledPercent}%"
        ></div>
      </div>

      <!-- Timeline Nodes -->
      {#each positions as pos, idx (pos.id)}
        {@const voted = selectedVotes[pos.id] !== null}
        {@const isActive = currentPositionIndex === idx}

        <button
          type="button"
          data-step-index={idx}
          onclick={() => ongoToPosition(idx)}
          class="group relative z-10 flex flex-col items-center focus:outline-none cursor-pointer w-32 flex-shrink-0"
          aria-label="Go to {pos.name} selection"
        >
          <!-- Circle indicator -->
          <div
            class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300"
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
          <div class="mt-3 flex w-32 flex-col items-center text-center">
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
        data-step-index={totalPositions}
        onclick={() => ongoToPosition(totalPositions)}
        class="group relative z-10 flex flex-col items-center focus:outline-none cursor-pointer w-32 flex-shrink-0"
        aria-label="Go to Review step"
      >
        <div
          class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300"
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
        <div class="mt-3 flex w-32 flex-col items-center text-center">
          <span
            class="font-mono text-[10px] uppercase tracking-wider transition-colors"
            class:text-blue-400={isReview}
            class:text-emerald-400={allVoted && !isReview}
            class:text-slate-500={!isReview && !allVoted}
          >
            Review
          </span>
          <span class="mt-0.5 line-clamp-1 font-mono text-[9px] text-slate-500">
            {allVoted ? 'merge: ready' : `${totalPositions - selectedCount} remaining selection(s)`}
          </span>
        </div>
      </button>
    </div>
  </div>
</div>
