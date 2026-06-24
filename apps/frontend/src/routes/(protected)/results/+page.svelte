<script lang='ts'>
  import { onMount } from 'svelte'
  import { getCurrentElection, listResults } from '$lib/api/elections'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import type { TElection, TResults } from '$lib/types'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { BarChart3 } from 'lucide-svelte'

  let election = $state<TElection | null>(null)
  let results = $state<TResults>([])
  let isLoading = $state(true)
  let error = $state('')

  async function load() {
    isLoading = true
    error = ''
    try {
      const current = await getCurrentElection()
      if (!current) {
        election = null
        return
      }
      election = current
      results = await listResults(current.id)
    }
    catch (e: unknown) {
      error = extractErrorMessage(e, 'Failed to load results')
    }
    finally {
      isLoading = false
    }
  }

  onMount(load)
</script>

{#if isLoading}
  <div class='flex min-h-[60vh] items-center justify-center'>
    <Spinner size={40} />
  </div>
{:else if error}
  <div class='p-8 text-center'>
    <p class='text-red-400'>{error}</p>
  </div>
{:else if !election}
  <div class='flex min-h-[60vh] items-center justify-center p-8'>
    <div class='max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl'>
      <BarChart3 size={48} class='mx-auto mb-4 text-slate-400' />
      <h1 class='text-2xl font-bold text-slate-100'>No results yet</h1>
      <p class='mt-2 text-slate-400'>Results will be available once an election opens.</p>
    </div>
  </div>
{:else}
  <div class='mx-auto max-w-3xl p-6'>
    <h1 class='text-3xl font-black text-slate-100'>{election.name} — Results</h1>
    {#if results.length === 0}
      <p class='mt-4 text-slate-400'>No votes have been cast yet.</p>
    {:else}
      <div class='mt-8 space-y-6'>
        {#each results as r (r.positionId)}
          <div class='rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
            <h2 class='text-xl font-bold text-slate-100'>{r.positionName}</h2>
            <p class='mt-1 text-sm text-slate-400'>{r.totalVotes} total votes</p>
            <div class='mt-4 space-y-3'>
              {#each r.candidates as c (c.candidateId)}
                <div>
                  <div class='flex items-center justify-between text-sm'>
                    <span class='font-semibold text-slate-100'>{c.fullName}</span>
                    <span class='text-slate-400'>{c.voteCount} ({c.percentage}%)</span>
                  </div>
                  <div class='mt-1 h-2 rounded-full bg-slate-800'>
                    <div
                      class='h-full rounded-full bg-blue-500 transition-all'
                      style:width={`${c.percentage}%`}
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
