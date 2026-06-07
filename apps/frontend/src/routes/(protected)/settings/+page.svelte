<script lang='ts'>
  import type { ChangePasswordData, ProfileData, UpdateProfileData } from '$lib/types'
  import { goto } from '$app/navigation'
  import { changePassword, getMyProfile, updateMyProfile } from '$lib/api/profile'
  import { authStore } from '$lib/stores/auth'
  import { UserRole } from '$lib/types'
  import { ArrowLeft, Eye, EyeOff, KeyRound, Loader, Save } from 'lucide-svelte'
  import { onMount } from 'svelte'

  // State
  let profile = $state<ProfileData | null>(null)
  let isLoading = $state(true)
  let loadError = $state('')

  // Profile form
  let firstName = $state('')
  let lastName = $state('')
  let username = $state('')
  let email = $state('')
  let isSavingProfile = $state(false)
  let profileMsg = $state<{ text: string, ok: boolean } | null>(null)

  // Password form
  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let isSavingPassword = $state(false)
  let passwordMsg = $state<{ text: string, ok: boolean } | null>(null)

  // Visibility toggles
  let showCurrent = $state(false)
  let showNew = $state(false)
  let showConfirm = $state(false)

  const user = $derived($authStore.user)
  const isAdmin = $derived(user?.user?.role === UserRole.ADMIN)

  onMount(async () => {
    try {
      const data = await getMyProfile()
      profile = data
      firstName = data.firstName
      lastName = data.lastName
      username = data.username
      email = data.email ?? ''
    }
    catch (e: any) {
      loadError = e.message || 'Failed to load profile'
    }
    finally {
      isLoading = false
    }
  })

  async function handleProfileSubmit(e: SubmitEvent) {
    e.preventDefault()
    isSavingProfile = true
    profileMsg = null
    try {
      const payload: UpdateProfileData = { firstName, lastName, username }
      if (email)
        payload.email = email
      await updateMyProfile(payload)
      profileMsg = { text: 'Profile updated successfully.', ok: true }
    }
    catch (err: any) {
      profileMsg = { text: err.message || 'Failed to update profile', ok: false }
    }
    finally {
      isSavingProfile = false
      setTimeout(() => {
        profileMsg = null
      }, 4000)
    }
  }

  async function handlePasswordSubmit(e: SubmitEvent) {
    e.preventDefault()
    passwordMsg = null
    if (newPassword.length < 8) {
      passwordMsg = { text: 'Password must be at least 8 characters', ok: false }
      return
    }
    if (newPassword !== confirmPassword) {
      passwordMsg = { text: 'Passwords do not match', ok: false }
      return
    }
    isSavingPassword = true
    try {
      const payload: ChangePasswordData = { currentPassword, newPassword }
      await changePassword(payload)
      passwordMsg = { text: 'Password changed successfully.', ok: true }
      currentPassword = ''
      newPassword = ''
      confirmPassword = ''
    }
    catch (err: any) {
      passwordMsg = { text: err.message || 'Failed to change password', ok: false }
    }
    finally {
      isSavingPassword = false
      setTimeout(() => {
        passwordMsg = null
      }, 4000)
    }
  }
</script>

