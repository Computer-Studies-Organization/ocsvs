<script lang='ts'>
  import { me } from '$lib/api/auth'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import { navigating } from '$app/stores'
  import ToastContainer from '$lib/components/ui/toast-container.svelte'
  import { installViewportTracking } from '$lib/keyboard-viewport'
  import '../app.css'

  const { children } = $props()

  onMount(() => installViewportTracking())

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

{#if $navigating}
  <div class="nav-progress-bar" aria-hidden="true"></div>
{/if}

{@render children()}
<ToastContainer />

<style>
  .nav-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 9999;
    background: linear-gradient(
      90deg,
      oklch(0.55 0.15 250) 0%,
      oklch(0.65 0.20 280) 50%,
      oklch(0.75 0.15 310) 100%
    );
    box-shadow: 0 0 8px oklch(0.65 0.20 280 / 0.5);
    transform-origin: left;
    animation: progress 8s cubic-bezier(0.1, 0.8, 0.1, 1) forwards;
  }

  @keyframes progress {
    0% {
      transform: scaleX(0);
    }
    10% {
      transform: scaleX(0.3);
    }
    50% {
      transform: scaleX(0.7);
    }
    80% {
      transform: scaleX(0.88);
    }
    100% {
      transform: scaleX(0.98);
    }
  }
</style>
