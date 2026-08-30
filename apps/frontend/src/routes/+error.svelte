<script lang='ts'>
  import { page } from '$app/state'
  import { authStore } from '$lib/stores/auth.svelte'
  import { UserRole } from '$lib/types'
  import { logout } from '$lib/api/auth'
  import { appCache } from '$lib/cache'
  import Header from '$lib/components/ui/Header.svelte'
  import {
    SearchX,
    ShieldAlert,
    ServerCrash,
    AlertCircle,
    ArrowLeft,
    RefreshCw,
    Vote,
    LayoutDashboard,
    LogIn,
    LogOut,
  } from 'lucide-svelte'
  import csoLogo88 from '$lib/assets/cso-logo-88.webp'

  const status = $derived(page.status ?? 500)
  const is404 = $derived(status === 404)
  const is403 = $derived(status === 403)
  const is500 = $derived(status >= 500)

  const isAdmin = $derived(
    authStore.user?.role === UserRole.ADMIN || authStore.user?.role === UserRole.SUPER_ADMIN,
  )
  const isVoter = $derived(authStore.user?.role === UserRole.USER)
  const isAuthenticated = $derived(Boolean(authStore.user))
  const isAdminView = $derived(isAdmin && page.url.pathname.startsWith('/admin'))

  const errorTitle = $derived.by(() => {
    if (is404) {
      if (page.error?.message && page.error.message !== 'Not Found') {
        return page.error.message
      }
      return 'Page Not Found'
    }
    if (is403) return 'Access Denied'
    if (is500) return 'Internal Server Error'
    return `Error ${status}`
  })

  const errorDescription = $derived.by(() => {
    if (is404) {
      return (
        page.error?.message && page.error.message !== 'Not Found'
          ? "The requested resource could not be found. It may have been archived, deleted, or the link may be outdated."
          : "The page you're looking for doesn't exist, may have been moved, or you may have followed an outdated link."
      )
    }
    if (is403) {
      return (
        page.error?.message ||
        "You do not have the required administrative permissions to access this page."
      )
    }
    if (is500) {
      return "We encountered an unexpected error while loading this page. Please try again."
    }
    return page.error?.message || "An unexpected error occurred while processing your request."
  })

  const errorStack = $derived.by(() => {
    if (
      page.error &&
      typeof page.error === 'object' &&
      'stack' in page.error &&
      typeof (page.error as { stack?: unknown }).stack === 'string'
    ) {
      return (page.error as { stack: string }).stack
    }
    return null
  })

  function handleGoBack() {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
      } else if (isAdmin) {
        window.location.href = '/admin-dashboard'
      } else if (isAuthenticated) {
        window.location.href = '/voting'
      } else {
        window.location.href = '/'
      }
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // ignore network failure
    } finally {
      appCache.invalidate()
      authStore.logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/auth'
      }
    }
  }
</script>

<svelte:head>
  <title>{status} • {errorTitle} | CSO Voting System</title>
