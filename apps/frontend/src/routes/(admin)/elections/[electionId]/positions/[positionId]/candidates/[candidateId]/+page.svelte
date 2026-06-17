<script lang='ts'>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { ArrowLeft, Loader, Save, Trash2 } from 'lucide-svelte'
  import { getCandidate, updateCandidate, deleteCandidate } from '$lib/api/candidates'
  import { getElection } from '$lib/api/elections'
  import { listPositions } from '$lib/api/positions'
  import { fetchUser } from '$lib/api/users'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import Modal from '$lib/components/ui/modal.svelte'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import type { TElection, TPosition, TUsersData } from '$lib/types'

  type CandidateRecord = {
    id: string
    fullName: string
    accountId: string
    positionId: string
    manifesto: string
    isActive: number
  }

  let candidate = $state<CandidateRecord | null>(null)
  let election = $state<TElection | null>(null)
  let position = $state<TPosition | null>(null)
  let user = $state<TUsersData | null>(null)
  let isLoading = $state(true)
  let error = $state('')
  let isSaving = $state(false)
  let saveMsg = $state('')
  let isDeleteOpen = $state(false)
  let isDeleting = $state(false)
  let deleteError = $state('')

  let editManifesto = $state('')
  let editIsActive = $state(true)

  const electionId = $derived(page.params.electionId)
  const positionId = $derived(page.params.positionId)
  const candidateId = $derived(page.params.candidateId)

  async function load() {
    if (!electionId || !positionId || !candidateId)
      return
    isLoading = true
    error = ''
    try {
      const c = (await getCandidate(candidateId)) as unknown as CandidateRecord
      candidate = c
      editManifesto = c.manifesto ?? ''
      editIsActive = c.isActive === 1
      const [e, allPos, u] = await Promise.all([
        getElection(electionId),
        listPositions(electionId),
        fetchUser(c.accountId).catch(() => null),
      ])
      election = e
      position = allPos.find(p => p.id === positionId) ?? null
      user = u ?? null
    }
    catch (e: unknown) {
      error = `Couldn't load candidate: ${extractErrorMessage(e, 'Unknown error')}`
    }
    finally {
      isLoading = false
    }
  }

  onMount(load)

  $effect(() => {
    electionId
    positionId
    candidateId
    load()
  })

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    if (!candidateId)
      return
    isSaving = true
    saveMsg = ''
    try {
      const updated = await updateCandidate(candidateId, {
        manifesto: editManifesto,
        isActive: editIsActive ? 1 : 0,
      })
      candidate = { ...candidate, ...(updated as unknown as CandidateRecord) } as CandidateRecord
      saveMsg = 'Saved'
      setTimeout(() => (saveMsg = ''), 1500)
    }
    catch (err: unknown) {
      saveMsg = extractErrorMessage(err, 'Failed to save')
    }
    finally {
      isSaving = false
    }
  }

  function openDelete() {
    deleteError = ''
    isDeleteOpen = true
  }

  function closeDelete() {
    if (isDeleting)
      return
    isDeleteOpen = false
  }

  async function handleDelete() {
    if (!candidateId)
      return
    isDeleting = true
    deleteError = ''
    try {
      await deleteCandidate(candidateId)
      isDeleteOpen = false
      await goto(`/admin/elections/${electionId}/positions/${positionId}`)
    }
    catch (err: unknown) {
      deleteError = extractErrorMessage(err, 'Failed to delete')
    }
    finally {
      isDeleting = false
    }
  }
</script>

