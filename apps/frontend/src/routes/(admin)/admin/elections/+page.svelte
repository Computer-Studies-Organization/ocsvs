<script lang='ts'>
  import { onMount } from 'svelte'
  import { Plus, Loader, CalendarRange } from 'lucide-svelte'
  import { listElections, createElection } from '$lib/api/elections'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast'
  import { validate } from '$lib/validation/helpers'
  import { createElectionSchema } from '$lib/validation/election'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import type { TElection, TElectionStatus } from '$lib/types'

  let elections = $state<TElection[]>([])
  let isLoading = $state(true)
  let error = $state('')
  let statusFilter = $state<TElectionStatus | 'all'>('all')
  let isCreateOpen = $state(false)
  let createName = $state('')
  let createDescription = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})

  const tabs: Array<{ value: TElectionStatus | 'all', label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
  ]

  function formatDate(unixSeconds: number | null): string {
    if (!unixSeconds)
      return ''
    return new Date(unixSeconds * 1000).toLocaleString()
  }

  async function load() {
    isLoading = true
    error = ''
    try {
      elections = await listElections(statusFilter === 'all' ? undefined : statusFilter)
    }
    catch (e: unknown) {
      addToast('error', extractErrorMessage(e, 'Failed to load elections'))
    }
    finally {
      isLoading = false
    }
  }

  onMount(load)

  $effect(() => {
    void statusFilter
    load()
  })

  function openCreate() {
    createName = ''
    createDescription = ''
    isCreateOpen = true
  }

  function closeCreate() {
    if (createBusy)
      return
    isCreateOpen = false
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    const result = validate(createElectionSchema, { name: createName.trim(), description: createDescription.trim() || undefined })
    if (!result.ok) {
      createErrors = result.errors
      return
    }
    createErrors = {}
    createBusy = true
    try {
      await createElection({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      })
      isCreateOpen = false
      createName = ''
      createDescription = ''
      await load()
      addToast('success', 'Election created')
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to create election'))
    }
    finally {
      createBusy = false
    }
  }
</script>

<div class='min-h-[100dvh]' style='background: oklch(0.16 0.020 250)'>
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
    <!-- Header -->
    <header class='mb-6 flex flex-wrap items-center justify-between gap-4'>
      <div>
        <p class='inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/90 mb-2'>
          <span class='h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'></span>
          Admin Panel
        </p>
        <h1 class='text-2xl font-black sm:text-3xl' style='color: oklch(0.95 0.008 250)'>Elections</h1>
        <p class='mt-1 text-xs' style='color: oklch(0.65 0.015 250)'>
          Manage election lifecycles, positions, and candidates.
        </p>
      </div>
      <button
        type='button'
        onclick={openCreate}
        class='flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
      >
        <Plus size={18} stroke-width={2.5} />
        New election
      </button>
    </header>

    <!-- Status filter tabs -->
    <div class='mb-4 flex flex-wrap gap-2'>
      {#each tabs as tab (tab.value)}
        <button
          type='button'
          onclick={() => (statusFilter = tab.value)}
          class='px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer'
          style={statusFilter === tab.value
            ? 'background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250)'
            : 'background: oklch(0.20 0.022 250); color: oklch(0.70 0.015 250); border: 1px solid oklch(0.25 0.025 250)'}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Body -->
    {#if isLoading}
      <div class='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {#each { length: 4 } as _}
          <SkeletonCard />
        {/each}
      </div>
    {:else if error}
      <div class='rounded-2xl border p-8 shadow-2xl' style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'>
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>{error}</p>
      </div>
    {:else if elections.length === 0}
      <EmptyState
        icon={CalendarRange}
        title='No elections yet'
        description='Create your first election to get started.'
        cta='New election'
        oncta={openCreate}
      />
    {:else}
      <div class='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {#each elections as election (election.id)}
          <a
            href={`/admin/elections/${election.id}`}
            class='block rounded-2xl border p-5 shadow-lg transition-all hover:shadow-xl cursor-pointer'
            style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
          >
            <div class='flex items-start justify-between gap-3 mb-2'>
              <h3 class='text-lg font-black' style='color: oklch(0.95 0.008 250)'>
                {election.name}
              </h3>
              <StatusBadge status={election.status} />
            </div>
            <p class='text-sm mb-3' style='color: oklch(0.70 0.015 250)'>
              {election.description || '(no description)'}
            </p>
            <div class='flex items-center justify-between text-xs' style='color: oklch(0.60 0.015 250)'>
              <span>Created {formatDate(election.createdAt)}</span>
              <span class='font-bold' style='color: oklch(0.55 0.15 250)'>Manage →</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- New Election Modal -->
<Modal open={isCreateOpen} onclose={closeCreate}>
  <h2 class='text-xl font-black mb-4' style='color: oklch(0.95 0.008 250)'>New election</h2>


  <form onsubmit={submitCreate} class='space-y-5'>
    <div class='space-y-2'>
      <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Name
      </label>
      <input
        type='text'
        bind:value={createName}
        required
        disabled={createBusy}
        placeholder='CSO General Elections 2026'
        oninput={() => { if (createErrors.name) createErrors.name = '' }}
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {createErrors.name ? 'border-red-500' : ''}'
        style='background: oklch(0.16 0.020 250); border-color: {createErrors.name ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)'
      />
      {#if createErrors.name}
        <p class='text-xs mt-1' style='color: oklch(0.65 0.15 25)'>{createErrors.name}</p>
      {/if}
    </div>

    <div class='space-y-2'>
      <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Description (optional)
      </label>
      <textarea
        bind:value={createDescription}
        rows={3}
        disabled={createBusy}
        placeholder='Annual student council elections…'
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold resize-none transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      ></textarea>
    </div>

    <div class='flex gap-3 pt-2'>
      <button
        type='button'
        onclick={closeCreate}
        disabled={createBusy}
        class='flex-1 px-4 py-3 rounded-xl font-bold transition cursor-pointer'
        style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
      >
        Cancel
      </button>
      <button
        type='submit'
        disabled={createBusy || !createName.trim()}
        class='flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
      >
        {#if createBusy}<Loader class='animate-spin' size={18} />{/if}
        {createBusy ? 'Creating…' : 'Create election'}
      </button>
    </div>
  </form>
</Modal>
