<script lang='ts'>
  import type { TElection, TElectionStatus } from '$lib/types'
  import { transitionElection } from '$lib/api/elections'
  import { canTransition } from '$lib/election-lifecycle-client'
  import Modal from './modal.svelte'

  let { election, onsuccess = () => {} }: {
    election: TElection
    onsuccess?: () => void
  } = $props()

  let open = $state(false)
  let busy = $state(false)
  let error = $state('')

  const targets: TElectionStatus[] = ['open', 'closed', 'archived']
  const allowed = $derived(targets.filter(t => canTransition(election.status, t)))
  const target = $derived(allowed[0] ?? null)

  async function confirm() {
    if (!target) return
    busy = true
    error = ''
    try {
      const body: { to: TElectionStatus, opensAt?: number, closesAt?: number } = { to: target }
      if (target === 'open') {
        const opensAt = Math.floor(Date.now() / 1000)
        body.opensAt = opensAt
        body.closesAt = opensAt + 7 * 24 * 3600
      }
      await transitionElection(election.id, body)
      open = false
      onsuccess()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Transition failed'
    } finally {
      busy = false
    }
  }
</script>

{#if target}
  <button
    type='button'
    onclick={() => (open = true)}
    disabled={busy}
    class='px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer'
    style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
  >
    Transition to {target}
  </button>
{/if}

<Modal open={open} onclose={() => (open = false)}>
  <h2 class='text-xl font-black mb-2' style='color: oklch(0.95 0.008 250)'>Confirm transition</h2>
  <p class='text-sm mb-4' style='color: oklch(0.70 0.015 250)'>
    Change status from <strong style='color: oklch(0.95 0.008 250)'>{election.status}</strong>
    to <strong style='color: oklch(0.95 0.008 250)'>{target}</strong>?
  </p>
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
      class='px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer'
      style='background: oklch(0.25 0.025 250); color: oklch(0.95 0.008 250)'
    >
      Cancel
    </button>
    <button
      type='button'
      onclick={confirm}
      disabled={busy}
      class='px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer'
      style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250)'
    >
      {busy ? 'Working…' : 'Confirm'}
    </button>
  </div>
</Modal>
