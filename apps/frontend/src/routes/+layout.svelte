<script lang='ts'>
  import { me } from '$lib/api/auth'
  import { authStore } from '$lib/stores/auth'
  import { onMount } from 'svelte'
  import '../app.css'

  const { children } = $props()

  onMount(async () => {
    const user = await me()
    authStore.set({ user, loading: false })
  })
</script>

{@render children()}
