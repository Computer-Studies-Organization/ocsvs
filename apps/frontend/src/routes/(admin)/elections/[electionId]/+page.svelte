<script lang='ts'>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { ArrowLeft, Loader, Plus } from 'lucide-svelte'
  import { getElection } from '$lib/api/elections'
  import { createPosition, listPositions } from '$lib/api/positions'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'
  import TransitionButton from '$lib/components/ui/transition-button.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import type { TElection, TPosition } from '$lib/types'

  let election = $state<TElection | null>(null)
  let positions = $state<TPosition[]>([])
  let isLoading = $state(true)
  let error = $state('')
  let isCreateOpen = $state(false)
  let createName = $state('')
  let createOrder = $state('')
  let createBusy = $state(false)
  let createError = $state('')

  const electionId = $derived(page.params.electionId)

  async function load() {
    if (!electionId)
      return
    isLoading = true
    error = ''
    try {
      const [e, p] = await Promise.all([
        getElection(electionId),
        listPositions(electionId),
      ])
      election = e
      positions = p
    }
    catch (e: unknown) {
      error = `Couldn't load election: ${extractErrorMessage(e, 'Unknown error')}`
    }
    finally {
      isLoading = false
    }
  }

  onMount(load)

  $effect(() => {
    electionId
    load()
  })

  function openCreate() {
    createName = ''
    createOrder = ''
    createError = ''
    isCreateOpen = true
  }

  function closeCreate() {
    if (createBusy)
      return
    isCreateOpen = false
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    if (!createName.trim() || !electionId)
      return
    createBusy = true
    createError = ''
    try {
      const orderNum = Number.parseInt(createOrder, 10)
      await createPosition(electionId, {
        name: createName.trim(),
        displayOrder: Number.isFinite(orderNum) ? orderNum : undefined,
      })
      isCreateOpen = false
      createName = ''
      createOrder = ''
      const p = await listPositions(electionId)
      positions = p
    }
    catch (err: unknown) {
      createError = extractErrorMessage(err, 'Failed to create position')
    }
    finally {
      createBusy = false
    }
  }
</script>

<div class='min-h-[100dvh]' style='background: oklch(0.16 0.020 250)'>
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
    <a
      href='/admin/elections'
      class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
      style='color: oklch(0.70 0.015 250)'
    >
      <ArrowLeft size={16} />
      Back to elections
    </a>

    {#if isLoading}
      <div
        class='rounded-2xl border p-8 shadow-2xl flex items-center justify-center gap-3'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <Spinner size={28} />
        <p class='text-sm font-medium' style='color: oklch(0.70 0.015 250)'>Loading election…</p>
      </div>
    {:else if error || !election}
      <div
        class='rounded-2xl border p-8 shadow-2xl'
        style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'
      >
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>{error || 'Election not found.'}</p>
      </div>
    {:else}
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
        <TransitionButton {election} onsuccess={load} />
      </header>

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

        {#if positions.length === 0}
          <p class='text-sm text-center py-6' style='color: oklch(0.70 0.015 250)'>
            No positions yet. Add positions before opening.
          </p>
        {:else}
          <ul class='space-y-2'>
            {#each positions as p (p.id)}
              <li>
                <a
                  href={`/admin/elections/${electionId}/positions/${p.id}`}
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
        {/if}
      </section>
    {/if}
  </div>
</div>

<!-- Add Position Modal -->
<Modal open={isCreateOpen} onclose={closeCreate}>
  <h2 class='text-xl font-black mb-4' style='color: oklch(0.95 0.008 250)'>Add position</h2>

  {#if createError}
    <div
      class='mb-4 rounded-xl px-4 py-3 text-sm'
      style='background: oklch(0.40 0.15 25 / 0.25); color: oklch(0.98 0.005 250); border: 1px solid oklch(0.40 0.15 25 / 0.5)'
    >
      {createError}
    </div>
  {/if}

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
        placeholder='President'
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
    </div>

    <div class='space-y-2'>
      <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Display order (optional)
      </label>
      <input
        type='number'
        bind:value={createOrder}
        disabled={createBusy}
        placeholder='0'
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
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
        {createBusy ? 'Creating…' : 'Add position'}
      </button>
    </div>
  </form>
</Modal>
