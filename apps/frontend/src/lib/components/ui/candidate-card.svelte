<script lang='ts'>
  import type { TCandidate } from '$lib/types'
  import VoteProgressBar from './vote-progress-bar.svelte'

  let {
    candidate,
    voteCount = 0,
    percentage = 0,
    manifestoClamp = 'line-clamp-4',
  }: {
    candidate: TCandidate
    voteCount?: number
    percentage?: number
    manifestoClamp?: string
  } = $props()

  const displayVoteCount = $derived(Number.isFinite(voteCount) ? Math.max(0, voteCount) : 0)
  const displayPercentage = $derived(Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0)
</script>

<div class='flex h-full flex-col rounded-xl border border-white/10 bg-slate-900/40 p-4 shadow-lg transition-all hover:border-blue-500/30 hover:shadow-xl sm:p-5'>
  <div class='mb-2 flex items-center justify-between gap-2'>
    <div>
      <h4 class='text-base font-semibold text-slate-100 sm:text-lg'>{candidate.fullName}</h4>
    </div>
  </div>

  <p class='mt-2 whitespace-pre-line text-xs text-slate-300 sm:text-sm {manifestoClamp}'>
    {candidate.manifesto}
  </p>

  <div class='mt-3'>
    <div class='mb-1 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs'>
      <span>Votes: {displayVoteCount}</span>
      <span class='font-semibold text-slate-100'>{displayPercentage}%</span>
    </div>
    <VoteProgressBar percentage={displayPercentage} />
  </div>
</div>
