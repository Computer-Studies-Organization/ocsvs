<script lang='ts'>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { ArrowLeft, Edit, Loader, Plus, Users } from 'lucide-svelte'
  import { getElection } from '$lib/api/elections'
  import { listPositions } from '$lib/api/positions'
  import { allCandidates, createCandidate } from '$lib/api/candidates'
  import { fetchUsers } from '$lib/api/users'
  import { getCandidateUserLabel, resolveCandidateUserSelection } from '$lib/adminUsers'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import Modal from '$lib/components/ui/modal.svelte'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import type { TElection, TPosition, TUsersData } from '$lib/types'

  type CandidateRow = {
    id: string
    fullName: string
    isActive?: number
  }

  let election = $state<TElection | null>(null)
  let position = $state<TPosition | null>(null)
  let candidates = $state<CandidateRow[]>([])
  let users = $state<TUsersData[]>([])
  let isLoading = $state(true)
  let error = $state('')
  let usersError = $state('')
  let isCreateOpen = $state(false)
  let createAccountId = $state('')
  let createFullName = $state('')
  let createManifesto = $state('')
  let createBusy = $state(false)
  let createError = $state('')

  const electionId = $derived(page.params.electionId)
  const positionId = $derived(page.params.positionId)

  async function load() {
    if (!electionId || !positionId)
      return
    isLoading = true
    error = ''
    try {
      const [e, allPos, candRes] = await Promise.all([
        getElection(electionId),
        listPositions(electionId),
        allCandidates({ electionId, positionId, includeInactive: true }),
      ])
      election = e
      position = allPos.find(p => p.id === positionId) ?? null
      candidates = candRes.data.map(c => ({
        id: c.id,
        fullName: c.fullName,
        isActive: (c as { isActive?: number }).isActive,
      }))
    }
    catch (e: unknown) {
      error = `Couldn't load position: ${extractErrorMessage(e, 'Unknown error')}`
    }
    finally {
      isLoading = false
    }
  }

  async function loadUsers() {
    try {
      const res = await fetchUsers({ limit: 100 })
      users = res.data
    }
    catch (e: unknown) {
      usersError = extractErrorMessage(e, 'Failed to load users')
      users = []
    }
  }

  onMount(() => {
    load()
    loadUsers()
  })

  $effect(() => {
    void electionId
    void positionId
    load()
  })

  function openCreate() {
    createAccountId = ''
    createFullName = ''
    createManifesto = ''
    createError = ''
    isCreateOpen = true
  }

  function closeCreate() {
    if (createBusy)
      return
    isCreateOpen = false
  }

  function handleUserSelect(accountId: string) {
    const selected = resolveCandidateUserSelection(users, accountId)
    createAccountId = selected?.accountId ?? ''
    createFullName = selected ? `${selected.firstName} ${selected.lastName}` : ''
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    if (!createAccountId || !createFullName.trim() || !createManifesto.trim() || !positionId || !electionId)
      return
    createBusy = true
    createError = ''
    const eId = electionId
    const pId = positionId
    try {
      await createCandidate({
        fullName: createFullName.trim(),
        accountId: createAccountId,
        positionId: pId,
        manifesto: createManifesto.trim(),
      } as never)
      isCreateOpen = false
      createAccountId = ''
      createFullName = ''
      createManifesto = ''
      const candRes = await allCandidates({ electionId: eId, positionId: pId, includeInactive: true })
      candidates = candRes.data.map(c => ({
        id: c.id,
        fullName: c.fullName,
        isActive: (c as { isActive?: number }).isActive,
      }))
    }
    catch (err: unknown) {
      createError = extractErrorMessage(err, 'Failed to create candidate')
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
        href={`/admin/elections/${electionId}`}
        class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
        style='color: oklch(0.70 0.015 250)'
      >
        <ArrowLeft size={16} />
        {election.name}
      </a>
    {:else}
      <a
        href={`/admin/elections/${electionId}`}
        class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
        style='color: oklch(0.70 0.015 250)'
      >
        <ArrowLeft size={16} />
        Back to election
      </a>
    {/if}

    {#if isLoading}
      <div
        class='rounded-2xl border p-8 shadow-2xl flex items-center justify-center gap-3'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <Spinner size={28} />
        <p class='text-sm font-medium' style='color: oklch(0.70 0.015 250)'>Loading position…</p>
      </div>
    {:else if error || !position}
      <div
        class='rounded-2xl border p-8 shadow-2xl'
        style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'
      >
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>{error || 'Position not found.'}</p>
      </div>
    {:else}
      <header
        class='rounded-2xl border p-5 shadow-lg mb-6'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <h1 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>{position.name}</h1>
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
          <p class='text-sm text-center py-6' style='color: oklch(0.70 0.015 250)'>
            No candidates yet. Click <span class='font-bold' style='color: oklch(0.55 0.15 250)'>Add candidate</span> to register one.
          </p>
        {:else}
          <ul class='space-y-2'>
            {#each candidates as c (c.id)}
              <li>
                <a
                  href={`/admin/elections/${electionId}/positions/${positionId}/candidates/${c.id}`}
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

  {#if createError}
    <div
      class='mb-4 rounded-xl px-4 py-3 text-sm'
      style='background: oklch(0.40 0.15 25 / 0.25); color: oklch(0.98 0.005 250); border: 1px solid oklch(0.40 0.15 25 / 0.5)'
    >
      {createError}
    </div>
  {/if}

  {#if usersError}
    <div class='mb-4 rounded-xl border border-yellow-500/30 px-4 py-2 text-sm' style='background: oklch(0.25 0.025 250); color: oklch(0.95 0.008 250)'>
      {usersError}
    </div>
  {/if}

  <form onsubmit={submitCreate} class='space-y-5'>
    <div class='space-y-2'>
      <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        User
      </label>
      <select
        value={createAccountId}
        onchange={(e) => handleUserSelect(e.currentTarget.value)}
        required
        disabled={createBusy}
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      >
        <option value=''>Select a user</option>
        {#each users as u (u.accountId)}
          <option value={u.accountId}>{getCandidateUserLabel(u)}</option>
        {/each}
      </select>
    </div>

    <div class='space-y-2'>
      <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Full name
      </label>
      <input
        type='text'
        value={createFullName}
        readonly
        required
        class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
    </div>

    <div class='space-y-2'>
      <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
        Manifesto
      </label>
      <textarea
        bind:value={createManifesto}
        rows={5}
        required
        disabled={createBusy}
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
