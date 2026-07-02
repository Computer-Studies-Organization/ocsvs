<script lang='ts'>
  import { ArrowLeft, Edit, Loader, Plus, Users } from 'lucide-svelte'
  import { invalidate } from '$app/navigation'
  import { updatePosition } from '$lib/api/positions'
  import { createCandidate } from '$lib/api/candidates'
  import { fetchUsers } from '$lib/api/users'
  import { getCandidateUserLabel, resolveCandidateUserSelection } from '$lib/adminUsers'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast'
  import Modal from '$lib/components/ui/modal.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import { validate } from '$lib/validation/helpers'
  import { createCandidateSchema } from '$lib/validation/candidate'
  import { updatePositionSchema } from '$lib/validation/position'
  import type { TElection, TPosition, TUsersData } from '$lib/types'
  import { appCache } from '$lib/cache'

  type CandidateRow = {
    id: string
    fullName: string
    isActive?: number
  }

  let { data } = $props()
  let election = $derived(data.election)
  let position = $derived(data.position)
  let candidates = $derived<CandidateRow[]>(data.candidates)
  let users = $state<TUsersData[]>([])
  let usersError = $state('')
  let isCreateOpen = $state(false)
  let createAccountId = $state('')
  let createFullName = $state('')
  let createManifesto = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})

  let isEditOpen = $state(false)
  let editName = $state('')
  let editOrder = $state('')
  let editBusy = $state(false)
  let editErrors = $state<Record<string, string>>({})

  // Load users on mount for the create modal
  $effect(() => {
    fetchUsers({ limit: 100 })
      .then(res => { users = res.data })
      .catch(e => { usersError = extractErrorMessage(e, 'Failed to load users'); users = [] })
  })

  function openCreate() {
    createAccountId = ''
    createFullName = ''
    createManifesto = ''
    createErrors = {}
    isCreateOpen = true
  }

  function closeCreate() {
    if (createBusy) return
    isCreateOpen = false
  }

  function openEdit() {
    if (!position) return
    editName = position.name
    editOrder = String(position.displayOrder ?? '')
    editErrors = {}
    isEditOpen = true
  }

  function closeEdit() {
    if (editBusy) return
    isEditOpen = false
  }

  async function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    if (!election || !position) return
    const orderNum = Number.parseInt(editOrder, 10)
    const result = validate(updatePositionSchema, {
      name: editName.trim(),
      displayOrder: Number.isFinite(orderNum) ? orderNum : undefined,
    })
    if (!result.ok) {
      editErrors = result.errors
      return
    }
    editErrors = {}
    editBusy = true
    try {
      await updatePosition(election.id, position.id, {
        name: editName.trim(),
        displayOrder: Number.isFinite(orderNum) ? orderNum : undefined,
      })
      isEditOpen = false
      appCache.invalidate({ params: { electionId: election.id } })
      await invalidate('app:position')
      addToast('success', 'Position updated')
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to update position'))
    }
    finally {
      editBusy = false
    }
  }

  function handleUserSelect(accountId: string) {
    const selected = resolveCandidateUserSelection(users, accountId)
    createAccountId = selected?.accountId ?? ''
    createFullName = selected ? `${selected.firstName} ${selected.lastName}` : ''
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    if (!position || !election) return
    const result = validate(createCandidateSchema, {
      fullName: createFullName.trim(),
      manifesto: createManifesto.trim(),
    })
    if (!result.ok) {
      createErrors = result.errors
      return
    }
    if (!createAccountId) {
      createErrors = { ...createErrors, user: 'User is required' }
      return
    }
    createErrors = {}
    createBusy = true
    try {
      await createCandidate({
        fullName: createFullName.trim(),
        accountId: createAccountId,
        positionId: position.id,
        manifesto: createManifesto.trim(),
      } as never)
      isCreateOpen = false
      createAccountId = ''
      createFullName = ''
      createManifesto = ''
      appCache.invalidate({ params: { electionId: election.id } })
      await invalidate('app:position')
      addToast('success', 'Candidate added')
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to add candidate'))
    }
    finally {
      createBusy = false
    }
  }
</script>

