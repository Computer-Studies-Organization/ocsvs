<script lang='ts'>
  import AuthGuardLayout from '$lib/components/ui/AuthGuardLayout.svelte'
  import { getAdminRouteRedirectPath } from '$lib/routeGuards'

  const { children } = $props()
</script>

<AuthGuardLayout adminMode={true} getRedirectPath={getAdminRouteRedirectPath}>
  {@render children()}
</AuthGuardLayout>
