<script lang='ts'>
  import { ArrowLeft, Edit, Flag, ListOrdered, Plus } from 'lucide-svelte'
  import { goto, invalidate } from '$app/navigation'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import TransitionButton from '$lib/components/ui/transition-button.svelte'
  import type { TElection, TPartyList, TPosition } from '$lib/types'
  import { appCache } from '$lib/cache'
  import AddPositionModal from '$lib/components/admin/add-position-modal.svelte'
  import EditPositionModal from '$lib/components/admin/edit-position-modal.svelte'
  import AddPartyModal from '$lib/components/admin/add-party-modal.svelte'
  import EditPartyModal from '$lib/components/admin/edit-party-modal.svelte'

  let { data } = $props()
  const election = $derived(data.election)
  const positions = $derived(data.positions)
  const partyLists = $derived(data.partyLists)
  let isCreateOpen = $state(false)
  let editingPosition = $state<TPosition | null>(null)

  let isPartyCreateOpen = $state(false)
  let editingParty = $state<TPartyList | null>(null)

  function openCreate() {
    isCreateOpen = true
  }

  function closeCreate() {
    isCreateOpen = false
  }

  function openEdit(p: TPosition) {
    editingPosition = p
  }

  function closeEdit() {
    editingPosition = null
  }

  async function handleEditSuccess() {
    closeEdit()
    await invalidate('app:election')
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
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6'>
    <a
      href='/admin/elections'
      class='inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80'
      style='color: oklch(0.70 0.015 250)'
    >
      <ArrowLeft size={16} />
      Back to elections
    </a>

    <!-- Header -->
    <header
      class='rounded-2xl border p-5 shadow-lg flex flex-wrap items-start justify-between gap-4'
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

    <!-- Party Lists Section -->
    <section
      class='rounded-2xl border p-5 shadow-lg'
      style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
    >
      <div class='flex items-center justify-between mb-4'>
        <div class='flex items-center gap-2'>
          <Flag size={20} class='text-sky-400' />
          <h2 class='text-lg font-black' style='color: oklch(0.95 0.008 250)'>Party Lists (Slates)</h2>
        </div>
        {#if election.status === 'draft'}
          <button
            type='button'
            onclick={() => isPartyCreateOpen = true}
            class='flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg cursor-pointer'
            style='background: oklch(0.45 0.15 250); color: oklch(0.98 0.005 250)'
          >
            <Plus size={16} stroke-width={2.5} />
            Add Party List
          </button>
        {/if}
      </div>

      {#if partyLists.length === 0}
        <p class='text-xs italic' style='color: oklch(0.60 0.015 250)'>No party lists created yet. Candidates will default to Independent.</p>
      {:else}
        <div class='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
          {#each partyLists as party (party.id)}
            <div
              class='flex items-center justify-between p-3.5 rounded-xl border transition hover:border-slate-700/80'
              style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
            >
              <div class='flex items-center gap-3'>
                <span
                  class='w-3.5 h-3.5 rounded-full shrink-0'
                  style='background-color: {party.color || '#3B82F6'}'
                ></span>
                <div>
                  <p class='font-bold text-sm text-slate-100'>{party.name}</p>
                  <span class='text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-sky-400'>
                    {party.code}
                  </span>
                </div>
              </div>
              {#if election.status === 'draft'}
                <button
                  type='button'
                  onclick={() => editingParty = party}
                  class='p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer text-slate-400 hover:text-slate-200'
                  title='Edit Party'
                >
                  <Edit size={16} />
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Positions Section -->
    {#if positions.length === 0}
      <EmptyState
        icon={ListOrdered}
        title='No positions yet'
        description='Add positions for this election.'
        cta='Add position'
        oncta={openCreate}
      />
    {:else}
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
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                onclick={() => goto(`/admin/elections/${election.id}/positions/${p.id}`)}
                class='flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-lg cursor-pointer hover:border-slate-700/80 hover:scale-[1.005]'
                style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
              >
                <div>
                  <p class='font-bold' style='color: oklch(0.95 0.008 250)'>{p.name}</p>
                  <p class='text-xs' style='color: oklch(0.60 0.015 250)'>Order: {p.displayOrder}</p>
                </div>
                <div class='flex items-center gap-3'>
                  {#if election.status === 'draft'}
                    <button
                      type='button'
                      onclick={(e) => {
                        e.stopPropagation()
                        openEdit(p)
                      }}
                      class='rounded-lg p-1.5 transition-colors cursor-pointer hover:bg-slate-800'
                      style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
                      title='Edit position'
                    >
                      <Edit size={16} />
                    </button>
                  {/if}
                  <span class='text-xs font-bold' style='color: oklch(0.55 0.15 250)'>Open →</span>
                </div>
              </div>
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

{#if editingPosition}
<EditPositionModal
  onclose={closeEdit}
  electionId={election.id}
  position={editingPosition}
  onsuccess={handleEditSuccess}
/>
{/if}

{#if isPartyCreateOpen && election.status === 'draft'}
<AddPartyModal
  onclose={() => isPartyCreateOpen = false}
  electionId={election.id}
  onsuccess={() => isPartyCreateOpen = false}
/>
{/if}

{#if editingParty && election.status === 'draft'}
<EditPartyModal
  onclose={() => editingParty = null}
  electionId={election.id}
  party={editingParty}
  onsuccess={() => editingParty = null}
/>
{/if}
