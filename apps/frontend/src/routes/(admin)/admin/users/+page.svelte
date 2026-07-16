<script lang='ts'>
  import { type TCourse, type TUsersData, type TYearLevel, YEAR_LEVEL_VALUES, COURSE_VALUES, UserRole } from '$lib/types'
  import { goto, invalidate } from '$app/navigation'
  import { onDestroy, untrack } from 'svelte'
  import { deleteUser, hardDeleteUser, restoreUser, updateUser, createUser, unlockUser } from '$lib/api/users'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import {
    Archive,
    ArrowUpDown,
    Edit,
    Eye,
    EyeOff,
    Loader,
    RotateCcw,
    Search,
    Trash2,
    Unlock,
    X,
  } from 'lucide-svelte'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import { extractErrorMessage } from '$lib/mutation-feedback-utils'

  type SortableKey = 'studentId' | 'firstName' | 'lastName' | 'username' | 'yearLevel' | 'course'
  const SORTABLE_KEYS: SortableKey[] = ['studentId', 'firstName', 'lastName', 'username', 'yearLevel', 'course']
  const SORTABLE_LABELS: Record<SortableKey, string> = {
    studentId: 'Student ID',
    firstName: 'First Name',
    lastName: 'Last Name',
    username: 'Username',
    yearLevel: 'Year',
    course: 'Course',
  }

  type EditField = 'firstName' | 'lastName' | 'username' | 'email' | 'yearLevel' | 'course'
  const EDIT_FIELDS: EditField[] = ['firstName', 'lastName', 'username', 'email', 'yearLevel', 'course']
  const EDIT_LABELS: Record<EditField, string> = {
    firstName: 'First Name',
    lastName: 'Last Name',
    username: 'Username',
    email: 'Email',
    yearLevel: 'Year Level',
    course: 'Course',
  }
  type EditForm = Record<EditField, string>
  type AddUserForm = {
    firstName: string
    lastName: string
    studentId: string
    course: TCourse | ''
    yearLevel: TYearLevel | ''
    username: string
    email: string
    password: string
    role: UserRole
  }

  let { data } = $props()
  const users = $derived<TUsersData[]>(data.users)
  let includeDeleted = $state(untrack(() => data.includeDeleted))

  // State
  let search = $state('')
  let sortKey = $state<SortableKey>('studentId')
  let sortAsc = $state(true)
  let pageIndex = $state(0)
  const pageSize = 25

  // Modals
  let viewUser = $state<TUsersData | null>(null)
  let editUser = $state<TUsersData | null>(null)
  let editForm = $state<EditForm>({ firstName: '', lastName: '', username: '', email: '', yearLevel: '', course: '' })
  let isEditSaving = $state(false)
  let editMsg = $state('')
  let archiveConfirmUser = $state<TUsersData | null>(null)
  let restoreConfirmUser = $state<TUsersData | null>(null)
  let unlockConfirmUser = $state<TUsersData | null>(null)
  let hardDeleteConfirmUser = $state<TUsersData | null>(null)
  let hardDeleteConfirmText = $state('')
  let isActionLoading = $state(false)
  let actionMsg = $state('')
  let editTimeoutId: any

  // Add User State
  let showAddModal = $state(false)
  let addForm = $state<AddUserForm>({
    firstName: '',
    lastName: '',
    studentId: '',
    course: '',
    yearLevel: '',
    username: '',
    email: '',
    password: '',
    role: UserRole.USER,
  })
  let isAddSaving = $state(false)
  let addMsg = $state('')
  let addFormVisiblePassword = $state(false)
  let addSuccessDetails = $state<{ username: string; password: string } | null>(null)

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$'
    const maxUnbiasedByte = 256 - (256 % chars.length)
    let pass = ''
    while (pass.length < 10) {
      const randomBytes = new Uint8Array(10)
      crypto.getRandomValues(randomBytes)
      for (const byte of randomBytes) {
        if (byte < maxUnbiasedByte) {
          pass += chars.charAt(byte % chars.length)
        }
        if (pass.length === 10) {
          break
        }
      }
    }
    addForm.password = pass
    addFormVisiblePassword = true
  }

  async function handleAddSave(e?: SubmitEvent) {
    if (e) e.preventDefault()

    const studentIdRegex = /^C\d{2}-\d{2}-\d{4,5}-[A-Z]{3}\d{3}$/
    if (!studentIdRegex.test(addForm.studentId)) {
      addMsg = 'Invalid Student ID format (should be CXX-XX-XXXX-XXX123)'
      return
    }
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) {
      addMsg = 'First name and Last name are required'
      return
    }
    if (!addForm.password || addForm.password.length < 8) {
      addMsg = 'Password must be at least 8 characters'
      return
    }
    if (!addForm.course) {
      addMsg = 'Course is required'
      return
    }
    if (!addForm.yearLevel) {
      addMsg = 'Year level is required'
      return
    }

    isAddSaving = true
    addMsg = ''
    try {
      const payload: any = {
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        studentId: addForm.studentId.trim(),
        course: addForm.course,
        yearLevel: addForm.yearLevel,
        password: addForm.password,
        role: addForm.role,
      }
      if (addForm.username.trim()) {
        payload.username = addForm.username.trim()
      }
      if (addForm.email.trim()) {
        payload.email = addForm.email.trim()
      }

      const res = await createUser(payload)
      addToast('success', 'User created successfully')
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')

      addSuccessDetails = { username: res.user.username, password: addForm.password }
    }
    catch (e: unknown) {
      addMsg = extractErrorMessage(e, 'Failed to create user')
      addToast('error', addMsg)
    }
    finally {
      isAddSaving = false
    }
  }

  function closeAddModal() {
    showAddModal = false
    addForm = {
      firstName: '',
      lastName: '',
      studentId: '',
      course: '',
      yearLevel: '',
      username: '',
      email: '',
      password: '',
      role: UserRole.USER,
    }
    addMsg = ''
    addSuccessDetails = null
    addFormVisiblePassword = false
  }

  // Update local includeDeleted when SvelteKit page data updates (URL history sync)
  $effect(() => {
    includeDeleted = data.includeDeleted
  })

  // Update URL when includeDeleted changes
  $effect(() => {
    const url = new URL(window.location.href)
    if (includeDeleted) {
      url.searchParams.set('archived', 'true')
    } else {
      url.searchParams.delete('archived')
    }
    if (url.toString() === window.location.href) return
    goto(url.toString(), { replaceState: true, noScroll: true })
  })

  // Derived filtered + sorted + paginated list
  const filtered = $derived.by(() => {
    let list = includeDeleted ? users : users.filter((u) => !u.deletedAt)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((u) => {
        const studentIdMatch = u.studentId?.toLowerCase().includes(q)
        const firstNameMatch = u.firstName?.toLowerCase().includes(q)
        const lastNameMatch = u.lastName?.toLowerCase().includes(q)
        const usernameMatch = u.username?.toLowerCase().includes(q)
        return studentIdMatch || firstNameMatch || lastNameMatch || usernameMatch
      })
    }
    list = [...list].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return list
  })

  const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)))
  const paginated = $derived(filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize))

  $effect(() => {
    void includeDeleted
    void search
    pageIndex = 0
  })

  onDestroy(() => {
    if (editTimeoutId) {
      clearTimeout(editTimeoutId)
    }
  })

  function toggleSort(key: SortableKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc
    }
    else {
      sortKey = key
      sortAsc = true
    }
    pageIndex = 0
  }

  function openEdit(u: TUsersData) {
    editUser = u
    editForm = {
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      username: u.username ?? '',
      email: u.email ?? '',
      yearLevel: u.yearLevel ?? '',
      course: u.course ?? '',
    }
    editMsg = ''
  }

  async function handleEditSave() {
    if (!editUser)
      return
    isEditSaving = true
    editMsg = ''
    try {
      await updateUser(editUser.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        username: editForm.username,
        email: editForm.email.trim(),
        yearLevel: editForm.yearLevel || undefined,
        course: editForm.course || undefined,
      })
      editMsg = 'Saved!'
      addToast('success', 'User updated')
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      editTimeoutId = setTimeout(() => {
        editUser = null
      }, 800)
    }
    catch (e: unknown) {
      editMsg = extractErrorMessage(e, 'Failed to save')
      addToast('error', editMsg)
    }
    finally {
      isEditSaving = false
    }
  }

  async function handleArchive() {
    if (!archiveConfirmUser)
      return
    isActionLoading = true
    actionMsg = ''
    try {
      await deleteUser(archiveConfirmUser.id)
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      archiveConfirmUser = null
      addToast('success', 'User archived')
    }
    catch (e: unknown) {
      actionMsg = extractErrorMessage(e, 'Failed to archive')
      addToast('error', actionMsg)
    }
    finally {
      isActionLoading = false
    }
  }

  async function handleRestore() {
    if (!restoreConfirmUser)
      return
    isActionLoading = true
    actionMsg = ''
    try {
      await restoreUser(restoreConfirmUser.id)
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      restoreConfirmUser = null
      addToast('success', 'User restored')
    }
    catch (e: unknown) {
      actionMsg = extractErrorMessage(e, 'Failed to restore')
      addToast('error', actionMsg)
    }
    finally {
      isActionLoading = false
    }
  }

  async function handleUnlock() {
    if (!unlockConfirmUser)
      return
    isActionLoading = true
    actionMsg = ''
    try {
      // No cache invalidation needed: unlock only clears login_attempts rows and does not
      // mutate any field in TUsersData. If a lock-status field is ever added to the user
      // list API response, add appCache.invalidate({ resource: 'users' }) + invalidate('app:users') here.
      await unlockUser(unlockConfirmUser.id)
      unlockConfirmUser = null
      addToast('success', 'User account unlocked successfully')
    }
    catch (e: unknown) {
      actionMsg = extractErrorMessage(e, 'Failed to unlock account')
      addToast('error', actionMsg)
    }
    finally {
      isActionLoading = false
    }
  }

  async function handleHardDelete() {
    if (!hardDeleteConfirmUser || hardDeleteConfirmText !== 'DELETE')
      return
    isActionLoading = true
    actionMsg = ''
    try {
      await hardDeleteUser(hardDeleteConfirmUser.id, 'DELETE')
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      hardDeleteConfirmUser = null
      hardDeleteConfirmText = ''
      addToast('success', 'User permanently deleted')
    }
    catch (e: unknown) {
      actionMsg = extractErrorMessage(e, 'Failed to delete')
      addToast('error', actionMsg)
    }
    finally {
      isActionLoading = false
    }
  }
