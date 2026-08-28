<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { createPosition } from '$lib/api/positions'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import { Loader } from 'lucide-svelte'
  import { appCache } from '$lib/cache'
  import type { TPosition } from '$lib/types'
  import {
    COMMON_POSITION_PRESETS,
    isPositionAlreadyAdded,
  } from '$lib/position-presets'

  let {
    electionId,
    existingPositions,
    onclose,
    onsuccess,
  }: {
    electionId: string
    existingPositions: TPosition[]
    onclose: () => void
    onsuccess: () => void
  } = $props()

  // Track user-selected preset names. Initialized with all missing presets.
  let selectedPositions = $state<Set<string>>(
    new Set(
      COMMON_POSITION_PRESETS.filter(
        (preset) => !isPositionAlreadyAdded(preset, existingPositions)
      )
    )
  )

  let isBusy = $state(false)
  let currentCreatingIndex = $state<number | null>(null)
  let currentCreatingName = $state<string>('')
  let toCreateTotal = $state(0)
  let errorMessage = $state<string | null>(null)

  const availablePresets = $derived(
    COMMON_POSITION_PRESETS.filter(
      (preset) => !isPositionAlreadyAdded(preset, existingPositions)
    )
  )

  const selectedAvailablePresets = $derived(
    COMMON_POSITION_PRESETS.filter(
      (preset) =>
        selectedPositions.has(preset) &&
        !isPositionAlreadyAdded(preset, existingPositions)
    )
  )

  const selectedCount = $derived(selectedAvailablePresets.length)

  function togglePreset(preset: string) {
    if (isBusy || isPositionAlreadyAdded(preset, existingPositions)) return
    const next = new Set(selectedPositions)
    if (next.has(preset)) {
      next.delete(preset)
    } else {
      next.add(preset)
    }
    selectedPositions = next
  }

  function selectAllAvailable() {
    if (isBusy) return
    selectedPositions = new Set(availablePresets)
  }

  function deselectAll() {
    if (isBusy) return
    selectedPositions = new Set()
  }

  async function submitAdd(e: SubmitEvent) {
    e.preventDefault()
    if (isBusy || selectedCount === 0) return

    errorMessage = null
    isBusy = true

    const toCreate = selectedAvailablePresets
    toCreateTotal = toCreate.length
    let successCount = 0
    let failedError: unknown = null
    let failedPositionName = ''

    try {
      for (let i = 0; i < toCreate.length; i++) {
        const name = toCreate[i]
        currentCreatingIndex = i + 1
        currentCreatingName = name
        try {
          await createPosition(electionId, { name })
          successCount++
          const next = new Set(selectedPositions)
          next.delete(name)
          selectedPositions = next
        } catch (err) {
          failedError = err
          failedPositionName = name
          break
        }
      }

      if (successCount > 0) {
        appCache.invalidate({ resource: 'elections' })
        appCache.invalidate({ resource: 'election', params: { id: electionId } })
        appCache.invalidate({ params: { electionId } })
        try {
          await invalidate('app:election')
        } catch {
          // Invalidation failures should not block success notifications
        }
      }

      if (failedError === null) {
        addToast(
          'success',
          successCount === 1
            ? '1 position created'
            : `${successCount} positions created`
        )
        onsuccess()
      } else {
        const errText = extractErrorMessage(failedError, 'Request failed')
        if (successCount > 0) {
          errorMessage = `Added ${successCount} position${successCount === 1 ? '' : 's'}, but failed to create "${failedPositionName}": ${errText}`
          addToast(
            'error',
            `Partially completed: ${successCount} added, failed at ${failedPositionName}`
          )
        } else {
          errorMessage = `Failed to create position "${failedPositionName}": ${errText}`
          addToast('error', extractErrorMessage(failedError, 'Failed to create positions'))
        }
      }
    } catch (err) {
      const errText = extractErrorMessage(err, 'Failed to create positions')
      errorMessage = errText
      addToast('error', errText)
    } finally {
      currentCreatingIndex = null
      currentCreatingName = ''
      isBusy = false
    }
  }

  function handleClose() {
    if (isBusy) return
    onclose()
  }
