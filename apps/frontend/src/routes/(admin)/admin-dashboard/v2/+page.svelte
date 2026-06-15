<script lang='ts'>
  import type { TCandidate, TUsersData } from '$lib/types'
  import { goto } from '$app/navigation'
  import { allCandidates, createCandidate } from '$lib/api/candidates'
  import { fetchUsers } from '$lib/api/users'
  import { getVoteResults } from '$lib/api/votes'
  import { authStore } from '$lib/stores/auth'
  import CandidateCard from '$lib/components/ui/candidate-card.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import { POSITIONS } from '$lib/constants/positions'
  import { getCandidateUserLabel, resolveCandidateUserSelection } from '$lib/adminUsers'
  import { CANDIDATE_FIELD_LABELS, getMutationErrorMessage } from '$lib/userRegistration'
  import {
    Award,
    BarChart3,
    ChevronDown,
    Loader,
    Menu,
    Plus,
    TrendingUp,
    Users2,
    X,
  } from 'lucide-svelte'
  import { onMount } from 'svelte'

  interface CandidateWithStats extends TCandidate {
    voteCount: number
    percentage: number
  }

  interface PositionGroup {
    position: string
    candidates: CandidateWithStats[]
  }

  let candidates = $state<CandidateWithStats[]>([])
  let users = $state<TUsersData[]>([])
  let isLoadingCandidates = $state(true)
  let isCandidateModalOpen = $state(false)
  let isCandidateSaving = $state(false)
  let candidateMsg = $state('')
  let usersError = $state('')
  let candidatesError = $state('')
  let isSidebarOpen = $state(true)
  let expandedPositions = $state<Set<string>>(new Set(POSITIONS))

  const EMPTY_CANDIDATE_FORM = { fullName: '', position: '', manifesto: '', accountId: '' }
  let candidateForm = $state({ ...EMPTY_CANDIDATE_FORM })

  const authUser = $derived($authStore.user)

  const positionGroups = $derived.by<PositionGroup[]>(() => {
    return POSITIONS
      .map(pos => ({
        position: pos,
        candidates: candidates.filter(c => c.position === pos),
      }))
      .filter(g => g.candidates.length > 0)
  })

  const totalVotes = $derived(candidates.reduce((sum, c) => sum + c.voteCount, 0))
  const totalCandidates = $derived(candidates.length)

  async function loadCandidates() {
    isLoadingCandidates = true
    candidatesError = ''
    try {
      const [res, resultsRes] = await Promise.all([
        allCandidates(),
        getVoteResults(),
      ])

      const counts: Record<string, number> = {}
      for (const group of resultsRes.results) {
        for (const c of group.candidates) {
          counts[c.candidateId] = c.voteCount || 0
        }
      }

      const withVotes = res.data.map(c => ({
        ...c,
        voteCount: counts[c.id] || 0,
        percentage: 0,
      }))

      const positionTotals: Record<string, number> = {}
      for (const c of withVotes) {
        positionTotals[c.position] = (positionTotals[c.position] || 0) + c.voteCount
      }

      candidates = withVotes.map(c => ({
        ...c,
        percentage: positionTotals[c.position] > 0
          ? Math.round((c.voteCount / positionTotals[c.position]) * 10000) / 100
          : 0,
      }))
    } catch (err: unknown) {
      candidatesError = getMutationErrorMessage(err, 'Failed to load candidates')
      candidates = []
    } finally {
      isLoadingCandidates = false
    }
  }

  async function loadUsers() {
    try {
      const res = await fetchUsers({ limit: 100 })
      users = res.data
    } catch (err: unknown) {
      usersError = getMutationErrorMessage(err, 'Failed to load users')
      users = []
    }
  }

  onMount(() => {
    loadCandidates()
    loadUsers()
  })

  function togglePosition(position: string) {
    const next = new Set(expandedPositions)
    if (next.has(position)) {
      next.delete(position)
    } else {
      next.add(position)
    }
    expandedPositions = next
  }

  function handleUserSelect(accountId: string) {
    const selected = resolveCandidateUserSelection(users, accountId)
    candidateForm.accountId = selected?.accountId ?? ''
    candidateForm.fullName = selected ? `${selected.firstName} ${selected.lastName}` : ''
  }

  function openCreateModal() {
    candidateForm = { ...EMPTY_CANDIDATE_FORM }
    candidateMsg = ''
    isCandidateModalOpen = true
  }

  async function handleCandidateSubmit(e: SubmitEvent) {
    e.preventDefault()
    candidateMsg = ''

    if (!candidateForm.fullName.trim() || !candidateForm.position.trim() || !candidateForm.manifesto.trim()) {
      candidateMsg = 'All fields are required'
      return
    }
    if (!candidateForm.accountId) {
      candidateMsg = 'Please select a valid user from the list'
      return
    }

    isCandidateSaving = true
    try {
      await createCandidate({
        fullName: candidateForm.fullName,
        accountId: candidateForm.accountId,
        position: candidateForm.position,
        manifesto: candidateForm.manifesto,
      })
      candidateMsg = ''
      candidateForm = { ...EMPTY_CANDIDATE_FORM }
      isCandidateModalOpen = false
      await loadCandidates()
    } catch (err: unknown) {
      candidateMsg = getMutationErrorMessage(err, 'Failed to create candidate', CANDIDATE_FIELD_LABELS)
    } finally {
      isCandidateSaving = false
    }
  }
