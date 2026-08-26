<script lang='ts'>
  import { untrack } from 'svelte'
  import type { ChangePasswordData, ProfileData, UpdateProfileData } from '$lib/types'
  import { goto } from '$app/navigation'
  import { invalidate } from '$app/navigation'
  import { changePassword, updateMyProfile } from '$lib/api/profile'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import { UserRole } from '$lib/types'
  import { ArrowLeft, Eye, EyeOff, KeyRound, Loader, Save } from 'lucide-svelte'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { updateProfileSchema, changePasswordSchema } from '$lib/validation/profile'

  let { data } = $props()
  const profile = $derived(data.profile)

  // Profile form
  let firstName = $state(untrack(() => data.profile.firstName))
  let lastName = $state(untrack(() => data.profile.lastName))
  let username = $state(untrack(() => data.profile.username))
  let email = $state(untrack(() => data.profile.email ?? ''))
  let isSavingProfile = $state(false)
  let profileErrors = $state<Record<string, string>>({})

  // Password form
  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let isSavingPassword = $state(false)
  let passwordErrors = $state<Record<string, string>>({})

  // Visibility toggles
  let showCurrent = $state(false)
  let showNew = $state(false)
  let showConfirm = $state(false)

  const user = $derived(authStore.user)
  const isAdmin = $derived(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN)

  async function handleProfileSubmit(e: SubmitEvent) {
    e.preventDefault()
    const result = validate(updateProfileSchema, {
      firstName,
      lastName,
      username,
      email: email.trim() || undefined,
    })
    if (!result.ok) {
      profileErrors = result.errors
      return
    }
    profileErrors = {}
    isSavingProfile = true
    try {
      const payload: UpdateProfileData = {
        firstName,
        lastName,
        username,
        email: email.trim(),
      }
      await updateMyProfile(payload)
      await invalidate('app:profile')
      addToast('success', 'Profile updated')
    }
    catch (err: any) {
      addToast('error', extractErrorMessage(err, 'Failed to update profile'))
    }
    finally {
      isSavingProfile = false
    }
  }

  async function handlePasswordSubmit(e: SubmitEvent) {
    e.preventDefault()
    const result = validate(changePasswordSchema, {
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (!result.ok) {
      passwordErrors = result.errors
      return
    }
    passwordErrors = {}
    isSavingPassword = true
    try {
      const payload: ChangePasswordData = { currentPassword, newPassword }
      const result = await changePassword(payload)

      if (!result.sessionRotated) {
        addToast('info', result.message)
        appCache.invalidate()
        authStore.logout()
        goto('/auth', { replaceState: true })
        return
      }

      addToast('success', result.message)
      currentPassword = ''
      newPassword = ''
      confirmPassword = ''
    }
    catch (err: any) {
      addToast('error', extractErrorMessage(err, 'Failed to change password'))
    }
    finally {
      isSavingPassword = false
    }
  }
</script>

<div class='keyboard-scroll-content w-full mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8'>

    <!-- Header -->
    <div class='mb-8'>
      <button
        onclick={() => goto(isAdmin ? '/admin-dashboard' : '/voting')}
        class='mb-4 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-50 cursor-pointer'
      >
        <ArrowLeft size={20} stroke-width={2.5} />
        <span class='font-semibold'>Back</span>
      </button>
      <h1 class='text-3xl font-black text-slate-50'>Profile Settings</h1>
      <p class='mt-2 text-sm font-medium text-slate-400'>Manage your account information and security</p>
    </div>

    <!-- Profile Information -->
    <div class='mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6'>
      <h2 class='mb-6 text-xl font-bold text-slate-50'>Profile Information</h2>


      <form onsubmit={handleProfileSubmit} class='space-y-5'>
        <div class='grid grid-cols-1 gap-5 md:grid-cols-2'>
          <!-- First Name -->
          <div class='space-y-2'>
            <label for='firstName' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>First Name</label>
            <input
              id='firstName'
              type='text'
              bind:value={firstName}
              oninput={() => { if (profileErrors.firstName) profileErrors.firstName = '' }}
              required
              class='w-full rounded-xl border-2 {profileErrors.firstName ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
            />
            {#if profileErrors.firstName}
              <p class='text-xs font-medium text-red-400'>{profileErrors.firstName}</p>
            {/if}
          </div>
          <!-- Last Name -->
          <div class='space-y-2'>
            <label for='lastName' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Last Name</label>
            <input
              id='lastName'
              type='text'
              bind:value={lastName}
              oninput={() => { if (profileErrors.lastName) profileErrors.lastName = '' }}
              required
              class='w-full rounded-xl border-2 {profileErrors.lastName ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
            />
            {#if profileErrors.lastName}
              <p class='text-xs font-medium text-red-400'>{profileErrors.lastName}</p>
            {/if}
          </div>
          <!-- Username -->
          <div class='space-y-2'>
            <label for='username' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Username</label>
            <input
              id='username'
              type='text'
              bind:value={username}
              oninput={() => { if (profileErrors.username) profileErrors.username = '' }}
              required
              class='w-full rounded-xl border-2 {profileErrors.username ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
            />
            {#if profileErrors.username}
              <p class='text-xs font-medium text-red-400'>{profileErrors.username}</p>
            {/if}
          </div>
          <!-- Email -->
          <div class='space-y-2'>
            <label for='email' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Email</label>
            <input
              id='email'
              type='email'
              bind:value={email}
              oninput={() => { if (profileErrors.email) profileErrors.email = '' }}
              class='w-full rounded-xl border-2 {profileErrors.email ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
            />
            {#if profileErrors.email}
              <p class='text-xs font-medium text-red-400'>{profileErrors.email}</p>
            {/if}
          </div>
        </div>

        <!-- Read-only fields -->
        <div class='mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4'>
          <p class='mb-3 text-xs font-bold uppercase tracking-wider text-slate-500'>Admin-Managed Fields</p>
          <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
            {#each [['studentId', 'Student ID', profile?.studentId], ['yearLevel', 'Year Level', profile?.yearLevel], ['course', 'Course', profile?.course]] as [id, label, val] (id)}
              <div>
                <label for={id} class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'>{label}</label>
                <input id={id} type='text' value={val ?? ''} disabled class='w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-500' />
              </div>
            {/each}
          </div>
        </div>

        <div class='flex justify-end pt-2'>
          <button
            type='submit'
            disabled={isSavingProfile}
            class='flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 font-bold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer sm:w-auto'
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
    <div class='rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6'>
      <div class='mb-6 flex items-center gap-3'>
        <div class='rounded-lg bg-violet-500/15 p-2'>
          <KeyRound size={20} class='text-violet-400' />
        </div>
        <h2 class='text-xl font-bold text-slate-50'>Change Password</h2>
      </div>


      <form onsubmit={handlePasswordSubmit} class='space-y-5'>
        <!-- Current Password -->
        <div class='space-y-2'>
          <label for='currentPassword' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Current Password</label>
          <div class='relative'>
            <input
              id='currentPassword'
              type={showCurrent ? 'text' : 'password'}
              bind:value={currentPassword}
              oninput={() => { if (passwordErrors.currentPassword) passwordErrors.currentPassword = '' }}
              required
              class='w-full rounded-xl border-2 {passwordErrors.currentPassword ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 pr-12 font-semibold text-slate-50 transition focus:border-violet-400 focus:outline-none'
            />
            <button type='button' onclick={() => showCurrent = !showCurrent} aria-label={showCurrent ? 'Hide current password' : 'Show current password'} aria-pressed={showCurrent} class='absolute right-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-50 cursor-pointer'>
              {#if showCurrent}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
            </button>
          </div>
          {#if passwordErrors.currentPassword}
            <p class='text-xs font-medium text-red-400'>{passwordErrors.currentPassword}</p>
          {/if}
        </div>

        <!-- New Password -->
        <div class='space-y-2'>
          <label for='newPassword' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>New Password</label>
          <div class='relative'>
            <input
              id='newPassword'
              type={showNew ? 'text' : 'password'}
              bind:value={newPassword}
              oninput={() => { if (passwordErrors.newPassword) passwordErrors.newPassword = '' }}
              required
              class='w-full rounded-xl border-2 {passwordErrors.newPassword ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 pr-12 font-semibold text-slate-50 transition focus:border-violet-400 focus:outline-none'
            />
            <button type='button' onclick={() => showNew = !showNew} aria-label={showNew ? 'Hide new password' : 'Show new password'} aria-pressed={showNew} class='absolute right-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-50 cursor-pointer'>
              {#if showNew}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
            </button>
          </div>
          {#if passwordErrors.newPassword}
            <p class='text-xs font-medium text-red-400'>{passwordErrors.newPassword}</p>
          {/if}
        </div>

        <!-- Confirm Password -->
        <div class='space-y-2'>
          <label for='confirmPassword' class='block text-sm font-bold uppercase tracking-wider text-slate-400'>Confirm New Password</label>
          <div class='relative'>
            <input
              id='confirmPassword'
              type={showConfirm ? 'text' : 'password'}
              bind:value={confirmPassword}
              oninput={() => { if (passwordErrors.confirmPassword) passwordErrors.confirmPassword = '' }}
              required
              class='w-full rounded-xl border-2 {passwordErrors.confirmPassword ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-4 py-3 pr-12 font-semibold text-slate-50 transition focus:border-violet-400 focus:outline-none'
            />
            <button type='button' onclick={() => showConfirm = !showConfirm} aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirm} class='absolute right-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-50 cursor-pointer'>
              {#if showConfirm}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
            </button>
          </div>
          {#if passwordErrors.confirmPassword}
            <p class='text-xs font-medium text-red-400'>{passwordErrors.confirmPassword}</p>
          {/if}
        </div>

        <div class='flex justify-end pt-2'>
          <button
            type='submit'
            disabled={isSavingPassword}
            class='flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-6 py-3 font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer sm:w-auto'
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
