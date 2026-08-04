<script lang='ts'>
  import { goto, invalidate } from '$app/navigation'
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { ArrowLeft, Loader, Save, Trash2 } from 'lucide-svelte'
  import { updateCandidate, deleteCandidate, uploadCandidateImage, deleteCandidateImage } from '$lib/api/candidates'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import ImageUpload from '$lib/components/ui/image-upload.svelte'
  import { validate } from '$lib/validation/helpers'
  import { updateCandidateSchema } from '$lib/validation/candidate'
  import type { TElection, TPartyList, TPosition, TUsersData } from '$lib/types'
  import { appCache } from '$lib/cache'

  type CandidateRecord = {
    id: string
    fullName: string
    accountId: string
    positionId: string
    partyId?: string | null
    manifesto: string
    isActive: number
    imageUrl: string | null
  }

  let { data } = $props()
  const candidate = $derived<CandidateRecord>(data.candidate)
  const election = $derived<TElection>(data.election)
  const position = $derived<TPosition | null>(data.position)
  const user = $derived<TUsersData | null>(data.user)
  const partyLists = $derived<TPartyList[]>(data.partyLists ?? [])

  const electionId = $derived(page.params.electionId)
  const positionId = $derived(page.params.positionId)
  const candidateId = $derived(page.params.candidateId)
  const canModify = $derived(election?.status === 'draft' && candidate?.isActive === 1)

  let isSaving = $state(false)
  let isDeleteOpen = $state(false)
  let isDeleting = $state(false)
  let imageError = $state('')

  let editManifesto = $state(untrack(() => candidate.manifesto ?? ''))
  let editPartyId = $state(untrack(() => candidate.partyId ?? ''))
  let editErrors = $state<Record<string, string>>({})

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    if (!candidateId || !canModify) return
    const result = validate(updateCandidateSchema, {
      manifesto: editManifesto,
    })
    if (!result.ok) {
      editErrors = result.errors
      return
    }
    editErrors = {}
    isSaving = true
    try {
      await updateCandidate(candidateId, {
        manifesto: editManifesto,
        partyId: editPartyId || null,
      })
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:candidate')
      addToast('success', 'Candidate updated')
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to update candidate'))
    }
    finally {
      isSaving = false
    }
  }

  function openDelete() {
    if (!canModify) return
    isDeleteOpen = true
  }

  function closeDelete() {
    if (isDeleting) return
    isDeleteOpen = false
  }

  async function handleDelete() {
    if (!candidateId || !canModify) return
    isDeleting = true
    try {
      await deleteCandidate(candidateId)
      appCache.invalidate({ params: { electionId } })
      isDeleteOpen = false
      addToast('success', 'Candidate deleted')
      await goto(`/admin/elections/${electionId}/positions/${positionId}`)
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to delete candidate'))
    }
    finally {
      isDeleting = false
    }
  }

  async function handleImageUpload(file: File) {
    if (!candidateId || !canModify) return
    imageError = ''
    try {
      await uploadCandidateImage(candidateId, file)
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:candidate')
    } catch (err: unknown) {
      imageError = extractErrorMessage(err, 'Failed to upload image')
      throw err
    }
  }

  async function handleImageDelete() {
    if (!candidateId || !canModify) return
    imageError = ''
    try {
      await deleteCandidateImage(candidateId)
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:candidate')
    } catch (err: unknown) {
      imageError = extractErrorMessage(err, 'Failed to delete image')
      throw err
    }
  }
</script>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
    <a
      href={`/admin/elections/${electionId}/positions/${positionId}`}
      class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
      style='color: oklch(0.70 0.015 250)'
    >
      <ArrowLeft size={16} />
      {position?.name ?? 'Position'}
    </a>

    {#if !candidate}
      <div
        class='rounded-2xl border p-8 shadow-2xl'
        style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'
      >
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>Candidate not found.</p>
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
        <a
          href={`/admin/audit-log?targetType=candidate&targetId=${candidateId}`}
          class='mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer'
        >
          View Audit Trail →
        </a>
      </header>

  {#if canModify}
    {#key candidateId}
      <form
        onsubmit={handleSave}
        class='rounded-2xl border p-5 shadow-lg space-y-5'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <ImageUpload
          currentImageUrl={candidate.imageUrl}
          onupload={handleImageUpload}
          ondelete={handleImageDelete}
          disabled={isSaving}
        />

        {#if imageError}
          <p class='text-sm text-red-400'>{imageError}</p>
        {/if}

        <div class='space-y-2'>
          <label for='fullName' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
            Full name
          </label>
          <input
            id='fullName'
            type='text'
            value={candidate.fullName}
            readonly
            class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
            style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
          />
        </div>

        <div class='space-y-2'>
          <label for='editPartyId' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
            Party List
          </label>
          <select
            id='editPartyId'
            bind:value={editPartyId}
            disabled={isSaving}
            class='w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none'
            style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
          >
            <option value=''>Independent (No Party)</option>
            {#each partyLists as party (party.id)}
              <option value={party.id}>{party.name} ({party.code})</option>
            {/each}
          </select>
        </div>

        <div class='space-y-2'>
          <label for='editManifesto' class='block text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>
            Manifesto
          </label>
          <textarea
            id='editManifesto'
            bind:value={editManifesto}
            rows={6}
            disabled={isSaving}
            oninput={() => { if (editErrors.manifesto) editErrors.manifesto = '' }}
            class='w-full px-4 py-3 rounded-xl border-2 font-semibold resize-none transition focus:outline-none {editErrors.manifesto ? 'border-red-500' : ''}'
            style='background: oklch(0.16 0.020 250); border-color: {editErrors.manifesto ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)'
          ></textarea>
          {#if editErrors.manifesto}
            <p class='text-xs mt-1' style='color: oklch(0.65 0.15 25)'>{editErrors.manifesto}</p>
          {/if}
        </div>

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
    {/key}
  {:else}
    <section
      class='rounded-2xl border p-5 shadow-lg space-y-5'
      style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
    >
      <p class='text-sm' style='color: oklch(0.70 0.015 250)'>
        Candidate details are locked once the election leaves draft.
      </p>
      {#if candidate.imageUrl}
        <img src={candidate.imageUrl} alt={`Avatar for ${candidate.fullName}`} class='max-h-64 rounded-xl object-cover' />
      {/if}
      {#if candidate.partyId}
        {@const currentParty = partyLists.find((p) => p.id === candidate.partyId)}
        {#if currentParty}
          <div class='space-y-1'>
            <h2 class='text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>Party List</h2>
            <p class='font-semibold' style='color: oklch(0.95 0.008 250)'>{currentParty.name} ({currentParty.code})</p>
          </div>
        {/if}
      {/if}
      <div class='space-y-2'>
        <h2 class='text-xs font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>Manifesto</h2>
        <p class='whitespace-pre-wrap' style='color: oklch(0.95 0.008 250)'>{candidate.manifesto}</p>
      </div>
    </section>
  {/if}
    {/if}
  </div>
</div>

<!-- Delete confirmation -->
{#if canModify}
<Modal open={isDeleteOpen} onclose={closeDelete} presentation="sheet">
  <h2 class='text-xl font-black mb-2' style='color: oklch(0.95 0.008 250)'>Delete candidate?</h2>
  <p class='text-sm mb-4' style='color: oklch(0.70 0.015 250)'>
    This will soft-delete <strong style='color: oklch(0.95 0.008 250)'>{candidate?.fullName ?? ''}</strong>. The candidate will be marked inactive.
  </p>


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
{/if}
