<script lang="ts">
  import { User } from 'lucide-svelte'

  let {
    candidate,
    selected = false,
    onclick,
  }: {
    candidate: { id: string; fullName: string; imageUrl: string | null }
    selected?: boolean
    onclick: () => void
  } = $props()
</script>

<button
  type="button"
  {onclick}
  class="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer"
  style:background={selected ? 'oklch(0.30 0.08 250)' : 'oklch(0.22 0.025 250)'}
  style:border-color={selected ? 'oklch(0.55 0.15 250)' : 'oklch(0.30 0.025 250)'}
>
  {#if candidate.imageUrl}
    <img
      src={candidate.imageUrl}
      alt={candidate.fullName}
      class="h-10 w-10 rounded-full object-cover"
    />
  {:else}
    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
      <User size={20} class="text-slate-400" />
    </div>
  {/if}
  <span class="font-semibold text-slate-100">{candidate.fullName}</span>
  {#if selected}
    <span class="ml-auto text-blue-400 font-medium">Selected</span>
  {/if}
</button>
