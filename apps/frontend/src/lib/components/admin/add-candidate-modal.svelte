<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { invalidate } from '$app/navigation'
  import { createCandidate, uploadCandidateImage } from '$lib/api/candidates'
  import { fetchUsers } from '$lib/api/users'
  import { getCandidateUserLabel } from '$lib/adminUsers'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { createCandidateSchema } from '$lib/validation/candidate'
  import { IMAGE_FILE_ACCEPT, IMAGE_FILE_HINT, validateImageFile } from '$lib/validation/image-file'
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
  const createAccountId = $derived(selectedUser?.accountId ?? '')
  const createFullName = $derived(selectedUser ? [selectedUser.firstName, selectedUser.lastName].join(' ').trim() : '')
  let userSearchLoading = $state(false)
  let userSearchError = $state('')
  let userResultsOpen = $state(false)
  let activeUserIndex = $state(-1)
  let createPartyId = $state('')
  let createManifesto = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})
  let selectedPhoto = $state<File | null>(null)
  let photoError = $state('')
  let photoInput: HTMLInputElement | undefined = $state()

  let searchTimeout: ReturnType<typeof setTimeout> | undefined
  let searchRequestId = 0
  let userSearchInput: HTMLInputElement | undefined = $state()
  let userSearchContainer: HTMLDivElement | undefined = $state()

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
    try {
      const result = await fetchUsers({
        page: 1,
        limit: 20,
        search: query,
        includeDeleted: false,
      })

      if (requestId !== searchRequestId || userSearch.trim() !== query) return

      userSearchLoading = false
      userResults = result.data
    } catch (err: unknown) {
      if (requestId !== searchRequestId || userSearch.trim() !== query) return

      userSearchLoading = false
      userResults = []
      userSearchError = extractErrorMessage(err, 'Failed to search users')
    }
  }

  function closeUserResults() {
    if (!userResultsOpen) return
    userResultsOpen = false
    activeUserIndex = -1
  }

  function handleUserSearchFocusOut(e: FocusEvent) {
    const nextTarget = e.relatedTarget
    if (!(nextTarget instanceof Node) || !userSearchContainer?.contains(nextTarget)) closeUserResults()
  }

  function handleUserSearchOutsidePointerDown(e: PointerEvent) {
    const target = e.target
    if (!(target instanceof Node) || !userSearchContainer?.contains(target)) closeUserResults()
  }

  function handleUserSelect(user: TUsersData) {
    ++searchRequestId
    selectedUser = user
    if (createErrors.user) createErrors.user = ''
  }

  function clearUserSelection() {
    ++searchRequestId
    if (searchTimeout) clearTimeout(searchTimeout)
    selectedUser = null
    userSearch = ''
    userResults = []
    userResultsOpen = false
    userSearchLoading = false
    userSearchError = ''
    activeUserIndex = -1
    void tick().then(() => userSearchInput?.focus())
  }

  function handleUserSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && userResultsOpen) {
      e.preventDefault()
      e.stopPropagation()
      closeUserResults()
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

  function handlePhotoChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      selectedPhoto = null
      photoError = ''
      return
    }

    const validationError = validateImageFile(file)
    if (validationError) {
      photoError = validationError
      selectedPhoto = null
      input.value = ''
      return
    }

    photoError = ''
    selectedPhoto = file
  }

  function clearPhotoSelection() {
    selectedPhoto = null
    photoError = ''
    if (photoInput) photoInput.value = ''
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    if (createBusy) return
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
    if (photoError) {
      return
    }
    createErrors = {}
    createBusy = true
    let candidate: Awaited<ReturnType<typeof createCandidate>>
    try {
      candidate = await createCandidate({
        fullName: createFullName.trim(),
        accountId: createAccountId,
        positionId: positionId,
        partyId: createPartyId || null,
        manifesto: createManifesto.trim(),
      })
    } catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to add candidate'))
      createBusy = false
      return
    }

    let postCreateFailed = false
    if (selectedPhoto) {
      try {
        await uploadCandidateImage(candidate.id, selectedPhoto)
      } catch {
        postCreateFailed = true
        addToast('error', 'Candidate added, but photo upload failed. Retry the photo from candidate editing.')
      }
    }

    try {
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:position')
    } catch {
      postCreateFailed = true
      addToast('error', 'Candidate added, but the candidate list could not refresh. Refresh the page to see the latest data.')
    }

    if (!postCreateFailed) addToast('success', 'Candidate added')
    createBusy = false
    onsuccess()
  }

  function handleClose() {
    if (createBusy) return
    onclose()
  }
</script>

<svelte:window onpointerdown={handleUserSearchOutsidePointerDown} />

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
        <div
          class="relative"
          bind:this={userSearchContainer}
          onfocusout={handleUserSearchFocusOut}
        >
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
      {#if selectedPhoto}
        <p class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
          Photo <span style="color: oklch(0.55 0.015 250)">(optional)</span>
        </p>
        <div
          class="flex min-h-11 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3"
          style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-sm">{selectedPhoto.name}</p>
            <p class="text-xs" style="color: oklch(0.60 0.015 250)">{(selectedPhoto.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onclick={clearPhotoSelection}
            disabled={createBusy}
            class="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-bold transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            style="color: oklch(0.70 0.15 225)"
            aria-label="Remove photo"
          >
            <X size={15} />
            Remove
          </button>
        </div>
      {:else}
        <label for="candidatePhoto" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
          Photo <span style="color: oklch(0.55 0.015 250)">(optional)</span>
        </label>
        <input
          id="candidatePhoto"
          type="file"
          accept={IMAGE_FILE_ACCEPT}
          bind:this={photoInput}
          onchange={handlePhotoChange}
          disabled={createBusy}
          aria-invalid={photoError ? 'true' : 'false'}
          aria-describedby={photoError ? 'candidate-photo-error' : 'candidate-photo-hint'}
          class="block w-full text-sm font-semibold file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:cursor-pointer transition focus:outline-none file:disabled:opacity-50 file:disabled:cursor-not-allowed cursor-pointer"
          style="color: oklch(0.80 0.015 250); file:background: oklch(0.28 0.035 250); file:color: oklch(0.95 0.008 250)"
        />
        <p id="candidate-photo-hint" class="text-xs" style="color: oklch(0.60 0.015 250)">
          {IMAGE_FILE_HINT}
        </p>
      {/if}
      {#if photoError}
        <p id="candidate-photo-error" class="text-xs mt-1" style="color: oklch(0.65 0.15 25)">{photoError}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="createManifesto" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Manifesto <span style="color: oklch(0.55 0.015 250)">(optional)</span>
      </label>
      <textarea
        id="createManifesto"
        bind:value={createManifesto}
        rows={5}
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
        disabled={createBusy || !createAccountId || !createFullName.trim() || Boolean(photoError)}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
      >
        {#if createBusy}<Loader class="animate-spin" size={18} />{/if}
        {createBusy ? 'Adding…' : 'Add candidate'}
      </button>
    </div>
  </form>
</Modal>
