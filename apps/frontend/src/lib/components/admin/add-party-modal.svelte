<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { createPartyList } from '$lib/api/parties'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { validatePartyCode } from '$lib/validation/party-code'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader } from 'lucide-svelte'

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
  let createCode = $state('')
  let createColor = $state('#3B82F6')
  let createBusy = $state(false)
  let createError = $state('')

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault()
    if (!createName.trim() || !createCode.trim()) return

    const codeVal = createCode.trim().toUpperCase()
    const codeError = validatePartyCode(codeVal)
    if (codeError) {
      createError = codeError
      return
    }

    createError = ''
    createBusy = true
    try {
      await createPartyList(electionId, {
        name: createName.trim(),
        code: codeVal,
        color: createColor.trim() || null,
      })
      await invalidate('app:election')
      addToast('success', 'Party list created')
      onsuccess()
    }
    catch (err: unknown) {
      createError = extractErrorMessage(err, 'Failed to create party list')
      addToast('error', createError)
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
  <h2 class="text-xl font-black mb-4" style="color: oklch(0.95 0.008 250)">Add Party List</h2>

  <form onsubmit={submitCreate} class="space-y-5">
    <div class="space-y-2">
      <label for="partyName" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Party Name
      </label>
      <input
        id="partyName"
        type="text"
        bind:value={createName}
        required
        disabled={createBusy}
        placeholder="Innovators Party"
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
    </div>

    <div class="space-y-2">
      <label for="partyCode" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Acronym / Code
      </label>
      <input
        id="partyCode"
        type="text"
        bind:value={createCode}
        required
        disabled={createBusy}
        placeholder="INNOVATORS"
        class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none uppercase"
        style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
      />
    </div>

    <div class="space-y-2">
      <label for="partyColor" class="block text-xs font-bold uppercase tracking-wider" style="color: oklch(0.70 0.015 250)">
        Badge Color (Hex)
      </label>
      <div class="flex items-center gap-3">
        <input
          id="partyColorPicker"
          type="color"
          bind:value={createColor}
          disabled={createBusy}
          class="h-10 w-12 rounded cursor-pointer border-0 bg-transparent"
        />
        <input
          id="partyColor"
          type="text"
          bind:value={createColor}
          disabled={createBusy}
          placeholder="#3B82F6"
          class="w-full px-4 py-3 rounded-xl border-2 font-semibold transition focus:outline-none"
          style="background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)"
        />
      </div>
    </div>

    {#if createError}
      <p class="text-xs font-bold" style="color: oklch(0.65 0.15 25)">{createError}</p>
    {/if}

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
        disabled={createBusy || !createName.trim() || !createCode.trim()}
        class="flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
      >
        {#if createBusy}<Loader class="animate-spin" size={18} />{/if}
        {createBusy ? 'Creating…' : 'Create Party List'}
      </button>
    </div>
  </form>
</Modal>