</script>

<div class='min-h-screen' style='background: oklch(0.16 0.020 250)'>
  <!-- Mobile overlay -->
  {#if isSidebarOpen}
    <div
      class='fixed inset-0 z-40 lg:hidden'
      style='background: oklch(0.10 0.015 250 / 0.8)'
      onclick={() => isSidebarOpen = false}
    />
  {/if}

  <!-- Sidebar -->
  <aside
    aria-label='Navigation sidebar'
    class='fixed left-0 top-0 bottom-0 border-r flex flex-col z-50 transition-all duration-300 {isSidebarOpen ? "w-64" : "w-0 lg:w-16"}'
    style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
  >
    <div class='p-6 border-b flex items-center justify-between' style='border-color: oklch(0.25 0.025 250)'>
      {#if isSidebarOpen}
        <div>
          <h1 class='text-xl font-black tracking-tight' style='color: oklch(0.95 0.008 250)'>OCSVS Admin</h1>
          <p class='text-xs font-semibold mt-1' style='color: oklch(0.60 0.015 250)'>Election Control Panel</p>
        </div>
        <button
          onclick={() => isSidebarOpen = false}
          class='hidden lg:block p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/10'
          style='color: oklch(0.60 0.015 250)'
        >
          <ChevronDown size={20} stroke-width={2.5} style='transform: rotate(-90deg)' />
        </button>
      {:else}
        <button
          onclick={() => isSidebarOpen = true}
          class='hidden lg:block p-1.5 rounded-lg transition-colors mx-auto cursor-pointer hover:bg-white/10'
          style='color: oklch(0.60 0.015 250)'
        >
          <ChevronDown size={20} stroke-width={2.5} style='transform: rotate(90deg)' />
        </button>
      {/if}
    </div>

    {#if isSidebarOpen}
      <nav class='flex-1 p-4 space-y-2'>
        <button
          class='w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer'
          style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250)'
        >
          Candidates
        </button>
        <a
          href='/admin-dashboard'
          class='block w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors hover:bg-white/10'
          style='color: oklch(0.70 0.015 250)'
        >
          Users
        </a>
        <a
          href='/admin-dashboard/results'
          class='block w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors hover:bg-white/10'
          style='color: oklch(0.70 0.015 250)'
        >
          Results
        </a>
        <a
          href='/settings'
          class='block w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors hover:bg-white/10'
          style='color: oklch(0.70 0.015 250)'
        >
          Settings
        </a>
      </nav>

      <div class='p-4 m-4 rounded-xl' style='background: oklch(0.20 0.022 250)'>
        <div class='flex items-center gap-3'>
          <div
            class='w-10 h-10 rounded-full flex items-center justify-center font-black'
            style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250)'
          >
            {(authUser?.user.username || 'A').charAt(0).toUpperCase()}
          </div>
          <div class='flex-1 min-w-0'>
            <p class='font-bold text-sm truncate' style='color: oklch(0.95 0.008 250)'>
              {authUser?.user.username || 'Admin User'}
            </p>
            <p class='text-xs truncate' style='color: oklch(0.60 0.015 250)'>
              {authUser?.user.email || 'admin@ocsvs.edu'}
            </p>
          </div>
        </div>
      </div>
    {/if}
  </aside>
  <!-- Main Content -->
  <div class='transition-all duration-300 {isSidebarOpen ? "lg:ml-64" : "lg:ml-16"}'>
    <!-- Header -->
    <header
      class='sticky top-0 z-10 border-b'
      style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
    >
      <div class='px-4 sm:px-6 lg:px-8 py-4'>
        <div class='flex items-center justify-between gap-4'>
          <div class='flex items-center gap-3'>
            <button
              onclick={() => isSidebarOpen = true}
              class='lg:hidden p-2 rounded-xl transition-colors cursor-pointer hover:bg-white/10'
              style='color: oklch(0.70 0.015 250)'
            >
              <Menu size={24} stroke-width={2.5} />
            </button>
            <div>
              <h2 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>Candidate Management</h2>
              <p class='text-sm font-medium mt-0.5' style='color: oklch(0.65 0.015 250)'>
                {totalCandidates} candidates across {positionGroups.length} positions
              </p>
            </div>
          </div>
          <div class='hidden lg:flex gap-3'>
            <button
              onclick={() => goto('/admin-dashboard/results')}
              class='flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer'
              style='background: oklch(0.70 0.12 280); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.70 0.12 280 / 0.3)'
            >
              <BarChart3 size={18} stroke-width={2.5} />
              <span class='hidden sm:inline'>View Results</span>
            </button>
            <button
              onclick={openCreateModal}
              class='flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer'
              style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
            >
              <Plus size={18} stroke-width={2.5} />
              <span class='hidden sm:inline'>New Candidate</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class='border-b' style='border-color: oklch(0.25 0.025 250)'>
      <div class='px-4 sm:px-6 lg:px-8 py-6'>
        <div class='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          {#each [
            { label: 'Total Candidates', value: totalCandidates, icon: Users2, color: 'oklch(0.70 0.12 250)' },
            { label: 'Active Positions', value: positionGroups.length, icon: Award, color: 'oklch(0.70 0.12 280)' },
            { label: 'Total Votes Cast', value: totalVotes, icon: TrendingUp, color: 'oklch(0.70 0.12 140)' },
          ] as stat}
            <div
              class='p-5 rounded-2xl border'
              style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
            >
              <div class='flex items-center gap-3 mb-2'>
                <div class='p-2 rounded-lg' style='background: {stat.color} / 0.15'>
                  <svelte:component this={stat.icon} size={20} stroke-width={2.5} style='color: {stat.color}' />
                </div>
                <p class='text-xs font-bold uppercase tracking-wider' style='color: oklch(0.60 0.015 250)'>
                  {stat.label}
                </p>
              </div>
              <p class='text-3xl font-black' style='color: oklch(0.95 0.008 250)'>
                {stat.value}
              </p>
            </div>
          {/each}
        </div>
      </div>
    </div>
    <!-- Candidates Grid -->
    <div class='px-4 sm:px-6 lg:px-8 py-6'>
      {#if isLoadingCandidates}
        <div
          class='rounded-2xl border p-8 shadow-2xl'
          style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
        >
          <div class='flex items-center justify-center gap-3'>
            <Loader class='animate-spin' size={24} style='color: oklch(0.55 0.15 250)' />
            <p class='text-sm font-medium' style='color: oklch(0.70 0.015 250)'>Loading candidates...</p>
          </div>
        </div>
      {:else if candidatesError}
        <div class='rounded-2xl border border-red-500/30 bg-red-500/10 p-8 shadow-2xl'>
          <p class='text-sm text-center text-red-300'>{candidatesError}</p>
        </div>
      {:else if candidates.length === 0}
        <div
          class='rounded-2xl border p-8 shadow-2xl'
          style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
        >
          <p class='text-sm text-center' style='color: oklch(0.70 0.015 250)'>
            No candidates yet. Click <span class='font-bold' style='color: oklch(0.55 0.15 250)'>New Candidate</span> to create one.
          </p>
        </div>
      {:else}
        <div class='space-y-6'>
          {#each positionGroups as group (group.position)}
            <div>
              <button
                onclick={() => togglePosition(group.position)}
                aria-expanded={expandedPositions.has(group.position)}
                class='w-full flex items-center justify-between mb-4 group cursor-pointer'
              >
                <div class='flex items-center gap-2'>
                  <ChevronDown
                    size={20}
                    stroke-width={2.5}
                    class='transition-transform duration-200'
                    style='color: oklch(0.70 0.12 250); transform: {expandedPositions.has(group.position) ? "rotate(0deg)" : "rotate(-90deg)"}'
                  />
                  <h3 class='text-lg font-black' style='color: oklch(0.95 0.008 250)'>
                    {group.position}
                  </h3>
                </div>
                <span
                  class='px-3 py-1 rounded-full text-xs font-bold'
                  style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.12 250)'
                >
                  {group.candidates.length} {group.candidates.length === 1 ? 'candidate' : 'candidates'}
                </span>
              </button>

              {#if expandedPositions.has(group.position)}
                <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {#each group.candidates as candidate (candidate.id)}
                    <CandidateCard
                      candidate={candidate}
                      voteCount={candidate.voteCount}
                      percentage={candidate.percentage}
                      manifestoClamp='line-clamp-2'
                    />
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- FAB - Mobile only -->
  <div class='lg:hidden fixed bottom-6 right-6 z-30'>
    <button
      onclick={openCreateModal}
      class='w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all cursor-pointer hover:scale-110'
      style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 30px -5px oklch(0.55 0.15 250 / 0.5)'
    >
      <Plus size={24} stroke-width={2.5} />
    </button>
  </div>
</div>

<!-- Add Candidate Modal -->
<Modal open={isCandidateModalOpen} onclose={() => { if (!isCandidateSaving) { isCandidateModalOpen = false; candidateForm = { ...EMPTY_CANDIDATE_FORM }; candidateMsg = '' } }}>
  <div class='flex items-center justify-between mb-6'>
    <h2 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>Add New Candidate</h2>
  </div>

  {#if candidateMsg}
    <div class='mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{candidateMsg}</div>
  {/if}

  <form onsubmit={handleCandidateSubmit} class='space-y-5'>
    <div class='space-y-2'>
      <label class='block text-sm font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>User</label>
      {#if usersError}
        <div class='rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300'>{usersError}</div>
      {/if}
      <select
        value={candidateForm.accountId}
        onchange={(e) => handleUserSelect(e.currentTarget.value)}
        required
        class='w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      >
        <option value=''>Select a user</option>
        {#each users as u (u.accountId)}
          <option value={u.accountId}>{getCandidateUserLabel(u)}</option>
        {/each}
      </select>
    </div>

    <div class='space-y-2'>
      <label class='block text-sm font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>Full Name</label>
      <input
        type='text'
        value={candidateForm.fullName}
        readonly
        required
        class='w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
    </div>

    <div class='space-y-2'>
      <label class='block text-sm font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>Position</label>
      <select
        bind:value={candidateForm.position}
        required
        class='w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      >
        <option value=''>Select position</option>
        {#each POSITIONS as pos}
          <option value={pos}>{pos}</option>
        {/each}
      </select>
    </div>

    <div class='space-y-2'>
      <label class='block text-sm font-bold uppercase tracking-wider' style='color: oklch(0.70 0.015 250)'>Manifesto</label>
      <textarea
        bind:value={candidateForm.manifesto}
        rows={5}
        required
        class='w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all resize-none focus:outline-none'
        style='background: oklch(0.16 0.020 250); border-color: oklch(0.28 0.025 250); color: oklch(0.95 0.008 250)'
      />
    </div>

    <div class='flex gap-3 pt-2'>
      <button
        type='button'
        onclick={() => { if (!isCandidateSaving) { isCandidateModalOpen = false; candidateForm = { ...EMPTY_CANDIDATE_FORM }; candidateMsg = '' } }}
        class='flex-1 px-4 py-3.5 rounded-xl font-bold transition-all cursor-pointer hover:bg-white/10'
        style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
      >
        Cancel
      </button>
      <button
        type='submit'
        disabled={!candidateForm.fullName.trim() || !candidateForm.position.trim() || !candidateForm.manifesto.trim() || !candidateForm.accountId || isCandidateSaving}
        class='flex-1 px-4 py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
        style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
      >
        {#if isCandidateSaving}<Loader class='animate-spin' size={20} />{/if}
        {isCandidateSaving ? 'Creating...' : 'Add Candidate'}
      </button>
    </div>
  </form>
</Modal>
