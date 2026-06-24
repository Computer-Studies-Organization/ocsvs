<script lang='ts'>
  import { goto } from '$app/navigation'
  import { login, register } from '$lib/api/auth'
  import aclcLogo from '$lib/assets/aclcLogo.webp'
  import csoLogo from '$lib/assets/cso-logo.webp'
  import { authStore } from '$lib/stores/auth'
  import { COURSE_VALUES, YEAR_LEVEL_VALUES } from '$lib/types'
  import {
    EMPTY_REGISTER_USER_DRAFT,
    getMutationErrorMessage,
    getRegisterUserDraftStepOneValidationMessage,
    getRegisterUserDraftValidationMessage,
    isRegisterUserDraftComplete,
    isRegisterUserDraftStepOneComplete,
    REGISTER_FIELD_LABELS,
  } from '$lib/userRegistration'
  import {
    ArrowRight,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Loader,
  } from 'lucide-svelte'

  // Runes
  let mode = $state<'login' | 'register'>('login')
  let isLoading = $state(false)
  let message = $state('')
  let showPassword = $state(false)

  // Login form state
  const loginData = $state({
    studentNumber: '',
    password: '',
  })

  // Register form state
  let registerData = $state({ ...EMPTY_REGISTER_USER_DRAFT })
  let registerStep = $state(1)

  // Computed/Derived properties using standard $derived rune
  const isLoginValid = $derived(loginData.studentNumber.trim().length > 0 && loginData.password.trim().length > 0)
  const isStepOneValid = $derived(isRegisterUserDraftStepOneComplete(registerData))
  const isRegisterValid = $derived(isRegisterUserDraftComplete(registerData))

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
      })
      authStore.set({ user: userData, loading: false })
      if (userData.user.role === 'admin') {
        goto('/admin-dashboard', { replaceState: true })
      }
      else {
        goto('/voting', { replaceState: true })
      }
    }
    catch (err: any) {
      message = err.message || 'Login failed'
    }
    finally {
      isLoading = false
    }
  }

  function handleNextStep() {
    const stepOneMessage = getRegisterUserDraftStepOneValidationMessage(registerData)
    if (stepOneMessage) {
      message = stepOneMessage
      return
    }
    registerStep = 2
    message = ''
  }

  function handleBackStep() {
    registerStep = 1
    message = ''
  }

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault()
    if (!isRegisterValid || isLoading)
      return

    const validationMessage = getRegisterUserDraftValidationMessage(registerData)
    if (validationMessage) {
      message = validationMessage
      return
    }

    isLoading = true
    message = ''

    try {
      // Cast is safe due to isRegisterValid guard
      await register(registerData as any)
      // On success, notify user and switch to login
      message = 'Account created successfully! Please sign in.'
      mode = 'login'
      loginData.studentNumber = registerData.studentId
      loginData.password = ''
      registerData = { ...EMPTY_REGISTER_USER_DRAFT }
      registerStep = 1
    }
    catch (err: any) {
      message = getMutationErrorMessage(err, 'Failed to create account', REGISTER_FIELD_LABELS)
    }
    finally {
      isLoading = false
    }
  }

  function toggleMode(newMode: 'login' | 'register') {
    mode = newMode
    message = ''
    isLoading = false
    showPassword = false
  }
