<script lang='ts'>
  import { ArrowLeft, Edit, Flag, ListOrdered, Plus, MoreHorizontal } from 'lucide-svelte'
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
  import EditElectionModal from '$lib/components/admin/edit-election-modal.svelte'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'

  let { data } = $props()
  const election = $derived(data.election)
  const positions = $derived(data.positions)
  const partyLists = $derived(data.partyLists)
  const candidates = $derived(data.candidates)
  const displayStatus = $derived(getEffectiveElectionStatus(election))

  let isCreateOpen = $state(false)
  let editingPosition = $state<TPosition | null>(null)

  let isPartyCreateOpen = $state(false)
  let editingParty = $state<TPartyList | null>(null)

  let activeTab = $state('overview')
  let isMenuOpen = $state(false)
  let isEditElectionOpen = $state(false)

  const lifecycleInfo = $derived({
    title: displayStatus === 'draft' ? 'Draft for setup' : displayStatus === 'open' ? 'Open for voting' : displayStatus === 'closed' ? 'Closed for voting' : 'Archived',
    steps: [
      { label: 'Draft', color: displayStatus === 'draft' ? 'bg-sky-500' : 'bg-emerald-500' },
      { label: 'Open', color: displayStatus === 'draft' ? 'bg-slate-800' : displayStatus === 'open' ? 'bg-sky-500' : 'bg-emerald-500' },
      { label: 'Closed', color: displayStatus === 'draft' || displayStatus === 'open' ? 'bg-slate-800' : displayStatus === 'closed' ? 'bg-sky-500' : 'bg-emerald-500' }
    ]
  })

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

<svelte:window
  onkeydown={(e) => {
    if (isMenuOpen && e.key === 'Escape') {
      isMenuOpen = false
    }
  }}
