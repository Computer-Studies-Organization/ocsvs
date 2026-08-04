<script lang="ts">
  import { onMount } from 'svelte'
  import { invalidate } from '$app/navigation'
  import { createCandidate } from '$lib/api/candidates'
  import { getCandidateUserLabel, resolveCandidateUserSelection } from '$lib/adminUsers'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { createCandidateSchema } from '$lib/validation/candidate'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader } from 'lucide-svelte'
  import { appCache } from '$lib/cache'
  import type { TPartyList, TUsersData } from '$lib/types'

  // NOTE: This component is always open when mounted.
  // The parent component controls showing/hiding by conditionally mounting/unmounting it.
  let {
    onclose,
    electionId,
    positionId,
    partyLists = [],
    onsuccess,
  }: {
    onclose: () => void
    electionId: string
    positionId: string
    partyLists?: TPartyList[]
    onsuccess: () => void
  } = $props()

  let users = $state<TUsersData[]>([])
  let usersError = $state('')
  let createAccountId = $state('')
  let createFullName = $state('')
  let createPartyId = $state('')
  let createManifesto = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})

  // Fetch users on mount (modal is conditionally mounted by parent)
  onMount(() => {
    void loadUsers()
  })

  async function loadUsers() {
    const usersEntry = appCache.get('users', { limit: 100, includeDeleted: false })
    const result = await usersEntry.fetch()

    if (result) {
      users = result.data
    } else {
      usersError = usersEntry.error ?? 'Failed to load users'
      users = []
    }
  }

  function handleUserSelect(accountId: string) {
    const selected = resolveCandidateUserSelection(users, accountId)
    createAccountId = selected?.accountId ?? ''
    createFullName = selected ? `${selected.firstName} ${selected.lastName}` : ''
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
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
        positionId: positionId,
        partyId: createPartyId || null,
        manifesto: createManifesto.trim(),
      })
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:position')
      addToast('success', 'Candidate added')
      onsuccess()
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to add candidate'))
    }
    finally {
      createBusy = false
    }
  }

  function handleClose() {
    if (createBusy) return
    onclose()
  }
</script>

<Modal open={true} onclose={handleClose} presentation="sheet">
  <h2 class="text-xl font-black mb-4" style="color: oklch(0.95 0.008 250)">Add candidate</h2>

  {#if usersError}
    <div class="mb-4 rounded-xl border border-yellow-500/30 px-4 py-2 text-sm" style="background: oklch(0.25 0.025 250); color: oklch(0.95 0.008 250)">
      {usersError}
    </div>
  {/if}

  <form onsubmit={submitCreate} class="space-y-5">
    <div class="space-y-2">
      <label for="createAccountId" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        User
      </label>
      <select
        id="createAccountId"
        value={createAccountId}
        onchange={(e) => { handleUserSelect(e.currentTarget.value); if (createErrors.user) createErrors.user = '' }}
        required
        disabled={createBusy}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {createErrors.user ? 'border-red-500' : ''}"
        style="background: oklch(0.16 0.020 250); border-color: {createErrors.user ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
      >
        <option value="">Select a user</option>
        {#each users as u (u.accountId)}
          <option value={u.accountId}>{getCandidateUserLabel(u)}</option>
        {/each}
      </select>
      {#if createErrors.user}
        <p class="text-xs mt-1" style="color: oklch(0.65 0.15 25)">{createErrors.user}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="createPartyId" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Party List
      </label>
      <select
        id="createPartyId"
        bind:value={createPartyId}
        disabled={createBusy}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      >
        <option value="">Independent (No Party)</option>
        {#each partyLists as party (party.id)}
          <option value={party.id}>{party.name} ({party.code})</option>
        {/each}
      </select>
    </div>

    <div class="space-y-2">
      <label for="createFullName" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Full name
      </label>
      <input
        id="createFullName"
        type="text"
        value={createFullName}
        readonly
        required
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
    </div>

    <div class="space-y-2">
      <label for="createManifesto" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Manifesto
      </label>
      <textarea
        id="createManifesto"
        bind:value={createManifesto}
        rows={5}
        required
        disabled={createBusy}
        oninput={() => { if (createErrors.manifesto) createErrors.manifesto = '' }}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold resize-none transition focus:outline-none {createErrors.manifesto ? 'border-red-500' : ''}"
        style="background: oklch(0.16 0.020 250); border-color: {createErrors.manifesto ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
      ></textarea>
      {#if createErrors.manifesto}
        <p class="text-xs mt-1" style="color: oklch(0.65 0.15 25)">{createErrors.manifesto}</p>
      {/if}
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="button"
        onclick={handleClose}
        disabled={createBusy}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition cursor-pointer"
        style="background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={createBusy || !createAccountId || !createFullName.trim() || !createManifesto.trim()}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
      >
        {#if createBusy}<Loader class="animate-spin" size={18} />{/if}
        {createBusy ? 'Adding…' : 'Add candidate'}
      </button>
    </div>
  </form>
</Modal>