</svelte:head>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col'>
  <!-- Navigation Bar: Preserved for Authenticated Users, Clean Fallback for Guests -->
  {#if isAuthenticated}
    <Header adminMode={isAdminView} />
  {:else}
    <header class='border-b bg-slate-900 border-slate-800 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between'>
      <a href='/' class='flex items-center gap-2.5 font-black text-lg text-white hover:text-blue-400 transition'>
        <img src={csoLogo88} alt='CSO Logo' width='36' height='36' class='h-8 w-auto object-contain' />
        <span>CSO Voting System</span>
      </a>
      <a href='/auth' class='inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition'>
        <LogIn size={16} />
        Sign In
      </a>
    </header>
  {/if}

  <!-- Error Content Area -->
  <main class='flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 text-center'>
    <div class='w-full max-w-xl flex flex-col items-center'>
      <!-- Status Icon with Glow -->
      {#if is404}
        <div class='mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-sky-500/30 bg-sky-500/10 text-sky-400 shadow-lg shadow-sky-500/5 ring-8 ring-sky-500/5'>
          <SearchX size={40} />
        </div>
        <span class='mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-400'>
          404 • Not Found
        </span>
      {:else if is403}
        <div class='mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/5 ring-8 ring-amber-500/5'>
          <ShieldAlert size={40} />
        </div>
        <span class='mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-400'>
          403 • Access Restricted
        </span>
      {:else if is500}
        <div class='mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-lg shadow-rose-500/5 ring-8 ring-rose-500/5'>
          <ServerCrash size={40} />
        </div>
        <span class='mb-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-400'>
          {status} • Server Error
        </span>
      {:else}
        <div class='mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-700 bg-slate-800 text-slate-300 shadow-lg ring-8 ring-slate-800/20'>
          <AlertCircle size={40} />
        </div>
        <span class='mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-300'>
          Error {status}
        </span>
      {/if}

      <!-- Main Title -->
      <h1 class='text-3xl sm:text-4xl font-black tracking-tight text-white'>
        {errorTitle}
      </h1>

      <!-- Informative Subtext -->
      <p class='mt-4 text-base sm:text-lg text-slate-400 leading-relaxed max-w-lg'>
        {errorDescription}
      </p>

      <!-- Active Identity Banner for 403 -->
      {#if is403 && authStore.user}
        <div class='mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-400'>
          <span>Signed in as <strong class='text-slate-200'>@{authStore.user.username}</strong></span>
          <span class='text-slate-600'>•</span>
          <span>Role: <span class='font-bold text-amber-400 uppercase tracking-wider text-[11px]'>{authStore.user.role}</span></span>
        </div>
      {/if}

      <!-- Responsive, Centered Action Buttons -->
      <div class='mt-8 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto'>
        {#if is404}
          {#if isAdmin}
            <a
              href='/admin-dashboard'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/10'
            >
              <LayoutDashboard size={18} />
              Admin Dashboard
            </a>
          {:else if isVoter}
            <a
              href='/voting'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition cursor-pointer shadow-lg shadow-blue-600/20'
            >
              <Vote size={18} />
              Return to Voting
            </a>
          {:else}
            <a
              href='/auth'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition cursor-pointer shadow-lg shadow-blue-600/20'
            >
              <LogIn size={18} />
              Sign In
            </a>
          {/if}
          <button
            type='button'
            onclick={handleGoBack}
            class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer'
          >
            <ArrowLeft size={18} />
            Go Back
          </button>
        {:else if is403}
          {#if isAuthenticated}
            <a
              href='/voting'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition cursor-pointer shadow-lg shadow-blue-600/20'
            >
              <Vote size={18} />
              Voter Portal
            </a>
            <button
              type='button'
              onclick={handleLogout}
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition cursor-pointer'
            >
              <LogOut size={18} />
              Sign Out
            </button>
          {:else}
            <a
              href='/auth'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition cursor-pointer shadow-lg shadow-blue-600/20'
            >
              <LogIn size={18} />
              Sign In
            </a>
            <button
              type='button'
              onclick={handleGoBack}
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer'
            >
              <ArrowLeft size={18} />
              Go Back
            </button>
          {/if}
        {:else if is500}
          <button
            type='button'
            onclick={() => typeof window !== 'undefined' && window.location.reload()}
            class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500 transition cursor-pointer shadow-lg shadow-rose-600/20'
          >
            <RefreshCw size={18} />
            Try Again
          </button>
          {#if isAdmin}
            <a
              href='/admin-dashboard'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer'
            >
              <LayoutDashboard size={18} />
              Dashboard
            </a>
          {:else if isAuthenticated}
            <a
              href='/voting'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer'
            >
              <Vote size={18} />
              Home
            </a>
          {:else}
            <a
              href='/'
              class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer'
            >
              Home
            </a>
          {/if}
        {:else}
          <button
            type='button'
            onclick={handleGoBack}
            class='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer'
          >
            <ArrowLeft size={18} />
            Go Back
          </button>
        {/if}
      </div>

      <!-- Developer Diagnostics Accordion -->
      {#if import.meta.env.DEV && page.error}
        <details class='mt-10 w-full max-w-md rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left text-xs font-mono text-slate-300'>
          <summary class='cursor-pointer text-amber-400 font-semibold select-none hover:text-amber-300 text-center sm:text-left'>
            Technical Diagnostics (Development Only)
          </summary>
          <div class='mt-2.5 space-y-1.5 overflow-x-auto text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5'>
            <div><span class='text-slate-500'>HTTP Status:</span> {status}</div>
            <div><span class='text-slate-500'>Pathname:</span> {page.url.pathname}</div>
            {#if page.error.message}
              <div><span class='text-slate-500'>Message:</span> <span class='text-rose-400'>{page.error.message}</span></div>
            {/if}
            {#if errorStack}
              <pre class='mt-2 whitespace-pre-wrap rounded bg-slate-950 p-2 text-rose-300 border border-slate-800/80'>{errorStack}</pre>
            {/if}
          </div>
        </details>
      {/if}
    </div>
  </main>
</div>
