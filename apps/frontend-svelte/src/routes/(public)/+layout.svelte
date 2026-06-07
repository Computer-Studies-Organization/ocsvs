<script lang="ts">
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { getPublicRouteRedirectPath } from '$lib/routeGuards'
  import { derived } from 'svelte/store'

  let { children } = $props()

  const state = derived(authStore, $auth => ({
    loading: $auth.loading,
    redirect: getPublicRouteRedirectPath($auth.user),
  }))

  $effect(() => {
    if (!$state.loading && $state.redirect) {
      goto($state.redirect, { replaceState: true })
    }
  })
</script>

{#if $state.loading}
  <div class="flex min-h-screen w-full items-center justify-center">
    <Spinner size={40} />
  </div>
{:else if !$state.redirect}
  {@render children()}
{/if}
