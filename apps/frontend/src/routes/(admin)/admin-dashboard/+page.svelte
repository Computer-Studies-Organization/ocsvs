<script lang='ts'>
  import type { AdminStats } from '$lib/api/admin-stats'
  import { goto, invalidateAll } from '$app/navigation'
  import Countdown from '$lib/components/ui/countdown.svelte'
  import { formatTimestamp } from '$lib/utils'
  import {
    Users,
    FileText,
    Activity,
    PlusCircle,
    ArrowRight,
    Vote,
    History,
    ShieldAlert,
    Calendar,
    ChevronRight
  } from 'lucide-svelte'

  let { data } = $props()
  const stats = $derived<AdminStats>(data.stats)
  const error = $derived<string | undefined>(data.error)
  const turnoutPct = $derived(stats.activeElection?.turnoutPct ?? null)
  const votedCount = $derived(stats.activeElection?.votedCount ?? null)
  const votersCount = $derived(stats.activeElection?.votersCount ?? null)
  const turnoutProgress = $derived(Math.max(0, Math.min(100, turnoutPct ?? 0)))

  function truncateId(id: string): string {
    return id.length > 12 ? id.slice(0, 12) + '…' : id
  }
</script>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <!-- Top accent bar -->
  <div class='h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500'></div>

  <div class='w-full mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
    <!-- Header -->
    <header class='mb-8 flex flex-wrap items-center justify-between gap-4'>
      <div>
        <h1 class='text-3xl font-black text-slate-50 tracking-tight sm:text-4xl'>Dashboard Overview</h1>
        <p class='mt-1 text-sm text-slate-400'>Monitor election participation, system audit history, and access quick actions.</p>
      </div>
    </header>

    {#if error}
      <div class='mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3 text-red-400'>
        <ShieldAlert size={20} />
        <p class='text-sm font-semibold'>{error}</p>
      </div>
    {/if}

    <!-- Metrics Grid -->
    <div class='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8'>
      <!-- Voters Card -->
      <div class='relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md shadow-sm transition hover:border-slate-700/80'>
        <div class='flex items-center justify-between'>
          <div>
            <p class='text-xs font-bold uppercase tracking-wider text-slate-500'>Registered Voters</p>
            <p class='mt-2 text-3xl font-black text-slate-50'>{stats.votersCount}</p>
          </div>
          <div class='rounded-xl bg-blue-500/10 p-3 text-blue-400 border border-blue-500/10'>
            <Users size={24} />
          </div>
        </div>
        <div class='mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-3'>
          <span>Active voter directory</span>
          <a href='/admin/users' class='flex items-center gap-0.5 text-blue-400 font-bold hover:underline'>
            Manage users →
          </a>
        </div>
      </div>

      <!-- Elections Card -->
      <div class='relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md shadow-sm transition hover:border-slate-700/80'>
        <div class='flex items-center justify-between'>
          <div>
            <p class='text-xs font-bold uppercase tracking-wider text-slate-500'>Total Elections</p>
            <p class='mt-2 text-3xl font-black text-slate-50'>{stats.electionsCount}</p>
          </div>
          <div class='rounded-xl bg-purple-500/10 p-3 text-purple-400 border border-purple-500/10'>
            <FileText size={24} />
          </div>
        </div>
        <div class='mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-3'>
          <span>Draft, Live, Closed or Archived</span>
          <a href='/admin/elections' class='flex items-center gap-0.5 text-purple-400 font-bold hover:underline'>
            View elections →
          </a>
        </div>
      </div>

      <!-- Turnout Quick Card -->
      <div class='relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md shadow-sm transition hover:border-slate-700/80 sm:col-span-2 lg:col-span-1'>
        <div class='flex items-center justify-between'>
          <div>
            <p class='text-xs font-bold uppercase tracking-wider text-slate-500'>Active Turnout</p>
            <p class='mt-2 text-3xl font-black text-slate-50'>
              {stats.activeElection && turnoutPct !== null ? `${turnoutPct}%` : 'Unavailable'}
            </p>
          </div>
          <div class='rounded-xl bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/10'>
            <Activity size={24} />
          </div>
        </div>
        <div class='mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-3'>
          <span>
            {stats.activeElection
              ? votedCount !== null
                ? `${votedCount} votes cast`
                : 'Ballot count unavailable'
              : 'No active election'}
          </span>
          {#if stats.activeElection}
            <a href='/admin/results' class='flex items-center gap-0.5 text-emerald-400 font-bold hover:underline'>
              Real-time results →
            </a>
          {/if}
        </div>
      </div>
    </div>

    <div class='grid grid-cols-1 gap-8 lg:grid-cols-3'>
      <!-- Left 2 Cols: Turnout & Action -->
      <div class='lg:col-span-2 space-y-8'>
        <!-- Turnout Progress Card -->
        <div class='rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm backdrop-blur-md'>
          <h2 class='text-lg font-bold text-slate-50 mb-4 flex items-center gap-2'>
            <Vote size={18} class='text-amber-400' />
            Live Election Turnout
          </h2>

          {#if stats.activeElection}
            <div class='space-y-4'>
              <div class='flex items-center justify-between gap-4'>
                <div>
                  <span class='inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase mb-1.5'>
                    <span class='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping'></span>
                    Live Now
                  </span>
                  <h3 class='text-base font-bold text-slate-100'>{stats.activeElection.name}</h3>
                </div>
                <div class='text-right'>
                  <span class='text-xl font-black text-amber-400'>{turnoutPct !== null ? `${turnoutPct}%` : 'Unavailable'}</span>
                  {#if votedCount !== null && votersCount !== null}
                    <p class='text-xs text-slate-500'>{votedCount} / {votersCount} voted</p>
                  {:else}
                    <p class='text-xs text-slate-500'>Ballot turnout unavailable</p>
                  {/if}
                </div>
              </div>

              <!-- Progress bar -->
              <div class='space-y-1.5'>
                <div class='h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800/80'>
                  <div
                    class='h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500'
                    style='width: {turnoutProgress}%'
                  ></div>
                </div>
              </div>

              {#if stats.activeElection.closesAt}
                <div class='flex flex-wrap items-center gap-3 text-xs bg-slate-950/65 rounded-xl px-4 py-2 border border-slate-850 w-fit'>
                  <div class='flex items-center gap-1.5 text-slate-400'>
                    <Calendar size={14} class='text-slate-500' />
                    <span>Closes at: <span class='font-semibold text-slate-350'>{formatTimestamp(stats.activeElection.closesAt)}</span></span>
                  </div>
                  <div class='h-3 w-px bg-slate-800 hidden sm:block'></div>
                  <Countdown
                    targetUnixSeconds={stats.activeElection.closesAt}
                    prefix="Time left: "
                    class="text-amber-400 font-semibold"
                    onZero={async () => {
                      await invalidateAll()
                    }}
                  />
                </div>
              {/if}
            </div>
          {:else}
            <div class='py-8 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/30'>
              <Vote size={36} class='mx-auto text-slate-700 mb-2' />
              <p class='text-sm text-slate-400 font-semibold'>No Active Voting Session</p>
              <p class='text-xs text-slate-500 mt-1'>Activate or create an election from the elections management page.</p>
              <a
                href='/admin/elections'
                class='mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 px-4 py-2 text-xs font-bold text-slate-200 border border-slate-700 transition'
              >
                Go to Elections
                <ArrowRight size={12} />
              </a>
            </div>
          {/if}
        </div>

        <!-- Quick Actions Card -->
        <div class='rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm backdrop-blur-md'>
          <h2 class='text-lg font-bold text-slate-50 mb-4'>Quick Actions</h2>
          <div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <!-- Create Election -->
            <a
              href='/admin/elections'
              class='flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:bg-slate-950 hover:border-slate-750 hover:scale-[1.01]'
            >
              <div class='rounded-lg bg-amber-500/10 p-2.5 text-amber-400 border border-amber-500/10'>
                <PlusCircle size={18} />
              </div>
              <div>
                <h3 class='text-sm font-bold text-slate-100'>Manage Elections</h3>
                <p class='mt-1 text-xs text-slate-500'>Create elections, adjust schedule, or add details.</p>
              </div>
            </a>

            <!-- Manage Voters -->
            <a
              href='/admin/users'
              class='flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:bg-slate-950 hover:border-slate-750 hover:scale-[1.01]'
            >
              <div class='rounded-lg bg-blue-500/10 p-2.5 text-blue-400 border border-blue-500/10'>
                <Users size={18} />
              </div>
              <div>
                <h3 class='text-sm font-bold text-slate-100'>Manage Voters</h3>
                <p class='mt-1 text-xs text-slate-500'>Browse voter directory, edit metadata or archive/restore users.</p>
              </div>
            </a>

            <!-- View Audit Logs -->
            <a
              href='/admin/audit-log'
              class='flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:bg-slate-950 hover:border-slate-750 hover:scale-[1.01]'
            >
              <div class='rounded-lg bg-slate-750 p-2.5 text-slate-300 border border-slate-700/80'>
                <History size={18} />
              </div>
              <div>
                <h3 class='text-sm font-bold text-slate-100'>Audit History</h3>
                <p class='mt-1 text-xs text-slate-500'>Monitor actions taken by admins across the system.</p>
              </div>
            </a>

            <!-- View Results -->
            <a
              href='/admin/results'
              class='flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:bg-slate-950 hover:border-slate-750 hover:scale-[1.01]'
            >
              <div class='rounded-lg bg-purple-500/10 p-2.5 text-purple-400 border border-purple-500/10'>
                <Activity size={18} />
              </div>
              <div>
                <h3 class='text-sm font-bold text-slate-100'>Election Results</h3>
                <p class='mt-1 text-xs text-slate-500'>View real-time live counts and final closed results.</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      <!-- Right 1 Col: Recent Audit Logs -->
      <div class='lg:col-span-1'>
        <div class='rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm backdrop-blur-md h-full flex flex-col'>
          <div class='flex items-center justify-between mb-4'>
            <h2 class='text-lg font-bold text-slate-50 flex items-center gap-2'>
              <History size={18} class='text-slate-400' />
              Recent Logs
            </h2>
            <a href='/admin/audit-log' class='text-xs text-blue-400 font-semibold hover:underline flex items-center gap-0.5'>
              View all
              <ChevronRight size={12} />
            </a>
          </div>

          <div class='flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 no-scrollbar'>
            {#each stats.recentLogs as log (log.id)}
              <div class='rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 space-y-1.5 transition hover:border-slate-700/60'>
                <div class='flex items-center justify-between gap-2'>
                  <span class='font-bold text-xs text-slate-200'>{log.actorUsernameSnapshot}</span>
                  <span class='text-[10px] text-slate-500 font-semibold'>{formatTimestamp(log.createdAt).split(',')[0]}</span>
                </div>
                <div class='flex flex-wrap gap-1'>
                  <span class='rounded bg-blue-500/10 border border-blue-500/10 text-[9px] font-bold text-blue-400 px-1.5 py-0.2'>
                    {log.action}
                  </span>
                  <span class='rounded bg-emerald-500/10 border border-emerald-500/10 text-[9px] font-bold text-emerald-400 px-1.5 py-0.2 uppercase'>
                    {log.targetType}
                  </span>
                </div>
                {#if log.description}
                  <p class='text-xs text-slate-400 border-t border-slate-800/60 pt-1.5 mt-1 font-medium'>
                    {log.description}
                  </p>
                {/if}
              </div>
            {:else}
              <div class='py-8 text-center text-slate-600 flex flex-col items-center justify-center h-full'>
                <History size={24} class='text-slate-800 mb-2' />
                <p class='text-xs font-semibold'>No system audits found</p>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
