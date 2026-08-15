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
  class="mt-8 flex items-center justify-between transition-all duration-200
         max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-40 max-md:mt-0
         max-md:bg-slate-950/85 max-md:backdrop-blur-md max-md:border-t max-md:border-slate-800/80
         max-md:px-6 max-md:py-4.5"
>
  <!-- Previous button -->
  <button
    type="button"
    onclick={onprevious}
    disabled={currentPositionIndex === 0 || isSubmitting}
    class="min-h-11 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 font-mono text-xs uppercase tracking-wider text-slate-300 disabled:bg-slate-950/40 disabled:text-slate-700 disabled:border-slate-900/50 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
  >
    <ArrowLeft size={16} /> Prev_Step
  </button>
  
  {#if !isReview}
    <!-- Status readout -->
    <p class="font-mono text-[10px] uppercase tracking-wider text-slate-500 max-md:hidden">
      selected: <span class="text-blue-400 font-bold">{selectedVotesCount}</span> / {totalPositions}
    </p>

    <!-- Next button -->
    <button
      type="button"
      onclick={onnext}
      class="min-h-11 flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs uppercase tracking-wider text-white transition-all duration-300 cursor-pointer"
      class:bg-slate-800={!isCurrentSelected}
      class:border={!isCurrentSelected}
      class:border-slate-700={!isCurrentSelected}
      class:text-slate-400={!isCurrentSelected}
      
      class:bg-blue-600={isCurrentSelected}
      class:hover:bg-blue-500={isCurrentSelected}
      class:shadow-[0_0_12px_rgba(59,130,246,0.4)]={isCurrentSelected}
      class:scale-[1.02]={isCurrentSelected}
    >
      Next_Step <ArrowRight size={16} />
    </button>
  {:else}
    <!-- Submit button on Review step -->
    <button
      type="button"
      onclick={onsubmit}
      disabled={!canSubmit || isSubmitting}
      class="min-h-11 flex items-center gap-2 rounded-xl px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-all duration-300 disabled:bg-slate-950/40 disabled:text-slate-700 disabled:border-slate-900/50 disabled:cursor-not-allowed cursor-pointer"
      class:bg-emerald-600={canSubmit}
      class:hover:bg-emerald-500={canSubmit}
      class:shadow-[0_0_15px_rgba(16,185,129,0.4)]={canSubmit && !isSubmitting}
      class:bg-slate-850={!canSubmit}
      class:border={!canSubmit}
      class:border-slate-850={!canSubmit}
    >
      {#if isSubmitting}
        Submitting…
      {:else}
        <GitMerge size={16} class="mr-0.5" /> Submit Ballot
      {/if}
    </button>
  {/if}
</div>
