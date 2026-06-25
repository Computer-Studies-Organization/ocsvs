<script lang='ts'>
  import { me } from '$lib/api/auth'
  import { authStore } from '$lib/stores/auth'
  import { onMount } from 'svelte'
  import ToastContainer from '$lib/components/ui/toast-container.svelte'
  import '../app.css'

  const { children } = $props()

  onMount(async () => {
    try {
      const user = await me()
      authStore.set({ user, loading: false })
    }
    catch {
      authStore.set({ user: null, loading: false })
    }
  })
</script>

{@render children()}
<ToastContainer />