</script>

<Modal open={true} onclose={handleClose} presentation="sheet" ariaLabelledby="common-positions-title">
  <div class="space-y-4">
    <div>
      <h2
        id="common-positions-title"
        class="text-xl font-black"
        style="color: oklch(0.95 0.008 250)"
      >
        Common positions
      </h2>
      <p class="text-xs mt-1" style="color: oklch(0.70 0.015 250)">
        Add standard CSO positions to this election. Already added positions cannot be selected again.
      </p>
    </div>

    {#if availablePresets.length === 0}
      <div
        class="p-4 rounded-xl border text-sm text-center font-medium"
        style="background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250); color: oklch(0.75 0.015 250)"
      >
        All 17 common positions have already been added to this election.
      </div>
    {:else}
      <div class="flex items-center justify-between text-xs font-semibold" style="color: oklch(0.70 0.015 250)">
        <span>{selectedCount} of {availablePresets.length} available selected</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={selectAllAvailable}
            disabled={isBusy || selectedCount === availablePresets.length}
            class="min-h-11 inline-flex items-center px-1.5 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline text-sky-400"
          >
            Select all
          </button>
          <span aria-hidden="true">&middot;</span>
          <button
            type="button"
            onclick={deselectAll}
            disabled={isBusy || selectedCount === 0}
            class="min-h-11 inline-flex items-center px-1.5 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline text-slate-400"
          >
            Deselect all
          </button>
        </div>
      </div>
    {/if}

    {#if errorMessage}
      <div
        class="p-3 rounded-xl border text-xs font-semibold leading-relaxed"
        style="background: oklch(0.25 0.10 25); border-color: oklch(0.45 0.15 25); color: oklch(0.90 0.08 25)"
      >
        {errorMessage}
      </div>
    {/if}

    <form onsubmit={submitAdd} class="space-y-4">
      <div class="max-h-80 overflow-y-auto space-y-2 pr-1">
        {#each COMMON_POSITION_PRESETS as preset, index (preset)}
          {@const isAdded = isPositionAlreadyAdded(preset, existingPositions)}
          {@const isChecked = selectedPositions.has(preset) && !isAdded}
          {@const inputId = `preset-pos-${index}`}

          <label
            for={inputId}
            class="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition min-h-11 select-none {isAdded
              ? 'opacity-60 cursor-not-allowed bg-slate-900/40 border-slate-800'
              : isChecked
                ? 'cursor-pointer border-sky-500/50 bg-sky-500/10'
                : 'cursor-pointer border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'}"
          >
            <div class="flex items-center gap-3 min-w-0">
              <input
                id={inputId}
                type="checkbox"
                checked={isChecked}
                disabled={isAdded || isBusy}
                onchange={() => togglePreset(preset)}
                class="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer disabled:cursor-not-allowed"
              />
              <span
                class="text-sm font-semibold truncate {isAdded
                  ? 'text-slate-400'
                  : isChecked
                    ? 'text-sky-200'
                    : 'text-slate-200'}"
              >
                {preset}
              </span>
            </div>

            {#if isAdded}
              <span
                class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/90 text-slate-400 shrink-0"
              >
                Already added
              </span>
            {/if}
          </label>
        {/each}
      </div>

      <div class="flex gap-3 pt-2">
        <button
          type="button"
          onclick={handleClose}
          disabled={isBusy}
          class="min-h-11 flex-1 px-4 py-3 rounded-xl font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style="background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isBusy || selectedCount === 0}
          class="min-h-11 flex-1 px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style="background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)"
        >
          {#if isBusy}
            <Loader class="animate-spin" size={18} />
            Adding ({currentCreatingIndex}/{toCreateTotal})…
          {:else if selectedCount > 0}
            Add {selectedCount} {selectedCount === 1 ? 'position' : 'positions'}
          {:else if availablePresets.length === 0}
            No positions to add
          {:else}
            Add positions
          {/if}
        </button>
      </div>
    </form>
  </div>
</Modal>
