<script lang='ts'>
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { getProtectedRouteRedirectPath } from '$lib/routeGuards'
  import { authStore } from '$lib/stores/auth'
  import { logout } from '$lib/api/auth'
  import { derived } from 'svelte/store'
  import { LogOut, Settings, UserCheck } from 'lucide-svelte'

  const { children } = $props()

  const state = derived(authStore, $authStore => ({
    loading: $authStore.loading,
    user: $authStore.user,
    redirect: getProtectedRouteRedirectPath($authStore.user),
  }))

  $effect(() => {
    if (!$state.loading && $state.redirect) {
      goto($state.redirect, { replaceState: true })
    }
  })

  async function handleLogout() {
    try {
      await logout()
    }
    catch {
      // ignore API failure, proceed with local logout
    }
    finally {
      authStore.set({ user: null, loading: false })
      goto('/auth', { replaceState: true })
    }
  }

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  }
</script>

{#if $state.loading}
  <div class='flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-100'>
    <Spinner size={40} />
  </div>
{:else if !$state.redirect}
  <div class='min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col'>
    <!-- Decorative top accent bar -->
    <div class='h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500'></div>

    <!-- Navigation Header -->
    <header class='border-b bg-slate-900 border-slate-800 px-4 sm:px-6 lg:px-8'>
      <div class='mx-auto max-w-7xl flex items-center justify-between py-3'>
        <div class='flex items-center gap-6 sm:gap-10'>
          <!-- Logo / Brand Link -->
          <a
            href='/voting'
            class='font-black text-xl tracking-tight text-white hover:text-blue-400 transition-colors'
          >
            OCSVS
          </a>

          <!-- Navigation Links -->
          <nav aria-label='Voter navigation' class='flex items-center gap-1'>
            <a
              href='/voting'
              aria-current={isActive('/voting') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/voting') ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Voting
            </a>
            <a
              href='/results'
              aria-current={isActive('/results') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/results') ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Results
            </a>
          </nav>
        </div>

        <!-- Right action menu -->
        {#if $state.user}
          <div class='flex items-center gap-2 sm:gap-4'>
            <!-- Optional Admin shortcut -->
            {#if $state.user.user.role === 'admin'}
              <a
                href='/admin-dashboard'
                class='hidden sm:flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition'
              >
                <UserCheck size={14} />
                Admin Panel
              </a>
            {/if}

            <!-- Settings shortcut -->
            <a
              href='/settings'
              title='Settings'
              class="p-2 rounded-lg transition hover:bg-slate-800 {isActive('/settings') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              <Settings size={18} />
            </a>

            <!-- User Indicator -->
            <span class='hidden md:inline-block text-xs font-medium text-slate-400'>
              {$state.user.user.username}
            </span>

            <!-- Logout button -->
            <button
              onclick={handleLogout}
              class='flex items-center gap-1.5 rounded-lg border border-red-950 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition cursor-pointer'
            >
              <LogOut size={14} />
              <span class='hidden sm:inline'>Logout</span>
            </button>
          </div>
        {/if}
      </div>
    </header>

    <!-- Main Content Area -->
    <main class='flex-1 flex flex-col'>
      {@render children()}
    </main>
  </div>
{/if}
