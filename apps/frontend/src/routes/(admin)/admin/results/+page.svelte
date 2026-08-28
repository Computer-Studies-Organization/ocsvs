<script lang='ts'>
  import type { TElection, TElectionStatus, TElectionTurnout, TResults } from '$lib/types'
  import { appCache } from '$lib/cache'
  import {
    refreshElectionAndResults,
    refreshResultsAfterClose,
    startResultsPolling,
  } from '$lib/results-polling'
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth.svelte'
  import { getEffectiveElectionStatus } from '$lib/election-lifecycle-client'
  import { ArrowLeft, BarChart3, Download } from 'lucide-svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import ResultsPanel from '$lib/components/results/results-panel.svelte'
  import { addToast } from '$lib/stores/toast.svelte'

  let { data } = $props()
  const elections = $derived<TElection[]>(data.elections)

  const selectedElection = $derived(
    elections.find(e => e.id === data.selectedElectionId) ?? null
  )
  const electionEntry = $derived(
    selectedElection ? appCache.get('election', { id: selectedElection.id }) : null,
  )
  const currentElection = $derived(electionEntry?.data ?? selectedElection)
  const resultsEntry = $derived(
    currentElection ? appCache.get('results', { electionId: currentElection.id }) : null,
  )
  const isError = $derived(Boolean(data.resultsError) && resultsEntry?.data === null)
  const results = $derived<TResults>(resultsEntry?.data?.results ?? data.results ?? [])
  const turnout = $derived<TElectionTurnout | null>(resultsEntry?.data?.turnout ?? data.turnout ?? null)

  const user = $derived(authStore.user)
  let now = $state(Math.floor(Date.now() / 1000))

  $effect(() => {
    const interval = setInterval(() => {
      now = Math.floor(Date.now() / 1000)
    }, 1000)
    return () => clearInterval(interval)
  })

  const effectiveStatus = $derived(
    currentElection ? getEffectiveElectionStatus(currentElection, now) : null,
  )

  async function poll(force = false) {
    if ((!force && effectiveStatus !== 'open') || (!force && document.hidden)) return
    try {
      await refreshElectionAndResults(
        () => electionEntry?.fetch(true),
        () => resultsEntry?.fetch(true),
      )
    } catch {
      // Fail silently (polling is best-effort)
    }
  }

  let previousEffectiveStatus: TElectionStatus | null = null

  $effect(() => {
    const status = effectiveStatus
    previousEffectiveStatus = status
      ? refreshResultsAfterClose(previousEffectiveStatus, status, () => poll(true))
      : null

    if (status !== 'open') return

    return startResultsPolling(() => poll(), () => status === 'open')
  })

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    closed: 'Closed',
    archived: 'Archived'
  }

  const visibleElections = $derived(
    (currentElection
      ? elections.map(e => e.id === currentElection.id ? currentElection : e)
      : elections
    ).filter(e => getEffectiveElectionStatus(e, now) !== 'draft')
  )

  function selectElection(id: string) {
    goto(`?electionId=${id}`, { keepFocus: true, noScroll: true })
  }

  function exportToCSV() {
    if (!results.length) return
    const electionName = currentElection?.name ?? ''
    const totalBallotsCast = turnout?.totalBallotsCast ?? 'Unavailable'
    const isFinal = !currentElection || ['closed', 'archived'].includes(
      getEffectiveElectionStatus(currentElection, now),
    )

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
    csvRows.push(`${escapeCsv('Total Votes Cast')},${escapeCsv(String(totalBallotsCast))}`)
    csvRows.push('')

    csvRows.push([
      escapeCsv('Position'),
      escapeCsv('Candidate'),
      escapeCsv('Party'),
      escapeCsv('Votes'),
      escapeCsv('Percentage'),
      escapeCsv('Status')
    ].join(','))

    for (const pos of results) {
      const sorted = [...pos.candidates].sort((a, b) => b.voteCount - a.voteCount)
      const winner = sorted[0]
      const isTie = sorted.length > 1 && sorted[0].voteCount === sorted[1].voteCount

      for (let i = 0; i < sorted.length; i++) {
        const candidate = sorted[i]
        let status = ''
        if (candidate.voteCount > 0) {
          if (isTie && candidate.voteCount === winner?.voteCount) {
            status = 'Tied'
          } else if (!isTie && i === 0) {
            status = isFinal ? 'Winner' : 'Leading'
          }
        }
        
        csvRows.push([
          escapeCsv(pos.positionName),
          escapeCsv(candidate.fullName),
          escapeCsv(candidate.partyCode || candidate.partyName || 'Independent'),
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

<svelte:head>
  <title>Vote Results | CSO Voting System</title>
</svelte:head>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='w-full mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8'>
    <!-- Header -->
    <header class='flex items-start gap-4 border-b border-slate-800/70 pb-4'>
      <div class='space-y-3 flex-1 min-w-0'>
        <a
          href='/admin-dashboard'
          class='inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-400 transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          Dashboard
        </a>
        <div>
          <h1 class='text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl'>Vote Results</h1>
          <p class='mt-1 break-words text-xs font-medium uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]'>
            {#if currentElection}
              Real-time Election Statistics — {currentElection.name}
            {:else}
              Real-time Election Statistics
            {/if}
          </p>
        </div>
        <div class='rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md backdrop-blur'>
          <p class='text-sm text-slate-200'>Welcome, <span class='font-semibold text-slate-50'>{user?.username || 'Admin'}</span></p>
          <p class='mt-1 text-xs text-slate-400'>View official vote counts, candidate standings, and voter turnout by position.</p>
        </div>
      </div>
    </header>

    <!-- Election Selector & Actions -->
    <div class='flex flex-col items-stretch gap-3 rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
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

      {#if results.length > 0 && !isError}
        <button
          onclick={exportToCSV}
          class='flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 sm:w-auto'
        >
          <Download size={16} />
          Export to CSV
        </button>
      {/if}
    </div>

    <!-- Results Content -->
    <main class='space-y-8'>
      {#if isError}
        <div class='rounded-2xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-xl'>
          <p class='text-center text-red-400'>{data.resultsError || 'Failed to load results. Please try again later.'}</p>
        </div>
      {:else if results.length === 0}
        <EmptyState
          icon={BarChart3}
          title='No results available'
          description='Results will appear after votes are cast or once an election is closed.'
          cta='View elections'
          oncta={() => goto('/admin/elections')}
        />
      {:else}
        <ResultsPanel election={currentElection} {results} {turnout} status={effectiveStatus ?? 'closed'} />
      {/if}
    </main>
  </div>
</div>