/>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto max-w-6xl space-y-6 px-3 py-4 sm:px-6 sm:py-6 lg:px-8'>
    <a
      href='/admin/elections'
      class='inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80'
      style='color: oklch(0.70 0.015 250)'
    >
      <ArrowLeft size={16} />
      Back to elections
    </a>

    <!-- Header -->
    <header
      class='flex flex-col gap-4 rounded-2xl border p-4 shadow-lg sm:p-5'
      style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
    >
      <div class='flex flex-wrap items-start justify-between gap-3 sm:gap-4'>
        <div class='min-w-0 flex-1'>
          <div class='mb-2 flex flex-wrap items-start gap-2 sm:items-center sm:gap-3'>
            <h1 class='min-w-0 break-words text-2xl font-black' style='color: oklch(0.95 0.008 250)'>{election.name}</h1>
            <StatusBadge status={displayStatus} />
          </div>
          <p class='text-sm line-clamp-2' style='color: oklch(0.70 0.015 250)'>
            {election.description || '(no description)'}
          </p>
        </div>
      </div>

      <div class='w-full h-[1px]' style='background-color: oklch(0.25 0.025 250)'></div>

      <div class='flex flex-wrap items-start justify-between gap-3'>
        <span class='text-xs' style='color: oklch(0.70 0.015 250)'>
          {partyLists.length} {partyLists.length === 1 ? 'slate' : 'slates'} &middot; {positions.length} {positions.length === 1 ? 'position' : 'positions'} &middot; {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'}
        </span>

        <!-- Triple dots button with dropdown -->
        {#if election.status === 'draft'}
          <div class='relative inline-block text-left shrink-0'>
            <button
              onclick={() => isMenuOpen = !isMenuOpen}
              type='button'
              aria-label={isMenuOpen ? 'Close election actions' : 'Open election actions'}
              class='flex h-11 w-11 items-center justify-center rounded-xl transition cursor-pointer hover:bg-slate-800 text-slate-400 hover:text-slate-200 border'
              style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
            >
              <MoreHorizontal size={18} />
            </button>
            
            {#if isMenuOpen}
              <!-- Backdrop to close dropdown on click outside -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class='fixed inset-0 z-10' onclick={() => isMenuOpen = false}></div>
              
              <div
                class='absolute right-0 mt-2 w-48 rounded-xl border shadow-lg py-1 z-20 focus:outline-none'
                style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
              >
                <button
                  onclick={() => { isMenuOpen = false; isEditElectionOpen = true; }}
                  class='w-full text-left px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-800 cursor-pointer flex items-center gap-2'
                  style='color: oklch(0.95 0.008 250)'
                >
                  <Edit size={14} />
                  Edit election
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </header>

    <!-- Tab Bar -->
    <div class='flex rounded-2xl p-1 border gap-1' style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'>
      <button
        onclick={() => activeTab = 'overview'}
        class="min-h-11 flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer text-center border {activeTab === 'overview' ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 font-black' : 'text-slate-400 hover:text-slate-200 border-transparent'}"
      >
        Overview
      </button>
      <button
        onclick={() => activeTab = 'parties'}
        class="min-h-11 flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer text-center border {activeTab === 'parties' ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 font-black' : 'text-slate-400 hover:text-slate-200 border-transparent'}"
      >
        Party lists
      </button>
      <button
        onclick={() => activeTab = 'positions'}
        class="min-h-11 flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer text-center border {activeTab === 'positions' ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 font-black' : 'text-slate-400 hover:text-slate-200 border-transparent'}"
      >
        Positions
      </button>
    </div>

    <!-- Active Tab Content -->
    <!-- Overview Tab -->
    <div class='space-y-6' class:hidden={activeTab !== 'overview'}>
      <!-- Stats Grid -->
      <div class='grid grid-cols-2 gap-4'>
        <button
          onclick={() => activeTab = 'parties'}
          class='flex flex-col items-start justify-between p-5 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.02] hover:bg-slate-900/50'
          style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
        >
          <span class='text-3xl font-black mb-2' style='color: oklch(0.95 0.008 250)'>{partyLists.length}</span>
          <span class='text-xs font-semibold' style='color: oklch(0.70 0.015 250)'>Party {partyLists.length === 1 ? 'list' : 'lists'}</span>
        </button>
        <button
          onclick={() => activeTab = 'positions'}
          class='flex flex-col items-start justify-between p-5 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.02] hover:bg-slate-900/50'
          style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
        >
          <span class='text-3xl font-black mb-2' style='color: oklch(0.95 0.008 250)'>{positions.length}</span>
          <span class='text-xs font-semibold' style='color: oklch(0.70 0.015 250)'>{positions.length === 1 ? 'Position' : 'Positions'}</span>
        </button>
      </div>

      <!-- Lifecycle Card -->
      <div
        class='rounded-2xl border p-5 shadow-lg space-y-4'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div>
          <h2 class='text-xl font-black' style='color: oklch(0.95 0.008 250)'>{lifecycleInfo.title}</h2>
          <p class='text-xs font-semibold' style='color: oklch(0.70 0.015 250)'>Election lifecycle</p>
        </div>

        <!-- Progress indicators -->
        <div class='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          {#each lifecycleInfo.steps as step}
            <div class='flex flex-col gap-2'>
              <div class='h-2.5 rounded-full {step.color} w-full transition-colors duration-300'></div>
              <span class='text-xs font-semibold' style='color: oklch(0.70 0.015 250)'>{step.label}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Buttons Row -->
      <div class='flex flex-wrap items-center justify-end gap-3'>
        <a
          href={`/admin/audit-log?targetType=election&targetId=${election.id}`}
          class='min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-sm font-bold text-sky-400 hover:bg-sky-500/10 transition cursor-pointer text-center'
        >
          Audit trail &rarr;
        </a>
        <TransitionButton {election} onsuccess={handleTransitionSuccess} />
      </div>
    </div>

    <!-- Party Lists Tab -->
    <div class:hidden={activeTab !== 'parties'}>
      <section
        class='rounded-2xl border p-5 shadow-lg'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='flex items-center justify-between mb-4 gap-4'>
          <div class='flex items-center gap-2'>
            <Flag size={20} class='text-sky-400 shrink-0' />
            <h2 class='text-lg font-black' style='color: oklch(0.95 0.008 250)'>Party Lists (Slates)</h2>
          </div>
          {#if election.status === 'draft'}
            <button
              type='button'
              onclick={() => isPartyCreateOpen = true}
              class='hidden md:flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg cursor-pointer shrink-0'
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
              {@const partyCandidates = candidates.filter((candidate) => candidate.partyId === party.id)}
              <article
                class='overflow-hidden rounded-xl border transition hover:border-slate-700/80'
                style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
              >
                <div class='flex items-start gap-2 p-3.5'>
                  <details class='min-w-0 flex-1'>
                    <summary class='min-h-11 cursor-pointer rounded-lg px-1 py-2 text-left transition hover:bg-slate-900/50'>
                      <span class='flex items-center gap-3'>
                        <span
                          class='h-3.5 w-3.5 shrink-0 rounded-full'
                          style='background-color: {party.color || '#3B82F6'}'
                        ></span>
                        <span class='min-w-0 flex-1'>
                          <span class='block truncate text-sm font-bold text-slate-100'>{party.name}</span>
                          <span class='inline-block max-w-full truncate rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono font-bold text-sky-400'>
                            {party.code}
                          </span>
                        </span>
                        <span class='shrink-0 text-xs' style='color: oklch(0.60 0.015 250)'>
                          {partyCandidates.length} {partyCandidates.length === 1 ? 'candidate' : 'candidates'}
                        </span>
                      </span>
                    </summary>

                    <div class='mt-3 border-t pt-3' style='border-color: oklch(0.25 0.025 250)'>
                      {#if partyCandidates.length === 0}
                        <p class='px-1 text-xs italic' style='color: oklch(0.60 0.015 250)'>No candidates assigned to this party list yet.</p>
                      {:else}
                        <ul class='space-y-2'>
                          {#each partyCandidates as candidate (candidate.id)}
                            {@const position = positions.find((item) => item.id === candidate.positionId)}
                            <li>
                              <a
                                href={`/admin/elections/${election.id}/positions/${candidate.positionId}/candidates/${candidate.id}`}
                                class='flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 transition hover:border-sky-500/40 hover:bg-slate-900/60'
                                style='border-color: oklch(0.25 0.025 250)'
                              >
                                <span class='min-w-0'>
                                  <span class='block truncate text-sm font-semibold text-slate-100'>{candidate.fullName}</span>
                                  <span class='block truncate text-xs' style='color: oklch(0.60 0.015 250)'>{position?.name ?? 'Unknown position'}</span>
                                </span>
                                {#if candidate.isActive === 0}
                                  <span class='shrink-0 text-[10px] font-bold uppercase tracking-wider' style='color: oklch(0.60 0.015 250)'>Inactive</span>
                                {/if}
                              </a>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    </div>
                  </details>

                  {#if election.status === 'draft'}
                    <button
                      type='button'
                      onclick={() => editingParty = party}
                      aria-label="Edit {party.name} party list"
                      title='Edit Party'
                      class='inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-slate-800 transition cursor-pointer text-slate-400 hover:text-slate-200 shrink-0'
                    >
                      <Edit size={16} />
                    </button>
                  {/if}
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>
    </div>

    <!-- Positions Tab -->
    <div class:hidden={activeTab !== 'positions'}>
      {#if positions.length === 0}
        <EmptyState
          icon={ListOrdered}
          title='No positions yet'
          description={election.status === 'draft' ? 'Add positions for this election.' : 'No positions have been defined for this election.'}
          cta={election.status === 'draft' ? 'Add position' : undefined}
          oncta={election.status === 'draft' ? openCreate : undefined}
        />
      {:else}
        <section
          class='rounded-2xl border p-5 shadow-lg'
          style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
        >
          <div class='flex items-center justify-between mb-4 gap-4'>
            <h2 class='text-lg font-black' style='color: oklch(0.95 0.008 250)'>Positions</h2>
            {#if election.status === 'draft'}
              <button
                type='button'
                onclick={openCreate}
                class='hidden md:flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg cursor-pointer shrink-0'
                style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
              >
                <Plus size={16} stroke-width={2.5} />
                Add position
              </button>
            {/if}
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
                  <div class='min-w-0'>
                    <p class='font-bold truncate' style='color: oklch(0.95 0.008 250)'>{p.name}</p>
                    <p class='text-xs' style='color: oklch(0.60 0.015 250)'>Order: {p.displayOrder}</p>
                  </div>
                  <div class='flex items-center gap-3 shrink-0'>
                    {#if election.status === 'draft'}
                      <button
                        type='button'
                        onclick={(e) => {
                          e.stopPropagation()
                          openEdit(p)
                        }}
                        aria-label="Edit {p.name} position"
                        class='inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors cursor-pointer hover:bg-slate-800'
                        style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
                      >
                        <Edit size={16} />
                      </button>
                    {/if}
                    <span class='text-xs font-bold' style='color: oklch(0.55 0.15 250)'>Open &rarr;</span>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  </div>

  <!-- Floating Action Buttons for Mobile/Non-Desktop Screens -->
  {#if election.status === 'draft' && activeTab === 'parties'}
    <button
      type='button'
      onclick={() => isPartyCreateOpen = true}
      class='md:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 cursor-pointer'
      style='background: oklch(0.45 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.45 0.15 250 / 0.4)'
      aria-label='Add Party List'
    >
      <Plus size={24} stroke-width={2.5} />
    </button>
  {/if}

  {#if election.status === 'draft' && activeTab === 'positions'}
    <button
      type='button'
      onclick={openCreate}
      class='md:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 cursor-pointer'
      style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.4)'
      aria-label='Add Position'
    >
      <Plus size={24} stroke-width={2.5} />
    </button>
  {/if}
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

{#if isEditElectionOpen}
<EditElectionModal
  onclose={() => isEditElectionOpen = false}
  {election}
  onsuccess={() => isEditElectionOpen = false}
/>
{/if}
