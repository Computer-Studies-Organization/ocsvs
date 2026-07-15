<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { createPosition } from '$lib/api/positions'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { createPositionSchema } from '$lib/validation/position'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader } from 'lucide-svelte'
  import { appCache } from '$lib/cache'

  let {
    onclose,
    electionId,
    onsuccess,
  }: {
    onclose: () => void
    electionId: string
    onsuccess: () => void
  } = $props()

  let createName = $state('')
  let createOrder = $state('')
  let createBusy = $state(false)
  let createErrors = $state<Record<string, string>>({})

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    const orderNum = Number.parseInt(createOrder, 10)
    const result = validate(createPositionSchema, {
      name: createName.trim(),
      displayOrder: Number.isFinite(orderNum) ? orderNum : undefined,
    })
    if (!result.ok) {
      createErrors = result.errors
      return
    }
    createErrors = {}
    createBusy = true
    try {
      await createPosition(electionId, {
        name: createName.trim(),
        displayOrder: Number.isFinite(orderNum) ? orderNum : undefined,
      })
      appCache.invalidate({ resource: 'elections' })
      appCache.invalidate({ resource: 'election', params: { id: electionId } })
      appCache.invalidate({ params: { electionId } })
      await invalidate('app:election')
      addToast('success', 'Position created')
      onsuccess()
    }
    catch (err: unknown) {
      addToast('error', extractErrorMessage(err, 'Failed to create position'))
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

<Modal open={true} onclose={handleClose}>
  <h2 class="text-xl font-black mb-4" style="color: oklch(0.95 0.008 250)">Add position</h2>

  <form onsubmit={submitCreate} class="space-y-5">
    <div class="space-y-2">
      <label for="positionName" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Name
      </label>
      <input
        id="positionName"
        type="text"
        bind:value={createName}
        required
        disabled={createBusy}
        placeholder="President"
        oninput={() => { if (createErrors.name) createErrors.name = '' }}
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none {createErrors.name ? 'border-red-500' : ''}"
        style="background: oklch(0.16 0.020 250); border-color: {createErrors.name ? 'oklch(0.65 0.15 25)' : 'oklch(0.28 0.025 250)'}; color: oklch(0.95 0.008 250)"
      />
      {#if createErrors.name}
        <p class="text-xs mt-1" style="color: oklch(0.65 0.15 25)">{createErrors.name}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="positionOrder" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Display order (optional)
      </label>
      <input
        id="positionOrder"
        type="number"
        bind:value={createOrder}
        disabled={createBusy}
        placeholder="0"
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
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
        disabled={createBusy || !createName.trim()}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
      >
        {#if createBusy}<Loader class="animate-spin" size={18} />{/if}
        {createBusy ? 'Creating…' : 'Create position'}
      </button>
    </div>
  </form>
</Modal>
