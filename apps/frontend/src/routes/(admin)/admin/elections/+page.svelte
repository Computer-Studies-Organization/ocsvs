<script lang='ts'>
  import { Plus, Loader, CalendarRange } from 'lucide-svelte'
  import { invalidate } from '$app/navigation'
  import { createElection } from '$lib/api/elections'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { createElectionSchema } from '$lib/validation/election'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import type { TElection, TElectionStatus } from '$lib/types'
  import { appCache } from '$lib/cache'
  import { formatDate } from '$lib/utils'

  let { data } = $props()
  const elections = $derived(data.elections)
  let isCreateOpen = $state(false)
  let createName = $state('')
  let createDescription = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})

  function openCreate() {
    createName = ''
    createDescription = ''
    isCreateOpen = true
  }

  function closeCreate() {
    if (createBusy) return
    isCreateOpen = false
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    const result = validate(createElectionSchema, {
      name: createName.trim(),
      description: createDescription.trim() || undefined,
    })
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
      appCache.invalidate({ resource: 'elections' })
      appCache.invalidate({ resource: 'votingState' })
      await invalidate('app:elections')
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

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
    <div class='flex flex-wrap items-center justify-between gap-4 mb-6'>
      <h1 class='text-3xl font-black' style='color: oklch(0.95 0.008 250)'>Elections</h1>
      <button
        type='button'
        onclick={openCreate}
        class='flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
      >
        <Plus size={18} stroke-width={2.5} />
        New election
      </button>
    </div>

    {#if elections.length === 0}
      <EmptyState
        icon={CalendarRange}
        title='No elections yet'
        description='Create your first election to get started.'
        cta='Create election'
        oncta={openCreate}
      />
    {:else}
      <div class='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {#each elections as election (election.id)}
          <a
            href={`/admin/elections/${election.id}`}
            class='group block rounded-2xl border p-5 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] cursor-pointer'
            style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
          >
            <div class='flex items-start justify-between gap-3 mb-3'>
              <h2 class='text-lg font-black line-clamp-2' style='color: oklch(0.95 0.008 250)'>{election.name}</h2>
              <StatusBadge status={election.status} />
            </div>
            <p class='text-xs line-clamp-2 mb-4' style='color: oklch(0.60 0.015 250)'>
              {election.description || '(no description)'}
            </p>
            <div class='space-y-1'>
              {#if election.opensAt}
                <p class='text-xs' style='color: oklch(0.60 0.015 250)'>
                  Opens: {formatDate(election.opensAt)}
                </p>
              {/if}
              {#if election.closesAt}
                <p class='text-xs' style='color: oklch(0.60 0.015 250)'>
                  Closes: {formatDate(election.closesAt)}
                </p>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Create Election Modal -->
<Modal open={isCreateOpen} onclose={closeCreate}>
  <h2 class='text-xl font-black mb-4' style='color: oklch(0.95 0.008 250)'>Create election</h2>

  <form onsubmit={submitCreate} class='space-y-5'>
    <div class='space-y-2'>
      <label for='createElectionName' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Name
      </label>
      <input
        id='createElectionName'
        type='text'
        bind:value={createName}
        required
        disabled={createBusy}
        placeholder='Spring 2025 Election'
        oninput={() => { if (createErrors.name) createErrors.name = '' }}
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {createErrors.name ? 'border-red-500' : ''}'
        style='background: oklch(0.16 0.020 250); border-color: {createErrors.name ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)'
      />
      {#if createErrors.name}
        <p class='text-xs mt-1' style='color: oklch(0.65 0.15 25)'>{createErrors.name}</p>
      {/if}
    </div>

    <div class='space-y-2'>
      <label for='createElectionDescription' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Description (optional)
      </label>
      <textarea
        id='createElectionDescription'
        bind:value={createDescription}
        rows={3}
        disabled={createBusy}
        placeholder='Annual student council election...'
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none resize-none'
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