</script>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500'></div>

  <div class='mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
    <!-- Header -->
    <header class='mb-6 flex flex-wrap items-center justify-between gap-4'>
      <div>
        <p class='inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/90 mb-2'>
          <span class='h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'></span>
          Admin Panel
        </p>
        <h1 class='text-2xl font-black text-slate-50 sm:text-3xl'>User Management</h1>
        <p class='mt-1 text-xs text-slate-500'>Manage registered voters and administrators</p>
      </div>
      <div>
        <button
          onclick={() => showAddModal = true}
          class='flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition cursor-pointer'
        >
          Add User
        </button>
      </div>
    </header>

    <!-- Search & Filters -->
    <div class='mb-4 flex flex-wrap gap-3'>
      <div class='relative flex-1 min-w-[200px]'>
        <Search size={16} class='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' />
        <input
          type='text'
          placeholder='Search users…'
          bind:value={search}
          oninput={() => pageIndex = 0}
          class='w-full rounded-xl border-2 border-slate-700 bg-slate-900 py-2.5 pl-9 pr-4 text-sm font-medium text-slate-100 placeholder-slate-500 transition focus:border-sky-400 focus:outline-none'
        />
      </div>
      <label class='flex cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800'>
        <input type='checkbox' bind:checked={includeDeleted} class='h-4 w-4 accent-amber-400' />
        Show archived
      </label>
    </div>

    {#if actionMsg}
      <div class='mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{actionMsg}</div>
    {/if}

    <!-- Table -->
    <div class='overflow-hidden rounded-2xl border border-slate-800 bg-slate-900'>
      <div class='overflow-x-auto'>
        <table class='w-full text-sm'>
          <thead>
            <tr class='border-b border-slate-800 bg-slate-950/50'>
              {#each SORTABLE_KEYS as key (key)}
                <th class='px-4 py-3 text-left'>
                  <button onclick={() => toggleSort(key)} class='flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-100 cursor-pointer'>
                    {SORTABLE_LABELS[key]}
                    <ArrowUpDown size={12} />
                  </button>
                </th>
              {/each}
              <th class='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400'>Status</th>
              <th class='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each paginated as u (u.id)}
              <tr class="border-b border-slate-800/60 transition hover:bg-slate-800/30 {u.deletedAt ? 'opacity-60' : ''}">
                <td class='px-4 py-3 font-semibold text-slate-50'>{u.studentId}</td>
                <td class='px-4 py-3 font-semibold text-slate-50'>{u.firstName}</td>
                <td class='px-4 py-3 font-semibold text-slate-50'>{u.lastName}</td>
                <td class='px-4 py-3 text-slate-300'>{u.username ?? '—'}</td>
                <td class='px-4 py-3 text-slate-300'>{u.yearLevel ?? '—'}</td>
                <td class='px-4 py-3 text-slate-300'>{u.course ?? '—'}</td>
                <td class='px-4 py-3'>
                  <div class='flex flex-wrap gap-1'>
                    {#if u.deletedAt}
                      <span class='rounded bg-orange-500/80 px-2 py-0.5 text-[10px] font-bold text-white'>ARCHIVED</span>
                    {/if}
                  </div>
                </td>
                <td class='px-4 py-3'>
                  <div class='flex gap-1.5'>
                    <button onclick={() => viewUser = u} title='View' class='rounded-lg bg-slate-700 p-1.5 text-slate-200 transition hover:bg-slate-600 cursor-pointer'><Eye size={14} /></button>
                    {#if u.deletedAt}
                      <button onclick={() => restoreConfirmUser = u} title='Restore' class='rounded-lg bg-emerald-600 p-1.5 text-white transition hover:bg-emerald-500 cursor-pointer'><RotateCcw size={14} /></button>
                      {#if authStore.user?.role === 'super_admin' || (u.role !== 'admin' && u.role !== 'super_admin')}
                        <button onclick={() => { hardDeleteConfirmUser = u; hardDeleteConfirmText = '' }} title='Delete Permanently' class='rounded-lg bg-red-600 p-1.5 text-white transition hover:bg-red-500 cursor-pointer'><Trash2 size={14} /></button>
                      {/if}
                    {:else}
                      <button onclick={() => openEdit(u)} title='Edit' class='rounded-lg bg-sky-600 p-1.5 text-white transition hover:bg-sky-500 cursor-pointer'><Edit size={14} /></button>
                      <button onclick={() => archiveConfirmUser = u} title='Archive' class='rounded-lg bg-orange-600 p-1.5 text-white transition hover:bg-orange-500 cursor-pointer'><Archive size={14} /></button>
                      <button onclick={() => unlockConfirmUser = u} title='Unlock Account' class='rounded-lg bg-teal-600 p-1.5 text-white transition hover:bg-teal-500 cursor-pointer'><Unlock size={14} /></button>
                      {#if authStore.user?.role === 'super_admin' || (u.role !== 'admin' && u.role !== 'super_admin')}
                        <button onclick={() => { hardDeleteConfirmUser = u; hardDeleteConfirmText = '' }} title='Delete Permanently' class='rounded-lg bg-red-600 p-1.5 text-white transition hover:bg-red-500 cursor-pointer'><Trash2 size={14} /></button>
                      {/if}
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
            {#if paginated.length === 0}
              <tr><td colspan={8} class='h-24 text-center text-slate-500'>No users found.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class='flex items-center justify-between border-t border-slate-800 px-4 py-3'>
        <p class='text-xs text-slate-500'>{filtered.length} user(s)</p>
        <div class='flex items-center gap-2'>
          <button
            disabled={pageIndex === 0}
            onclick={() => pageIndex--}
            class='rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer'
          >←</button>
          <span class='text-sm font-semibold text-slate-100'>{pageIndex + 1} / {pageCount}</span>
          <button
            disabled={pageIndex >= pageCount - 1}
            onclick={() => pageIndex++}
            class='rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer'
          >→</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- View Modal -->
<Modal open={Boolean(viewUser)} onclose={() => viewUser = null} ariaLabelledby="view-user-title">
  <div class='mb-4 flex items-center justify-between'>
    <h3 id="view-user-title" class='text-lg font-bold text-slate-50'>User Details</h3>
  </div>
  {#if viewUser}
    <div class='space-y-2 text-sm'>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Student ID</span>
        <span class='font-semibold text-slate-50'>{viewUser.studentId}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>First Name</span>
        <span class='font-semibold text-slate-50'>{viewUser.firstName}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Last Name</span>
        <span class='font-semibold text-slate-50'>{viewUser.lastName}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Username</span>
        <span class='font-semibold text-slate-50'>{viewUser.username ?? '—'}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Email</span>
        <span class='font-semibold text-slate-50'>{viewUser.email ?? '—'}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Year Level</span>
        <span class='font-semibold text-slate-50'>{viewUser.yearLevel ?? '—'}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Course</span>
        <span class='font-semibold text-slate-50'>{viewUser.course ?? '—'}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Role</span>
        <span class='font-semibold text-slate-50'>{viewUser.role ?? '—'}</span>
      </div>
      <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
        <span class='text-slate-400'>Status</span>
        <span class='font-semibold text-slate-50'>{viewUser.deletedAt ? 'Archived' : 'Active'}</span>
      </div>
      <a
        href={`/admin/audit-log?targetType=user&targetId=${viewUser.id}`}
        class='mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition'
      >
        View Audit Trail →
      </a>
    </div>
  {/if}
</Modal>

<!-- Edit Modal -->
<Modal open={Boolean(editUser)} onclose={() => editUser = null} ariaLabelledby="edit-user-title">
  <div class='mb-4 flex items-center justify-between'>
    <h3 id="edit-user-title" class='text-lg font-bold text-slate-50'>Edit User</h3>
  </div>
  {#if editUser}
    <div class='space-y-3'>
      {#each EDIT_FIELDS as field (field)}
        <div>
          <label for={field} class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>{EDIT_LABELS[field]}</label>
          <input
            id={field}
            type='text'
            value={editForm[field]}
            oninput={e => editForm[field] = e.currentTarget.value}
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 transition focus:border-sky-400 focus:outline-none'
          />
        </div>
      {/each}
      {#if editMsg}
        <p class="text-sm {editMsg === 'Saved!' ? 'text-emerald-400' : 'text-red-400'}">{editMsg}</p>
      {/if}
      <div class='flex justify-end gap-2 pt-2'>
        <button onclick={() => editUser = null} class='rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
        <button
          onclick={handleEditSave}
          disabled={isEditSaving}
          class='flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 disabled:opacity-60 cursor-pointer'
        >
          {#if isEditSaving}<Loader class='animate-spin' size={14} />{/if}
          Save
        </button>
      </div>
    </div>
  {/if}
</Modal>

<!-- Archive Confirm -->
<Modal open={Boolean(archiveConfirmUser)} onclose={() => archiveConfirmUser = null} ariaLabelledby="archive-user-title">
  <h3 id="archive-user-title" class='mb-2 text-lg font-bold text-slate-50'>Archive User?</h3>
  {#if archiveConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>Are you sure you want to archive <span class='font-semibold text-slate-200'>{archiveConfirmUser.firstName} {archiveConfirmUser.lastName}</span>? They will no longer be able to log in.</p>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => archiveConfirmUser = null} class='rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleArchive}
        disabled={isActionLoading}
        class='flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Archive
      </button>
    </div>
  {/if}
</Modal>

<!-- Restore Confirm -->
<Modal open={Boolean(restoreConfirmUser)} onclose={() => restoreConfirmUser = null} ariaLabelledby="restore-user-title">
  <h3 id="restore-user-title" class='mb-2 text-lg font-bold text-slate-50'>Restore User?</h3>
  {#if restoreConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>Restore <span class='font-semibold text-slate-200'>{restoreConfirmUser.firstName} {restoreConfirmUser.lastName}</span> so they can log in again.</p>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => restoreConfirmUser = null} class='rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleRestore}
        disabled={isActionLoading}
        class='flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Restore
      </button>
    </div>
  {/if}
</Modal>

<!-- Unlock Confirm -->
<Modal open={Boolean(unlockConfirmUser)} onclose={() => unlockConfirmUser = null} ariaLabelledby="unlock-user-title">
  <h3 id="unlock-user-title" class='mb-2 text-lg font-bold text-slate-50'>Unlock User Account?</h3>
  {#if unlockConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>Unlock the account for <span class='font-semibold text-slate-200'>{unlockConfirmUser.firstName} {unlockConfirmUser.lastName}</span> to reset their password lockout login attempts.</p>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => unlockConfirmUser = null} class='rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleUnlock}
        disabled={isActionLoading}
        class='flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Unlock Account
      </button>
    </div>
  {/if}
</Modal>

<!-- Hard Delete Confirm -->
<Modal open={Boolean(hardDeleteConfirmUser)} onclose={() => { hardDeleteConfirmUser = null; hardDeleteConfirmText = '' }} ariaLabelledby="hard-delete-user-title">
  <h3 id="hard-delete-user-title" class='mb-2 text-lg font-bold text-slate-50'>⚠️ Permanently Delete User?</h3>
  {#if hardDeleteConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>This will permanently delete <span class='font-semibold text-slate-200'>{hardDeleteConfirmUser.firstName} {hardDeleteConfirmUser.lastName}</span> and cannot be undone.</p>
    <p class='mb-4 text-xs text-slate-500'>This action removes: account credentials, user profile, and all active sessions.</p>
    <div class='mb-4'>
      <label for='hard-delete-confirm' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Type DELETE to confirm</label>
      <input
        id='hard-delete-confirm'
        type='text'
        bind:value={hardDeleteConfirmText}
        placeholder='DELETE'
        class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 transition focus:border-red-400 focus:outline-none'
      />
    </div>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => { hardDeleteConfirmUser = null; hardDeleteConfirmText = '' }} class='rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleHardDelete}
        disabled={isActionLoading || hardDeleteConfirmText !== 'DELETE'}
        class='flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Delete Permanently
      </button>
    </div>
  {/if}
</Modal>

<!-- Add User Modal -->
<Modal open={showAddModal} onclose={closeAddModal} ariaLabelledby="add-user-title">
  <div class='mb-4 flex items-center justify-between'>
    <h3 id="add-user-title" class='text-lg font-bold text-slate-50'>Add New User</h3>
  </div>
  {#if addSuccessDetails}
    <div class='space-y-4'>
      <div class='p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm font-semibold'>
        User created successfully! Please copy the credentials below.
      </div>
      <div class='space-y-2 text-sm'>
        <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
          <span class='text-slate-400'>Username</span>
          <span class='font-mono font-semibold text-slate-50 select-all'>{addSuccessDetails.username}</span>
        </div>
        <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
          <span class='text-slate-400'>Password</span>
          <span class='font-mono font-semibold text-slate-50 select-all'>{addSuccessDetails.password}</span>
        </div>
      </div>
      <div class='flex justify-end pt-2'>
        <button onclick={closeAddModal} class='rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 cursor-pointer'>
          Done
        </button>
      </div>
    </div>
  {:else}
    <form onsubmit={handleAddSave} class='space-y-3.5'>
      <div class='grid grid-cols-2 gap-3.5'>
        <div>
          <label for='add-studentId' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Student ID</label>
          <input
            id='add-studentId'
            type='text'
            bind:value={addForm.studentId}
            placeholder='CXX-XX-XXXX-XXX123'
            required
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none'
          />
        </div>
        <div>
          <label for='add-role' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Role</label>
          {#if authStore.user?.role === 'super_admin'}
            <select
              id='add-role'
              bind:value={addForm.role}
              required
              class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none cursor-pointer'
            >
              <option value={UserRole.USER}>Voter (User)</option>
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
            </select>
          {:else}
            <input
              id='add-role-display'
              type='text'
              value='Voter (User)'
              disabled
              class='w-full rounded-xl border-2 border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-400 focus:outline-none opacity-60'
            />
          {/if}
        </div>
      </div>

      <div class='grid grid-cols-2 gap-3.5'>
        <div>
          <label for='add-firstName' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>First Name</label>
          <input
            id='add-firstName'
            type='text'
            bind:value={addForm.firstName}
            required
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none'
          />
        </div>
        <div>
          <label for='add-lastName' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Last Name</label>
          <input
            id='add-lastName'
            type='text'
            bind:value={addForm.lastName}
            required
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none'
          />
        </div>
      </div>

      <div class='grid grid-cols-2 gap-3.5'>
        <div>
          <label for='add-course' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Course</label>
          <select
            id='add-course'
            bind:value={addForm.course}
            required
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none cursor-pointer'
          >
            <option value=''>Select Course</option>
            {#each COURSE_VALUES as c (c)}
              <option value={c}>{c}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for='add-yearLevel' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Year Level</label>
          <select
            id='add-yearLevel'
            bind:value={addForm.yearLevel}
            required
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none cursor-pointer'
          >
            <option value=''>Select Year</option>
            {#each YEAR_LEVEL_VALUES as y (y)}
              <option value={y}>{y}</option>
            {/each}
          </select>
        </div>
      </div>

      <div>
        <label for='add-username' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Username <span class='text-[10px] font-normal text-slate-500'>(Optional - auto-generated if blank)</span></label>
        <input
          id='add-username'
          type='text'
          bind:value={addForm.username}
          placeholder='username'
          class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none'
        />
      </div>

      <div>
        <label for='add-email' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Email <span class='text-[10px] font-normal text-slate-500'>(Optional)</span></label>
        <input
          id='add-email'
          type='email'
          bind:value={addForm.email}
          placeholder='email@example.com'
          class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none'
        />
      </div>

      <div>
        <label for='add-password' class='mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'>Password</label>
        <div class='flex gap-2'>
          <div class='relative flex-1'>
            <input
              id='add-password'
              type={addFormVisiblePassword ? 'text' : 'password'}
              bind:value={addForm.password}
              placeholder='Min 8 chars'
              required
              class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none pr-10'
            />
            <button
              type='button'
              onclick={() => addFormVisiblePassword = !addFormVisiblePassword}
              class='absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 cursor-pointer'
            >
              {#if addFormVisiblePassword}
                <EyeOff size={16} />
              {:else}
                <Eye size={16} />
              {/if}
            </button>
          </div>
          <button
            type='button'
            onclick={generatePassword}
            class='rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer'
          >
            Generate
          </button>
        </div>
      </div>

      {#if addMsg}
        <p class='text-sm text-red-400'>{addMsg}</p>
      {/if}

      <div class='flex justify-end gap-2 pt-2'>
        <button type='button' onclick={closeAddModal} class='rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
        <button
          type='submit'
          disabled={isAddSaving}
          class='flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 disabled:opacity-60 cursor-pointer'
        >
          {#if isAddSaving}<Loader class='animate-spin' size={14} />{/if}
          Create
        </button>
      </div>
    </form>
  {/if}
</Modal>

