<script lang="ts">
  import { User, Check } from 'lucide-svelte'

  let {
    candidate,
    selected = false,
    onclick,
  }: {
    candidate: { id: string; fullName: string; imageUrl: string | null; manifesto: string }
    selected?: boolean
    onclick: () => void
  } = $props()

  let isExpanded = $state(false)
</script>

<div
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onclick();
    }
  }}
  aria-pressed={selected}
  class="group relative flex w-full flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer overflow-hidden {selected ? 'border-blue-500/80 bg-blue-950/20 shadow-lg shadow-blue-500/10' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60 hover:-translate-y-0.5 hover:shadow-lg'} focus:outline-none focus:ring-2 focus:ring-blue-500/50"
>
  <div class="flex w-full items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      {#if candidate.imageUrl}
        <img
          src={candidate.imageUrl}
          alt={candidate.fullName}
          class="h-11 w-11 rounded-full object-cover border border-slate-800 group-hover:border-slate-700 transition-colors"
        />
      {:else}
        <div class="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors">
          <User size={22} class="text-slate-400" />
        </div>
      {/if}
      <div class="flex flex-col">
        <span class="font-semibold text-slate-100 text-base group-hover:text-white transition-colors">
          {candidate.fullName}
        </span>
      </div>
    </div>
    
    <!-- Selection Check Indicator -->
    <div
      class="flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-300"
      class:border-slate-700={!selected}
      class:text-transparent={!selected}
      class:scale-100={!selected}
      
      class:border-blue-500={selected}
      class:bg-blue-500={selected}
      class:text-white={selected}
      class:scale-110={selected}
      class:shadow-[0_0_8px_rgba(59,130,246,0.5)]={selected}
    >
      <Check size={14} class="stroke-[3]" />
    </div>
  </div>

  <!-- Platform Manifesto -->
  <div class="mt-1 w-full border-t border-white/5 pt-3">
    <div class="flex items-center justify-between mb-1">
      <p class="font-mono text-[10px] uppercase tracking-wider text-slate-500">platform manifesto</p>
      {#if candidate.manifesto && candidate.manifesto.length > 120}
        <button
          type="button"
          class="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline text-[10px] uppercase focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1"
          onclick={(e) => {
            e.stopPropagation();
            isExpanded = !isExpanded;
          }}
        >
          {isExpanded ? 'Read Less' : 'Read More'}
        </button>
      {/if}
    </div>
    <p class="text-slate-300 text-xs font-normal leading-relaxed transition-all duration-200 {isExpanded ? '' : 'line-clamp-3'}">
      {candidate.manifesto || 'No platform manifesto stashed for this candidate.'}
    </p>
  </div>

  <!-- IDE commit branch footer decoration -->
  <span class="self-end font-mono text-[8px] text-slate-600 group-hover:text-slate-500 transition-colors uppercase tracking-wider mt-1">
    feat/{candidate.fullName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
  </span>
</div>
