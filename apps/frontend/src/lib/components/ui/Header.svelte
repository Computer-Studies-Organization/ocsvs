<script lang='ts'>
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import { logout } from '$lib/api/auth'
  import { LogOut, Settings, UserCheck, Menu, X } from 'lucide-svelte'
  import { UserRole } from '$lib/types'
  import { slide } from 'svelte/transition'

  let { adminMode = false } = $props()
  let mobileMenuOpen = $state(false)

  $effect(() => {
    // Automatically close the mobile menu on page navigation
    const _ = page.url.pathname
    mobileMenuOpen = false
  })

  async function handleLogout() {
    try {
      await logout()
    }
    catch {
      // ignore API failure, proceed with local logout
    }
    finally {
      appCache.invalidate()
      authStore.set({ user: null, loading: false })
      goto('/auth', { replaceState: true })
    }
  }

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  }
</script>

<div class='w-full flex flex-col'>
  <!-- Dynamic top accent bar -->
  {#if adminMode}
    <div class='h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500'></div>
  {:else}
    <div class='h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500'></div>
  {/if}

  <!-- Navigation Header -->
  <header class='relative border-b bg-slate-900 border-slate-800 px-4 sm:px-6 lg:px-8'>
    <div class='mx-auto max-w-7xl flex items-center justify-between py-3'>
      <div class='flex items-center gap-6 sm:gap-10'>
        <!-- Logo / Brand Link -->
        <a
          href={adminMode ? '/admin-dashboard' : '/voting'}
          class='font-black text-xl tracking-tight text-white hover:text-blue-400 transition-colors'
        >
          OCSVS
        </a>

        <!-- Navigation Links -->
        <nav aria-label={adminMode ? 'Admin navigation' : 'Voter navigation'} class='hidden lg:flex items-center gap-1'>
          {#if adminMode}
            <a
              href='/admin-dashboard'
              aria-current={page.url.pathname === '/admin-dashboard' ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {page.url.pathname === '/admin-dashboard' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Dashboard
            </a>
            <a
              href='/admin/users'
              aria-current={isActive('/admin/users') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/users') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Users
            </a>
            <a
              href='/admin/elections'
              aria-current={isActive('/admin/elections') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/elections') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Elections
            </a>
            <a
              href='/admin/results'
              aria-current={isActive('/admin/results') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/results') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Results
            </a>
            <a
              href='/admin/audit-log'
              aria-current={isActive('/admin/audit-log') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/audit-log') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Audit Log
            </a>
          {:else}
            <a
              href='/voting'
              aria-current={isActive('/voting') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/voting') ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Voting
            </a>
            <a
              href='/elections'
              aria-current={isActive('/elections') ? 'page' : undefined}
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/elections') ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
            >
              Elections
            </a>
          {/if}
        </nav>
      </div>

      <!-- Right action menu -->
      {#if authStore.user}
        <div class='flex items-center gap-2 sm:gap-4'>
          <!-- Mode Shortcut Switcher -->
          {#if adminMode}
            <a
              href='/voting'
              class='hidden sm:flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition'
            >
              Exit Admin
            </a>
          {:else if authStore.user.role === UserRole.ADMIN || authStore.user.role === UserRole.SUPER_ADMIN}
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
            aria-label='Settings'
            class="inline-flex min-h-11 min-w-11 items-center justify-center p-2 rounded-lg transition hover:bg-slate-800 {isActive('/settings') ? (adminMode ? 'text-amber-400' : 'text-blue-400') : 'text-slate-400 hover:text-slate-200'}"
          >
            <Settings size={18} />
          </a>

          <!-- User Indicator -->
          <span class='hidden md:inline-block text-xs font-medium text-slate-400'>
            {authStore.user.username}
          </span>

          <!-- Logout button -->
          <button
            onclick={handleLogout}
            aria-label='Log out'
            class='min-h-11 min-w-11 flex items-center gap-1.5 rounded-lg border border-red-950 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition cursor-pointer'
          >
            <LogOut size={14} />
            <span class='hidden sm:inline'>Logout</span>
          </button>

          <!-- Mobile Menu Toggle -->
          <button
            onclick={() => mobileMenuOpen = !mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            class='min-h-11 min-w-11 flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition lg:hidden cursor-pointer'
          >
            {#if mobileMenuOpen}
              <X size={18} />
            {:else}
              <Menu size={18} />
            {/if}
          </button>
        </div>
      {/if}
    </div>

    <!-- Mobile Navigation Drawer -->
    {#if mobileMenuOpen}
      <div
        transition:slide={{ duration: 200 }}
        class='absolute top-full left-0 right-0 bg-slate-900/98 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex flex-col gap-1 lg:hidden z-50 shadow-2xl'
      >
        {#if adminMode}
          <a
            href='/admin-dashboard'
            aria-current={page.url.pathname === '/admin-dashboard' ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {page.url.pathname === '/admin-dashboard' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Dashboard
          </a>
          <a
            href='/admin/users'
            aria-current={isActive('/admin/users') ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/users') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Users
          </a>
          <a
            href='/admin/elections'
            aria-current={isActive('/admin/elections') ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/elections') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Elections
          </a>
          <a
            href='/admin/results'
            aria-current={isActive('/admin/results') ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/results') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Results
          </a>
          <a
            href='/admin/audit-log'
            aria-current={isActive('/admin/audit-log') ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/admin/audit-log') ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Audit Log
          </a>
          <div class="h-px bg-slate-800 my-1"></div>
          <a
            href='/voting'
            class='flex min-h-11 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition'
          >
            Exit Admin
          </a>
        {:else}
          <a
            href='/voting'
            aria-current={isActive('/voting') ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/voting') ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Voting
          </a>
          <a
            href='/elections'
            aria-current={isActive('/elections') ? 'page' : undefined}
            class="flex min-h-11 items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/elections') ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
          >
            Elections
          </a>
          {#if authStore.user && (authStore.user.role === UserRole.ADMIN || authStore.user.role === UserRole.SUPER_ADMIN)}
            <div class="h-px bg-slate-800 my-1"></div>
            <a
              href='/admin-dashboard'
              class='flex min-h-11 items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition'
            >
              <UserCheck size={14} />
              Admin Panel
            </a>
          {/if}
        {/if}
      </div>
    {/if}
  </header>
</div>
