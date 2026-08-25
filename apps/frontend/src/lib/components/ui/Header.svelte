<script lang='ts'>
  import { page } from '$app/state'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import { logout } from '$lib/api/auth'
  import { LogOut, Settings, UserCheck, Menu, X } from 'lucide-svelte'
  import { UserRole } from '$lib/types'
  import Modal from './modal.svelte'
  import { slide } from 'svelte/transition'
  import csoLogo88 from '$lib/assets/cso-logo-88.webp'

  let { adminMode = false } = $props()
  let mobileMenuOpen = $state(false)
  let showLogoutConfirm = $state(false)

  $effect(() => {
    // Automatically close the mobile menu on page navigation
    const _ = page.url.pathname
    mobileMenuOpen = false
  })

  async function handleLogout() {
    showLogoutConfirm = false

    try {
      await logout()
    }
    catch {
      // ignore API failure, proceed with local logout
    }
    finally {
      appCache.invalidate()
      authStore.logout()
    }
  }

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  }
</script>

<div class='sticky top-0 z-40 w-full flex flex-col'>
  <!-- Dynamic top accent bar -->
  {#if adminMode}
    <div class='h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500'></div>
  {:else}
    <div class='h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500'></div>
  {/if}

  <!-- Navigation Header -->
  <header class='relative border-b bg-slate-900 border-slate-800 px-4 sm:px-6 lg:px-8'>
    <div class='relative w-full flex items-center justify-between py-2 sm:py-2.5'>
      <!-- Logo / Brand Link (Leftmost) -->
      <div class='flex items-center'>
        <a
          href={adminMode ? '/admin-dashboard' : '/voting'}
          class="flex items-center gap-2.5 sm:gap-3 font-black text-lg sm:text-xl tracking-tight text-white {adminMode ? 'hover:text-amber-400' : 'hover:text-blue-400'} hover:opacity-90 transition-all"
          aria-label='CSO Voting System'
        >
          <!-- Logo on larger screens -->
          <img
            src={csoLogo88}
            alt='CSO Logo'
            width='48'
            height='48'
            class='hidden sm:block h-10 sm:h-11 w-auto object-contain shrink-0'
          />
          <!-- Brand text -->
          <span class='whitespace-nowrap'>
            CSO Voting System
          </span>
        </a>
      </div>

      <!-- Main Navigation Links (Slightly left of center) -->
      <nav aria-label={adminMode ? 'Admin navigation' : 'Voter navigation'} class='hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 -ml-16 xl:-ml-24'>
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

      <!-- Right action menu -->
      {#if authStore.user}
        <div class='flex items-center gap-1.5 sm:gap-2'>
          <!-- Desktop action controls (hidden on mobile) -->
          <div class='hidden lg:flex items-center gap-1.5 sm:gap-2'>
            <!-- Mode Shortcut Switcher -->
            {#if adminMode}
              <a
                href='/voting'
                class='inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/40 transition'
              >
                Exit Admin
              </a>
            {:else if authStore.user.role === UserRole.ADMIN || authStore.user.role === UserRole.SUPER_ADMIN}
              <a
                href='/admin-dashboard'
                class='inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 transition'
              >
                <UserCheck size={16} />
                Admin Panel
              </a>
            {/if}

            <!-- User Indicator -->
            <span class='inline-flex items-center text-xs font-medium text-slate-400 px-2 py-1'>
              {authStore.user.username}
            </span>

            <!-- Settings shortcut -->
            <a
              href='/settings'
              title='Settings'
              aria-label='Settings'
              class="inline-flex min-h-11 min-w-11 items-center justify-center p-2 rounded-lg transition hover:bg-slate-800 {isActive('/settings') ? (adminMode ? 'text-amber-400 bg-slate-800' : 'text-blue-400 bg-slate-800') : 'text-slate-400 hover:text-slate-200'}"
            >
              <Settings size={18} />
            </a>

            <!-- Logout button -->
            <button
              onclick={() => showLogoutConfirm = true}
              title='Log out'
              aria-label='Log out'
              class='inline-flex min-h-11 min-w-11 items-center justify-center p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition cursor-pointer'
            >
              <LogOut size={18} />
            </button>
          </div>

          <!-- Mobile Menu Toggle -->
          <button
            onclick={() => mobileMenuOpen = !mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            class='min-h-11 min-w-11 flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition lg:hidden cursor-pointer'
          >
            {#if mobileMenuOpen}
              <X size={20} />
            {:else}
              <Menu size={20} />
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
        {#if authStore.user}
          <!-- User info bar -->
          <div class='flex items-center justify-between px-3 py-2 border-b border-slate-800/80 mb-1'>
            <span class='text-xs font-semibold text-slate-400'>
              Signed in as <strong class='text-slate-200'>{authStore.user.username}</strong>
            </span>
            <span class='text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full {adminMode ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}'>
              {authStore.user.role}
            </span>
          </div>
        {/if}

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
        {/if}

        <div class="h-px bg-slate-800 my-1"></div>

        <!-- Mode switcher in drawer -->
        {#if adminMode}
          <a
            href='/voting'
            class='flex min-h-11 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition'
          >
            Exit Admin
          </a>
        {:else if authStore.user && (authStore.user.role === UserRole.ADMIN || authStore.user.role === UserRole.SUPER_ADMIN)}
          <a
            href='/admin-dashboard'
            class='flex min-h-11 items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition'
          >
            <UserCheck size={14} />
            Admin Panel
          </a>
        {/if}

        <!-- Settings in drawer -->
        <a
          href='/settings'
          aria-current={isActive('/settings') ? 'page' : undefined}
          class="flex min-h-11 items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors {isActive('/settings') ? (adminMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-800 text-blue-400') : 'text-slate-400 hover:text-slate-200'}"
        >
          <Settings size={16} />
          Settings
        </a>

        <!-- Logout in drawer -->
        <button
          type='button'
          onclick={() => showLogoutConfirm = true}
          class='flex min-h-11 items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 transition cursor-pointer w-full text-left'
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    {/if}
  </header>
</div>

<Modal
  open={showLogoutConfirm}
  onclose={() => showLogoutConfirm = false}
  ariaLabelledby='logout-title'
  presentation='sheet'
>
  <h2 id='logout-title' class='mb-2 text-lg font-bold text-slate-50'>Log out?</h2>
  <p class='mb-4 text-sm text-slate-400'>Are you sure you want to log out?</p>
  <div class='flex justify-end gap-2'>
    <button
      type='button'
      onclick={() => showLogoutConfirm = false}
      class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'
    >
      Cancel
    </button>
    <button
      type='button'
      onclick={handleLogout}
      class='min-h-11 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 cursor-pointer'
    >
      Log out
    </button>
  </div>
</Modal>
