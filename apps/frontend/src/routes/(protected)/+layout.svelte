<script lang='ts'>
  import AuthGuardLayout from '$lib/components/ui/AuthGuardLayout.svelte'
  import { getProtectedRouteRedirectPath } from '$lib/routeGuards'

  const { children } = $props()
</script>

<AuthGuardLayout adminMode={false} getRedirectPath={getProtectedRouteRedirectPath}>
  {@render children()}
</AuthGuardLayout>
