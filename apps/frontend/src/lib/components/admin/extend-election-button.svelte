<script lang="ts">
  import { Clock, Loader } from 'lucide-svelte'
  import { extendElection } from '$lib/api/elections'
  import { fromLocalDateTime, getEffectiveElectionStatus, toLocalDateTime } from '$lib/election-lifecycle-client'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { formatTimestamp } from '$lib/utils'
  import type { TElection } from '$lib/types'
  import Modal from '$lib/components/ui/modal.svelte'

  let { election, onsuccess = () => {} }: { election: TElection; onsuccess?: () => void } = $props()

  let open = $state(false)
  let busy = $state(false)
  let error = $state('')
  let closesAtInput = $state('')
  let now = $state(Math.floor(Date.now() / 1000))

  $effect(() => {
    const interval = setInterval(() => now = Math.floor(Date.now() / 1000), 1000)
    return () => clearInterval(interval)
  })

  const isEffectivelyOpen = $derived(getEffectiveElectionStatus(election, now) === 'open')
  const selectedClosesAt = $derived(fromLocalDateTime(closesAtInput))
  const minimumClosesAt = $derived(
    election.closesAt === null ? null : Math.ceil((election.closesAt + 60) / 60) * 60
  )

  const extensionPresets = [
    {
      label: '+15m',
      getTimestamp: () => (election.closesAt ?? Math.floor(Date.now() / 1000)) + 15 * 60
    },
    {
      label: '+30m',
      getTimestamp: () => (election.closesAt ?? Math.floor(Date.now() / 1000)) + 30 * 60
    },
    {
      label: '+1h',
      getTimestamp: () => (election.closesAt ?? Math.floor(Date.now() / 1000)) + 3600
    },
    {
      label: '+2h',
      getTimestamp: () => (election.closesAt ?? Math.floor(Date.now() / 1000)) + 7200
    },
    {
      label: '+4h',
      getTimestamp: () => (election.closesAt ?? Math.floor(Date.now() / 1000)) + 14400
    }
  ]

  function openForm() {
    error = ''
    closesAtInput = toLocalDateTime(election.closesAt === null ? null : election.closesAt + 3600)
    open = true
  }

  function closeForm() {
    if (!busy) open = false
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (selectedClosesAt === null || election.closesAt === null || selectedClosesAt < election.closesAt + 60) {
      error = 'New closing time must be later than the current closing time'
      return
    }

    busy = true
    error = ''
    try {
      await extendElection(election.id, selectedClosesAt)
      open = false
      addToast('success', 'Election closing time extended successfully')
      try {
        await onsuccess()
      }
      catch {
        addToast('error', 'Election extended, but the page could not refresh. Refresh the page to see the latest data.')
      }
    }
    catch (err: unknown) {
      error = extractErrorMessage(err, 'Failed to extend election')
      addToast('error', error)
    }
    finally {
      busy = false
    }
  }
</script>

{#if isEffectivelyOpen}
  <button
    type="button"
    onclick={openForm}
    class="min-h-11 inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-400 transition hover:bg-amber-500/20 cursor-pointer"
  >
    <Clock size={16} />
    Extend voting
  </button>
{/if}

<Modal {open} onclose={closeForm} ariaLabelledby="extend-election-title" presentation="sheet">
  <form onsubmit={submit} class="space-y-5">
    <div>
      <h2 id="extend-election-title" class="text-xl font-black text-slate-100">Extend voting</h2>
      <p class="mt-1 text-sm text-slate-400">Move the closing time later without interrupting voting.</p>
    </div>

    <div class="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
      Current close: <strong class="text-slate-100">{formatTimestamp(election.closesAt)}</strong>
    </div>

    <label class="block space-y-2 text-sm font-semibold text-slate-300">
      <span>New closing time</span>
      <input
        type="datetime-local"
        bind:value={closesAtInput}
        min={minimumClosesAt === null ? undefined : toLocalDateTime(minimumClosesAt)}
        required
        disabled={busy}
        class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:border-amber-500"
      />
    </label>
    <div class="flex flex-wrap gap-1.5">
      {#each extensionPresets as preset (preset.label)}
        <button
          type="button"
          disabled={busy}
          onclick={() => (closesAtInput = toLocalDateTime(preset.getTimestamp()))}
          class="min-h-11 min-w-11 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {preset.label}
        </button>
      {/each}
    </div>

    {#if selectedClosesAt !== null && election.closesAt !== null && selectedClosesAt > election.closesAt}
      <p class="text-sm text-slate-300">New close: <strong class="text-slate-100">{formatTimestamp(selectedClosesAt)}</strong></p>
    {/if}

    {#if error}
      <p class="rounded-lg bg-red-950/70 px-3 py-2 text-sm text-red-200">{error}</p>
    {/if}

    <div class="flex gap-3 justify-end">
      <button type="button" onclick={closeForm} disabled={busy} class="min-h-11 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 cursor-pointer disabled:opacity-50">
        Cancel
      </button>
      <button type="submit" disabled={busy} class="min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 cursor-pointer disabled:opacity-50">
        {#if busy}<Loader class="animate-spin" size={16} />{/if}
        {busy ? 'Extending…' : 'Extend voting'}
      </button>
    </div>
  </form>
</Modal>
