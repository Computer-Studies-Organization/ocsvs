<script lang='ts'>
  import { me } from '$lib/api/auth'
  import { appCache } from '$lib/cache'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import { navigating } from '$app/stores'
  import ToastContainer from '$lib/components/ui/toast-container.svelte'
  import { installViewportTracking } from '$lib/keyboard-viewport'
  import { captureException } from '$lib/telemetry'
  import '../app.css'

  const { children } = $props()
  let authBootstrapError = $state(false)

  onMount(() => installViewportTracking())

  async function initializeAuth() {
    authBootstrapError = false
    appCache.invalidate()
    authStore.set({ user: null, loading: true })
    try {
      const user = await me()
      authStore.set({ user, loading: false })
    }
    catch (error) {
      captureException(error)
      console.error('Failed to initialize session', error)
      authStore.set({ user: null, loading: false })
      authBootstrapError = true
    }
  }

  onMount(() => {
    let pageWasHidden = false

    const handlePageHide = () => {
      pageWasHidden = true
    }
    const handlePageShow = () => {
      if (!pageWasHidden) return
      pageWasHidden = false
      void initializeAuth()
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    void initializeAuth()

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
    }
  })
</script>

{#if $navigating}
  <div class="nav-progress-bar" aria-hidden="true"></div>
{/if}

{#if authBootstrapError}
  <main class="auth-bootstrap-error" role="alert">
    <h1>We couldn't verify your session</h1>
    <p>Check your connection and try again.</p>
    <button type="button" onclick={() => { void initializeAuth() }}>Retry</button>
  </main>
{:else}
  {@render children()}
{/if}
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

  .auth-bootstrap-error {
    display: grid;
    min-height: 60vh;
    place-content: center;
    gap: 0.75rem;
    padding: 2rem;
    text-align: center;
  }

  .auth-bootstrap-error button {
    justify-self: center;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    background: oklch(0.55 0.15 250);
    color: white;
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
