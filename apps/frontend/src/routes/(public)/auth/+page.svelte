<script lang='ts'>
  import { goto } from '$app/navigation'
  import { login } from '$lib/api/auth'
  import { PUBLIC_OFFLINE_DEV, PUBLIC_TURNSTILE_SITEKEY } from '$env/static/public'
  import aclcLogo from '$lib/assets/aclcLogo.webp'
  import csoLogo from '$lib/assets/cso-logo.webp'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import { onMount } from 'svelte'
  import {
    ArrowRight,
    CheckCircle,
    Eye,
    EyeOff,
    Loader,
  } from 'lucide-svelte'

  // Runes
  let isLoading = $state(false)
  let message = $state('')
  let showPassword = $state(false)
  let turnstileToken = $state('')
  let turnstileWidgetId = $state<string | null>(null)
  let container = $state<HTMLElement | null>(null)
  const offlineDev = PUBLIC_OFFLINE_DEV === 'true'

  // Login form state
  const loginData = $state({
    studentNumber: '',
    password: '',
  })

  // Computed/Derived properties using standard $derived rune
  const isLoginValid = $derived(
    loginData.studentNumber.trim().length > 0 && 
    loginData.password.trim().length > 0 && 
    (offlineDev || turnstileToken.trim().length > 0)
  )

  onMount(() => {
    if (offlineDev) return

    let checkTurnstile: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds

    const initTurnstile = () => {
      if ((window as any).turnstile && container) {
        if (checkTurnstile) {
          clearInterval(checkTurnstile);
        }
        turnstileWidgetId = (window as any).turnstile.render(container, {
          sitekey: PUBLIC_TURNSTILE_SITEKEY,
          callback: (token: string) => {
            turnstileToken = token;
          },
          'error-callback': () => {
            turnstileToken = '';
          },
          'expired-callback': () => {
            turnstileToken = '';
          }
        });
        return true;
      }
      return false;
    };

    // Try immediately (handles SPA navigation back to page or fast load)
    if (!initTurnstile()) {
      checkTurnstile = setInterval(() => {
        attempts++;
        if (initTurnstile()) {
          // Handled inside initTurnstile
        } else if (attempts >= maxAttempts) {
          if (checkTurnstile) {
            clearInterval(checkTurnstile);
          }
          message = 'Security check failed to load. Please disable ad blockers or refresh the page.';
        }
      }, 100);
    }

    return () => {
      if (checkTurnstile) {
        clearInterval(checkTurnstile);
      }
      if (turnstileWidgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileWidgetId);
      }
    };
  });

  // Handlers
  async function handleLogin(e: SubmitEvent) {
    e.preventDefault()
    if (!isLoginValid || isLoading)
      return

    isLoading = true
    message = ''

    try {
      const userData = await login({
        studentNumber: loginData.studentNumber,
        password: loginData.password,
        ...(offlineDev ? {} : { turnstileToken }),
      })
      appCache.invalidate()
      authStore.set({ user: userData, loading: false })
      if (userData.user.role === 'admin' || userData.user.role === 'super_admin') {
        goto('/admin-dashboard', { replaceState: true })
      }
      else {
        goto('/voting', { replaceState: true })
      }
    }
    catch (err: any) {
      message = err.message || 'Login failed'
      if (!offlineDev && turnstileWidgetId && (window as any).turnstile) {
        (window as any).turnstile.reset(turnstileWidgetId);
        turnstileToken = '';
      }
    }
    finally {
      isLoading = false
    }
  }
</script>

<svelte:head>
  {#if !offlineDev}
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  {/if}
</svelte:head>

<div class='min-h-[100dvh] w-full flex flex-col lg:flex-row bg-slate-950 text-slate-100'>
  <!-- Left - Form section -->
  <div
    class='flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-slate-900'
  >
    <div class='w-full max-w-md'>
      <!-- Logo stack -->
      <div class='mb-8 space-y-4'>
        <div class='flex items-center gap-5'>
          <img
            src={aclcLogo}
            alt='ACLC Logo'
            class='h-12 w-auto'
          />
          <img
            src={csoLogo}
            alt='CSO Logo'
            class='h-12 w-auto'
          />
        </div>
        <div>
          <h1 class='text-4xl font-black tracking-tight mb-2 text-white'>
            Student Elections
          </h1>
          <p class='text-slate-400 font-medium'>
            Authenticate to access your ballot
          </p>
        </div>
      </div>

      <!-- Alerts / Messages -->
      {#if message}
        <div class='mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm font-semibold'>
          {message}
        </div>
      {/if}

      <!-- Login Form -->
      <form onsubmit={handleLogin} class='space-y-5'>
        <div class='space-y-2'>
          <label
            for='studentNumber'
            class='block text-xs font-black uppercase tracking-wider text-slate-400'
          >
            Student ID
          </label>
          <input
            id='studentNumber'
            type='text'
            bind:value={loginData.studentNumber}
            placeholder='C25-01-XXXXX'
            required
            class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
          />
        </div>

        <div class='space-y-2'>
          <label
            for='password'
            class='block text-xs font-black uppercase tracking-wider text-slate-400'
          >
            Password
          </label>
          <div class='relative'>
            <input
              id='password'
              type={showPassword ? 'text' : 'password'}
              bind:value={loginData.password}
              placeholder='Enter password'
              required
              class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 pr-12 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
            />
            <button
              type='button'
              onclick={() => showPassword = !showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              class='absolute right-4 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 transition-colors cursor-pointer'
            >
              {#if showPassword}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </button>
          </div>
        </div>

        {#if !offlineDev}
          <div class="flex justify-center py-2">
            <div bind:this={container}></div>
          </div>
        {/if}

        <button
          type='submit'
          disabled={!isLoginValid || isLoading}
          class='w-full py-4 font-black text-sm rounded-xl transition-all mt-6 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-white'
        >
          {#if isLoading}
            <Loader class='animate-spin' size={18} />
            <span>AUTHENTICATING</span>
          {:else}
            <span>SIGN IN</span>
            <ArrowRight size={18} />
          {/if}
        </button>
      </form>
    </div>
  </div>

  <!-- Right - Brand Panel -->
  <div
    class='lg:w-[42%] relative overflow-hidden flex items-center justify-center p-10 lg:p-16 min-h-[40vh] lg:min-h-0 bg-gradient-to-br from-blue-700 to-indigo-900'
  >
    <div
      class='absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-500/10 blur-[100px]'
    ></div>
    <div
      class='absolute bottom-0 left-0 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px]'
    ></div>

    <div class='relative z-10 max-w-md space-y-10'>
      <div class='space-y-5'>
        <h2 class='text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white'>
          Your voice
          <br />
          shapes our
          <br />
          community
        </h2>
        <p class='text-lg font-medium leading-relaxed text-blue-100'>
          Participate in transparent, secure elections that determine the future of the Computer Studies Organization.
        </p>
      </div>

      <div class='space-y-4'>
        {#each [
          'Secure authenticated voting',
          'One student, one vote guarantee',
          'Real-time result transparency',
        ] as feature (feature)}
          <div class='flex items-center gap-3'>
            <CheckCircle
              size={20}
              class='text-emerald-400 flex-shrink-0'
            />
            <span class='text-base font-bold text-slate-200'>
              {feature}
            </span>
          </div>
        {/each}
      </div>


    </div>
  </div>
</div>
