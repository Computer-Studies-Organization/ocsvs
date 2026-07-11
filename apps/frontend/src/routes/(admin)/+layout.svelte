<script lang='ts'>
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { getAdminRouteRedirectPath } from '$lib/routeGuards'
  import { authStore } from '$lib/stores/auth'
  import Header from '$lib/components/ui/Header.svelte'

  const { children } = $props()

  const loading = $derived($authStore.loading)
  const redirect = $derived(getAdminRouteRedirectPath($authStore.user))

  $effect(() => {
    if (!loading && redirect) {
      goto(redirect, { replaceState: true })
    }
  })
</script>

{#if loading}
  <div class='flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-100'>
    <Spinner size={40} />
  </div>
{:else if !redirect}
  <div class='min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col'>
    <Header adminMode={true} />
    <main class='flex-1 flex flex-col'>
      {@render children()}
    </main>
  </div>
{/if}
