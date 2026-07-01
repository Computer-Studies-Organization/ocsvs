<script lang='ts'>
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth'
  import { logout } from '$lib/api/auth'
  import { LogOut, Settings, UserCheck } from 'lucide-svelte'

  let { adminMode = false } = $props()

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

<div class='w-full flex flex-col'>
  <!-- Dynamic top accent bar -->
  {#if adminMode}
    <div class='h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500'></div>
  {:else}
    <div class='h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500'></div>
  {/if}

  <!-- Navigation Header -->
  <header class='border-b bg-slate-900 border-slate-800 px-4 sm:px-6 lg:px-8'>
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
        <nav aria-label={adminMode ? 'Admin navigation' : 'Voter navigation'} class='flex items-center gap-1'>
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
            <a
              href='/voting'
              class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-400 hover:text-slate-200"
            >
              Voter View
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
      {#if $authStore.user}
        <div class='flex items-center gap-2 sm:gap-4'>
          <!-- Mode Shortcut Switcher -->
          {#if adminMode}
            <a
              href='/voting'
              class='flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition'
            >
              Exit Admin
            </a>
          {:else if $authStore.user.user.role === 'admin'}
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
            class="p-2 rounded-lg transition hover:bg-slate-800 {isActive('/settings') ? (adminMode ? 'text-amber-400' : 'text-blue-400') : 'text-slate-400 hover:text-slate-200'}"
          >
            <Settings size={18} />
          </a>

          <!-- User Indicator -->
          <span class='hidden md:inline-block text-xs font-medium text-slate-400'>
            {$authStore.user.user.username}
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
</div>