<div class='min-h-[100dvh]' style='background: oklch(0.16 0.020 250)'>
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
    {#if election}
      <a
        href={`/admin/elections/${election.id}`}
        class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
        style='color: oklch(0.70 0.015 250)'
      >
        <ArrowLeft size={16} />
        {election.name}
      </a>
    {:else}
      <a
        href='/admin/elections'
        class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
        style='color: oklch(0.70 0.015 250)'
      >
        <ArrowLeft size={16} />
        Back to elections
      </a>
    {/if}

    {#if !position}
      <div
        class='rounded-2xl border p-8 shadow-2xl'
        style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'
      >
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>Position not found.</p>
      </div>
    {:else}
      <header
        class='rounded-2xl border p-5 shadow-lg mb-6'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='flex items-center gap-3'>
          <h1 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>{position.name}</h1>
          {#if election?.status === 'draft'}
            <button
              type='button'
              onclick={openEdit}
              class='rounded-lg p-1.5 transition-colors cursor-pointer'
              style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
              title='Edit position'
            >
              <Edit size={16} />
            </button>
          {/if}
        </div>
        <p class='text-sm mt-1' style='color: oklch(0.70 0.015 250)'>{election?.name ?? ''}</p>
      </header>

      <section
        class='rounded-2xl border p-5 shadow-lg'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='flex items-center justify-between mb-4'>
          <h2 class='text-lg font-black flex items-center gap-2' style='color: oklch(0.95 0.008 250)'>
            <Users size={18} />
            Candidates
          </h2>
          <button
            type='button'
            onclick={openCreate}
            class='flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg cursor-pointer'
            style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
          >
            <Plus size={16} stroke-width={2.5} />
            Add candidate
          </button>
        </div>

        {#if candidates.length === 0}
          <EmptyState
            icon={Users}
            title='No candidates yet'
            description='Add candidates for this position.'
            cta='Add candidate'
            oncta={openCreate}
          />
        {:else}
          <ul class='space-y-2'>
            {#each candidates as c (c.id)}
              <li>
                <a
                  href={`/admin/elections/${election?.id}/positions/${position.id}/candidates/${c.id}`}
                  class='flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-lg cursor-pointer'
                  style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
                >
                  <div>
                    <p class='font-bold' style='color: oklch(0.95 0.008 250)'>{c.fullName}</p>
                    {#if c.isActive === 0}
                      <p class='text-xs' style='color: oklch(0.60 0.015 250)'>Inactive</p>
                    {/if}
                  </div>
                  <span class='inline-flex items-center gap-1 text-xs font-bold' style='color: oklch(0.55 0.15 250)'>
                    <Edit size={14} />
                    Edit
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</div>

<!-- Add Candidate Modal -->
<Modal open={isCreateOpen} onclose={closeCreate}>
  <h2 class='text-xl font-black mb-4' style='color: oklch(0.95 0.008 250)'>Add candidate</h2>

  {#if usersError}
    <div class='mb-4 rounded-xl border border-yellow-500/30 px-4 py-2 text-sm' style='background: oklch(0.25 0.025 250); color: oklch(0.95 0.008 250)'>
      {usersError}
    </div>
  {/if}

  <form onsubmit={submitCreate} class='space-y-5'>
    <div class='space-y-2'>
      <label for='createAccountId' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        User
      </label>
      <select
        id='createAccountId'
        value={createAccountId}
        onchange={(e) => { handleUserSelect(e.currentTarget.value); if (createErrors.user) createErrors.user = '' }}
        required
        disabled={createBusy}
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {createErrors.user ? 'border-red-500' : ''}'
        style='background: oklch(0.16 0.020 250); border-color: {createErrors.user ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)'
      >
        <option value=''>Select a user</option>
        {#each users as u (u.accountId)}
          <option value={u.accountId}>{getCandidateUserLabel(u)}</option>
        {/each}
      </select>
      {#if createErrors.user}
        <p class='text-xs mt-1' style='color: oklch(0.65 0.15 25)'>{createErrors.user}</p>
      {/if}
    </div>

    <div class='space-y-2'>
      <label for='createFullName' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Full name
      </label>
      <input
        id='createFullName'
        type='text'
        value={createFullName}
        readonly
        required
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
    </div>

    <div class='space-y-2'>
      <label for='createManifesto' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Manifesto
      </label>
      <textarea
        id='createManifesto'
        bind:value={createManifesto}
        rows={5}
        required
        disabled={createBusy}
        oninput={() => { if (createErrors.manifesto) createErrors.manifesto = '' }}
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold resize-none transition focus:outline-none {createErrors.manifesto ? 'border-red-500' : ''}'
        style='background: oklch(0.16 0.020 250); border-color: {createErrors.manifesto ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)'
      ></textarea>
      {#if createErrors.manifesto}
        <p class='text-xs mt-1' style='color: oklch(0.65 0.15 25)'>{createErrors.manifesto}</p>
      {/if}
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
        disabled={createBusy || !createAccountId || !createFullName.trim() || !createManifesto.trim()}
        class='flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
      >
        {#if createBusy}<Loader class='animate-spin' size={18} />{/if}
        {createBusy ? 'Adding…' : 'Add candidate'}
      </button>
    </div>
  </form>
</Modal>

<!-- Edit Position Modal -->
<Modal open={isEditOpen} onclose={closeEdit}>
  <h2 class='text-xl font-black mb-4' style='color: oklch(0.95 0.008 250)'>Edit position</h2>

  <form onsubmit={submitEdit} class='space-y-5'>
    <div class='space-y-2'>
      <label for='editPositionName' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Name
      </label>
      <input
        id='editPositionName'
        type='text'
        bind:value={editName}
        required
        disabled={editBusy}
        placeholder='President'
        oninput={() => { if (editErrors.name) editErrors.name = '' }}
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {editErrors.name ? 'border-red-500' : ''}'
        style='background: oklch(0.16 0.020 250); border-color: {editErrors.name ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)'
      />
      {#if editErrors.name}
        <p class='text-xs mt-1' style='color: oklch(0.65 0.15 25)'>{editErrors.name}</p>
      {/if}
    </div>

    <div class='space-y-2'>
      <label for='editPositionOrder' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Display order (optional)
      </label>
      <input
        id='editPositionOrder'
        type='number'
        bind:value={editOrder}
        disabled={editBusy}
        placeholder='0'
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
    </div>

    <div class='flex gap-3 pt-2'>
      <button
        type='button'
        onclick={closeEdit}
        disabled={editBusy}
        class='flex-1 px-4 py-3 rounded-xl font-bold transition cursor-pointer'
        style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
      >
        Cancel
      </button>
      <button
        type='submit'
        disabled={editBusy || !editName.trim()}
        class='flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
      >
        {#if editBusy}<Loader class='animate-spin' size={18} />{/if}
        {editBusy ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  </form>
</Modal>