</script>

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
            {mode === 'login' ? 'Student Elections' : 'Register Voter'}
          </h1>
          <p class='text-slate-400 font-medium'>
            {mode === 'login'
              ? 'Authenticate to access your ballot'
              : 'Create an account to participate in elections'}
          </p>
        </div>
      </div>

      <!-- Tab Buttons -->
      <div class='flex border-b border-slate-800 mb-6'>
        <button
          onclick={() => toggleMode('login')}
          class="flex-1 pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-colors cursor-pointer {mode === 'login' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'}"
        >
          Sign In
        </button>
        <button
          onclick={() => toggleMode('register')}
          class="flex-1 pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-colors cursor-pointer {mode === 'register' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'}"
        >
          Register
        </button>
      </div>

      <!-- Alerts / Messages -->
      {#if message}
        <div class='mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm font-semibold'>
          {message}
        </div>
      {/if}

      <!-- Login Form -->
      {#if mode === 'login'}
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
                class='absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer'
              >
                {#if showPassword}
                  <EyeOff size={18} />
                {:else}
                  <Eye size={18} />
                {/if}
              </button>
            </div>
          </div>

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
      {:else}
        <!-- Register Form -->
        <form onsubmit={handleRegister} class='space-y-5'>
          {#if registerStep === 1}
            <!-- Step 1 -->
            <div class='space-y-4'>
              <div class='space-y-2'>
                <label
                  for='studentId'
                  class='block text-xs font-black uppercase tracking-wider text-slate-400'
                >
                  Student ID
                </label>
                <input
                  id='studentId'
                  type='text'
                  bind:value={registerData.studentId}
                  placeholder='C25-01-10001-MAN121'
                  required
                  class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
                />
              </div>

              <div class='grid grid-cols-2 gap-4'>
                <div class='space-y-2'>
                  <label
                    for='firstName'
                    class='block text-xs font-black uppercase tracking-wider text-slate-400'
                  >
                    First Name
                  </label>
                  <input
                    id='firstName'
                    type='text'
                    bind:value={registerData.firstName}
                    placeholder='First Name'
                    required
                    class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
                  />
                </div>

                <div class='space-y-2'>
                  <label
                    for='lastName'
                    class='block text-xs font-black uppercase tracking-wider text-slate-400'
                  >
                    Last Name
                  </label>
                  <input
                    id='lastName'
                    type='text'
                    bind:value={registerData.lastName}
                    placeholder='Last Name'
                    required
                    class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
                  />
                </div>
              </div>

              <!-- Step 1 Button -->
              <button
                type='button'
                onclick={handleNextStep}
                disabled={!isStepOneValid}
                class='w-full py-4 font-black text-sm rounded-xl transition-all mt-6 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-white'
              >
                <span>NEXT STEP</span>
                <ChevronRight size={18} />
              </button>
            </div>
          {:else}
            <!-- Step 2 -->
            <div class='space-y-4'>
              <div class='grid grid-cols-2 gap-4'>
                <div class='space-y-2'>
                  <label
                    for='yearLevel'
                    class='block text-xs font-black uppercase tracking-wider text-slate-400'
                  >
                    Year Level
                  </label>
                  <select
                    id='yearLevel'
                    bind:value={registerData.yearLevel}
                    required
                    class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 focus:outline-none transition-all cursor-pointer'
                  >
                    <option value="">Select Year</option>
                    {#each YEAR_LEVEL_VALUES as val}
                      <option value={val}>{val}</option>
                    {/each}
                  </select>
                </div>

                <div class='space-y-2'>
                  <label
                    for='course'
                    class='block text-xs font-black uppercase tracking-wider text-slate-400'
                  >
                    Course
                  </label>
                  <select
                    id='course'
                    bind:value={registerData.course}
                    required
                    class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 focus:outline-none transition-all cursor-pointer'
                  >
                    <option value="">Select Course</option>
                    {#each COURSE_VALUES as val}
                      <option value={val}>{val}</option>
                    {/each}
                  </select>
                </div>
              </div>

              <div class='space-y-2'>
                <label
                  for='email'
                  class='block text-xs font-black uppercase tracking-wider text-slate-400'
                >
                  Email Address
                </label>
                <input
                  id='email'
                  type='email'
                  bind:value={registerData.email}
                  placeholder='name@example.com'
                  required
                  class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
                />
              </div>

              <div class='grid grid-cols-2 gap-4'>
                <div class='space-y-2'>
                  <label
                    for='regUsername'
                    class='block text-xs font-black uppercase tracking-wider text-slate-400'
                  >
                    Username
                  </label>
                  <input
                    id='regUsername'
                    type='text'
                    bind:value={registerData.username}
                    placeholder='Username'
                    required
                    class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
                  />
                </div>

                <div class='space-y-2 relative'>
                  <label
                    for='regPassword'
                    class='block text-xs font-black uppercase tracking-wider text-slate-400'
                  >
                    Password
                  </label>
                  <input
                    id='regPassword'
                    type={showPassword ? 'text' : 'password'}
                    bind:value={registerData.password}
                    placeholder='Min 8 chars'
                    required
                    class='w-full rounded-xl bg-slate-850 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-4 py-3 pr-10 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all'
                  />
                  <button
                    type='button'
                    onclick={() => showPassword = !showPassword}
                    class='absolute right-3 top-[38px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer'
                  >
                    {#if showPassword}
                      <EyeOff size={16} />
                    {:else}
                      <Eye size={16} />
                    {/if}
                  </button>
                </div>
              </div>

              <div class='flex gap-4 mt-6'>
                <button
                  type='button'
                  onclick={handleBackStep}
                  class='flex-1 py-4 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 cursor-pointer text-slate-200'
                >
                  <ChevronLeft size={18} />
                  <span>BACK</span>
                </button>
                <button
                  type='submit'
                  disabled={!isRegisterValid || isLoading}
                  class='flex-1 py-4 font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-white'
                >
                  {#if isLoading}
                    <Loader class='animate-spin' size={18} />
                    <span>CREATING</span>
                  {:else}
                    <span>REGISTER</span>
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </form>
      {/if}
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
          'End-to-end encrypted voting',
          'One student, one vote guarantee',
          'Real-time result transparency',
        ] as feature}
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

      <!-- Trust badge -->
      <div class='inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-blue-900/40 border border-blue-500/30'>
        <div class='w-2 h-2 rounded-full bg-emerald-400 animate-pulse'></div>
        <span class='text-xs font-black uppercase tracking-wider text-blue-200'>
          System Active
        </span>
      </div>
    </div>
  </div>
</div>
