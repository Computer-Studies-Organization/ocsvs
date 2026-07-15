<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { untrack } from 'svelte'
  import { updatePosition } from '$lib/api/positions'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { updatePositionSchema } from '$lib/validation/position'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader } from 'lucide-svelte'
  import { appCache } from '$lib/cache'
  import type { TPosition } from '$lib/types'

  let {
    onclose,
    electionId,
    position,
    onsuccess,
  }: {
    onclose: () => void
    electionId: string
    position: TPosition
    onsuccess: () => void
  } = $props()

  let editName = $state(untrack(() => position.name))
  let editOrder = $state(untrack(() => String(position.displayOrder ?? '')))
  let editBusy = $state(false)
  let editErrors = $state<Record<string, string>>({})

  async function submitEdit(e: SubmitEvent) {
    e.preventDefault()
    if (!position) return
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
      await updatePosition(electionId, position.id, {
        name: editName.trim(),
        displayOrder: Number.isFinite(orderNum) ? orderNum : undefined,
      })
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:position')
      addToast('success', 'Position updated')
      onsuccess()
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to update position'))
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

<Modal open={true} onclose={handleClose}>
  <h2 class="text-xl font-black mb-4" style="color: oklch(0.95 0.008 250)">Edit position</h2>

  <form onsubmit={submitEdit} class="space-y-5">
    <div class="space-y-2">
      <label for="editPositionName" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Name
      </label>
      <input
        id="editPositionName"
        type="text"
        bind:value={editName}
        required
        disabled={editBusy}
        placeholder="President"
        oninput={() => { if (editErrors.name) editErrors.name = '' }}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {editErrors.name ? 'border-red-500' : ''}"
        style="background: oklch(0.16 0.020 250); border-color: {editErrors.name ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
      />
      {#if editErrors.name}
        <p class="text-xs mt-1" style="color: oklch(0.65 0.15 25)">{editErrors.name}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="editPositionOrder" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Display order (optional)
      </label>
      <input
        id="editPositionOrder"
        type="number"
        bind:value={editOrder}
        disabled={editBusy}
        placeholder="0"
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
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
