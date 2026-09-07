<script lang="ts">
  import { goto, invalidate } from '$app/navigation'
  import { isRedirect } from '@sveltejs/kit'
  import { appCache } from '$lib/cache'
  import { loadElectionData } from '$lib/load-election-data'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { TElection } from '$lib/types'
  import TransitionButton from '$lib/components/ui/transition-button.svelte'
  import ExtendElectionButton from './extend-election-button.svelte'

  let { election }: { election: TElection } = $props()
  let refreshing = $state(false)
  let stale = $state(false)

  async function refresh() {
    refreshing = true
    try {
      appCache.invalidate({ resource: 'elections' })
      appCache.invalidate({ resource: 'election', params: { id: election.id } })
      appCache.invalidate({ params: { electionId: election.id } })
      appCache.invalidate({ resource: 'votingState' })
      // Catch failed reads here; route invalidation renders an error page on load failure.
      await loadElectionData(election.id, { fetch, depends: () => {} })
      await invalidate('app:election')
      stale = false
    } catch (cause) {
      if (isRedirect(cause)) {
        await goto(cause.location)
        return
      }
      // The mutation already committed; a refresh failure must not undo its success.
      stale = true
    } finally {
      refreshing = false
    }
  }

  async function complete(message: string) {
    addToast('success', message)
    await refresh()
  }
</script>

<fieldset
  disabled={refreshing || stale}
  aria-label="Election lifecycle controls"
  class="flex min-w-0 flex-wrap justify-end gap-3 border-0 p-0 disabled:opacity-50"
>
  <TransitionButton {election} onsuccess={() => complete('Election transitioned')} />
  <ExtendElectionButton {election} onsuccess={() => complete('Election closing time extended successfully')} />
</fieldset>

{#if stale}
  <div role="status" class="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
    <p>The election change was saved, but the page could not refresh. Refresh before making another change.</p>
    <button type="button" onclick={refresh} disabled={refreshing} class="mt-2 min-h-11 rounded-lg border border-amber-500/40 px-4 py-2 font-semibold disabled:opacity-50">
      {refreshing ? 'Refreshing…' : 'Refresh page'}
    </button>
  </div>
{/if}
