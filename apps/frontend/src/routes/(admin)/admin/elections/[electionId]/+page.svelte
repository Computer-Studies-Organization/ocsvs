<script lang='ts'>
  import { ArrowLeft, ListOrdered, Plus } from 'lucide-svelte'
  import { invalidate } from '$app/navigation'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import TransitionButton from '$lib/components/ui/transition-button.svelte'
  import type { TElection, TPosition } from '$lib/types'
  import { appCache } from '$lib/cache'
  import AddPositionModal from '$lib/components/admin/add-position-modal.svelte'

  let { data } = $props()
  const election = $derived(data.election)
  const positions = $derived(data.positions)
  let isCreateOpen = $state(false)

  function openCreate() {
    isCreateOpen = true
  }

  function closeCreate() {
    isCreateOpen = false
  }

  async function handleTransitionSuccess() {
    appCache.invalidate({ resource: 'elections' })
    appCache.invalidate({ resource: 'election', params: { id: election.id } })
    appCache.invalidate({ params: { electionId: election.id } })
    appCache.invalidate({ resource: 'votingState' })
    await invalidate('app:election')
  }
</script>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
    <a
      href='/admin/elections'
      class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
      style='color: oklch(0.70 0.015 250)'
    >
      <ArrowLeft size={16} />
      Back to elections
    </a>

    <!-- Header -->
    <header
      class='rounded-2xl border p-5 shadow-lg mb-6 flex flex-wrap items-start justify-between gap-4'
      style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
    >
      <div>
        <div class='flex items-center gap-3 mb-2'>
          <h1 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>{election.name}</h1>
          <StatusBadge status={election.status} />
        </div>
        <p class='text-sm' style='color: oklch(0.70 0.015 250)'>
          {election.description || '(no description)'}
        </p>
      </div>
      <div class='flex items-center gap-3'>
        <a
          href={`/admin/audit-log?targetType=election&targetId=${election.id}`}
          class='flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer'
        >
          View Audit Trail →
        </a>
        <TransitionButton {election} onsuccess={handleTransitionSuccess} />
      </div>
    </header>

    {#if positions.length === 0}
      <EmptyState
        icon={ListOrdered}
        title='No positions yet'
        description='Add positions for this election.'
        cta='Add position'
        oncta={openCreate}
      />
    {:else}
      <!-- Positions -->
      <section
        class='rounded-2xl border p-5 shadow-lg'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='flex items-center justify-between mb-4'>
          <h2 class='text-lg font-black' style='color: oklch(0.95 0.008 250)'>Positions</h2>
          <button
            type='button'
            onclick={openCreate}
            class='flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg cursor-pointer'
            style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
          >
            <Plus size={16} stroke-width={2.5} />
            Add position
          </button>
        </div>

        <ul class='space-y-2'>
          {#each positions as p (p.id)}
            <li>
              <a
                href={`/admin/elections/${election.id}/positions/${p.id}`}
                class='flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-lg cursor-pointer'
                style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
              >
                <div>
                  <p class='font-bold' style='color: oklch(0.95 0.008 250)'>{p.name}</p>
                  <p class='text-xs' style='color: oklch(0.60 0.015 250)'>Order: {p.displayOrder}</p>
                </div>
                <span class='text-xs font-bold' style='color: oklch(0.55 0.15 250)'>Open →</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</div>

{#if isCreateOpen}
<AddPositionModal
  onclose={closeCreate}
  electionId={election.id}
  onsuccess={closeCreate}
/>
{/if}
