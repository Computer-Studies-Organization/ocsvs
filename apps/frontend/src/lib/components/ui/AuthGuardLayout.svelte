<!-- apps/frontend/src/lib/components/ui/AuthGuardLayout.svelte -->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'
  import { appCache } from '$lib/cache'
  import { authStore } from '$lib/stores/auth.svelte'
  import Header from '$lib/components/ui/Header.svelte'

  let {
    children,
    adminMode = false,
    getRedirectPath,
  }: {
    children: import('svelte').Snippet;
    adminMode?: boolean;
    getRedirectPath: (user: any) => string | null;
  } = $props()

  const loading = $derived(authStore.loading)
  const redirect = $derived(getRedirectPath(authStore.user))

  $effect(() => {
    if (!loading && redirect) {
      appCache.invalidate()
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
    <Header {adminMode} />
    <main class='flex-1 flex flex-col'>
      {@render children()}
    </main>
  </div>
{/if}
