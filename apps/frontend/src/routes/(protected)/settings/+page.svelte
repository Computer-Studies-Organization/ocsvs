<script lang='ts'>
  import { untrack } from 'svelte'
  import type { ChangePasswordData, UpdateProfileData } from '$lib/types'
  import { goto, invalidate } from '$app/navigation'
  import { changePassword, updateMyProfile } from '$lib/api/profile'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import { UserRole } from '$lib/types'
  import {
    ArrowLeft,
    Check,
    Copy,
    Eye,
    EyeOff,
    KeyRound,
    Loader,
    Save,
  } from 'lucide-svelte'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'
  import { addToast } from '$lib/stores/toast.svelte'
  import { validate } from '$lib/validation/helpers'
  import { updateProfileSchema, changePasswordSchema } from '$lib/validation/profile'

  let { data } = $props()
  const profile = $derived(data.profile)

  // Profile form state
  let firstName = $state(untrack(() => data.profile.firstName))
  let lastName = $state(untrack(() => data.profile.lastName))
  let username = $state(untrack(() => data.profile.username))
  let email = $state(untrack(() => data.profile.email ?? ''))
  let isSavingProfile = $state(false)
  let profileErrors = $state<Record<string, string>>({})

  // Password form state
  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let isSavingPassword = $state(false)
  let passwordErrors = $state<Record<string, string>>({})

  // Visibility toggles
  let showCurrent = $state(false)
  let showNew = $state(false)
  let showConfirm = $state(false)

  // Copy student ID state
  let copiedStudentId = $state(false)

  const user = $derived(authStore.user)
  const isAdmin = $derived(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN)

  function toTitleCase(str: string): string {
    if (!str) return ''
    return str
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Computed identity helpers
  const initials = $derived.by(() => {
    const first = (firstName || profile?.firstName || '').trim()
    const last = (lastName || profile?.lastName || '').trim()
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
    if (first) return first.slice(0, 2).toUpperCase()
    if (username) return username.slice(0, 2).toUpperCase()
    return 'U'
  })

  const displayName = $derived.by(() => {
    const first = (firstName || profile?.firstName || '').trim()
    const last = (lastName || profile?.lastName || '').trim()
    if (first || last) return toTitleCase(`${first} ${last}`.trim())
    return username || 'Account'
  })

  const roleLabel = $derived(user?.role === UserRole.SUPER_ADMIN ? 'Super Admin' : isAdmin ? 'Administrator' : 'Student Voter')

  // Password helpers
  const isNewPasswordLongEnough = $derived(newPassword.length >= 8)
  const passwordsMatch = $derived(newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword)
  const passwordsMismatch = $derived(confirmPassword.length > 0 && newPassword !== confirmPassword)

  async function copyStudentId() {
    if (!profile?.studentId) return
    try {
      await navigator.clipboard.writeText(profile.studentId)
      copiedStudentId = true
      setTimeout(() => {
        copiedStudentId = false
      }, 2000)
    }
    catch {
      // Ignore clipboard write failures
    }
  }

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

<div class='keyboard-scroll-content w-full mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8'>

  <!-- Header & Navigation -->
  <div class='mb-8'>
    <button
      onclick={() => goto(isAdmin ? '/admin-dashboard' : '/voting')}
      class='mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-400 transition-colors hover:text-slate-100 cursor-pointer'
    >
      <ArrowLeft size={16} />
      <span>Back to {isAdmin ? 'Dashboard' : 'Voting'}</span>
    </button>
    <div>
      <h1 class='text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl'>Account Settings</h1>
      <p class='mt-1 text-sm text-slate-400'>
        Manage your profile details and security credentials.
      </p>
    </div>
  </div>

  <!-- Main Responsive Layout -->
  <div class='grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8'>

    <!-- Left Column: Identity Sidebar -->
    <div class='space-y-6 lg:col-span-4'>
      <div class='lg:sticky lg:top-20 space-y-6'>
        
        <div class='rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 shadow-sm'>
          <!-- Avatar + Name -->
          <div class='flex flex-col items-center text-center'>
            <div class="mb-3.5 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800 text-lg font-semibold text-slate-200">
              {initials}
            </div>

            <h2 class='text-base font-semibold text-slate-100'>{displayName}</h2>
            <p class='text-xs font-mono text-slate-400 mt-0.5'>@{username}</p>

            <span class="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {isAdmin ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-300 border-slate-700/70'}">
              {roleLabel}
            </span>
          </div>

          <!-- Academic Record Info (clean flat definition list) -->
          <div class='mt-6 border-t border-slate-800/70 pt-5'>
            <div class='flex items-center justify-between mb-3'>
              <span class='text-xs font-semibold text-slate-400 uppercase tracking-wider'>Institutional Record</span>
              <span class='text-[11px] font-medium text-emerald-400/90'>Verified</span>
            </div>

            <dl class='divide-y divide-slate-800/60 text-xs'>
              <div class='py-2.5 flex items-center justify-between gap-2'>
                <dt class='text-slate-400 font-medium'>Student ID</dt>
                <dd class='flex items-center gap-1 font-mono text-slate-200 font-semibold'>
                  <span>{profile?.studentId || 'N/A'}</span>
                  {#if profile?.studentId}
                    <button
                      type='button'
                      onclick={copyStudentId}
                      aria-label='Copy Student ID'
                      title='Copy Student ID'
                      class='flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-slate-200 cursor-pointer'
                    >
                      {#if copiedStudentId}
                        <Check size={14} class='text-emerald-400' />
                      {:else}
                        <Copy size={14} />
                      {/if}
                    </button>
                  {/if}
                </dd>
              </div>

              <div class='py-2.5 flex items-center justify-between gap-2'>
                <dt class='text-slate-400 font-medium'>Course</dt>
                <dd class='text-slate-200 font-medium text-right'>{profile?.course || 'Unassigned'}</dd>
              </div>

              <div class='py-2.5 flex items-center justify-between gap-2'>
                <dt class='text-slate-400 font-medium'>Year Level</dt>
                <dd class='text-slate-200 font-medium text-right'>{profile?.yearLevel || 'Unassigned'}</dd>
              </div>
            </dl>

            <p class='mt-3 text-[11px] text-slate-400 text-center leading-relaxed'>
              Academic records are managed by CSO administration.
            </p>
          </div>
        </div>

      </div>
    </div>

    <!-- Right Column: Forms -->
    <div class='space-y-6 lg:col-span-8'>

      <!-- Personal Information Card -->
      <div class='rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-6 shadow-sm'>
        <div class='mb-5'>
          <h2 class='text-lg font-semibold text-slate-100'>Personal Information</h2>
          <p class='text-xs text-slate-400 mt-0.5'>Update your public name and contact email.</p>
        </div>

        <form onsubmit={handleProfileSubmit} class='space-y-4'>
          <div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <!-- First Name -->
            <div class='space-y-1.5'>
              <label for='firstName' class='block text-xs font-medium text-slate-300'>First Name</label>
              <input
                id='firstName'
                type='text'
                bind:value={firstName}
                oninput={() => { if (profileErrors.firstName) profileErrors.firstName = '' }}
                required
                class='w-full rounded-xl border {profileErrors.firstName ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
              />
              {#if profileErrors.firstName}
                <p class='text-xs font-medium text-red-400'>{profileErrors.firstName}</p>
              {/if}
            </div>

            <!-- Last Name -->
            <div class='space-y-1.5'>
              <label for='lastName' class='block text-xs font-medium text-slate-300'>Last Name</label>
              <input
                id='lastName'
                type='text'
                bind:value={lastName}
                oninput={() => { if (profileErrors.lastName) profileErrors.lastName = '' }}
                required
                class='w-full rounded-xl border {profileErrors.lastName ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
              />
              {#if profileErrors.lastName}
                <p class='text-xs font-medium text-red-400'>{profileErrors.lastName}</p>
              {/if}
            </div>

            <!-- Username -->
            <div class='space-y-1.5'>
              <label for='username' class='block text-xs font-medium text-slate-300'>Username</label>
              <input
                id='username'
                type='text'
                bind:value={username}
                oninput={() => { if (profileErrors.username) profileErrors.username = '' }}
                required
                class='w-full rounded-xl border {profileErrors.username ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
              />
              {#if profileErrors.username}
                <p class='text-xs font-medium text-red-400'>{profileErrors.username}</p>
              {/if}
            </div>

            <!-- Email -->
            <div class='space-y-1.5'>
              <label for='email' class='block text-xs font-medium text-slate-300'>Email Address</label>
              <input
                id='email'
                type='email'
                bind:value={email}
                oninput={() => { if (profileErrors.email) profileErrors.email = '' }}
                placeholder='Optional email'
                class='w-full rounded-xl border {profileErrors.email ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
              />
              {#if profileErrors.email}
                <p class='text-xs font-medium text-red-400'>{profileErrors.email}</p>
              {/if}
            </div>
          </div>

          <div class='flex justify-end pt-2'>
            <button
              type='submit'
              disabled={isSavingProfile}
              class='flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer sm:w-auto'
            >
              {#if isSavingProfile}
                <Loader class='animate-spin' size={16} />
                <span>Saving...</span>
              {:else}
                <Save size={16} />
                <span>Save Changes</span>
              {/if}
            </button>
          </div>
        </form>
      </div>

      <!-- Change Password Card -->
      <div class='rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-6 shadow-sm'>
        <div class='mb-5'>
          <h2 class='text-lg font-semibold text-slate-100'>Change Password</h2>
          <p class='text-xs text-slate-400 mt-0.5'>Update your account password.</p>
        </div>

        <form onsubmit={handlePasswordSubmit} class='space-y-4'>
          <!-- Current Password -->
          <div class='space-y-1.5'>
            <label for='currentPassword' class='block text-xs font-medium text-slate-300'>Current Password</label>
            <div class='relative'>
              <input
                id='currentPassword'
                type={showCurrent ? 'text' : 'password'}
                bind:value={currentPassword}
                oninput={() => { if (passwordErrors.currentPassword) passwordErrors.currentPassword = '' }}
                required
                class='w-full rounded-xl border {passwordErrors.currentPassword ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 pr-11 text-sm font-medium text-slate-100 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
              />
              <button
                type='button'
                onclick={() => showCurrent = !showCurrent}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                aria-pressed={showCurrent}
                class='absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 cursor-pointer'
              >
                {#if showCurrent}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
              </button>
            </div>
            {#if passwordErrors.currentPassword}
              <p class='text-xs font-medium text-red-400'>{passwordErrors.currentPassword}</p>
            {/if}
          </div>

          <div class='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <!-- New Password -->
            <div class='space-y-1.5'>
              <div class='flex items-center justify-between'>
                <label for='newPassword' class='block text-xs font-medium text-slate-300'>New Password</label>
                {#if newPassword.length > 0}
                  <span class="text-[11px] font-medium {isNewPasswordLongEnough ? 'text-emerald-400' : 'text-slate-400'}">
                    {isNewPasswordLongEnough ? '8+ characters' : `${newPassword.length}/8 chars`}
                  </span>
                {/if}
              </div>
              <div class='relative'>
                <input
                  id='newPassword'
                  type={showNew ? 'text' : 'password'}
                  bind:value={newPassword}
                  oninput={() => { if (passwordErrors.newPassword) passwordErrors.newPassword = '' }}
                  required
                  class='w-full rounded-xl border {passwordErrors.newPassword ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 pr-11 text-sm font-medium text-slate-100 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
                />
                <button
                  type='button'
                  onclick={() => showNew = !showNew}
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  aria-pressed={showNew}
                  class='absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 cursor-pointer'
                >
                  {#if showNew}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
                </button>
              </div>
              {#if passwordErrors.newPassword}
                <p class='text-xs font-medium text-red-400'>{passwordErrors.newPassword}</p>
              {/if}
            </div>

            <!-- Confirm Password -->
            <div class='space-y-1.5'>
              <div class='flex items-center justify-between'>
                <label for='confirmPassword' class='block text-xs font-medium text-slate-300'>Confirm New Password</label>
                {#if confirmPassword.length > 0}
                  <span class="text-[11px] font-medium {passwordsMatch ? 'text-emerald-400' : 'text-red-400'}">
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                {/if}
              </div>
              <div class='relative'>
                <input
                  id='confirmPassword'
                  type={showConfirm ? 'text' : 'password'}
                  bind:value={confirmPassword}
                  oninput={() => { if (passwordErrors.confirmPassword) passwordErrors.confirmPassword = '' }}
                  required
                  class="w-full rounded-xl border {passwordErrors.confirmPassword || passwordsMismatch ? 'border-red-500/80' : 'border-slate-800'} bg-slate-950/60 px-3.5 py-2.5 pr-11 text-sm font-medium text-slate-100 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                />
                <button
                  type='button'
                  onclick={() => showConfirm = !showConfirm}
                  aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                  aria-pressed={showConfirm}
                  class='absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 cursor-pointer'
                >
                  {#if showConfirm}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
                </button>
              </div>
              {#if passwordErrors.confirmPassword}
                <p class='text-xs font-medium text-red-400'>{passwordErrors.confirmPassword}</p>
              {/if}
            </div>
          </div>

          <div class='flex justify-end pt-2'>
            <button
              type='submit'
              disabled={isSavingPassword}
              class='flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer sm:w-auto'
            >
              {#if isSavingPassword}
                <Loader class='animate-spin' size={16} />
                <span>Changing...</span>
              {:else}
                <KeyRound size={16} />
                <span>Change Password</span>
              {/if}
            </button>
          </div>
        </form>
      </div>

    </div>

  </div>

</div>
