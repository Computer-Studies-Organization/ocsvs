<script lang="ts">
  import type { TStepperPosition } from '$lib/voting-stepper-logic'
  import { User, AlertCircle, Edit2, Terminal, HelpCircle } from 'lucide-svelte'

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

<div class="mt-6 sm:mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 shadow-2xl backdrop-blur-md">
  <div class="mb-4 sm:mb-6 flex items-start gap-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 shrink-0">
      <Terminal size={20} />
    </div>
    <div class="flex flex-col">
      <h2 class="text-lg sm:text-xl font-bold text-slate-100">Review Ballot</h2>
      <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">Please review your selections carefully before submitting your ballot. Once submitted, your vote is recorded and cannot be changed.</p>
    </div>
  </div>

  <!-- Grid layout of position selections -->
  <div class="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each positions as pos, idx (pos.id)}
      {@const selectedCandidateId = selectedVotes[pos.id]}
      {@const selectedCandidate = pos.candidates.find(c => c.id === selectedCandidateId)}

      <div
        class="flex flex-col justify-between min-h-36 rounded-xl border p-3.5 sm:p-4 transition-all duration-200 {selectedCandidateId !== null ? 'border-slate-800 bg-slate-950/40' : 'border-rose-900/50 bg-rose-950/20 shadow-[0_0_8px_rgba(244,63,94,0.08)]'}"
      >
        <!-- Header -->
        <div class="flex flex-col">
          <span
            class="font-mono text-[9px] font-bold uppercase tracking-wider"
            class:text-slate-400={selectedCandidateId !== null}
            class:text-rose-400={selectedCandidateId === null}
          >
            {pos.name}
          </span>

          {#if selectedCandidate}
            <!-- Selected Candidate Card Content -->
            <div class="flex items-center gap-2.5 mt-2.5">
              {#if selectedCandidate.imageUrl}
                <img
                  src={selectedCandidate.imageUrl}
                  alt={selectedCandidate.fullName}
                  class="h-10 w-10 rounded-lg object-cover border border-slate-800 shrink-0"
                />
              {:else}
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-slate-400 shrink-0">
                  <User size={18} />
                </div>
              {/if}
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm font-semibold text-slate-100 truncate">
                  {selectedCandidate.fullName}
                </span>
                <span class="text-xs text-slate-400 truncate mt-0.5 max-w-full">
                  {selectedCandidate.manifesto || 'No manifesto platform selected.'}
                </span>
              </div>
            </div>
          {:else}
            <!-- Empty Choice Content -->
            <div class="flex items-center gap-2 mt-3.5 text-rose-400">
              <AlertCircle size={16} class="shrink-0" />
              <span class="text-xs font-semibold uppercase font-mono tracking-wider">no candidate selected</span>
            </div>
          {/if}
        </div>

        <!-- Action Trigger -->
        <button
          type="button"
          onclick={() => ongoToPosition(idx)}
          aria-label="Change selection for {pos.name}"
          class="min-h-11 inline-flex items-center gap-1.5 rounded-lg px-2 font-mono text-[10px] font-semibold uppercase tracking-wider cursor-pointer mt-2 active:scale-95 transition-all"
          class:text-blue-400={selectedCandidateId !== null}
          class:hover:text-blue-300={selectedCandidateId !== null}

          class:text-rose-400={selectedCandidateId === null}
          class:hover:text-rose-300={selectedCandidateId === null}
        >
          {#if selectedCandidateId !== null}
            <Edit2 size={12} /> Edit selection
          {:else}
            <HelpCircle size={12} /> Choose candidate
          {/if}
        </button>
      </div>
    {/each}
  </div>

  <!-- Irreversibility Caution Callout -->
  <div class="mt-4 sm:mt-6 border border-amber-500/25 bg-amber-500/10 text-amber-200 rounded-xl p-3.5 sm:p-4 flex gap-3 text-xs leading-relaxed items-start shadow-sm">
    <AlertCircle size={18} class="text-amber-400 flex-shrink-0 mt-0.5" />
    <div class="flex flex-col">
      <span class="font-bold text-amber-400 uppercase font-mono tracking-wider mb-0.5">submission warning</span>
      <span>Ballot submission is absolute and irreversible. Clicking &ldquo;Submit ballot&rdquo; will permanently sign and seal your votes. Please review and verify all selections.</span>
    </div>
  </div>
</div>
