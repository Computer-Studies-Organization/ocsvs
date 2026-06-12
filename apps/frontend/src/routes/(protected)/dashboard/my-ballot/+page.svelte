<script lang='ts'>
  import type { TCandidate } from '$lib/types'
  import { goto } from '$app/navigation'
  import { allCandidates } from '$lib/api/candidates'
  import { getMyVotes } from '$lib/api/votes'
  import { ArrowRight, CheckCircle2, Loader, LockKeyhole } from 'lucide-svelte'
  import { onMount } from 'svelte'

  interface VoteWithCandidate {
    voteId: string
    candidate: TCandidate
  }

  interface PositionGroup {
    position: string
    votes: VoteWithCandidate[]
  }

  let candidates = $state<TCandidate[]>([])
  let votesByPosition = $state<PositionGroup[]>([])
  let hasVoted = $state(false)
  let isLoading = $state(true)
  let isError = $state(false)

  onMount(async () => {
    try {
      const [candidatesRes, voteStatus] = await Promise.all([
        allCandidates(),
        getMyVotes(),
      ])

      candidates = candidatesRes.data
      hasVoted = voteStatus.hasVoted

      if (voteStatus.votes && candidates.length > 0) {
        const matched: VoteWithCandidate[] = voteStatus.votes
          .map((vote) => {
            const candidate = candidates.find(c => c.id === vote.candidateId)
            return candidate ? { voteId: vote.id, candidate } : null
          })
          .filter((item): item is VoteWithCandidate => item !== null)
          .sort((a, b) => a.candidate.position.localeCompare(b.candidate.position))

        const grouped = new Map<string, VoteWithCandidate[]>()
        for (const item of matched) {
          const existing = grouped.get(item.candidate.position) ?? []
          existing.push(item)
          grouped.set(item.candidate.position, existing)
        }

        votesByPosition = Array.from(grouped.entries()).map(([position, votes]) => ({
          position,
          votes,
        }))
      }
    }
    catch {
      isError = true
    }
    finally {
      isLoading = false
    }
  })
</script>

<div class='min-h-[100dvh] bg-slate-950/95'>
  <div class='h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500' />

  <div class='pointer-events-none fixed inset-0 -z-10'>
    <div class='absolute -top-40 left-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl' />
    <div class='absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl' />
  </div>

  <div class='mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-6 md:px-6 lg:px-8'>
    <header class='relative mb-5 flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4'>
      <div class='space-y-3'>
        <div>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl'>My Ballot</h1>
          <p class='mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500'>Your Voting Summary</p>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur'>
          <p class='text-sm text-slate-200'>
            {#if hasVoted && votesByPosition.length > 0}
              You have voted for {votesByPosition.length} position{votesByPosition.length > 1 ? 's' : ''}
            {:else}
              You have not submitted any votes yet
            {/if}
          </p>
        </div>
      </div>
      <button
        onclick={() => goto('/dashboard')}
        class='inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 md:px-4 cursor-pointer'
      >
        <ArrowRight size={18} />
        <span class='hidden md:inline'>Back to Dashboard</span>
      </button>
    </header>

    <main>
      {#if isLoading}
        <div class='flex min-h-[60vh] items-center justify-center'>
          <Loader class='animate-spin text-blue-400' size={40} />
        </div>
      {:else if isError}
        <div class='flex min-h-[60vh] items-center justify-center'>
          <div class='text-center'>
            <p class='mb-4 text-red-400'>Failed to load your ballot</p>
            <button
              onclick={() => goto('/dashboard')}
              class='rounded-lg bg-slate-800 px-4 py-2 text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer'
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      {:else if !hasVoted || votesByPosition.length === 0}
        <section class='flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-lg shadow-slate-950/60 backdrop-blur'>
          <div class='space-y-4 text-center'>
            <p class='text-lg text-slate-400'>You haven't voted yet.</p>
            <p class='text-sm text-slate-500'>Go to the voting dashboard to cast your votes.</p>
            <button
              onclick={() => goto('/dashboard')}
              class='mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-500/40 transition hover:bg-sky-600 cursor-pointer'
            >
              Go to Voting Dashboard
            </button>
          </div>
        </section>
      {:else}
        <section class='space-y-4'>
          {#each votesByPosition as group (group.position)}
            <div class='rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/60 backdrop-blur'>
              <div class='mb-4'>
                <p class='text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500'>Position</p>
                <h2 class='mt-1 text-lg font-semibold text-slate-50 sm:text-xl'>{group.position}</h2>
              </div>
              <div class='space-y-3'>
                {#each group.votes as { voteId, candidate } (voteId)}
                  <div class='flex items-start justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4'>
                    <div class='flex-1 space-y-1.5'>
                      <div class='flex items-center gap-2'>
                        <CheckCircle2 class='text-emerald-400' size={20} />
                        <p class='text-sm font-semibold text-slate-50'>{candidate.fullName}</p>
                      </div>
                      <p class='text-[11px] text-slate-400'>{candidate.position}</p>
                      <p class='text-[11px] italic text-slate-300/85'>"{candidate.manifesto}"</p>
                    </div>
                    <span class='inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300'>
                      Your Vote
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      {/if}
    </main>

    <footer class='mt-6 flex flex-col items-center justify-center gap-3 border-t border-slate-800/80 pt-4 text-[10px] text-slate-500'>
      <div class='flex items-center gap-2'>
        <LockKeyhole size={11} />
        <span>Your votes are confidential and securely recorded.</span>
      </div>
    </footer>
  </div>
</div>