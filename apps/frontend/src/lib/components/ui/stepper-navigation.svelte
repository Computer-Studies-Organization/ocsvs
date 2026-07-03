<script lang="ts">
  import { ArrowLeft, ArrowRight } from 'lucide-svelte'

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
  } = $props()
</script>

<div class="mt-6 flex items-center justify-between">
  <button
    type="button"
    onclick={onprevious}
    disabled={currentPositionIndex === 0 || isSubmitting}
    class="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-slate-100 disabled:opacity-50 cursor-pointer"
  >
    <ArrowLeft size={18} /> Previous
  </button>
  
  {#if !isReview}
    <p class="text-sm text-slate-400">{selectedVotesCount} / {totalPositions} selected</p>
    <button
      type="button"
      onclick={onnext}
      class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white cursor-pointer"
    >
      Next <ArrowRight size={18} />
    </button>
  {:else}
    <button
      type="button"
      onclick={onsubmit}
      disabled={!canSubmit || isSubmitting}
      class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50 cursor-pointer"
    >
      {isSubmitting ? 'Submitting…' : 'Submit votes'}
    </button>
  {/if}
</div>
