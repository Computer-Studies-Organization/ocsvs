<script lang="ts">
  import { ArrowLeft, ArrowRight, GitMerge } from 'lucide-svelte'

  let {
    currentPositionIndex,
    isSubmitting,
    isReview,
    selectedVotesCount,
    totalPositions,
    onprevious,
    onnext,
    onsubmit,
    canSubmit,
    isCurrentSelected = false,
  }: {
    currentPositionIndex: number
    isSubmitting: boolean
    isReview: boolean
    selectedVotesCount: number
    totalPositions: number
    onprevious: () => void
    onnext: () => void
    onsubmit: () => void
    canSubmit: boolean
    isCurrentSelected?: boolean
  } = $props()
</script>

<!-- Responsive Stepper Navigation -->
<div
  class="mt-8 flex items-center justify-between gap-3 transition-all duration-200
         max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-40 max-md:mt-0
         max-md:bg-slate-950/95 max-md:backdrop-blur-xl max-md:border-t max-md:border-slate-800/90
         max-md:px-4 sm:max-md:px-6 max-md:pt-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]
         shadow-2xl shadow-black"
>
  <!-- Previous button -->
  <button
    type="button"
    onclick={onprevious}
    disabled={currentPositionIndex === 0 || isSubmitting}
    class="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-slate-200 disabled:bg-slate-950/40 disabled:text-slate-700 disabled:border-slate-900/50 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white active:scale-95 transition-all cursor-pointer shadow-sm"
  >
    <ArrowLeft size={16} /> Previous
  </button>

  <!-- Mobile status readout -->
  <div class="flex flex-col items-center text-center max-md:flex md:hidden">
    <span class="font-mono text-[10px] font-bold text-slate-300 uppercase tracking-wider">
      {isReview ? 'Review' : `Step ${currentPositionIndex + 1}/${totalPositions}`}
    </span>
    <span class="font-mono text-[9px] text-blue-400 font-semibold">
      {selectedVotesCount}/{totalPositions} selected
    </span>
  </div>

  <!-- Desktop status readout -->
  <p class="font-mono text-[10px] uppercase tracking-wider text-slate-400 max-md:hidden">
    selected: <span class="text-blue-400 font-bold">{selectedVotesCount}</span> / {totalPositions}
  </p>

  {#if !isReview}
    <!-- Next button -->
    <button
      type="button"
      onclick={onnext}
      class="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-white transition-all duration-200 active:scale-95 cursor-pointer shadow-md"
      class:bg-slate-800={!isCurrentSelected}
      class:border={!isCurrentSelected}
      class:border-slate-700={!isCurrentSelected}
      class:text-slate-300={!isCurrentSelected}
      class:hover:bg-slate-700={!isCurrentSelected}

      class:bg-blue-600={isCurrentSelected}
      class:hover:bg-blue-500={isCurrentSelected}
      class:shadow-[0_0_14px_rgba(59,130,246,0.45)]={isCurrentSelected}
    >
      Next <ArrowRight size={16} />
    </button>
  {:else}
    <!-- Submit button on Review step -->
    <button
      type="button"
      onclick={onsubmit}
      disabled={!canSubmit || isSubmitting}
      class="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition-all duration-200 disabled:bg-slate-950/40 disabled:text-slate-700 disabled:border-slate-900/50 disabled:cursor-not-allowed active:scale-95 cursor-pointer shadow-md"
      class:bg-emerald-600={canSubmit}
      class:hover:bg-emerald-500={canSubmit}
      class:shadow-[0_0_16px_rgba(16,185,129,0.45)]={canSubmit && !isSubmitting}
      class:bg-slate-850={!canSubmit}
      class:border={!canSubmit}
      class:border-slate-800={!canSubmit}
      class:text-slate-400={!canSubmit}
    >
      {#if isSubmitting}
        Submitting…
      {:else}
        <GitMerge size={16} class="mr-0.5" /> Submit ballot
      {/if}
    </button>
  {/if}
</div>
