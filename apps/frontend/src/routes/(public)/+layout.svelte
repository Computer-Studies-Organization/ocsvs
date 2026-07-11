<script lang='ts'>
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { getPublicRouteRedirectPath } from '$lib/routeGuards'
  import { authStore } from '$lib/stores/auth'

  const { children } = $props()

  const loading = $derived($authStore.loading)
  const redirect = $derived(getPublicRouteRedirectPath($authStore.user))

  $effect(() => {
    if (!loading && redirect) {
      goto(redirect, { replaceState: true })
    }
  })
</script>

{#if loading}
  <div class='flex min-h-screen w-full items-center justify-center'>
    <Spinner size={40} />
  </div>
{:else if !redirect}
  {@render children()}
{/if}
