<script lang='ts'>
  import type { TElection, TVoteCount, TVoteResults, TVoteResultsResponse } from '$lib/types'
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth.svelte'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import { ArrowLeft, BarChart3, Trophy, Download } from 'lucide-svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import { addToast } from '$lib/stores/toast.svelte'

  interface CandidateWithPct extends TVoteCount { percentage: number }
  interface PositionResult extends Omit<TVoteResults, 'candidates'> {
    candidates: CandidateWithPct[]
    totalVotes: number
  }

  let { data } = $props()
  const elections = $derived<TElection[]>(data.elections)
  const resultsData = $derived<TVoteResultsResponse>(data.resultsData)
  const isError = $derived(Boolean(data.resultsError))

  const user = $derived(authStore.user)
  let now = $state(Math.floor(Date.now() / 1000))

  $effect(() => {
    const interval = setInterval(() => {
      now = Math.floor(Date.now() / 1000)
    }, 1000)
    return () => clearInterval(interval)
  })

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    closed: 'Closed',
    archived: 'Archived'
  }

  const visibleElections = $derived(
    elections.filter(e => getEffectiveElectionStatus(e, now) !== 'draft')
  )

  const resultsWithPercentages = $derived.by<PositionResult[]>(() => {
    if (!resultsData?.results)
      return []
    return resultsData.results.map((pos) => {
      const totalVotes = pos.candidates.reduce((s, c) => s + c.voteCount, 0)
      const withPct = pos.candidates.map(c => ({
        ...c,
        percentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 10000) / 100 : 0,
      })).sort((a, b) => b.voteCount - a.voteCount)
      return { ...pos, candidates: withPct, totalVotes }
    })
  })

  function selectElection(id: string) {
    goto(`?electionId=${id}`, { keepFocus: true, noScroll: true })
  }

  function exportToCSV() {
    if (!resultsWithPercentages.length) return
    const electionName = elections.find(e => e.id === data.selectedElectionId)?.name ?? ''

    const escapeCsv = (val: string) => {
      const stringVal = String(val)
      if (/[",\n\r]/.test(stringVal)) {
        return `"${stringVal.replace(/"/g, '""')}"`
      }
      return stringVal
    }

    const csvRows: string[] = []

    csvRows.push(`${escapeCsv('Election Name')},${escapeCsv(electionName)}`)
    csvRows.push(`${escapeCsv('Export Date')},${escapeCsv(new Date().toLocaleString())}`)
    if (resultsData?.meta) {
      csvRows.push(`${escapeCsv('Total Votes Cast')},${escapeCsv(String(resultsData.meta.totalVotes))}`)
    }
    csvRows.push('')

    csvRows.push([
      escapeCsv('Position'),
      escapeCsv('Candidate'),
      escapeCsv('Votes'),
      escapeCsv('Percentage'),
      escapeCsv('Status')
    ].join(','))

    for (const pos of resultsWithPercentages) {
      const winner = pos.candidates[0]
      const isTie = pos.candidates.length > 1 && pos.candidates[0].voteCount === pos.candidates[1].voteCount

      for (let i = 0; i < pos.candidates.length; i++) {
        const candidate = pos.candidates[i]
        let status = ''
        if (candidate.voteCount > 0) {
          if (isTie && candidate.voteCount === winner?.voteCount) {
            status = 'Tied'
          } else if (!isTie && i === 0) {
            status = 'Winner'
          }
        }
        
        csvRows.push([
          escapeCsv(pos.positionName),
          escapeCsv(candidate.candidateName),
          escapeCsv(String(candidate.voteCount)),
          escapeCsv(`${candidate.percentage}%`),
          escapeCsv(status)
        ].join(','))
      }
    }

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    const formattedElectionName = electionName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '')
    const timestamp = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `${formattedElectionName}_results_${timestamp}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addToast('success', 'CSV export started')
  }
</script>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8'>
    <!-- Header -->
    <header class='flex items-start gap-4 border-b border-slate-800/70 pb-4'>
      <div class='space-y-3'>
        <a
          href='/admin-dashboard'
          class='inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-400 transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          Dashboard
        </a>
        <div>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl'>Vote Results</h1>
          <p class='mt-1 break-words text-xs font-medium uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]'>
            {#if data.selectedElectionId}
              Real-time Election Statistics — {elections.find(e => e.id === data.selectedElectionId)?.name ?? ''}
            {:else}
              Real-time Election Statistics
            {/if}
          </p>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <p class='text-sm text-slate-200'>Welcome, <span class='font-semibold text-slate-50'>{user?.username || 'Admin'}</span></p>
          <p class='mt-1 text-xs text-slate-400'>View detailed vote counts and percentages for each candidate by position.</p>
        </div>
      </div>

    </header>

    <!-- Election Selector & Actions -->
    <div class='flex flex-col items-stretch gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4'>
      <div class='flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3'>
        <label for='election-select' class='text-sm font-bold text-slate-400'>
          Election:
        </label>
        {#if visibleElections.length > 0}
          <select
            id='election-select'
            value={data.selectedElectionId}
            onchange={(e) => selectElection(e.currentTarget.value)}
            class='min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-100 focus:border-sky-400 focus:outline-none sm:w-auto'
          >
            {#each visibleElections as e (e.id)}
              <option value={e.id}>{e.name} ({statusLabels[getEffectiveElectionStatus(e, now)] ?? getEffectiveElectionStatus(e, now)})</option>
            {/each}
          </select>
        {:else}
          <span class='text-sm text-slate-500 font-medium'>No visible elections available</span>
        {/if}
      </div>

      {#if resultsWithPercentages.length > 0 && !isError}
        <button
          onclick={exportToCSV}
          class='flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 sm:w-auto'
        >
          <Download size={16} />
          Export to CSV
        </button>
      {/if}
    </div>

    <!-- Summary -->
    {#if resultsData?.meta}
      <div class='grid grid-cols-2 gap-3 sm:gap-4'>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3 shadow-md backdrop-blur sm:px-4'>
          <div class='flex items-center gap-2 sm:gap-3'>
            <div class='rounded-lg bg-blue-500/20 p-2'><BarChart3 size={20} class='text-blue-400' /></div>
            <div>
              <p class='text-xs uppercase tracking-wide text-slate-400'>Total Votes</p>
              <p class='text-xl font-bold text-slate-50'>{resultsData.meta.totalVotes}</p>
            </div>
          </div>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3 shadow-md backdrop-blur sm:px-4'>
          <div class='flex items-center gap-2 sm:gap-3'>
            <div class='rounded-lg bg-emerald-500/20 p-2'><Trophy size={20} class='text-emerald-400' /></div>
            <div>
              <p class='text-xs uppercase tracking-wide text-slate-400'>Positions</p>
              <p class='text-xl font-bold text-slate-50'>{resultsData.meta.totalPositions}</p>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Results -->
    <div class='flex-1 space-y-6'>
      {#if isError}
        <div class='rounded-2xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-xl'>
          <p class='text-center text-red-400'>{data.resultsError || 'Failed to load results. Please try again later.'}</p>
        </div>
      {:else if resultsWithPercentages.length === 0}
        <EmptyState
          icon={BarChart3}
          title='No results available'
          description='Results will appear after an election is closed.'
          cta='View elections'
          oncta={() => goto('/admin/elections')}
        />
      {:else}
        <div class='space-y-8'>
          {#each resultsWithPercentages as pos (pos.positionId)}
            {@const winner = pos.candidates[0]}
            {@const isTie = pos.candidates.length > 1 && pos.candidates[0].voteCount === pos.candidates[1].voteCount}
            <div class='rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl sm:p-8'>
              <!-- Position header -->
              <div class='mb-4 flex flex-col items-start gap-3 border-b border-white/10 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
                <div class='min-w-0 flex-1'>
                  <h3 class='text-md font-bold text-slate-100 sm:text-xl'>{pos.positionName}</h3>
                  <p class='mt-1 text-xs text-slate-400'>{pos.totalVotes} total {pos.totalVotes === 1 ? 'vote' : 'votes'}</p>
                </div>
                {#if !isTie && winner && winner.voteCount > 0}
                  <div class='flex max-w-full items-start gap-2 rounded-full bg-emerald-500/20 px-3 py-1'>
                    <Trophy size={16} class='shrink-0 text-emerald-400' />
                    <span class='break-words text-xs font-medium text-emerald-300 sm:text-sm'>{winner.candidateName}</span>
                  </div>
                {:else if isTie}
                  <div class='flex max-w-full items-start gap-2 rounded-full bg-yellow-500/20 px-3 py-1'>
                    <Trophy size={16} class='shrink-0 text-yellow-400' />
                    <span class='break-words text-xs font-medium text-yellow-300 sm:text-sm'>Tie</span>
                  </div>
                {/if}
              </div>

              <!-- Candidates -->
              <div class='space-y-4'>
                {#each pos.candidates as candidate, i (candidate.candidateId)}
                  {@const isWinner = !isTie && i === 0 && candidate.voteCount > 0}
                  {@const isTied = isTie && candidate.voteCount === winner?.voteCount}
                  <div class="flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:gap-4 sm:p-5
                    {isWinner || isTied ? 'border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' : 'border-white/10 bg-slate-900/40'}">
                    <div class='min-w-0 flex-1'>
                      <div class='mb-2 flex items-center gap-2'>
                        <h4 class="min-w-0 break-words text-base font-semibold sm:text-lg {isWinner || isTied ? 'text-emerald-300' : 'text-slate-100'}">
                          {candidate.candidateName}
                        </h4>
                        {#if isWinner || isTied}
                          <Trophy size={18} class='text-emerald-400' />
                        {/if}
                      </div>
                      <div class='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 sm:text-sm'>
                        <span><span class='font-semibold text-slate-300'>{candidate.voteCount}</span> votes</span>
                        <span><span class='font-semibold text-slate-300'>{candidate.percentage}%</span> of total</span>
                      </div>
                    </div>
                    <!-- Progress bar -->
                    <div class='w-full flex-shrink-0 sm:w-48'>
                      <div class='mb-1 flex items-center justify-between text-[11px] text-slate-400 sm:text-xs'>
                        <span>Vote percentage</span>
                        <span class='font-semibold text-slate-100'>{candidate.percentage}%</span>
                      </div>
                      <div class='h-2.5 w-full overflow-hidden rounded-full bg-slate-800'>
                        <div
                          class="h-full rounded-full transition-all duration-300 {isWinner || isTied ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'}"
                          style='width: {Math.min(100, Math.max(0, candidate.percentage))}%'
                        ></div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
