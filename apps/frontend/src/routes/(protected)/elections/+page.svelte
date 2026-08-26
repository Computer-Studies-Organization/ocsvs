<script lang='ts'>
  import { onMount } from 'svelte'
  import { listElections } from '$lib/api/elections'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import type { TElection } from '$lib/types'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import StatusBadge from '$lib/components/ui/status-badge.svelte'

  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import { Calendar, Inbox, Vote } from 'lucide-svelte'
  import Countdown from '$lib/components/ui/countdown.svelte'
  import { formatTimestamp } from '$lib/utils'

  let elections = $state<TElection[]>([])
  let isLoading = $state(true)
  let error = $state('')

  // Filter out draft status and sort: open first, then closed, then archived.
  const sortedElections = $derived(
    elections
      .filter(e => e.status !== 'draft')
      .sort((a, b) => {
        const order: Record<string, number> = { open: 1, closed: 2, archived: 3 }
        const scoreA = order[a.status] ?? 99
        const scoreB = order[b.status] ?? 99
        if (scoreA !== scoreB) return scoreA - scoreB
        // secondary sort: newest closesAt first
        return (b.closesAt ?? 0) - (a.closesAt ?? 0)
      })
  )

  async function load() {
    isLoading = true
    error = ''
    try {
      elections = await listElections()
    }
    catch (e: unknown) {
      error = extractErrorMessage(e, 'Failed to load elections')
    }
    finally {
      isLoading = false
    }
  }

  onMount(load)
</script>

<div class='w-full mx-auto max-w-4xl p-6'>
  <div class='flex items-center justify-between border-b border-white/10 pb-6'>
    <div>
      <h1 class='text-3xl font-black text-slate-100'>Elections</h1>
      <p class='mt-1 text-slate-400'>Browse current, past, and archived elections.</p>
    </div>
  </div>

  {#if isLoading}
    <div class='mt-8 grid gap-4 sm:grid-cols-1 md:grid-cols-2'>
      {#each Array(3) as _, i (i)}
        <SkeletonCard />
      {/each}
    </div>
  {:else if error}
    <div class='mt-8 rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-center text-red-400'>
      {error}
    </div>
  {:else if elections.length === 0}
    <EmptyState
      icon={Vote}
      title='No elections available'
      description='There are no elections at this time. Check back later.'
    />
  {:else}
    <div class='mt-8 grid gap-4 sm:grid-cols-1 md:grid-cols-2'>
      {#each sortedElections as election (election.id)}
        <a
          href='/elections/{election.id}'
          class='group flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900/80'
        >
          <div>
            <div class='flex items-start justify-between gap-4'>
              <h2 class='text-xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors'>
                {election.name}
              </h2>
              <StatusBadge status={election.status} />
            </div>

            {#if election.description}
              <p class='mt-3 line-clamp-2 text-sm text-slate-400'>
                {election.description}
              </p>
            {/if}
          </div>

          <div class='mt-6 border-t border-white/5 pt-4 text-xs text-slate-500 space-y-1'>
            {#if election.status === 'open'}
              <div class='flex items-center gap-2 text-sky-400'>
                <Vote size={14} />
                <span>Ends: {formatTimestamp(election.closesAt)} {#if election.closesAt}(<Countdown targetUnixSeconds={election.closesAt} plainText={true} /> left){/if}</span>
              </div>
            {:else if election.status === 'closed' || election.status === 'archived'}
              <div class='flex items-center gap-2'>
                <Calendar size={14} />
                <span>Ended: {formatTimestamp(election.closesAt)}</span>
              </div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
