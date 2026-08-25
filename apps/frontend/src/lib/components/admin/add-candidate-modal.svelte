<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { invalidate } from '$app/navigation'
  import { createCandidate } from '$lib/api/candidates'
  import { getCandidateUserLabel } from '$lib/adminUsers'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { createCandidateSchema } from '$lib/validation/candidate'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader, Search, X } from 'lucide-svelte'
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

  let userSearch = $state('')
  let userResults = $state<TUsersData[]>([])
  let selectedUser = $state<TUsersData | null>(null)
  let userSearchLoading = $state(false)
  let userSearchError = $state('')
  let userResultsOpen = $state(false)
  let activeUserIndex = $state(-1)
  let createAccountId = $state('')
  let createFullName = $state('')
  let createPartyId = $state('')
  let createManifesto = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})

  let searchTimeout: ReturnType<typeof setTimeout> | undefined
  let searchRequestId = 0
  let userSearchInput: HTMLInputElement | undefined = $state()

  function handleUserSearchInput(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value
    const query = value.trim()
    const requestId = ++searchRequestId

    userSearch = value
    userResults = []
    activeUserIndex = -1
    userSearchError = ''
    userResultsOpen = query.length > 0
    userSearchLoading = query.length >= 2

    if (searchTimeout) clearTimeout(searchTimeout)

    if (query.length < 2) return

    searchTimeout = setTimeout(() => {
      void searchUsers(query, requestId)
    }, 300)
  }

  async function searchUsers(query: string, requestId: number) {
    const usersEntry = appCache.get('users', {
      page: 1,
      limit: 20,
      search: query,
      includeDeleted: false,
    })
    const result = await usersEntry.fetch()

    if (requestId !== searchRequestId || userSearch.trim() !== query) return

    userSearchLoading = false
    if (result) {
      userResults = result.data
      return
    }

    userResults = []
    userSearchError = usersEntry.error ?? 'Failed to search users'
  }

  function handleUserSelect(user: TUsersData) {
    selectedUser = user
    createAccountId = user.accountId
    createFullName = `${user.firstName} ${user.lastName}`.trim()
    userSearch = ''
    userResults = []
    userResultsOpen = false
    userSearchLoading = false
    userSearchError = ''
    activeUserIndex = -1
    if (createErrors.user) createErrors.user = ''
  }

  function clearUserSelection() {
    ++searchRequestId
    if (searchTimeout) clearTimeout(searchTimeout)
    selectedUser = null
    createAccountId = ''
    createFullName = ''
    userSearch = ''
    userResults = []
    userResultsOpen = false
    userSearchLoading = false
    userSearchError = ''
    activeUserIndex = -1
    void tick().then(() => userSearchInput?.focus())
  }

  function handleUserSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      userResultsOpen = false
      activeUserIndex = -1
      return
    }

    if (!userResultsOpen || userResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeUserIndex = (activeUserIndex + 1) % userResults.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeUserIndex = (activeUserIndex - 1 + userResults.length) % userResults.length
    } else if (e.key === 'Enter' && activeUserIndex >= 0) {
      e.preventDefault()
      handleUserSelect(userResults[activeUserIndex])
    }
  }

  onDestroy(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
    ++searchRequestId
  })

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

  <form onsubmit={submitCreate} class="space-y-5">
    <div class="space-y-2">
      {#if selectedUser}
        <p class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">User</p>
        <div
          class="flex min-h-11 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3"
          style="background: oklch(0.16 0.020 250); border-color: {createErrors.user ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold">{getCandidateUserLabel(selectedUser)}</p>
            <p class="text-xs" style="color: oklch(0.60 0.015 250)">Selected user</p>
          </div>
          <button
            type="button"
            onclick={clearUserSelection}
            disabled={createBusy}
            class="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-bold transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            style="color: oklch(0.70 0.15 225)"
          >
            <X size={15} />
            Change
          </button>
        </div>
      {:else}
        <label for="candidate-user-search" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
          User
        </label>
        <div class="relative">
          <Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="candidate-user-search"
            type="text"
            bind:this={userSearchInput}
            value={userSearch}
            oninput={handleUserSearchInput}
            onkeydown={handleUserSearchKeydown}
            onfocus={() => { if (userSearch.trim()) userResultsOpen = true }}
            disabled={createBusy}
            autocomplete="off"
            placeholder="Search name or student ID…"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="candidate-user-results"
            aria-expanded={userResultsOpen}
            aria-haspopup="listbox"
            aria-activedescendant={activeUserIndex >= 0 ? `candidate-user-option-${userResults[activeUserIndex]?.accountId}` : undefined}
            aria-required="true"
            aria-invalid={createErrors.user ? 'true' : 'false'}
            class="min-h-11 w-full rounded-xl border-2 py-3 pl-10 pr-4 font-semibold transition focus:outline-none {createErrors.user ? 'border-red-500' : ''}"
            style="background: oklch(0.16 0.020 250); border-color: {createErrors.user ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
          />

          {#if userResultsOpen}
            <div
              id="candidate-user-results"
              role="listbox"
              aria-label="User search results"
              class="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-y-auto rounded-xl border-2 p-1 shadow-2xl"
              style="background: oklch(0.12 0.020 250); border-color: oklch(0.28 0.025 250)"
            >
              {#if userSearchLoading}
                <div class="flex min-h-11 items-center gap-2 px-3 py-2 text-sm" style="color: oklch(0.70 0.015 250)">
                  <Loader class="animate-spin" size={16} />
                  Searching users…
                </div>
              {:else if userSearchError}
                <div class="px-3 py-2 text-sm" style="color: oklch(0.65 0.15 25)">{userSearchError}</div>
              {:else if userSearch.trim().length < 2}
                <div class="px-3 py-2 text-sm" style="color: oklch(0.60 0.015 250)">Type at least 2 characters.</div>
              {:else if userResults.length === 0}
                <div class="px-3 py-2 text-sm" style="color: oklch(0.60 0.015 250)">No users found.</div>
              {:else}
                {#each userResults as user, index (user.accountId)}
                  <button
                    id={`candidate-user-option-${user.accountId}`}
                    type="button"
                    role="option"
                    aria-selected={activeUserIndex === index}
                    onclick={() => handleUserSelect(user)}
                    onmouseenter={() => { activeUserIndex = index }}
                    class="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-800 {activeUserIndex === index ? 'bg-slate-800' : ''} cursor-pointer"
                    style="color: oklch(0.95 0.008 250)"
                  >
                    {getCandidateUserLabel(user)}
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/if}
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
