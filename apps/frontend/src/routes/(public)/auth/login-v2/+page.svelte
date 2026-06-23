<script lang='ts'>
  import { goto } from '$app/navigation'
  import { login } from '$lib/api/auth'
  import aclcLogo from '$lib/assets/aclcLogo.webp'
  import csoLogo from '$lib/assets/cso-logo.webp'
  import { authStore } from '$lib/stores/auth'
  import { Eye, EyeOff, Loader, Vote } from 'lucide-svelte'

  let isLoading = $state(false)
  let message = $state('')
  let showPassword = $state(false)

  const loginData = $state({
    studentNumber: '',
    password: '',
  })

  const isValid = $derived(loginData.studentNumber.trim().length > 0 && loginData.password.trim().length > 0)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!isValid || isLoading) return

    isLoading = true
    message = ''

    try {
      const userData = await login({
        studentNumber: loginData.studentNumber,
        password: loginData.password,
      })
      authStore.set({ user: userData, loading: false })
      if (userData.user.role === 'admin') {
        goto('/admin-dashboard', { replaceState: true })
      } else {
        goto('/dashboard', { replaceState: true })
      }
    } catch (err: any) {
      message = err.message || 'Login failed'
    } finally {
      isLoading = false
    }
  }
</script>

<div
  class='min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden'
  style='background: oklch(0.18 0.025 250)'
>
  <!-- Background depth layers -->
  <div
    class='absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-30'
    style='background: radial-gradient(circle, oklch(0.35 0.12 250) 0%, transparent 70%); transform: translate(-30%, -30%)'
  ></div>
  <div
    class='absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-25'
    style='background: radial-gradient(circle, oklch(0.32 0.10 260) 0%, transparent 70%); transform: translate(25%, 25%)'
  ></div>
  <div
    class='absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full opacity-20'
    style='background: radial-gradient(circle, oklch(0.28 0.08 245) 0%, transparent 70%); transform: translate(-50%, -50%)'
  ></div>

  <!-- Main card -->
  <div class='relative z-10 w-full max-w-lg'>
    <div
      class='rounded-2xl p-8 sm:p-10 shadow-2xl'
      style='background: oklch(0.22 0.020 250); box-shadow: 0 25px 50px -12px oklch(0.10 0.015 250 / 0.5)'
    >
      <!-- Dual logo header -->
      <div class='flex items-center justify-center gap-8 mb-8'>
        <img src={aclcLogo} alt='ACLC Logo' class='h-16 w-auto' />
        <div class='h-16 w-0.5 rounded-full' style='background: oklch(0.35 0.03 250)'></div>
        <img src={csoLogo} alt='CSO Logo' class='h-16 w-auto' />
      </div>

      <!-- Title -->
      <div class='text-center mb-8 space-y-2'>
        <h1 class='text-3xl font-bold tracking-tight' style='color: oklch(0.95 0.008 250)'>
          Cast Your Vote
        </h1>
        <p class='text-base' style='color: oklch(0.65 0.015 250)'>
          Sign in to participate in CSO elections
        </p>
      </div>

      <!-- Error message -->
      {#if message}
        <div class='mb-6 flex items-start gap-3'>
          <div class='w-1 h-8 rounded-full flex-shrink-0 mt-0.5' style='background: oklch(0.55 0.18 25)'></div>
          <p class='text-sm font-medium flex-1' style='color: oklch(0.85 0.05 25)'>
            {message}
          </p>
        </div>
      {/if}

      <form onsubmit={handleSubmit} class='space-y-5'>
        <div class='space-y-2.5'>
          <label
            for='studentNumber'
            class='block text-sm font-semibold tracking-wide uppercase'
            style='color: oklch(0.70 0.015 250); letter-spacing: 0.05em'
          >
            Student Number
          </label>
          <input
            id='studentNumber'
            type='text'
            bind:value={loginData.studentNumber}
            placeholder='20XX-XXXXX'
            autocomplete='username'
            required
            class='w-full rounded-xl px-4 py-3.5 text-base font-medium transition-all focus:outline-none'
            style='background: oklch(0.16 0.018 250); color: oklch(0.95 0.008 250); border: {message ? "2px solid oklch(0.50 0.18 25)" : "2px solid oklch(0.28 0.025 250)"}'
          />
        </div>

        <div class='space-y-2.5'>
          <label
            for='password'
            class='block text-sm font-semibold tracking-wide uppercase'
            style='color: oklch(0.70 0.015 250); letter-spacing: 0.05em'
          >
            Password
          </label>
          <div class='relative'>
            <input
              id='password'
              type={showPassword ? 'text' : 'password'}
              bind:value={loginData.password}
              placeholder='Enter your password'
              autocomplete='current-password'
              required
              class='w-full rounded-xl px-4 py-3.5 pr-12 text-base font-medium transition-all focus:outline-none'
              style='background: oklch(0.16 0.018 250); color: oklch(0.95 0.008 250); border: {message ? "2px solid oklch(0.50 0.18 25)" : "2px solid oklch(0.28 0.025 250)"}'
            />

            <button
              type='button'
              onclick={() => showPassword = !showPassword}
              class='absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer'
              style='color: oklch(0.55 0.015 250)'
            >
              {#if showPassword}<Eye size={20} stroke-width={2.5} />{:else}<EyeOff size={20} stroke-width={2.5} />{/if}
            </button>
          </div>
        </div>

        <button
          type='submit'
          disabled={!isValid || isLoading}
          class='w-full py-4 font-bold text-base rounded-xl transition-all mt-7 flex items-center justify-center gap-2.5 disabled:opacity-35 disabled:cursor-not-allowed shadow-lg cursor-pointer'
          style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
        >
          {#if isLoading}
            <Loader class='animate-spin' size={20} stroke-width={2.5} />
            <span>Authenticating</span>
          {:else}
            <Vote size={20} stroke-width={2.5} />
            <span>Sign in to vote</span>
          {/if}
        </button>
      </form>

      <div
        class='mt-8 pt-6 text-center text-sm'
        style='border-top: 1px solid oklch(0.28 0.025 250); color: oklch(0.60 0.015 250)'
      >
        First time voter?
        <a href='/auth' class='font-bold transition-colors' style='color: oklch(0.70 0.12 250)'>
          Register now
        </a>
      </div>
    </div>

    <!-- Trust badge -->
    <div class='mt-6 text-center text-xs flex items-center justify-center gap-2' style='color: oklch(0.50 0.015 250)'>
      <div class='w-1.5 h-1.5 rounded-full' style='background: oklch(0.60 0.12 140)'></div>
      <span>Secure authentication &bull; Encrypted ballot submission</span>
    </div>
  </div>
</div>
