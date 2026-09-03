<script lang='ts'>
  import type { TElection, TElectionStatus } from '$lib/types'
  import { transitionElection } from '$lib/api/elections'
  import { canTransition, getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import Modal from './modal.svelte'
  import DateTimePicker, { type DateTimePreset } from './date-time-picker.svelte'
  import { addToast } from '$lib/stores/toast.svelte'
  import { formatTimestamp } from '$lib/utils'

  let { election, onsuccess = () => {}, class: className = '' }: {
    election: TElection
    onsuccess?: () => void
    class?: string
  } = $props()

  let open = $state(false)
  let busy = $state(false)
  let error = $state('')
  let activeTarget = $state<TElectionStatus | null>(null)
  let opensAtValue = $state<number | null>(null)
  let closesAtValue = $state<number | null>(null)
  let now = $state(Math.floor(Date.now() / 1000))
  const minimumClosesAt = $derived((opensAtValue ?? 0) + 60)

  $effect(() => {
    const interval = setInterval(() => {
      now = Math.floor(Date.now() / 1000)
    }, 1000)
    return () => clearInterval(interval)
  })

  const isExpiredOpen = $derived(election.status === 'open' && getEffectiveElectionStatus(election, now) === 'closed')
  const isScheduledOpen = $derived(
    election.status === 'open' &&
    election.opensAt !== null &&
    election.opensAt > now &&
    getEffectiveElectionStatus(election, now) === 'draft'
  )

  const targets: TElectionStatus[] = ['open', 'closed', 'archived', 'draft']
  const allowed = $derived(targets.filter(t => canTransition(election.status, t)))
  const labels: Record<TElectionStatus, string> = {
    draft: 'Draft',
    open: 'Open',
    closed: 'Closed',
    archived: 'Archived'
  }

  const openPresets: DateTimePreset[] = [
    {
      label: 'Right now',
      getTimestamp: () => Math.floor(Date.now() / 1000)
    },
    {
      label: 'Today 8:00 AM',
      getTimestamp: () => {
        const d = new Date()
        d.setHours(8, 0, 0, 0)
        return Math.floor(d.getTime() / 1000)
      }
    },
    {
      label: 'Tomorrow 8:00 AM',
      getTimestamp: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(8, 0, 0, 0)
        return Math.floor(d.getTime() / 1000)
      }
    }
  ]

  const closePresets: DateTimePreset[] = [
    {
      label: '+2 hours',
      getTimestamp: () => (opensAtValue ?? Math.floor(Date.now() / 1000)) + 2 * 3600
    },
    {
      label: '+4 hours',
      getTimestamp: () => (opensAtValue ?? Math.floor(Date.now() / 1000)) + 4 * 3600
    },
    {
      label: '+8 hours',
      getTimestamp: () => (opensAtValue ?? Math.floor(Date.now() / 1000)) + 8 * 3600
    },
    {
      label: 'Today 5:00 PM',
      getTimestamp: () => {
        const d = new Date()
        d.setHours(17, 0, 0, 0)
        return Math.floor(d.getTime() / 1000)
      }
    },
    {
      label: 'Tomorrow 5:00 PM',
      getTimestamp: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(17, 0, 0, 0)
        return Math.floor(d.getTime() / 1000)
      }
    }
  ]

  function openConfirm(target: TElectionStatus) {
    activeTarget = target
    error = ''
    opensAtValue = target === 'open' ? (election.opensAt ?? now) : null
    closesAtValue = target === 'open' ? (election.closesAt ?? (now + 8 * 3600)) : null
    open = true
  }

  async function confirm(event: SubmitEvent) {
    event.preventDefault()
    if (!activeTarget) return
    busy = true
    error = ''
    try {
      const body: { to: TElectionStatus, opensAt?: number, closesAt?: number } = { to: activeTarget }
      if (activeTarget === 'open') {
        if (opensAtValue === null || closesAtValue === null || closesAtValue < minimumClosesAt) {
          error = 'Closing time must be at least one minute after opening time'
          return
        }
        body.opensAt = opensAtValue
        body.closesAt = closesAtValue
      }
      await transitionElection(election.id, body)
      open = false
      activeTarget = null
      onsuccess()
      addToast('success', 'Election transitioned')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Transition failed'
      addToast('error', e instanceof Error ? e.message : 'Transition failed')
    } finally {
      busy = false
    }
  }
</script>

{#each allowed as t (t)}
  <button
    type='button'
    onclick={() => openConfirm(t)}
    disabled={busy}
    class='min-h-11 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer {className}'
    style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
  >
    {isExpiredOpen && t === 'closed'
      ? 'Finalize closure'
      : isScheduledOpen && t === 'closed'
        ? 'Close scheduled election'
        : `Transition to ${labels[t]}`}
  </button>
{/each}

<Modal open={open} onclose={() => (open = false)} ariaLabelledby='transition-title' presentation="sheet">
  <form onsubmit={confirm}>
    <h2 id='transition-title' class='text-xl font-black mb-2' style='color: oklch(0.95 0.008 250)'>Confirm transition</h2>
    <p class='text-sm mb-4' style='color: oklch(0.70 0.015 250)'>
      Change status from <strong style='color: oklch(0.95 0.008 250)'>{labels[election.status]}</strong>
      to <strong style='color: oklch(0.95 0.008 250)'>{activeTarget ? labels[activeTarget] : ''}</strong>?
    </p>
    {#if activeTarget === 'open'}
      <div class='grid gap-4 mb-4 sm:grid-cols-2'>
        <DateTimePicker
          label='Opening time'
          bind:value={opensAtValue}
          disabled={busy}
          presets={openPresets}
          required
        />
        <DateTimePicker
          label='Closing time'
          bind:value={closesAtValue}
          min={minimumClosesAt}
          disabled={busy}
          presets={closePresets}
          required
        />
      </div>
      {#if opensAtValue !== null && closesAtValue !== null}
        <div class='mb-4 rounded-lg border px-3 py-2 text-sm' style='border-color: oklch(0.28 0.025 250); color: oklch(0.75 0.015 250)'>
          <p>Opens: <strong>{formatTimestamp(opensAtValue)}</strong></p>
          <p>Closes: <strong>{formatTimestamp(closesAtValue)}</strong></p>
        </div>
      {/if}
    {/if}
    {#if error}
      <p class='text-sm mb-4 px-3 py-2 rounded-lg' style='background: oklch(0.40 0.15 25); color: oklch(0.98 0.005 250)'>
        {error}
      </p>
    {/if}
    <div class='flex gap-3 justify-end'>
      <button
        type='button'
        onclick={() => (open = false)}
        disabled={busy}
        class='min-h-11 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer'
        style='background: oklch(0.25 0.025 250); color: oklch(0.95 0.008 250)'
      >
        Cancel
      </button>
      <button
        type='submit'
        disabled={busy}
        class='min-h-11 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250)'
      >
        {busy ? 'Working…' : 'Confirm'}
      </button>
    </div>
  </form>
</Modal>
