<script lang='ts'>
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { getProtectedRouteRedirectPath } from '$lib/routeGuards'
  import { authStore } from '$lib/stores/auth'
  import { derived } from 'svelte/store'
  import Header from '$lib/components/ui/Header.svelte'

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
</script>

{#if $state.loading}
  <div class='flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-100'>
    <Spinner size={40} />
  </div>
{:else if !$state.redirect}
  <div class='min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col'>
    <Header adminMode={false} />

    <!-- Main Content Area -->
    <main class='flex-1 flex flex-col'>
      {@render children()}
    </main>
  </div>
{/if}
