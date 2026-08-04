<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { updateElection } from '$lib/api/elections'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { updateElectionSchema } from '$lib/validation/election'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader } from 'lucide-svelte'
  import { untrack } from 'svelte'
  import type { TElection } from '$lib/types'
  import { appCache } from '$lib/cache'

  let {
    onclose,
    election,
    onsuccess,
  }: {
    onclose: () => void
    election: TElection
    onsuccess: () => void
  } = $props()

  let editName = $state(untrack(() => election.name))
  let editDescription = $state(untrack(() => election.description || ''))
  let editBusy = $state(false)
  let editErrors = $state<Record<string, string>>({})

  async function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    const result = validate(updateElectionSchema, {
      name: editName.trim(),
      description: editDescription.trim() || null,
    })
    if (!result.ok) {
      editErrors = result.errors
      return
    }
    editErrors = {}
    editBusy = true
    try {
      await updateElection(election.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      })
      appCache.invalidate({ resource: 'elections' })
      appCache.invalidate({ resource: 'election', params: { id: election.id } })
      await invalidate('app:election')
      addToast('success', 'Election updated successfully')
      onsuccess()
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to update election'))
    }
    finally {
      editBusy = false
    }
  }

  function handleClose() {
    if (editBusy) return
    onclose()
  }
</script>

<Modal open={true} onclose={handleClose} presentation="sheet">
  <h2 class="text-xl font-black mb-4" style="color: oklch(0.95 0.008 250)">Edit election</h2>

  <form onsubmit={submitEdit} class="space-y-5">
    <div class="space-y-2">
      <label for="electionName" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Name
      </label>
      <input
        id="electionName"
        type="text"
        bind:value={editName}
        required
        disabled={editBusy}
        placeholder="Election Name"
        oninput={() => { if (editErrors.name) editErrors.name = '' }}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {editErrors.name ? 'border-red-500' : ''}"
        style="background: oklch(0.16 0.020 250); border-color: {editErrors.name ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
      />
      {#if editErrors.name}
        <p class="text-xs mt-1" style="color: oklch(0.65 0.15 25)">{editErrors.name}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="electionDescription" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Description (optional)
      </label>
      <textarea
        id="electionDescription"
        bind:value={editDescription}
        rows={3}
        disabled={editBusy}
        placeholder="Election description..."
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none resize-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      ></textarea>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="button"
        onclick={handleClose}
        disabled={editBusy}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition cursor-pointer"
        style="background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={editBusy || !editName.trim()}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
      >
        {#if editBusy}<Loader class="animate-spin" size={18} />{/if}
        {editBusy ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  </form>
</Modal>