{#if isLoading}
  <div class='fixed inset-0 z-50 flex items-center justify-center bg-slate-950'>
    <Loader class='animate-spin text-sky-400' size={36} />
  </div>
{:else if loadError}
  <div class='flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100'>
    <p class='text-lg font-bold'>Failed to load profile</p>
    <p class='text-sm text-slate-400'>{loadError}</p>
    <button onclick={() => window.location.reload()} class='rounded-xl bg-sky-500 px-6 py-3 font-bold text-white'>Retry</button>
  </div>
{:else}
  <div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
    <div class='h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500'></div>
    <div class='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>

      <!-- Header -->
      <div class='mb-8'>
        <button
          onclick={() => goto(isAdmin ? '/admin-dashboard' : '/dashboard')}
          class='mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-50 cursor-pointer'
        >
          <ArrowLeft size={20} stroke-width={2.5} />
          <span class='font-semibold'>Back</span>
        </button>
        <h1 class='text-3xl font-black text-slate-50'>Profile Settings</h1>
        <p class='mt-2 text-sm font-medium text-slate-400'>Manage your account information and security</p>
      </div>

      <!-- Profile Information -->
      <div class='mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6'>
        <h2 class='mb-6 text-xl font-bold text-slate-50'>Profile Information</h2>

        {#if profileMsg}
          <div class="mb-4 rounded-xl border px-4 py-3 text-sm font-semibold
            {profileMsg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}">
            {profileMsg.text}
          </div>
        {/if}

        <form onsubmit={handleProfileSubmit} class='space-y-5'>
          <div class='grid grid-cols-1 gap-5 md:grid-cols-2'>
            <!-- First Name -->
            <div class='space-y-2'>
              <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>First Name</label>
              <input
                type='text'
                bind:value={firstName}
                required
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
              />
            </div>
            <!-- Last Name -->
            <div class='space-y-2'>
              <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Last Name</label>
              <input
                type='text'
                bind:value={lastName}
                required
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
              />
            </div>
            <!-- Username -->
            <div class='space-y-2'>
              <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Username</label>
              <input
                type='text'
                bind:value={username}
                required
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
              />
            </div>
            <!-- Email -->
            <div class='space-y-2'>
              <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Email</label>
              <input
                type='email'
                bind:value={email}
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
              />
            </div>
          </div>

          <!-- Read-only fields -->
          <div class='mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4'>
            <p class='mb-3 text-xs font-bold uppercase tracking-wider text-slate-500'>Admin-Managed Fields</p>
            <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
              {#each [['Student ID', profile?.studentId], ['Year Level', profile?.yearLevel], ['Course', profile?.course]] as [label, val]}
                <div>
                  <label class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'>{label}</label>
                  <input type='text' value={val ?? ''} disabled class='w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-500' />
                </div>
              {/each}
            </div>
          </div>

          <div class='flex justify-end pt-2'>
            <button
              type='submit'
              disabled={isSavingProfile}
              class='flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 font-bold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer'
            >
              {#if isSavingProfile}
                <Loader class='animate-spin' size={18} />
                Saving...
              {:else}
                <Save size={18} />
                Save Changes
              {/if}
            </button>
          </div>
        </form>
      </div>

      <!-- Change Password -->
      <div class='rounded-2xl border border-slate-800 bg-slate-900 p-6'>
        <div class='mb-6 flex items-center gap-3'>
          <div class='rounded-lg bg-violet-500/15 p-2'>
            <KeyRound size={20} class='text-violet-400' />
          </div>
          <h2 class='text-xl font-bold text-slate-50'>Change Password</h2>
        </div>

        {#if passwordMsg}
          <div class="mb-4 rounded-xl border px-4 py-3 text-sm font-semibold
            {passwordMsg.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}">
            {passwordMsg.text}
          </div>
        {/if}

        <form onsubmit={handlePasswordSubmit} class='space-y-5'>
          <!-- Current Password -->
          <div class='space-y-2'>
            <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Current Password</label>
            <div class='relative'>
              <input
                type={showCurrent ? 'text' : 'password'}
                bind:value={currentPassword}
                required
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 pr-12 font-semibold text-slate-50 transition focus:border-violet-400 focus:outline-none'
              />
              <button type='button' onclick={() => showCurrent = !showCurrent} class='absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-50 cursor-pointer'>
                {#if showCurrent}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
              </button>
            </div>
          </div>

          <!-- New Password -->
          <div class='space-y-2'>
            <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>New Password</label>
            <div class='relative'>
              <input
                type={showNew ? 'text' : 'password'}
                bind:value={newPassword}
                required
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 pr-12 font-semibold text-slate-50 transition focus:border-violet-400 focus:outline-none'
              />
              <button type='button' onclick={() => showNew = !showNew} class='absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-50 cursor-pointer'>
                {#if showNew}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class='space-y-2'>
            <label class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Confirm New Password</label>
            <div class='relative'>
              <input
                type={showConfirm ? 'text' : 'password'}
                bind:value={confirmPassword}
                required
                class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 pr-12 font-semibold text-slate-50 transition focus:border-violet-400 focus:outline-none'
              />
              <button type='button' onclick={() => showConfirm = !showConfirm} class='absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-50 cursor-pointer'>
                {#if showConfirm}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
              </button>
            </div>
          </div>

          <div class='flex justify-end pt-2'>
            <button
              type='submit'
              disabled={isSavingPassword}
              class='flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-3 font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer'
            >
              {#if isSavingPassword}
                <Loader class='animate-spin' size={18} />
                Changing...
              {:else}
                <KeyRound size={18} />
                Change Password
              {/if}
            </button>
          </div>
        </form>
      </div>

    </div>
  </div>
{/if}
