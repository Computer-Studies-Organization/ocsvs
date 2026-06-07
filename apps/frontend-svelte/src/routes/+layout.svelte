<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { authStore } from '$lib/stores/auth'
  import { me } from '$lib/api/auth'

  let { children } = $props()

  onMount(async () => {
    const user = await me()
    authStore.set({ user, loading: false })
  })
</script>

{@render children()}
