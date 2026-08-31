<script lang="ts">
  import { Check } from 'lucide-svelte'

  let {
    candidate,
    partyLists = [],
    electionId,
    selected = false,
    onclick,
  }: {
    candidate: { id: string; fullName: string; imageUrl: string | null; manifesto: string; partyId?: string | null }
    partyLists?: Array<{ id: string; name: string; code: string; color: string | null }>
    electionId?: string
    selected?: boolean
    onclick: () => void
  } = $props()

  let isExpanded = $state(false)
  let imageError = $state(false)

  const party = $derived(candidate.partyId ? partyLists.find((p) => p.id === candidate.partyId) : null)

  $effect(() => {
    // Reset image error if candidate or imageUrl changes
    const _ = candidate.imageUrl
    imageError = false
  })
</script>

<div
  class="group relative flex w-full flex-col gap-4 sm:gap-5 rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 overflow-hidden active:scale-[0.99] sm:active:scale-100 {selected ? 'border-blue-500 bg-blue-950/25 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60 hover:-translate-y-0.5 hover:shadow-xl'} focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500/50 sm:flex-row"
>
  <button
    type="button"
    aria-label="Select {candidate.fullName}"
    aria-pressed={selected}
    onclick={onclick}
    class="absolute inset-0 z-0 h-full w-full cursor-pointer rounded-2xl border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
  ></button>

  <!-- Left Section: Fixed-Size Candidate Portrait Frame -->
  <div class="relative z-10 pointer-events-none w-full shrink-0 aspect-[3/4] max-sm:max-h-56 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 flex items-center justify-center sm:w-44 md:w-48 shadow-inner">
    {#if candidate.imageUrl && !imageError}
      <img
        src={candidate.imageUrl}
        alt={candidate.fullName}
        class="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        onerror={() => {
          imageError = true
        }}
      />
    {:else}
      <!-- Candidate Silhouette Bust Placeholder -->
      <div class="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-900/50 to-slate-950 p-6">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          class="h-full max-h-36 w-full text-slate-700 transition-transform duration-300 group-hover:scale-[1.02]"
          aria-hidden="true"
          data-testid="candidate-portrait-silhouette"
        >
          <!-- Head -->
          <circle cx="12" cy="8" r="4.2" fill="currentColor" />
          <!-- Torso / Shoulders silhouette -->
          <path
            d="M4 21.5C4 16.8 7.5 13.5 12 13.5C16.5 13.5 20 16.8 20 21.5H4Z"
            fill="currentColor"
          />
        </svg>
      </div>
    {/if}

    <!-- Top-Left Floating Party Badge on Mobile only -->
    <div class="absolute top-3 left-3 z-10 sm:hidden">
      {#if party}
        {#if electionId}
          <a
            href="/elections/{electionId}/parties/{party.id}"
            aria-label="View {party.name} platform"
            onclick={(event) => event.stopPropagation()}
            class="relative z-20 min-h-11 inline-flex pointer-events-auto items-center text-[10px] font-mono font-bold px-3 py-1 rounded-full border shadow-lg backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400 active:scale-95 transition-transform"
            style="background: {party.color ? party.color + '30' : 'rgba(15,23,42,0.85)'}; border-color: {party.color || '#3B82F6'}; color: {party.color || '#60A5FA'}"
          >
            {party.code}
          </a>
        {:else}
          <span
            class="inline-flex items-center text-[10px] font-mono font-bold px-3 py-1 rounded-full border shadow-lg backdrop-blur-md"
            style="background: {party.color ? party.color + '30' : 'rgba(15,23,42,0.85)'}; border-color: {party.color || '#3B82F6'}; color: {party.color || '#60A5FA'}"
          >
            {party.code}
          </span>
        {/if}
      {:else}
        <span class="inline-flex items-center text-[10px] font-mono font-bold px-3 py-1 rounded-full border border-slate-700/80 bg-slate-950/80 text-slate-300 shadow-lg backdrop-blur-md">
          INDEPENDENT
        </span>
      {/if}
    </div>

    <!-- Top-Right Floating Selection Check Indicator on Mobile only -->
    <div class="absolute top-3 right-3 z-10 sm:hidden">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 {selected ? 'border-blue-400 bg-blue-500 text-white scale-110 shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'border-slate-700 bg-slate-950/80 text-transparent scale-100'}"
      >
        <Check size={16} class="stroke-[3]" />
      </div>
    </div>
  </div>

  <!-- Right Section: Details, Manifesto & Actions -->
  <div class="relative z-10 pointer-events-none flex flex-1 min-w-0 flex-col justify-between">
    <div>
      <!-- Header row: Name + Party badge + Desktop Checkmark -->
      <div class="flex items-start justify-between gap-3 sm:gap-4">
        <div class="flex flex-col gap-1.5 min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-bold text-slate-100 text-base sm:text-xl group-hover:text-white transition-colors tracking-tight">
              {candidate.fullName}
            </h3>
            <div class="hidden sm:inline-flex">
              {#if party}
                {#if electionId}
                  <a
                    href="/elections/{electionId}/parties/{party.id}"
                    aria-label="View {party.name} platform"
                    onclick={(event) => event.stopPropagation()}
                    class="relative z-20 inline-flex pointer-events-auto items-center text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition hover:scale-105"
                    style="background: {party.color ? party.color + '20' : 'rgba(59,130,246,0.15)'}; border-color: {party.color || '#3B82F6'}; color: {party.color || '#60A5FA'}"
                  >
                    {party.code}
                  </a>
                {:else}
                  <span
                    class="inline-flex items-center text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border shadow-sm"
                    style="background: {party.color ? party.color + '20' : 'rgba(59,130,246,0.15)'}; border-color: {party.color || '#3B82F6'}; color: {party.color || '#60A5FA'}"
                  >
                    {party.code}
                  </span>
                {/if}
              {:else}
                <span class="inline-flex items-center text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-400">
                  INDEPENDENT
                </span>
              {/if}
            </div>
          </div>
        </div>

        <!-- Desktop Check Indicator -->
        <div
          class="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 {selected ? 'border-blue-400 bg-blue-500 text-white scale-110 shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'border-slate-700 bg-slate-950/80 text-transparent scale-100 group-hover:border-slate-600'}"
        >
          <Check size={18} class="stroke-[3]" />
        </div>
      </div>

      <!-- Platform Manifesto -->
      <div class="mt-3 w-full border-t border-white/5 pt-2.5 sm:pt-3">
        <div class="flex items-center justify-between mb-1.5">
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">platform manifesto</p>
          {#if candidate.manifesto && candidate.manifesto.length > 150}
            <button
              type="button"
              class="relative z-20 min-h-11 pointer-events-auto text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline text-[10px] uppercase focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1"
              onclick={(e) => {
                e.stopPropagation();
                isExpanded = !isExpanded;
              }}
            >
              {isExpanded ? 'Read Less' : 'Read More'}
            </button>
          {/if}
        </div>
        <p class="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed transition-all duration-200 {isExpanded ? '' : 'line-clamp-3'}">
          {candidate.manifesto || 'No platform manifesto provided for this candidate.'}
        </p>
      </div>
    </div>

    <!-- IDE commit branch footer decoration -->
    <div class="mt-3 sm:mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
      <span class="text-[11px] font-mono {selected ? 'text-blue-400 font-semibold' : 'text-slate-400'}">
        {selected ? '● Selected on ballot' : '○ Click to select candidate'}
      </span>
      <span class="font-mono text-[8px] text-slate-500 group-hover:text-slate-400 transition-colors uppercase tracking-wider truncate max-w-[45%] text-right">
        feat/{candidate.fullName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
      </span>
    </div>
  </div>
</div>
