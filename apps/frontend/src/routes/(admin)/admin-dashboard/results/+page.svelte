<script lang='ts'>
  import type { TElection, TVoteCount, TVoteResults, TVoteResultsResponse } from '$lib/types'
  import { goto } from '$app/navigation'
  import { getVotingState, listResults, listElections } from '$lib/api/elections'
  import { authStore } from '$lib/stores/auth'
  import { ArrowLeft, BarChart3, Loader, Trophy, Download } from 'lucide-svelte'
  import { onMount } from 'svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import SkeletonCard from '$lib/components/ui/skeleton-card.svelte'
  import { addToast } from '$lib/stores/toast'

  interface CandidateWithPct extends TVoteCount { percentage: number }
  interface PositionResult extends TVoteResults {
    candidates: CandidateWithPct[]
    totalVotes: number
  }

  let elections = $state<TElection[]>([])
  let selectedElectionId = $state<string>('')
  let resultsData = $state<TVoteResultsResponse | null>(null)
  let electionName = $state('')
  let isLoading = $state(true)
  let isError = $state(false)

  const user = $derived($authStore.user)

  const visibleElections = $derived(
    elections.filter(e => e.status !== 'draft')
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

  onMount(async () => {
    try {
      elections = await listElections()
      
      const state = await getVotingState()
      const activeElection = state.open || state.lastClosed
      
      const filtered = elections.filter(e => e.status !== 'draft')
      if (activeElection && filtered.some(e => e.id === activeElection.id)) {
        selectedElectionId = activeElection.id
      } else if (filtered.length > 0) {
        selectedElectionId = filtered[0].id
      } else {
        selectedElectionId = ''
      }
    }
    catch {
      addToast('error', 'Failed to load elections list')
      isError = true
      isLoading = false
    }
  })

  $effect(() => {
    if (!selectedElectionId) {
      resultsData = {
        results: [],
        meta: {
          totalVotes: 0,
          totalPositions: 0
        }
      }
      isLoading = false
      return
    }

    let active = true
    async function loadResults() {
      isLoading = true
      isError = false
      try {
        const selected = elections.find(e => e.id === selectedElectionId)
        if (selected) {
          electionName = selected.name
        }
        const results = await listResults(selectedElectionId)
        const mappedResults = results.map(r => ({
          positionId: r.positionId,
          positionName: r.positionName,
          candidates: r.candidates.map(c => ({
            candidateId: c.candidateId,
            candidateName: c.fullName,
            positionId: r.positionId,
            positionName: r.positionName,
            voteCount: c.voteCount
          }))
        }))
        const totalVotes = results.reduce((sum, r) => sum + r.totalVotes, 0)
        
        if (active) {
          resultsData = {
            results: mappedResults,
            meta: {
              totalVotes,
              totalPositions: results.length
            }
          }
        }
      }
      catch {
        if (active) {
          isError = true
          addToast('error', 'Failed to load election results')
        }
      }
      finally {
        if (active) {
          isLoading = false
        }
      }
    }

    loadResults()

    return () => {
      active = false
    }
  })

  function exportToCSV() {
    if (!resultsWithPercentages.length || !electionName) return

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

<div class='relative min-h-[100dvh] w-full overflow-hidden bg-slate-900 text-slate-100'>
  <!-- Ambient glow -->
  <div class='pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-blue-600/20 blur-[100px]'></div>
  <div class='pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-rose-600/20 blur-[100px]'></div>

  <div class='relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8'>
    <!-- Header -->
    <header class='relative flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4'>
      <div class='space-y-3'>
        <div>
          <p class='inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/90'>
            <span class='h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]'></span>
            Election Results
          </p>
        </div>
        <div>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl'>Vote Results</h1>
          <p class='mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500'>
            {#if electionName}
              Real-time Election Statistics — {electionName}
            {:else}
              Real-time Election Statistics
            {/if}
          </p>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <p class='text-sm text-slate-200'>Welcome, <span class='font-semibold text-slate-50'>{user?.user?.username || 'Admin'}</span></p>
          <p class='mt-1 text-xs text-slate-400'>View detailed vote counts and percentages for each candidate by position.</p>
        </div>
      </div>

      <div class='absolute right-0'>
        <button
          onclick={() => goto('/admin-dashboard')}
          class='inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 cursor-pointer'
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
    </header>

    <!-- Election Selector & Actions -->
    <div class='flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm backdrop-blur'>
      <div class='flex items-center gap-3'>
        <label for='election-select' class='text-sm font-bold text-slate-400'>
          Election:
        </label>
        {#if visibleElections.length > 0}
          <select
            id='election-select'
            bind:value={selectedElectionId}
            class='rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-100 focus:border-sky-400 focus:outline-none cursor-pointer'
          >
            {#each visibleElections as e}
              <option value={e.id}>{e.name} ({e.status})</option>
            {/each}
          </select>
        {:else if isLoading}
          <div class='h-10 w-48 animate-pulse rounded-xl bg-slate-800'></div>
        {:else}
          <span class='text-sm text-slate-500 font-medium'>No visible elections available</span>
        {/if}
      </div>

      {#if resultsWithPercentages.length > 0 && !isLoading && !isError}
        <button
          onclick={exportToCSV}
          class='flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 cursor-pointer'
        >
          <Download size={16} />
          Export to CSV
        </button>
      {/if}
    </div>

    <!-- Summary -->
    {#if resultsData?.meta}
      <div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <div class='flex items-center gap-3'>
            <div class='rounded-lg bg-blue-500/20 p-2'><BarChart3 size={20} class='text-blue-400' /></div>
            <div>
              <p class='text-xs uppercase tracking-wide text-slate-400'>Total Votes</p>
              <p class='text-xl font-bold text-slate-50'>{resultsData.meta.totalVotes}</p>
            </div>
          </div>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <div class='flex items-center gap-3'>
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
      {#if isLoading}
        <div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          {#each { length: 2 } as _}
            <SkeletonCard />
          {/each}
        </div>
      {:else if isError}
        <div class='rounded-2xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-xl'>
          <p class='text-center text-red-400'>Failed to load results. Please try again later.</p>
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
            <div class='rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8'>
              <!-- Position header -->
              <div class='mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-4'>
                <div class='min-w-0 flex-1'>
                  <h3 class='text-md font-bold text-slate-100 sm:text-xl'>{pos.positionName}</h3>
                  <p class='mt-1 text-xs text-slate-400'>{pos.totalVotes} total {pos.totalVotes === 1 ? 'vote' : 'votes'}</p>
                </div>
                {#if !isTie && winner && winner.voteCount > 0}
                  <div class='flex flex-shrink-0 items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1'>
                    <Trophy size={16} class='text-emerald-400' />
                    <span class='text-xs font-medium text-emerald-300 sm:text-sm'>{winner.candidateName}</span>
                  </div>
                {:else if isTie}
                  <div class='flex flex-shrink-0 items-center gap-2 rounded-full bg-yellow-500/20 px-3 py-1'>
                    <Trophy size={16} class='text-yellow-400' />
                    <span class='text-xs font-medium text-yellow-300 sm:text-sm'>Tie</span>
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
                        <h4 class="text-base font-semibold sm:text-lg {isWinner || isTied ? 'text-emerald-300' : 'text-slate-100'}">
                          {candidate.candidateName}
                        </h4>
                        {#if isWinner || isTied}
                          <Trophy size={18} class='text-emerald-400' />
                        {/if}
                      </div>
                      <div class='flex items-center gap-4 text-xs text-slate-400 sm:text-sm'>
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
