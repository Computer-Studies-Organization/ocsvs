<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { untrack } from 'svelte'
  import { deletePartyList, updatePartyList } from '$lib/api/parties'
  import { appCache } from '$lib/cache'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { validatePartyCode } from '$lib/validation/party-code'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader, Trash2 } from 'lucide-svelte'
  import type { TPartyList } from '$lib/types'

  let {
    onclose,
    electionId,
    party,
    onsuccess,
  }: {
    onclose: () => void
    electionId: string
    party: TPartyList
    onsuccess: () => void
  } = $props()

  let editName = $state(untrack(() => party.name))
  let editCode = $state(untrack(() => party.code))
  let editColor = $state(untrack(() => party.color || '#3B82F6'))
  let editDescription = $state(untrack(() => party.description || ''))
  let busy = $state(false)
  let errorMsg = $state('')

  async function submitUpdate(e: SubmitEvent) {
    e.preventDefault()
    if (!editName.trim() || !editCode.trim()) return

    const codeVal = editCode.trim().toUpperCase()
    const codeError = validatePartyCode(codeVal)
    if (codeError) {
      errorMsg = codeError
      return
    }

    errorMsg = ''
    busy = true
    try {
      await updatePartyList(electionId, party.id, {
        name: editName.trim(),
        code: codeVal,
        color: editColor.trim() || null,
        description: editDescription.trim() || null,
      })
      appCache.invalidate({ resource: 'partyLists', params: { electionId } })
      await invalidate('app:election')
      addToast('success', 'Party list updated')
      onsuccess()
    }
    catch (err: unknown) {
      errorMsg = extractErrorMessage(err, 'Failed to update party list')
      addToast('error', errorMsg)
    }
    finally {
      busy = false
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete party '${party.name}'? Associated candidates will become Independent.`)) {
      return
    }

    errorMsg = ''
    busy = true
    try {
      await deletePartyList(electionId, party.id)
      appCache.invalidate({ resource: 'partyLists', params: { electionId } })
      await invalidate('app:election')
      addToast('success', 'Party list deleted')
      onsuccess()
    }
    catch (err: unknown) {
      errorMsg = extractErrorMessage(err, 'Failed to delete party list')
      addToast('error', errorMsg)
    }
    finally {
      busy = false
    }
  }

  function handleClose() {
    if (busy) return
    onclose()
  }
</script>

<Modal open={true} onclose={handleClose} presentation="sheet">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-black" style="color: oklch(0.95 0.008 250)">Edit Party List</h2>
    <button
      type="button"
      onclick={handleDelete}
      disabled={busy}
      class="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition cursor-pointer"
      title="Delete party list"
    >
      <Trash2 size={18} />
    </button>
  </div>

  <form onsubmit={submitUpdate} class="space-y-5">
    <div class="space-y-2">
      <label for="editPartyName" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Party Name
      </label>
      <input
        id="editPartyName"
        type="text"
        bind:value={editName}
        required
        disabled={busy}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
    </div>

    <div class="space-y-2">
      <label for="editPartyCode" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Acronym / Code
      </label>
      <input
        id="editPartyCode"
        type="text"
        bind:value={editCode}
        required
        disabled={busy}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none uppercase"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
    </div>

    <div class="space-y-2">
      <label for="editPartyColor" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Badge Color (Hex)
      </label>
      <div class="flex items-center gap-3">
        <input
          id="editPartyColorPicker"
          type="color"
          bind:value={editColor}
          disabled={busy}
          class="h-10 w-12 rounded cursor-pointer border-0 bg-transparent"
        />
        <input
          id="editPartyColor"
          type="text"
          bind:value={editColor}
          disabled={busy}
          class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
          style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
        />
      </div>
    </div>

    <div class="space-y-2">
      <label for="editPartyDescription" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Platform Description <span style="color: oklch(0.55 0.015 250)">(optional)</span>
      </label>
      <textarea
        id="editPartyDescription"
        bind:value={editDescription}
        disabled={busy}
        rows={6}
        placeholder="Paste the party's platform here…"
        class="w-full px-4 py-3 rounded-xl border-2 font-normal text-sm transition focus:outline-none resize-y"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      ></textarea>
    </div>

    {#if errorMsg}
      <p class="text-xs font-bold" style="color: oklch(0.65 0.15 25)">{errorMsg}</p>
    {/if}

    <div class="flex gap-3 pt-2">
      <button
        type="button"
        onclick={handleClose}
        disabled={busy}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition cursor-pointer"
        style="background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy || !editName.trim() || !editCode.trim()}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
      >
        {#if busy}<Loader class="animate-spin" size={18} />{/if}
        {busy ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  </form>
</Modal>
