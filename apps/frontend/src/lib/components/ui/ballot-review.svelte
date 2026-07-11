<script lang="ts">
  import type { TStepperPosition } from '$lib/voting-stepper-logic'
  import { Info, User } from 'lucide-svelte'

  let {
    positions,
    selectedVotes,
    ongoToPosition,
  }: {
    positions: TStepperPosition[]
    selectedVotes: Record<string, string | null>
    ongoToPosition: (idx: number) => void
  } = $props()
</script>

<div class="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
  <h2 class="text-xl font-bold text-slate-100 mb-2">Review Your Ballot</h2>
  <p class="text-sm text-slate-400 mb-6">Please review your selections carefully. Once submitted, your ballot cannot be changed or resubmitted.</p>
  
  <div class="divide-y divide-white/5 space-y-4">
    {#each positions as pos, idx (pos.id)}
      {@const selectedCandidateId = selectedVotes[pos.id]}
      {@const selectedCandidate = pos.candidates.find(c => c.id === selectedCandidateId)}
      <div class="pt-4 first:pt-0 flex items-center justify-between gap-4">
        <div>
          <h3 class="font-semibold text-slate-200">{pos.name}</h3>
          {#if selectedCandidate}
            <div class="flex items-center gap-2 mt-1">
              {#if selectedCandidate.imageUrl}
                <img src={selectedCandidate.imageUrl} alt={selectedCandidate.fullName} class="h-6 w-6 rounded-full object-cover" />
              {:else}
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800">
                  <User size={12} class="text-slate-400" />
                </div>
              {/if}
              <span class="text-slate-300 font-medium text-sm">{selectedCandidate.fullName}</span>
            </div>
          {:else}
            <p class="text-red-400 text-sm mt-1 font-semibold flex items-center gap-1">
              <Info size={14} /> No candidate selected
            </p>
          {/if}
        </div>
        <button
          type="button"
          onclick={() => ongoToPosition(idx)}
          class="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
        >
          Change
        </button>
      </div>
    {/each}
  </div>
</div>
