<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { authStore } from '$lib/stores/auth'
  import { allCandidates } from '$lib/api/candidates'
  import { getMyVotes, submitVotes } from '$lib/api/votes'
  import { logout } from '$lib/api/auth'
  import type { TCandidate, TPositionGroup } from '$lib/types'
  import { UserRole } from '$lib/types'
  import { POSITIONS, type TPosition } from '$lib/constants/positions'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import {
    ArrowRight,
    LockKeyhole,
    LogOut,
    Settings,
    Shield,
    Undo2,
    Vote,
    Loader,
  } from 'lucide-svelte'

  // State
  let candidates = $state<TCandidate[]>([])
  let hasVoted = $state(false)
  let isLoading = $state(true)
  let isSubmitting = $state(false)
  let isSettingsOpen = $state(false)
  let errorMsg = $state('')
  let successMsg = $state('')
  let currentPositionIndex = $state(0)
  let selectedVotes = $state<Record<string, string | null>>({})

  // Derived state
  let user = $derived($authStore.user)
  let positionGroups = $derived<TPositionGroup[]>(() => {
    const byPosition = new Map<string, TCandidate[]>()
    for (const c of candidates) {
      const pos = c.position || 'Unknown'
      const arr = byPosition.get(pos) ?? []
      arr.push(c)
      byPosition.set(pos, arr)
    }
    const groups = Array.from(byPosition.entries()).map(([positionName, cands]) => ({
      id: positionName.toLowerCase().replace(/\s+/g, '-'),
      title: positionName,
      description: positionName,
      candidates: cands,
    }))
    return groups.sort((a, b) => {
      const ia = POSITIONS.indexOf(a.title as TPosition)
      const ib = POSITIONS.indexOf(b.title as TPosition)
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  })

  let currentGroup = $derived(positionGroups[currentPositionIndex])
  let isFirst = $derived(currentPositionIndex === 0)
  let isLast = $derived(currentPositionIndex === positionGroups.length - 1)
  let hasCurrentVote = $derived(currentGroup ? selectedVotes[currentGroup.id] !== null : false)
  let completedCount = $derived(Object.values(selectedVotes).filter(Boolean).length)
  let allVoted = $derived(positionGroups.every(g => selectedVotes[g.id] !== null))

  onMount(async () => {
    try {
      const [candidateRes, voteRes] = await Promise.all([allCandidates(), getMyVotes()])
      candidates = candidateRes.data
      hasVoted = voteRes.hasVoted

      // Initialize selectedVotes
      const initialVotes: Record<string, string | null> = {}
      for (const c of candidates) {
        const posId = (c.position || 'Unknown').toLowerCase().replace(/\s+/g, '-')
        if (!(posId in initialVotes)) {
          initialVotes[posId] = null
        }
      }
      selectedVotes = initialVotes
    } catch (e: any) {
      errorMsg = e.message || 'Failed to load ballot'
    } finally {
      isLoading = false
    }
  })

  function handleSelectCandidate(positionId: string, candidateId: string) {
    if (hasVoted) return
    selectedVotes = { ...selectedVotes, [positionId]: candidateId }
  }

  async function handleSubmitVotes() {
    isSubmitting = true
    errorMsg = ''
    const candidateIds = Object.values(selectedVotes).filter((id): id is string => id !== null)
    try {
      await submitVotes(candidateIds)
      successMsg = 'Votes submitted successfully! Your selections have been saved.'
      hasVoted = true
      setTimeout(() => {
        successMsg = ''
      }, 4000)
    } catch (e: any) {
      errorMsg = e.message || 'Failed to submit votes'
    } finally {
      isSubmitting = false
    }
  }

  async function handleLogout() {
    try {
      await logout()
      authStore.set({ user: null, loading: false })
      goto('/auth', { replaceState: true })
    } catch (e) {
      // ignore
    }
  }
</script>

{#if isLoading}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
    <Spinner size={40} />
  </div>
{:else}
  {#if isSubmitting}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
      <Loader class="animate-spin text-blue-400" size={40} />
    </div>
  {/if}

  <div class="min-h-[100dvh] bg-slate-950/95 text-slate-100">
    <!-- Top gradient bar -->
    <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500"></div>

    <!-- Background glow -->
    <div class="pointer-events-none fixed inset-0 -z-10">
      <div class="absolute -top-40 left-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl"></div>
      <div class="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"></div>
    </div>

    <div class="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-6 md:px-6 lg:px-8">
      <!-- HEADER -->
      <header class="relative mb-5 flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4">
        <div class="space-y-3">
          <div>
            {#if hasVoted}
              <p class="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/90">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"></span>
                Voting completed
              </p>
            {:else}
              <p class="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/90">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"></span>
                Secure voting session
              </p>
            {/if}
          </div>

          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Official Student Ballot
            </h1>
            <p class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Digital Voting System
            </p>
          </div>

          <div class="rounded-xl border border-slate-800/80 max-w-sm bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
            <p class="text-sm text-slate-200">
              Welcome, <span class="font-semibold text-slate-50">{user?.user?.username || 'Voter'}</span>
            </p>
            {#if hasVoted}
              <p class="mt-1 text-xs text-emerald-400">
                <span class="font-semibold">Voting completed!</span> Your ballot has been recorded.
              </p>
            {:else}
              <p class="mt-1 text-xs text-slate-400">
                Please review each position and select <span class="font-semibold text-slate-200">one nominee per role</span>.
              </p>
            {/if}
          </div>
        </div>

        <!-- Settings menu -->
        <div class="absolute right-0 flex items-start justify-end">
          <div class="relative">
            <button
              onclick={() => isSettingsOpen = !isSettingsOpen}
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-300 shadow-sm transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-50 cursor-pointer"
            >
              <Settings size={18} />
            </button>

            {#if isSettingsOpen}
              <div class="absolute z-50 right-0 top-11 w-60 rounded-xl border border-slate-800/80 bg-slate-950/95 p-1.5 text-sm text-slate-100 shadow-xl backdrop-blur">
                <div class="px-3 py-2">
                  <p class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Account</p>
                  <p class="mt-1 text-xs font-medium text-slate-200">{user?.user?.username || 'Authenticated voter'}</p>
                </div>
                <div class="my-1 h-px bg-slate-800/80"></div>

                {#if user?.user?.role === UserRole.ADMIN}
                  <button
                    onclick={() => goto('/admin-dashboard')}
                    class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 hover:bg-slate-900/90 cursor-pointer"
                  >
                    <span>Admin Dashboard</span>
                    <Shield size={18} class="text-amber-300" />
                  </button>
                {/if}

                <button
                  onclick={() => goto('/settings')}
                  class="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 hover:bg-slate-900/90 cursor-pointer"
                >
                  <span>Profile Settings</span>
                  <Settings size={18} class="text-sky-400" />
                </button>

                <div class="my-1 h-px bg-slate-800/80"></div>

                <button
                  onclick={handleLogout}
                  class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-400 hover:bg-red-500/5 cursor-pointer"
                >
                  <span>Logout</span>
                  <LogOut size={16} />
                </button>
              </div>
            {/if}
          </div>
        </div>
      </header>

      <!-- Alerts -->
      {#if successMsg}
        <div class="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300 font-semibold">
          {successMsg}
        </div>
      {/if}
      {#if errorMsg}
        <div class="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 font-semibold">
          {errorMsg}
        </div>
      {/if}

      <!-- Progress bar -->
      <div class="mb-5 flex items-center justify-between gap-4 rounded-xl border border-slate-800/60 bg-gradient-to-r from-slate-900/90 to-slate-800/50 p-4 backdrop-blur-sm">
        <div class="flex items-center gap-6">
          <div class="flex flex-col">
            <span class="text-[10px] uppercase tracking-[0.2em] text-slate-500">Completed</span>
            <span class="mt-1 text-2xl font-bold text-emerald-400">{completedCount}</span>
            <span class="text-[10px] text-slate-500">of {positionGroups.length} positions</span>
          </div>
        </div>
        <div class="h-12 w-px bg-slate-700/50"></div>
        <div class="flex flex-col">
          <span class="text-[10px] uppercase tracking-[0.2em] text-slate-500">Remaining</span>
          <span class="mt-1 text-2xl font-bold text-sky-400">{positionGroups.length - completedCount}</span>
          <span class="text-[10px] text-slate-500">positions to vote</span>
        </div>
      </div>

      <!-- CONTENT -->
      <main class="grid flex-1 gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section class="flex min-h-[60vh] flex-col rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
                Position {currentPositionIndex + 1} of {positionGroups.length}
              </p>
              <h2 class="text-lg font-semibold text-slate-50 sm:text-xl">{currentGroup?.title || ''}</h2>
            </div>
            <div class="flex flex-col items-end gap-2">
              {#if hasCurrentVote}
                <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Choice saved
                </span>
              {/if}
            </div>
          </div>

          <!-- Candidates -->
          <div class="space-y-3">
            {#each currentGroup?.candidates ?? [] as candidate (candidate.id)}
              {@const isSelected = selectedVotes[currentGroup?.id ?? ''] === candidate.id}
              <button
                type="button"
                disabled={hasVoted}
                onclick={() => handleSelectCandidate(currentGroup?.id ?? '', candidate.id)}
                class="group flex w-full items-start justify-between gap-4 rounded-xl border px-4 py-4 text-left transition-all cursor-pointer
                  {hasVoted ? 'cursor-not-allowed opacity-60 border-slate-800/80 bg-slate-900/80' :
                   isSelected ? 'border-sky-400/80 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' :
                   'border-slate-800/80 bg-slate-900/80 hover:border-sky-500/60 hover:bg-slate-900'}"
              >
                <div class="space-y-1.5">
                  <p class="text-sm font-semibold text-slate-50">{candidate.fullName}</p>
                  <p class="text-[11px] -mt-1.5 sm:text-xs text-slate-400">{candidate.position}</p>
                  <p class="text-[11px] italic text-slate-300/85">"{candidate.manifesto}"</p>
                </div>
                {#if isSelected}
                  <span class="mt-1 inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                    Voted
                  </span>
                {/if}
              </button>
            {/each}
          </div>

          <!-- Navigation -->
          <div class="mt-auto pt-5">
            <div class="flex flex-col gap-3 sm:flex-row">
              {#if !isFirst}
                <button
                  type="button"
                  disabled={hasVoted}
                  onclick={() => currentPositionIndex--}
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition cursor-pointer
                    {hasVoted ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-500 hover:bg-slate-800'}"
                >
                  <Undo2 size={18} />
                  Previous position
                </button>
              {/if}

              {#if !isLast}
                <button
                  type="button"
                  disabled={!hasCurrentVote || hasVoted}
                  onclick={() => currentPositionIndex++}
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition cursor-pointer
                    {hasCurrentVote && !hasVoted ? 'bg-sky-500 text-white shadow-md shadow-sky-500/40 hover:bg-sky-600' : 'cursor-not-allowed bg-slate-800 text-slate-500'}"
                >
                  Next position
                  <ArrowRight size={18} />
                </button>
              {:else}
                <button
                  type="button"
                  disabled={!allVoted || isSubmitting || hasVoted}
                  onclick={handleSubmitVotes}
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition cursor-pointer
                    {allVoted && !isSubmitting && !hasVoted ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40 hover:bg-emerald-600' : 'cursor-not-allowed bg-slate-800 text-slate-500'}"
                >
                  {#if isSubmitting}
                    <Loader class="animate-spin" size={18} />
                    Submitting...
                  {:else if hasVoted}
                    Already Voted
                  {:else}
                    Submit ballot
                  {/if}
                </button>
              {/if}
            </div>

            <div class="mt-3 text-center text-[11px] text-slate-500">
              {#if hasVoted}
                <span class="text-emerald-400">Voting is complete. Your ballot has been recorded.</span>
              {:else if isLast}
                Review your selections. When ready, submit your ballot.
              {:else}
                You must select a nominee to continue to the next position.
              {/if}
            </div>
          </div>
        </section>

        <!-- Sidebar -->
        <aside class="flex flex-col gap-3">
          <section class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 text-xs text-slate-300 shadow-lg backdrop-blur">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Voting guidelines</p>
            <ul class="mt-2 space-y-1.5">
              <li class="flex items-start gap-2">
                <span class="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                <span>Select <span class="font-semibold text-slate-100">one nominee</span> for each position.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                <span>You can review and change your selections before submitting your ballot.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                <span>Once submitted, your ballot is <span class="font-semibold text-slate-100">final</span> and cannot be changed.</span>
              </li>
              {#if hasVoted}
                <li class="flex items-start gap-2">
                  <span class="mt-[3px] h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                  <span class="text-amber-300"><span class="font-semibold">You have already voted.</span> Voting is now disabled.</span>
                </li>
              {/if}
            </ul>

            <div class="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
              <LockKeyhole size={14} />
              <p>All votes are confidential and securely recorded.</p>
            </div>
          </section>

          <!-- Position progress list -->
          <section class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
            <p class="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ballot Progress</p>
            <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {#each positionGroups as group, i (group.id)}
                <button
                  onclick={() => { if (!hasVoted) currentPositionIndex = i }}
                  disabled={hasVoted}
                  class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition cursor-pointer
                    {i === currentPositionIndex ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}"
                >
                  <span class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                    {selectedVotes[group.id] ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}">
                    {i + 1}
                  </span>
                  <span class="truncate text-[11px] {selectedVotes[group.id] ? 'text-slate-200' : 'text-slate-400'}">{group.title}</span>
                  {#if selectedVotes[group.id]}
                    <Vote size={10} class="ml-auto flex-shrink-0 text-emerald-400" />
                  {/if}
                </button>
              {/each}
            </div>
          </section>
        </aside>
      </main>

      <!-- Footer -->
      <footer class="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-[10px] text-slate-500 sm:flex-row">
        <div class="flex items-center gap-2">
          <LockKeyhole size={11} />
          <span>Session secured and monitored to prevent duplicate voting.</span>
        </div>
      </footer>
    </div>
  </div>
{/if}