<div class='min-h-[100dvh]' style='background: oklch(0.16 0.020 250)'>
  <div class='mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
    <a
      href={`/admin/elections/${electionId}/positions/${positionId}`}
      class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
      style='color: oklch(0.70 0.015 250)'
    >
      <ArrowLeft size={16} />
      {position?.name ?? 'Position'}
    </a>

    {#if isLoading}
      <div
        class='rounded-2xl border p-8 shadow-2xl flex items-center justify-center gap-3'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <Spinner size={28} />
        <p class='text-sm font-medium' style='color: oklch(0.70 0.015 250)'>Loading candidate…</p>
      </div>
    {:else if error || !candidate}
      <div
        class='rounded-2xl border p-8 shadow-2xl'
        style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'
      >
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>{error || 'Candidate not found.'}</p>
      </div>
    {:else}
      <header
        class='rounded-2xl border p-5 shadow-lg mb-6'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <p class='text-xs uppercase tracking-wider mb-1' style='color: oklch(0.60 0.015 250)'>
          {election?.name ?? ''} · {position?.name ?? ''}
        </p>
        <h1 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>{candidate.fullName}</h1>
        {#if user}
          <p class='text-sm mt-1' style='color: oklch(0.70 0.015 250)'>
            {user.studentId} · {user.email ?? ''}
          </p>
        {/if}
      </header>

      <form
        onsubmit={handleSave}
        class='rounded-2xl border p-5 shadow-lg space-y-5'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='space-y-2'>
          <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
            Full name
          </label>
          <input
            type='text'
            value={candidate.fullName}
            readonly
            class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
            style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
          />
        </div>

        <div class='space-y-2'>
          <label class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
            Manifesto
          </label>
          <textarea
            bind:value={editManifesto}
            rows={6}
            disabled={isSaving}
            class='w-full px-4 py-3 rounded-xl border-2 font-semibold resize-none transition focus:outline-none'
            style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
          />
        </div>

        <label class='flex items-center gap-3 cursor-pointer'>
          <input
            type='checkbox'
            bind:checked={editIsActive}
            disabled={isSaving}
            class='h-5 w-5 cursor-pointer'
          />
          <span class='text-sm font-semibold' style='color: oklch(0.95 0.008 250)'>Active</span>
        </label>

        {#if saveMsg}
          <p
            class='text-sm font-semibold'
            style={saveMsg === 'Saved' ? 'color: oklch(0.70 0.15 145)' : 'color: oklch(0.70 0.15 25)'}
          >
            {saveMsg}
          </p>
        {/if}

        <div class='flex flex-wrap gap-3 pt-2'>
          <button
            type='submit'
            disabled={isSaving}
            class='flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg disabled:opacity-50 cursor-pointer'
            style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
          >
            {#if isSaving}<Loader class='animate-spin' size={16} />{/if}
            <Save size={16} stroke-width={2.5} />
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type='button'
            onclick={openDelete}
            disabled={isSaving || isDeleting}
            class='flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer'
            style='background: oklch(0.40 0.15 25); color: oklch(0.98 0.005 250)'
          >
            <Trash2 size={16} stroke-width={2.5} />
            Delete
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

<!-- Delete confirmation -->
<Modal open={isDeleteOpen} onclose={closeDelete}>
  <h2 class='text-xl font-black mb-2' style='color: oklch(0.95 0.008 250)'>Delete candidate?</h2>
  <p class='text-sm mb-4' style='color: oklch(0.70 0.015 250)'>
    This will soft-delete <strong style='color: oklch(0.95 0.008 250)'>{candidate?.fullName ?? ''}</strong>. The candidate will be marked inactive.
  </p>

  {#if deleteError}
    <div
      class='mb-4 rounded-xl px-4 py-3 text-sm'
      style='background: oklch(0.40 0.15 25 / 0.25); color: oklch(0.98 0.005 250); border: 1px solid oklch(0.40 0.15 25 / 0.5)'
    >
      {deleteError}
    </div>
  {/if}

  <div class='flex gap-3 justify-end'>
    <button
      type='button'
      onclick={closeDelete}
      disabled={isDeleting}
      class='px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer'
      style='background: oklch(0.25 0.025 250); color: oklch(0.95 0.008 250)'
    >
      Cancel
    </button>
    <button
      type='button'
      onclick={handleDelete}
      disabled={isDeleting}
      class='px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer'
      style='background: oklch(0.40 0.15 25); color: oklch(0.98 0.005 250)'
    >
      {#if isDeleting}<Loader class='animate-spin' size={14} />{/if}
      {isDeleting ? 'Deleting…' : 'Delete'}
    </button>
  </div>
</Modal>
