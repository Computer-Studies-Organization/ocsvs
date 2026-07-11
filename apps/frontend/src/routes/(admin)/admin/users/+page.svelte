<script lang='ts'>
  import type { TUsersData } from '$lib/types'
  import { goto, invalidate } from '$app/navigation'
  import { deleteUser, hardDeleteUser, restoreUser, updateUser } from '$lib/api/users'
  import { authStore } from '$lib/stores/auth'
  import { appCache } from '$lib/cache'
  import {
    Archive,
    ArrowUpDown,
    Edit,
    Eye,
    Loader,
    RotateCcw,
    Search,
    Trash2,
    X,
  } from 'lucide-svelte'
  import { addToast } from '$lib/stores/toast'

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

  let { data } = $props()
  let users = $derived<TUsersData[]>(data.users)
  // svelte-ignore state_referenced_locally
  let includeDeleted = $state(data.includeDeleted)

  $effect(() => {
    includeDeleted = data.includeDeleted
  })

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
  let hardDeleteConfirmUser = $state<TUsersData | null>(null)
  let hardDeleteConfirmText = $state('')
  let isActionLoading = $state(false)
  let actionMsg = $state('')

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
    pageIndex = 0
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
      setTimeout(() => {
        editUser = null
      }, 800)
    }
    catch (e: any) {
      editMsg = e.message || 'Failed to save'
      addToast('error', e.message || 'Failed to save')
    }
    finally {
      isEditSaving = false
    }
  }

  async function handleArchive() {
    if (!archiveConfirmUser)
      return
    isActionLoading = true
    try {
      await deleteUser(archiveConfirmUser.id)
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      archiveConfirmUser = null
      addToast('success', 'User archived')
    }
    catch (e: any) {
      actionMsg = e.message || 'Failed to archive'
      addToast('error', e.message || 'Failed to archive')
    }
    finally {
      isActionLoading = false
    }
  }

  async function handleRestore() {
    if (!restoreConfirmUser)
      return
    isActionLoading = true
    try {
      await restoreUser(restoreConfirmUser.id)
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      restoreConfirmUser = null
      addToast('success', 'User restored')
    }
    catch (e: any) {
      actionMsg = e.message || 'Failed to restore'
      addToast('error', e.message || 'Failed to restore')
    }
    finally {
      isActionLoading = false
    }
  }

  async function handleHardDelete() {
    if (!hardDeleteConfirmUser || hardDeleteConfirmText !== 'DELETE')
      return
    isActionLoading = true
    try {
      await hardDeleteUser(hardDeleteConfirmUser.id, 'DELETE')
      appCache.invalidate({ resource: 'users' })
      await invalidate('app:users')
      hardDeleteConfirmUser = null
      hardDeleteConfirmText = ''
      addToast('success', 'User permanently deleted')
    }
    catch (e: any) {
      actionMsg = e.message || 'Failed to delete'
      addToast('error', e.message || 'Failed to delete')
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
                      {#if $authStore.user?.user.role === 'super_admin' || (u.role !== 'admin' && u.role !== 'super_admin')}
                        <button onclick={() => { hardDeleteConfirmUser = u; hardDeleteConfirmText = '' }} title='Delete Permanently' class='rounded-lg bg-red-600 p-1.5 text-white transition hover:bg-red-500 cursor-pointer'><Trash2 size={14} /></button>
                      {/if}
                    {:else}
                      <button onclick={() => openEdit(u)} title='Edit' class='rounded-lg bg-sky-600 p-1.5 text-white transition hover:bg-sky-500 cursor-pointer'><Edit size={14} /></button>
                      <button onclick={() => archiveConfirmUser = u} title='Archive' class='rounded-lg bg-orange-600 p-1.5 text-white transition hover:bg-orange-500 cursor-pointer'><Archive size={14} /></button>
                      {#if $authStore.user?.user.role === 'super_admin' || (u.role !== 'admin' && u.role !== 'super_admin')}
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
{#if viewUser}
  <div class='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
    <div class='w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl'>
      <div class='mb-4 flex items-center justify-between'>
        <h3 class='text-lg font-bold text-slate-50'>User Details</h3>
        <button onclick={() => viewUser = null} class='rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer'><X size={18} /></button>
      </div>
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
    </div>
  </div>
{/if}
{#if editUser}
  <div class='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
    <div class='w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl'>
      <div class='mb-4 flex items-center justify-between'>
        <h3 class='text-lg font-bold text-slate-50'>Edit User</h3>
        <button onclick={() => editUser = null} class='rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer'><X size={18} /></button>
      </div>
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
    </div>
  </div>
{/if}

<!-- Archive Confirm -->
{#if archiveConfirmUser}
  <div class='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
    <div class='w-full max-w-sm rounded-2xl border border-orange-800/40 bg-slate-900 p-6 shadow-2xl'>
      <h3 class='mb-2 text-lg font-bold text-slate-50'>Archive User?</h3>
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
    </div>
  </div>
{/if}

<!-- Restore Confirm -->
{#if restoreConfirmUser}
  <div class='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
    <div class='w-full max-w-sm rounded-2xl border border-emerald-800/40 bg-slate-900 p-6 shadow-2xl'>
      <h3 class='mb-2 text-lg font-bold text-slate-50'>Restore User?</h3>
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
    </div>
  </div>
{/if}

<!-- Hard Delete Confirm -->
{#if hardDeleteConfirmUser}
  <div class='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
    <div class='w-full max-w-sm rounded-2xl border border-red-800/40 bg-slate-900 p-6 shadow-2xl'>
      <h3 class='mb-2 text-lg font-bold text-slate-50'>⚠️ Permanently Delete User?</h3>
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
    </div>
  </div>
{/if}
