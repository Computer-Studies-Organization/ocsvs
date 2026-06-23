<script lang='ts'>
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { getAdminRouteRedirectPath } from '$lib/routeGuards'
  import { authStore } from '$lib/stores/auth'
  import { derived } from 'svelte/store'

  const { children } = $props()

  const state = derived(authStore, $authStore => ({
    loading: $authStore.loading,
    redirect: getAdminRouteRedirectPath($authStore.user),
  }))

  $effect(() => {
    if (!$state.loading && $state.redirect) {
      goto($state.redirect, { replaceState: true })
    }
  })

  interface NavLink {
    href: string
    label: string
  }

  const navLinks: NavLink[] = [
    { href: '/admin-dashboard', label: 'Dashboard' },
    { href: '/voting', label: 'Voting' },
    { href: '/admin/elections', label: 'Elections' },
  ]
  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  }
</script>

{#if $state.loading}
  <div class='flex min-h-screen w-full items-center justify-center'>
    <Spinner size={40} />
  </div>
{:else if !$state.redirect}
  <nav
    aria-label='Admin navigation'
    class='flex items-center gap-1 border-b px-4 sm:px-6 lg:px-8'
    style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
  >
    {#each navLinks as link (link.href)}
      {@const active = isActive(link.href)}
      <a
        href={link.href}
        aria-current={active ? 'page' : undefined}
        class='px-4 py-3 text-sm font-semibold transition-colors'
        style={active
          ? 'color: oklch(0.95 0.008 250); border-bottom: 2px solid oklch(0.55 0.15 250); margin-bottom: -1px'
          : 'color: oklch(0.70 0.015 250)'}
      >
        {link.label}
      </a>
    {/each}
  </nav>
  {@render children()}
{/if}
