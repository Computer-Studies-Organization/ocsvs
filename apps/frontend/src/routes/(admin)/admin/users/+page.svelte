<script lang='ts'>
  import { isStudentId } from '@cso-voting/student-csv-parser'
  import { type TCourse, type TUsersData, type TYearLevel, YEAR_LEVEL_VALUES, COURSE_VALUES, UserRole } from '$lib/types'
  import { goto, invalidate } from '$app/navigation'
  import { onDestroy, untrack } from 'svelte'
  import { deleteUser, hardDeleteUser, restoreUser, updateUser, createUser, unlockUser, resetUserPassword } from '$lib/api/users'
  import { authStore } from '$lib/stores/auth.svelte'
  import { appCache } from '$lib/cache'
  import { slide } from 'svelte/transition'
  import {
    Archive,
    ArrowUpDown,
    Copy,
    Edit,
    Eye,
    EyeOff,
    KeyRound,
    Loader,
    MoreHorizontal,
    Plus,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Trash2,
    Unlock,
    Upload,
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

  const SORTABLE_LABELS_COMPACT: Record<SortableKey, string> = {
    studentId: 'ID',
    firstName: 'First',
    lastName: 'Last',
    username: 'User',
    yearLevel: 'Year',
    course: 'Course',
  }

  const ROLE_BADGE: Record<string, { label: string; pillCls: string; textCls: string }> = {
    user: { label: 'VOTER', pillCls: 'bg-sky-500/15', textCls: 'text-sky-300' },
    admin: { label: 'ADMIN', pillCls: 'bg-violet-500/15', textCls: 'text-violet-300' },
    super_admin: { label: 'S.ADMIN', pillCls: 'bg-amber-500/15', textCls: 'text-amber-300' },
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
  const usersResponse = $derived(data.usersResponse)
  const users = $derived(usersResponse.data)
  const total = $derived(usersResponse.meta.total)
  const pageCount = $derived(usersResponse.meta.totalPages)
  const currentPage = $derived(data.page)
  const includeDeleted = $derived(data.includeDeleted)

  // svelte-ignore state_referenced_locally
  let localSearch = $state(data.search)
  let sortKey = $state<SortableKey>('studentId')
  let sortAsc = $state(true)
  let isFilterExpanded = $state(false)
  let searchTimeoutId: any

  // Modals
  let viewUser = $state<TUsersData | null>(null)
  let pendingViewAction = $state<(() => void) | null>(null)
  let editUser = $state<TUsersData | null>(null)
  let editForm = $state<EditForm>({ firstName: '', lastName: '', username: '', email: '', yearLevel: '', course: '' })
  let isEditSaving = $state(false)
  let editMsg = $state('')
  let archiveConfirmUser = $state<TUsersData | null>(null)
  let restoreConfirmUser = $state<TUsersData | null>(null)
  let unlockConfirmUser = $state<TUsersData | null>(null)
  let resetPasswordUser = $state<TUsersData | null>(null)
  let resetPasswordInput = $state('')
  let resetPasswordVisible = $state(false)
  let isResetSaving = $state(false)
  let resetMsg = $state('')
  let resetSuccessDetails = $state<{ studentId: string; username: string; password: string } | null>(null)
  let hardDeleteConfirmUser = $state<TUsersData | null>(null)
  let hardDeleteConfirmText = $state('')
  let isActionLoading = $state(false)
  let actionMsg = $state('')
  let editTimeoutId: any
  let showSortMenu = $state(false)
  let activeDropdownUserId = $state<string | null>(null)
  let activeDropdownUser = $state<TUsersData | null>(null)
  let dropdownPosition = $state({ top: 0, left: 0 })

  function openDropdown(u: TUsersData, e: MouseEvent) {
    e.stopPropagation()
    if (activeDropdownUserId === u.id) {
      activeDropdownUserId = null
      activeDropdownUser = null
    } else {
      activeDropdownUserId = u.id
      activeDropdownUser = u
      const rect = e.currentTarget ? (e.currentTarget as HTMLElement).getBoundingClientRect() : null
      if (rect) {
        dropdownPosition = {
          top: rect.bottom + window.scrollY + 6,
          left: rect.right + window.scrollX - 192
        }
      }
    }
  }

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

    if (!isStudentId(addForm.studentId)) {
      addMsg = 'Invalid Student ID format (e.g. C25-01-10306-MAN121 or A25-01-1240-MAN121)'
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

  const activeFiltersCount = $derived(
    (data.course ? 1 : 0) + 
    (data.yearLevel ? 1 : 0) + 
    (data.role ? 1 : 0)
  )

  function clearFilters() {
    localSearch = ''
    updateFilters({
      search: '',
      course: '',
      yearLevel: '',
      role: '',
      page: 1,
    })
  }

  function updateFilters(newParams: Partial<{ page: number; search: string; course: string; yearLevel: string; role: string; archived: boolean }>) {
    activeDropdownUserId = null
    activeDropdownUser = null
    const url = new URL(window.location.href)
    
    // Page
    if (newParams.page !== undefined) {
      url.searchParams.set('page', String(newParams.page))
    } else if (
      newParams.search !== undefined || 
      newParams.course !== undefined || 
      newParams.yearLevel !== undefined || 
      newParams.role !== undefined || 
      newParams.archived !== undefined
    ) {
      url.searchParams.set('page', '1')
    }

    // Search
    const searchVal = newParams.search !== undefined ? newParams.search : localSearch
    if (searchVal.trim()) {
      url.searchParams.set('search', searchVal.trim())
    } else {
      url.searchParams.delete('search')
    }

    // Course
    const courseVal = newParams.course !== undefined ? newParams.course : data.course
    if (courseVal) {
      url.searchParams.set('course', courseVal)
    } else {
      url.searchParams.delete('course')
    }

    // Year Level
    const yearVal = newParams.yearLevel !== undefined ? newParams.yearLevel : data.yearLevel
    if (yearVal) {
      url.searchParams.set('yearLevel', yearVal)
    } else {
      url.searchParams.delete('yearLevel')
    }

    // Role
    const roleVal = newParams.role !== undefined ? newParams.role : data.role
    if (roleVal) {
      url.searchParams.set('role', roleVal)
    } else {
      url.searchParams.delete('role')
    }

    // Archived
    const archivedVal = newParams.archived !== undefined ? newParams.archived : includeDeleted
    if (archivedVal) {
      url.searchParams.set('archived', 'true')
    } else {
      url.searchParams.delete('archived')
    }

    goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true })
  }

  function handleSearchInput(e: Event) {
    const val = (e.currentTarget as HTMLInputElement).value
    localSearch = val
    if (searchTimeoutId) clearTimeout(searchTimeoutId)
    searchTimeoutId = setTimeout(() => {
      updateFilters({ search: val })
    }, 300)
  }

  $effect(() => {
    localSearch = data.search
  })

  // Derived sorted list from paginated data
  const paginated = $derived.by(() => {
    return [...users].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  })

  $effect(() => {
    // Reset open dropdown when paginated data or sortKey/sortAsc changes
    const _ = paginated
    activeDropdownUserId = null
    activeDropdownUser = null
  })

  onDestroy(() => {
    if (editTimeoutId) {
      clearTimeout(editTimeoutId)
    }
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId)
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

  function runPendingViewAction() {
    const action = pendingViewAction
    pendingViewAction = null
    action?.()
  }

  function queueMobileAction(action: () => void) {
    pendingViewAction = action
    viewUser = null
  }

  function startMobileEdit(u: TUsersData) {
    queueMobileAction(() => openEdit(u))
  }

  function startMobileArchive(u: TUsersData) {
    queueMobileAction(() => archiveConfirmUser = u)
  }

  function startMobileRestore(u: TUsersData) {
    queueMobileAction(() => restoreConfirmUser = u)
  }

  function startMobileUnlock(u: TUsersData) {
    queueMobileAction(() => unlockConfirmUser = u)
  }

  function startMobileResetPassword(u: TUsersData) {
    queueMobileAction(() => openResetPassword(u))
  }

  function generateResetPassword() {
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
    resetPasswordInput = pass
    resetPasswordVisible = true
  }

  function clearResetPasswordState() {
    resetPasswordInput = ''
    resetPasswordVisible = false
    resetMsg = ''
    resetSuccessDetails = null
    isResetSaving = false
  }

  function openResetPassword(u: TUsersData) {
    clearResetPasswordState()
    resetPasswordUser = u
  }

  function closeResetModal() {
    if (isResetSaving) return
    clearResetPasswordState()
    resetPasswordUser = null
  }

  async function handleResetPasswordSave() {
    if (!resetPasswordUser) return
    const userId = resetPasswordUser.id
    const password = resetPasswordInput.trim()
    if (password && password.length < 8) {
      resetMsg = 'Password must be at least 8 characters'
      return
    }

    isResetSaving = true
    resetMsg = ''
    try {
      const res = await resetUserPassword(userId, {
        password: password || undefined,
      })
      resetSuccessDetails = res.credentials
      addToast('success', 'Password reset successfully')
    } catch (e: unknown) {
      resetMsg = extractErrorMessage(e, 'Failed to reset password')
      addToast('error', resetMsg)
    } finally {
      isResetSaving = false
    }
  }

  async function copyResetCredentials() {
    if (!resetSuccessDetails) return
    const textToCopy = `Student ID: ${resetSuccessDetails.studentId}\nUsername: ${resetSuccessDetails.username}\nPassword: ${resetSuccessDetails.password}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      addToast('success', 'Credentials copied to clipboard')
    } catch {
      addToast('error', 'Failed to copy credentials')
    }
  }

  function startMobileHardDelete(u: TUsersData) {
    queueMobileAction(() => {
      hardDeleteConfirmUser = u
      hardDeleteConfirmText = ''
    })
  }

  // Mobile/desktop view tabs state
  import { fetchAuditLog, type AuditLogEntry } from '$lib/api/audit-log'

  let activeTab = $state<'overview' | 'access' | 'audit'>('overview')
  let isDangerZoneExpanded = $state(false)
  let showMoreMenu = $state(false)

  let userAuditLogs = $state<AuditLogEntry[]>([])
  let isAuditLoading = $state(false)
  let auditError = $state('')
  let auditRequestId = 0

  async function loadUserAuditLogs(userId: string) {
    const requestId = ++auditRequestId
    isAuditLoading = true
    auditError = ''
    try {
      const res = await fetchAuditLog({ targetType: 'user', targetId: userId, limit: 10 })
      if (requestId !== auditRequestId) return
      userAuditLogs = res.items
    } catch (e: any) {
      if (requestId !== auditRequestId) return
      auditError = e.message || 'Failed to load activity logs'
    } finally {
      if (requestId === auditRequestId) {
        isAuditLoading = false
      }
    }
  }

  $effect(() => {
    if (viewUser) {
      loadUserAuditLogs(viewUser.id)
      activeTab = 'overview'
      isDangerZoneExpanded = false
      showMoreMenu = false
    }
  })

  $effect(() => {
    if (!showMoreMenu) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target?.closest('.more-menu-container')) {
        showMoreMenu = false
      }
    }
    window.addEventListener('click', handleOutsideClick, true)
    return () => window.removeEventListener('click', handleOutsideClick, true)
  })

  $effect(() => {
    if (!showSortMenu) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target?.closest('.sort-menu-container')) {
        showSortMenu = false
      }
    }
    window.addEventListener('click', handleOutsideClick, true)
    return () => window.removeEventListener('click', handleOutsideClick, true)
  })

  function formatAuditTime(unixSeconds: number): string {
    const date = new Date(unixSeconds * 1000)
    const now = new Date()
    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear()
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    if (isToday) {
      return `Today · ${timeStr}`
    }
    const monthStr = date.toLocaleDateString([], { month: 'short' })
    const dayStr = date.getDate()
    return `${monthStr} ${dayStr} · ${timeStr}`
  }

  function getAuditDisplay(entry: AuditLogEntry) {
    let title = ''
    let subtitle = ''
    switch (entry.action) {
      case 'user.create':
        title = 'User profile created'
        subtitle = entry.description || 'Account was created.'
        break
      case 'user.unlock':
        title = 'Account unlocked'
        subtitle = `Performed by ${entry.actorUsernameSnapshot}.`
        break
      case 'user.reset_password':
        title = 'Password reset'
        subtitle = entry.description || `Performed by ${entry.actorUsernameSnapshot}.`
        break
      case 'user.soft_delete':
        title = 'Account archived'
        subtitle = `Performed by ${entry.actorUsernameSnapshot}.`
        break
      case 'user.restore':
        title = 'Account restored'
        subtitle = `Performed by ${entry.actorUsernameSnapshot}.`
        break
      case 'user.hard_delete':
        title = 'Account permanently deleted'
        subtitle = entry.description || `Performed by ${entry.actorUsernameSnapshot}.`
        break
      case 'user.bulk_import':
        title = 'Users imported'
        subtitle = entry.description || 'Bulk imported student records.'
        break
      case 'user.update':
        if (entry.description) {
          if (entry.description.toLowerCase().includes('role')) {
            title = 'Role changed'
            subtitle = entry.description
          } else {
            title = 'Profile updated'
            subtitle = entry.description
          }
        } else {
          title = 'User updated'
          subtitle = `Performed by ${entry.actorUsernameSnapshot}.`
        }
        break
      default:
        title = entry.action.replace('_', ' ').replace('.', ': ')
        title = title.charAt(0).toUpperCase() + title.slice(1)
        subtitle = entry.description || `Performed by ${entry.actorUsernameSnapshot}.`
    }
    if (entry.description && entry.description.includes('changed to')) {
      const parts = entry.description.split(' - ')
      if (parts.length > 1) {
        title = parts[0]
        subtitle = parts[1]
      }
    }
    return { title, subtitle }
  }
</script>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500'></div>

  <div class='w-full mx-auto max-w-7xl px-4 pt-6 pb-24 md:pb-6 sm:px-6 lg:px-8'>
    <!-- Header -->
    <header class='mb-6 flex flex-wrap items-center justify-between gap-4'>
      <div>
        <h1 class='text-2xl font-black text-slate-50 sm:text-3xl'>User Management</h1>
        <p class='mt-1 text-xs text-slate-500'>Manage registered voters and administrators</p>
      </div>
      <div class='flex items-center gap-3'>
        <a
          href='/admin/users/import'
          class='flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-sm hover:border-slate-600 hover:bg-slate-800 hover:text-white transition'
        >
          <Upload size={16} />
          Import Students
        </a>
        <button
          onclick={() => showAddModal = true}
          class='hidden md:flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition cursor-pointer'
        >
          <Plus size={16} />
          Add User
        </button>
      </div>
    </header>

    <!-- Search & Filters -->
    <div class='mb-4 flex flex-col gap-3 sm:flex-row'>
      <div class='relative flex-1 min-w-0'>
        <Search size={16} class='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' />
        <input
          type='text'
          placeholder='Search name, student ID, username…'
          value={localSearch}
          oninput={handleSearchInput}
          class='min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-900 py-2.5 pl-9 pr-4 text-sm font-medium text-slate-100 placeholder-slate-500 transition focus:border-sky-400 focus:outline-none'
        />
      </div>

      <div class='flex flex-nowrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto'>
        <!-- Filters toggle button -->
        <button
          type='button'
          onclick={() => isFilterExpanded = !isFilterExpanded}
          class='min-h-11 flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-100 transition cursor-pointer relative transition-all whitespace-nowrap {isFilterExpanded ? 'border-sky-500 bg-sky-950/20 shadow-[0_0_12px_rgba(14,165,233,0.15)] text-sky-200' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800'}'
        >
          <SlidersHorizontal size={14} class={activeFiltersCount > 0 ? 'text-sky-400' : 'text-slate-400'} />
          <span>Filters</span>
          {#if activeFiltersCount > 0}
            <span class='flex h-4.5 w-4.5 items-center justify-center rounded-full bg-sky-950 border border-sky-500/30 text-[10px] font-black text-sky-400 shrink-0'>
              {activeFiltersCount}
            </span>
          {/if}
        </button>

        <!-- Sort Dropdown Trigger (Visible on all sizes) -->
        <div class='relative sort-menu-container flex-1 sm:flex-none'>
          <button
            type='button'
            onclick={() => showSortMenu = !showSortMenu}
            class='min-h-11 w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-800 px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-100 transition cursor-pointer whitespace-nowrap'
          >
            <ArrowUpDown size={14} class='text-slate-400 shrink-0' />
            <span>Sort: <span class='text-slate-300'><span class='hidden sm:inline'>{SORTABLE_LABELS[sortKey]}</span><span class='inline sm:hidden'>{SORTABLE_LABELS_COMPACT[sortKey]}</span></span></span>
            <span class='text-[10px] uppercase font-black text-sky-400 shrink-0 ml-0.5'>{sortAsc ? 'Asc' : 'Desc'}</span>
          </button>

          {#if showSortMenu}
            <div class='absolute right-0 top-full mt-2 z-30 w-52 rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-xl flex flex-col gap-1'>
              <div class='px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-900 mb-1'>Sort Field</div>
              {#each SORTABLE_KEYS as key (key)}
                <button
                  type='button'
                  onclick={() => {
                    if (sortKey === key) {
                      sortAsc = !sortAsc
                    } else {
                      sortKey = key
                      sortAsc = true
                    }
                    showSortMenu = false
                  }}
                  class='min-h-11 w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer {sortKey === key ? 'bg-sky-500/10 text-sky-300' : 'text-slate-200 hover:bg-slate-900'}'
                >
                  <span>{SORTABLE_LABELS[key]}</span>
                  {#if sortKey === key}
                    <span class='text-[10px] uppercase font-bold text-sky-400'>{sortAsc ? 'Asc' : 'Desc'}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Vertical Divider -->
        <div class='h-6 w-px bg-slate-800 self-center shrink-0'></div>

        <!-- Archived Checkbox Button -->
          <button
            type='button'
            onclick={() => updateFilters({ archived: !includeDeleted })}
          class='min-h-11 flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-800 px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-100 transition cursor-pointer whitespace-nowrap'
        >
          <!-- Custom styled checkbox checkmark box -->
          <div class='flex h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0 items-center justify-center rounded border transition-colors {includeDeleted ? 'bg-sky-500 border-sky-400 text-white' : 'border-slate-600 bg-slate-950 text-transparent'}'>
            <svg class='h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path stroke-linecap='round' stroke-linejoin='round' d='M4.5 12.75l6 6 9-13.5' />
            </svg>
          </div>
          <span>Archived</span>
        </button>
      </div>
    </div>

    <!-- Active Filter Pills (Tags) -->
    {#if data.search || data.course || data.yearLevel || data.role}
      <div class='mb-4 flex flex-wrap gap-2 items-center'>
        {#if data.search}
          <button
            type='button'
            onclick={() => updateFilters({ search: '' })}
            class='min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group'
          >
            <span>Search: "{data.search}"</span>
            <X size={12} class='text-slate-500 group-hover:text-slate-300 transition' />
          </button>
        {/if}

        {#if data.course}
          <button
            type='button'
            onclick={() => updateFilters({ course: '' })}
            class='min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group'
          >
            <span>Course: {data.course}</span>
            <X size={12} class='text-slate-500 group-hover:text-slate-300 transition' />
          </button>
        {/if}

        {#if data.yearLevel}
          <button
            type='button'
            onclick={() => updateFilters({ yearLevel: '' })}
            class='min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group'
          >
            <span>Year: {data.yearLevel}</span>
            <X size={12} class='text-slate-500 group-hover:text-slate-300 transition' />
          </button>
        {/if}

        {#if data.role}
          <button
            type='button'
            onclick={() => updateFilters({ role: '' })}
            class='min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group'
          >
            <span>Role: {data.role === 'user' ? 'Voter' : data.role === 'admin' ? 'Admin' : 'Super Admin'}</span>
            <X size={12} class='text-slate-500 group-hover:text-slate-300 transition' />
          </button>
        {/if}
      </div>
    {/if}

    {#if isFilterExpanded}
      <div 
        transition:slide={{ duration: 200 }} 
        class='mb-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md relative overflow-hidden'
      >
        <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/20 via-orange-400/40 to-rose-500/20"></div>

        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400">Filter Voters</h3>
          {#if activeFiltersCount > 0}
            <button 
              onclick={clearFilters}
              class="min-h-11 text-xs font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer flex items-center gap-1"
            >
              Clear Filters
            </button>
          {/if}
        </div>

        <div class='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <div>
            <label for='filter-course' class='mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400'>Course</label>
            <select
              id='filter-course'
              value={data.course}
              onchange={(e) => updateFilters({ course: e.currentTarget.value })}
              class='min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer'
            >
              <option value=''>All Courses</option>
              <option value='BSCS'>BSCS (BS Computer Science)</option>
              <option value='BSIT'>BSIT (BS Information Technology)</option>
              <option value='WADT'>WADT (Web Application Development)</option>
            </select>
          </div>

          <div>
            <label for='filter-yearLevel' class='mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400'>Year Level</label>
            <select
              id='filter-yearLevel'
              value={data.yearLevel}
              onchange={(e) => updateFilters({ yearLevel: e.currentTarget.value })}
              class='min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer'
            >
              <option value=''>All Years</option>
              {#each YEAR_LEVEL_VALUES as y}
                <option value={y}>{y}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for='filter-role' class='mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400'>Role</label>
            <select
              id='filter-role'
              value={data.role}
              onchange={(e) => updateFilters({ role: e.currentTarget.value })}
              class='min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer'
            >
              <option value=''>All Roles</option>
              <option value='user'>Voter</option>
              <option value='admin'>Admin</option>
              <option value='super_admin'>Super Admin</option>
            </select>
          </div>
        </div>
      </div>
    {/if}

    {#if actionMsg}
      <div class='mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{actionMsg}</div>
    {/if}

    <!-- Table -->
    <div class='overflow-hidden rounded-2xl border border-slate-800 bg-slate-900'>
      <!-- Desktop Table -->
      <div class='hidden md:block overflow-x-auto'>
        <table class='w-full text-sm'>
          <thead>
            <tr class='border-b border-slate-800 bg-slate-950/50'>
              <th class='sticky left-0 z-10 bg-slate-950/80 px-4 py-3 text-left shadow-[1px_0_0_0_#334155]'>
                <button onclick={() => toggleSort('studentId')} class='min-h-11 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-100 cursor-pointer'>
                  {SORTABLE_LABELS['studentId']}
                  <ArrowUpDown size={12} />
                </button>
              </th>
              {#each SORTABLE_KEYS.slice(1) as key (key)}
                <th class='px-4 py-3 text-left'>
                  <button onclick={() => toggleSort(key)} class='min-h-11 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-100 cursor-pointer'>
                    {SORTABLE_LABELS[key]}
                    <ArrowUpDown size={12} />
                  </button>
                </th>
              {/each}
              <th class='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400'>Status</th>
              <th class='px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-20'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each paginated as u (u.id)}
              <tr class="border-b border-slate-800/60 transition hover:bg-slate-800/30">
                <td class="sticky left-0 z-10 whitespace-nowrap px-4 py-3 font-semibold text-slate-50 shadow-[1px_0_0_0_#334155] {u.deletedAt ? 'bg-slate-900/60 opacity-60' : 'bg-slate-900'}">{u.studentId}</td>
                <td class='px-4 py-3 font-semibold text-slate-50 {u.deletedAt ? "opacity-60" : ""}'>{u.firstName}</td>
                <td class='px-4 py-3 font-semibold text-slate-50 {u.deletedAt ? "opacity-60" : ""}'>{u.lastName}</td>
                <td class='px-4 py-3 text-slate-300 {u.deletedAt ? "opacity-60" : ""}'>{u.username ?? '—'}</td>
                <td class='px-4 py-3 text-slate-300 {u.deletedAt ? "opacity-60" : ""}'>{u.yearLevel ?? '—'}</td>
                <td class='px-4 py-3 text-slate-300 {u.deletedAt ? "opacity-60" : ""}'>{u.course ?? '—'}</td>
                <td class='px-4 py-3 {u.deletedAt ? "opacity-60" : ""}'>
                  <div class='flex flex-wrap gap-1'>
                    {#if ROLE_BADGE[u.role]}
                      <span class="inline-flex items-center gap-1 rounded {ROLE_BADGE[u.role].pillCls} px-2 py-0.5 whitespace-nowrap">
                        <span class="h-1.5 w-1.5 rounded-full {u.deletedAt ? 'bg-orange-400' : 'bg-emerald-400'}"></span>
                        <span class="text-[10px] font-bold {ROLE_BADGE[u.role].textCls}">{ROLE_BADGE[u.role].label}</span>
                      </span>
                    {/if}
                  </div>
                </td>
                <td class='px-4 py-3'>
                  <button
                    type='button'
                    onclick={(e) => openDropdown(u, e)}
                    title='Actions'
                    aria-label="Actions for {u.firstName} {u.lastName}"
                    class='flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition cursor-pointer border border-slate-700/50'
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            {/each}
            {#if paginated.length === 0}
              <tr><td colspan={8} class='h-24 text-center text-slate-500'>No users found.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Mobile List -->
      <div class='block md:hidden divide-y divide-slate-800 bg-slate-900'>
        {#each paginated as u (u.id)}
          <button
            onclick={() => viewUser = u}
            class="w-full text-left p-4 hover:bg-slate-800/30 transition-colors focus:outline-none focus:bg-slate-800/40 focus:ring-1 focus:ring-sky-500/50 flex items-center justify-between gap-4 {u.deletedAt ? 'opacity-60' : ''}"
          >
            <div class='min-w-0 flex-1'>
              <div class='flex items-center gap-2 flex-wrap'>
                <span class='text-sm font-bold text-slate-50 truncate'>{u.firstName} {u.lastName}</span>
                {#if u.deletedAt}
                  <span class='inline-flex items-center rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-400'>
                    ARCHIVED
                  </span>
                {/if}
              </div>
              <p class='mt-1 text-xs text-slate-400 font-mono'>{u.studentId}</p>
            </div>
            <div class='flex flex-col items-end gap-1.5 shrink-0'>
              {#if ROLE_BADGE[u.role]}
                <span class="inline-flex items-center gap-1 rounded {ROLE_BADGE[u.role].pillCls} px-2 py-0.5 whitespace-nowrap">
                  <span class="h-1.5 w-1.5 rounded-full {u.deletedAt ? 'bg-orange-400' : 'bg-emerald-400'}"></span>
                  <span class="text-[10px] font-bold {ROLE_BADGE[u.role].textCls}">{ROLE_BADGE[u.role].label}</span>
                </span>
              {/if}
            </div>
          </button>
        {/each}
        {#if paginated.length === 0}
          <div class='h-24 flex items-center justify-center text-slate-500 text-sm'>No users found.</div>
        {/if}
      </div>

      <!-- Pagination -->
      <div class='flex items-center justify-between border-t border-slate-800 px-4 py-3'>
        <p class='text-xs text-slate-500'>{total} user(s)</p>
        <div class='flex items-center gap-2'>
          <button
            disabled={currentPage === 1}
            onclick={() => updateFilters({ page: currentPage - 1 })}
            aria-label='Previous page'
            class='min-h-11 min-w-11 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer'
          >←</button>
          <span class='text-sm font-semibold text-slate-100'>{currentPage} / {pageCount}</span>
          <button
            disabled={currentPage >= pageCount}
            onclick={() => updateFilters({ page: currentPage + 1 })}
            aria-label='Next page'
            class='min-h-11 min-w-11 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer'
          >→</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Floating Action Button for Mobile/Non-Desktop Screens -->
  <button
    onclick={() => showAddModal = true}
    class='md:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/40 hover:bg-sky-600 transition active:scale-95 cursor-pointer'
    aria-label='Add User'
  >
    <Plus size={24} stroke-width={2.5} />
  </button>
</div>

<!-- View Modal -->
<Modal
  open={Boolean(viewUser)}
  onclose={() => viewUser = null}
  onOutroEnd={runPendingViewAction}
  ariaLabelledby="view-user-title"
  presentation="sheet"
>
  {#if viewUser}
    <!-- Modal Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-semibold text-slate-400">Manage user</h2>
    </div>

    <!-- User Identity Header (Left Aligned) -->
    <div class="flex items-center gap-4 mb-6">
      <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-slate-950 text-xl font-bold uppercase tracking-wider text-sky-300 shadow-inner">
        {viewUser.firstName?.[0] ?? ''}{viewUser.lastName?.[0] ?? ''}
      </div>
      <div>
        <h3 id="view-user-title" class="text-lg font-bold text-slate-50 leading-tight">
          {viewUser.firstName} {viewUser.lastName}
        </h3>
        <p class="mt-1 text-xs text-slate-400 font-mono tracking-wider">
          {viewUser.studentId}
        </p>
      </div>
    </div>

    <!-- Tabs Navigation Bar -->
    <div class="bg-slate-950 p-1 rounded-xl flex gap-1 mb-5">
      <button
        type="button"
        onclick={() => activeTab = 'overview'}
        class="min-h-11 flex-1 text-center py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer {activeTab === 'overview' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        Overview
      </button>
      <button
        type="button"
        onclick={() => activeTab = 'access'}
        class="min-h-11 flex-1 text-center py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer {activeTab === 'access' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        Access
      </button>
      <button
        type="button"
        onclick={() => activeTab = 'audit'}
        class="min-h-11 flex-1 text-center py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer {activeTab === 'audit' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        Audit
      </button>
    </div>

    <!-- Tab Content Area -->
    <div class="min-h-[220px]">
      {#if activeTab === 'overview'}
        <div class="rounded-xl border border-slate-800 bg-slate-950/20 overflow-hidden divide-y divide-slate-800/60">
          <div class="flex justify-between items-center px-4 py-3.5 text-sm">
            <span class="text-slate-400 text-xs font-semibold">Username</span>
            <span class="font-bold text-slate-100">{viewUser.username ?? '—'}</span>
          </div>
          <div class="flex justify-between items-center px-4 py-3.5 text-sm">
            <span class="text-slate-400 text-xs font-semibold">Email</span>
            <span class="font-bold text-slate-100 truncate max-w-[240px]" title={viewUser.email}>{viewUser.email ?? '—'}</span>
          </div>
          <div class="flex justify-between items-center px-4 py-3.5 text-sm">
            <span class="text-slate-400 text-xs font-semibold">Year level</span>
            <span class="font-bold text-slate-100">{viewUser.yearLevel ?? '—'}</span>
          </div>
          <div class="flex justify-between items-center px-4 py-3.5 text-sm">
            <span class="text-slate-400 text-xs font-semibold">Course</span>
            <span class="font-bold text-slate-100">{viewUser.course ?? '—'}</span>
          </div>
          <div class="flex justify-between items-center px-4 py-3.5 text-sm">
            <span class="text-slate-400 text-xs font-semibold">Role</span>
            <span class="font-bold text-slate-100 uppercase">{viewUser.role === 'user' ? 'Voter' : viewUser.role === 'admin' ? 'Admin' : 'Super Admin'}</span>
          </div>
        </div>
      {:else}
        <!-- Access Tab -->
        {#if activeTab === 'access'}
          <div class="space-y-4">
            <!-- Account Active Card -->
            {#if !viewUser.deletedAt}
              <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3.5 items-start">
                <div class="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="font-bold text-slate-100 text-sm">Account is active</h4>
                  <p class="mt-1 text-xs text-slate-400 leading-normal">The user can sign in and participate in currently available voting activities.</p>
                </div>
              </div>
            {:else}
              <div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3.5 items-start">
                <div class="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="font-bold text-slate-100 text-sm">Account is archived</h4>
                  <p class="mt-1 text-xs text-slate-400 leading-normal">This user account is soft-deleted and cannot participate in voting.</p>
                </div>
              </div>
            {/if}

            <!-- Account actions -->
            <div class="grid gap-3">
              {#if !viewUser.deletedAt}
              <button
                type="button"
                onclick={() => startMobileUnlock(viewUser!)}
                class="rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 text-white py-3 text-sm font-bold transition cursor-pointer"
              >
                Unlock
              </button>
              {/if}
              <button
                type="button"
                disabled={viewUser.deletedAt !== null || authStore.user?.id === viewUser.accountId || (authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin'))}
                onclick={() => startMobileResetPassword(viewUser!)}
                class="rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 py-3 text-sm font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <KeyRound size={16} />
                <span>Reset Password</span>
              </button>
            </div>

            <!-- Danger Zone -->
            <div>
              <button
                type="button"
                onclick={() => isDangerZoneExpanded = !isDangerZoneExpanded}
                class="w-full flex items-center justify-between rounded-xl border border-red-500/20 bg-red-950/5 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-950/15 transition cursor-pointer"
              >
                <span>Danger zone</span>
                <svg class="h-4 w-4 transition-transform {isDangerZoneExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              {#if isDangerZoneExpanded}
                <div class="mt-2 rounded-xl border border-red-500/10 bg-red-950/5 p-3 flex flex-col gap-2">
                  {#if !viewUser.deletedAt}
                    <button
                      type="button"
                      disabled={authStore.user?.id === viewUser.accountId || (authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin'))}
                      onclick={() => startMobileArchive(viewUser!)}
                      class="min-h-11 w-full rounded-xl bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-500/20 py-2.5 text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Archive User
                    </button>
                  {:else}
                    <button
                      type="button"
                      disabled={authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin')}
                      onclick={() => startMobileRestore(viewUser!)}
                      class="min-h-11 w-full rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 py-2.5 text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Restore User
                    </button>
                  {/if}

                  <button
                    type="button"
                    disabled={authStore.user?.id === viewUser.accountId || (authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin'))}
                    onclick={() => startMobileHardDelete(viewUser!)}
                    class="min-h-11 w-full rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 py-2.5 text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Delete Permanently
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <!-- Audit Tab -->
          {#if isAuditLoading}
            <div class="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2">
              <Loader class="animate-spin text-sky-400" size={24} />
              <span>Loading activity logs...</span>
            </div>
          {:else if auditError}
            <div class="py-8 text-center text-sm text-red-400">
              {auditError}
            </div>
          {:else if userAuditLogs.length === 0}
            <div class="py-12 text-center text-sm text-slate-500">
              No activity logs found for this user.
            </div>
          {:else}
            <div class="relative pl-6 border-l border-slate-800 space-y-6 ml-3 py-2">
              {#each userAuditLogs as entry (entry.id)}
                {@const display = getAuditDisplay(entry)}
                <div class="relative">
                  <!-- Timeline node dot -->
                  <span class="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-sky-500 bg-slate-900">
                    <span class="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                  </span>
                  <div>
                    <h4 class="font-semibold text-slate-100 text-sm leading-tight">{display.title}</h4>
                    {#if display.subtitle}
                      <p class="mt-1 text-xs text-slate-400">{display.subtitle}</p>
                    {/if}
                    <p class="mt-1 text-[10px] text-slate-500 font-mono">{formatAuditTime(entry.createdAt)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      {/if}
    </div>

    <!-- Bottom Actions Row -->
    <div class="relative flex gap-2.5 mt-6 border-t border-slate-800/80 pt-4">
      <button
        type="button"
        disabled={authStore.user?.id === viewUser.accountId || (authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin'))}
        onclick={() => startMobileEdit(viewUser!)}
        class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
      >
        Edit user
      </button>
      <div class="relative more-menu-container">
        <button
          type="button"
          onclick={() => showMoreMenu = !showMoreMenu}
          class="flex h-11.5 w-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 text-slate-400 transition cursor-pointer"
          aria-label="More options"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"></path>
          </svg>
        </button>

        {#if showMoreMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="absolute bottom-full right-0 mb-2 z-50 w-48 rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-xl flex flex-col gap-1"
            onclick={() => showMoreMenu = false}
          >
            {#if !viewUser.deletedAt}
              <button
                type="button"
                onclick={() => startMobileUnlock(viewUser!)}
                class="min-h-11 w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900 rounded-lg transition cursor-pointer"
              >
                Unlock Account
              </button>
            {/if}
            {#if !viewUser.deletedAt}
              <button
                type="button"
                disabled={authStore.user?.id === viewUser.accountId || (authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin'))}
                onclick={() => startMobileArchive(viewUser!)}
                class="min-h-11 w-full text-left px-3 py-2 text-xs font-semibold text-orange-400 hover:bg-slate-900 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                Archive User
              </button>
            {:else}
              <button
                type="button"
                disabled={authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin')}
                onclick={() => startMobileRestore(viewUser!)}
                class="min-h-11 w-full text-left px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-900 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                Restore User
              </button>
            {/if}
            <button
              type="button"
              disabled={authStore.user?.id === viewUser.accountId || (authStore.user?.role !== 'super_admin' && (viewUser.role === 'admin' || viewUser.role === 'super_admin'))}
              onclick={() => startMobileHardDelete(viewUser!)}
              class="min-h-11 w-full text-left px-3 py-2 text-xs font-semibold text-red-400 hover:bg-slate-900 rounded-lg transition border-t border-slate-900 mt-1 pt-2 disabled:opacity-50 cursor-pointer"
            >
              Delete Permanently
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>

<!-- Edit Modal -->
<Modal open={Boolean(editUser)} onclose={() => editUser = null} ariaLabelledby="edit-user-title" presentation="sheet">
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
        <button onclick={() => editUser = null} class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
        <button
          onclick={handleEditSave}
          disabled={isEditSaving}
          class='min-h-11 flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 disabled:opacity-60 cursor-pointer'
        >
          {#if isEditSaving}<Loader class='animate-spin' size={14} />{/if}
          Save
        </button>
      </div>
    </div>
  {/if}
</Modal>

<!-- Archive Confirm -->
<Modal open={Boolean(archiveConfirmUser)} onclose={() => archiveConfirmUser = null} ariaLabelledby="archive-user-title" presentation="sheet">
  <h3 id="archive-user-title" class='mb-2 text-lg font-bold text-slate-50'>Archive User?</h3>
  {#if archiveConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>Are you sure you want to archive <span class='font-semibold text-slate-200'>{archiveConfirmUser.firstName} {archiveConfirmUser.lastName}</span>? They will no longer be able to log in.</p>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => archiveConfirmUser = null} class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleArchive}
        disabled={isActionLoading}
        class='min-h-11 flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Archive
      </button>
    </div>
  {/if}
</Modal>

<!-- Restore Confirm -->
<Modal open={Boolean(restoreConfirmUser)} onclose={() => restoreConfirmUser = null} ariaLabelledby="restore-user-title" presentation="sheet">
  <h3 id="restore-user-title" class='mb-2 text-lg font-bold text-slate-50'>Restore User?</h3>
  {#if restoreConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>Restore <span class='font-semibold text-slate-200'>{restoreConfirmUser.firstName} {restoreConfirmUser.lastName}</span> so they can log in again.</p>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => restoreConfirmUser = null} class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleRestore}
        disabled={isActionLoading}
        class='min-h-11 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Restore
      </button>
    </div>
  {/if}
</Modal>

<!-- Unlock Confirm -->
<Modal open={Boolean(unlockConfirmUser)} onclose={() => unlockConfirmUser = null} ariaLabelledby="unlock-user-title" presentation="sheet">
  <h3 id="unlock-user-title" class='mb-2 text-lg font-bold text-slate-50'>Unlock User Account?</h3>
  {#if unlockConfirmUser}
    <p class='mb-4 text-sm text-slate-400'>Unlock the account for <span class='font-semibold text-slate-200'>{unlockConfirmUser.firstName} {unlockConfirmUser.lastName}</span> to reset their password lockout login attempts.</p>
    <div class='flex gap-2 justify-end'>
      <button onclick={() => unlockConfirmUser = null} class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleUnlock}
        disabled={isActionLoading}
        class='min-h-11 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Unlock Account
      </button>
    </div>
  {/if}
</Modal>

<!-- Reset Password Modal -->
<Modal open={Boolean(resetPasswordUser)} onclose={closeResetModal} ariaLabelledby="reset-password-title" presentation="sheet">
  <div class='mb-4 flex items-center justify-between'>
    <h3 id="reset-password-title" class='text-lg font-bold text-slate-50'>
      {resetSuccessDetails ? 'Password Reset Successful' : 'Reset User Password'}
    </h3>
  </div>

  {#if resetSuccessDetails}
    <div class='space-y-4'>
      <div class='p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm font-semibold'>
        Password reset successfully! Please copy the credentials below to share with the voter.
      </div>
      <div class='space-y-2 text-sm'>
        <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
          <span class='text-slate-400'>Student ID</span>
          <span class='font-mono font-semibold text-slate-50 select-all'>{resetSuccessDetails.studentId}</span>
        </div>
        <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
          <span class='text-slate-400'>Username</span>
          <span class='font-mono font-semibold text-slate-50 select-all'>{resetSuccessDetails.username}</span>
        </div>
        <div class='flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2'>
          <span class='text-slate-400'>New Password</span>
          <span class='font-mono font-semibold text-amber-300 select-all'>{resetSuccessDetails.password}</span>
        </div>
      </div>
      <p class='text-xs text-slate-500'>
        ⚠️ For security, this password will not be displayed again once you close this window.
      </p>
      <div class='flex items-center justify-between pt-2'>
        <button
          type='button'
          onclick={copyResetCredentials}
          class='min-h-11 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer'
        >
          <Copy size={16} />
          <span>Copy Credentials</span>
        </button>
        <button
          type='button'
          onclick={closeResetModal}
          disabled={isResetSaving}
          class='min-h-11 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition cursor-pointer'
        >
          Done
        </button>
      </div>
    </div>
  {:else if resetPasswordUser}
    <div class='space-y-4'>
      <p class='text-sm text-slate-400'>
        Set a new password for
        <span class='font-semibold text-slate-200'>{resetPasswordUser.firstName} {resetPasswordUser.lastName}</span>
        (Student ID: <span class='font-mono text-slate-300'>{resetPasswordUser.studentId}</span>,
        Username: <span class='font-mono text-slate-300'>{resetPasswordUser.username}</span>).
      </p>
      <p class='text-xs text-slate-500'>
        This will invalidate all active sessions and clear any failed login lockouts for this user.
      </p>

      <div class='space-y-1.5'>
        <div class='flex items-center justify-between'>
          <label for='reset-password-input' class='text-xs font-bold uppercase tracking-wider text-slate-400'>New Password</label>
          <button
            type='button'
            onclick={generateResetPassword}
            class='text-xs font-semibold text-sky-400 hover:text-sky-300 transition cursor-pointer'
          >
            Generate Password
          </button>
        </div>
        <div class='relative'>
          <input
            id='reset-password-input'
            type={resetPasswordVisible ? 'text' : 'password'}
            bind:value={resetPasswordInput}
            placeholder='Enter or generate new password (min 8 chars)'
            class='w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 pr-10 text-sm font-semibold text-slate-50 focus:border-sky-400 focus:outline-none'
          />
          <button
            type='button'
            onclick={() => resetPasswordVisible = !resetPasswordVisible}
            class='absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer'
            aria-label={resetPasswordVisible ? 'Hide password' : 'Show password'}
          >
            {#if resetPasswordVisible}
              <EyeOff size={16} />
            {:else}
              <Eye size={16} />
            {/if}
          </button>
        </div>
        {#if resetMsg}
          <p class='text-xs text-rose-400 font-semibold'>{resetMsg}</p>
        {/if}
      </div>

      <div class='flex gap-2 justify-end pt-2'>
        <button
          type='button'
          onclick={closeResetModal}
          disabled={isResetSaving}
          class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'
        >
          Cancel
        </button>
        <button
          type='button'
          onclick={handleResetPasswordSave}
          disabled={isResetSaving}
          class='min-h-11 flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-60 cursor-pointer transition'
        >
          {#if isResetSaving}<Loader class='animate-spin' size={14} />{/if}
          Reset Password
        </button>
      </div>
    </div>
  {/if}
</Modal>

<!-- Hard Delete Confirm -->
<Modal open={Boolean(hardDeleteConfirmUser)} onclose={() => { hardDeleteConfirmUser = null; hardDeleteConfirmText = '' }} ariaLabelledby="hard-delete-user-title" presentation="sheet">
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
      <button onclick={() => { hardDeleteConfirmUser = null; hardDeleteConfirmText = '' }} class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
      <button
        onclick={handleHardDelete}
        disabled={isActionLoading || hardDeleteConfirmText !== 'DELETE'}
        class='min-h-11 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60 cursor-pointer'
      >
        {#if isActionLoading}<Loader class='animate-spin' size={14} />{/if}
        Delete Permanently
      </button>
    </div>
  {/if}
</Modal>

<!-- Add User Modal -->
<Modal open={showAddModal} onclose={closeAddModal} ariaLabelledby="add-user-title" presentation="sheet">
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
        <button onclick={closeAddModal} class='min-h-11 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 cursor-pointer'>
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
              aria-label={addFormVisiblePassword ? 'Hide password' : 'Show password'}
              aria-pressed={addFormVisiblePassword}
              class='absolute right-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-350 cursor-pointer'
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
            class='min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer'
          >
            Generate
          </button>
        </div>
      </div>

      {#if addMsg}
        <p class='text-sm text-red-400'>{addMsg}</p>
      {/if}

      <div class='flex justify-end gap-2 pt-2'>
        <button type='button' onclick={closeAddModal} class='min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer'>Cancel</button>
        <button
          type='submit'
          disabled={isAddSaving}
          class='min-h-11 flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 disabled:opacity-60 cursor-pointer'
        >
          {#if isAddSaving}<Loader class='animate-spin' size={14} />{/if}
          Create
        </button>
      </div>
    </form>
  {/if}
</Modal>

{#if activeDropdownUserId && activeDropdownUser}
  <!-- Backdrop to close dropdown on click outside -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class='fixed inset-0 z-40' onclick={() => { activeDropdownUserId = null; activeDropdownUser = null; }}></div>
  
  <div
    class='absolute rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-xl z-50 focus:outline-none text-left w-48'
    style='top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;'
  >
    <!-- View Action -->
    <button
      type='button'
      onclick={() => { viewUser = activeDropdownUser; activeDropdownUserId = null; activeDropdownUser = null; }}
      class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-slate-200 hover:bg-slate-900 transition cursor-pointer'
    >
      <Eye size={14} class='text-slate-400' />
      <span>View Details</span>
    </button>

    {#if activeDropdownUser.deletedAt}
      <!-- Restore Action -->
      <button
        type='button'
        disabled={authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin')}
        onclick={() => { restoreConfirmUser = activeDropdownUser; activeDropdownUserId = null; activeDropdownUser = null; }}
        title={authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin') 
          ? 'Only super admins can restore admin accounts' 
          : 'Restore'}
        class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed'
      >
        <RotateCcw size={14} />
        <span>Restore</span>
      </button>
    {:else}
      <!-- Edit Action -->
      <button
        type='button'
        disabled={authStore.user?.id === activeDropdownUser.accountId || (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin'))}
        onclick={() => { openEdit(activeDropdownUser!); activeDropdownUserId = null; activeDropdownUser = null; }}
        title={authStore.user?.id === activeDropdownUser.accountId 
          ? 'You cannot edit your own account here' 
          : (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin')) 
          ? 'Only super admins can edit admin accounts' 
          : 'Edit'}
        class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-sky-400 hover:bg-sky-500/10 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed'
      >
        <Edit size={14} />
        <span>Edit Account</span>
      </button>

      <!-- Archive Action -->
      <button
        type='button'
        disabled={authStore.user?.id === activeDropdownUser.accountId || (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin'))}
        onclick={() => { archiveConfirmUser = activeDropdownUser; activeDropdownUserId = null; activeDropdownUser = null; }}
        title={authStore.user?.id === activeDropdownUser.accountId 
          ? 'You cannot archive your own account' 
          : (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin')) 
          ? 'Only super admins can archive admin accounts' 
          : 'Archive'}
        class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-orange-400 hover:bg-orange-500/10 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed'
      >
        <Archive size={14} />
        <span>Archive</span>
      </button>

      <!-- Unlock Action -->
      <button
        type='button'
        onclick={() => { unlockConfirmUser = activeDropdownUser; activeDropdownUserId = null; activeDropdownUser = null; }}
        class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-teal-400 hover:bg-teal-500/10 transition cursor-pointer'
      >
        <Unlock size={14} />
        <span>Unlock Account</span>
      </button>
    {/if}

    <!-- Reset Password Action -->
    <button
      type='button'
      disabled={activeDropdownUser.deletedAt !== null || authStore.user?.id === activeDropdownUser.accountId || (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin'))}
      onclick={() => { openResetPassword(activeDropdownUser!); activeDropdownUserId = null; activeDropdownUser = null; }}
      title={activeDropdownUser.deletedAt !== null
        ? 'Restore this user before resetting the password'
        : authStore.user?.id === activeDropdownUser.accountId
        ? 'You cannot reset your own password here'
        : (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin'))
        ? 'Only super admins can reset admin accounts'
        : 'Reset Password'}
      class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-amber-400 hover:bg-amber-500/10 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed'
    >
      <KeyRound size={14} />
      <span>Reset Password</span>
    </button>

    <!-- Divider -->
    <div class='my-1 h-px bg-slate-800/60'></div>

    <!-- Permanent Delete Action -->
    <button
      type='button'
      disabled={authStore.user?.id === activeDropdownUser.accountId || (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin'))}
      onclick={() => { hardDeleteConfirmUser = activeDropdownUser; hardDeleteConfirmText = ''; activeDropdownUserId = null; activeDropdownUser = null; }}
      title={authStore.user?.id === activeDropdownUser.accountId 
        ? 'You cannot delete your own account' 
        : (authStore.user?.role !== 'super_admin' && (activeDropdownUser.role === 'admin' || activeDropdownUser.role === 'super_admin')) 
        ? 'Only super admins can delete admin accounts' 
        : 'Delete Permanently'}
      class='w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-red-400 hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed'
    >
      <Trash2 size={14} />
      <span>Delete Permanently</span>
    </button>
  </div>
{/if}

<svelte:window 
  onresize={() => { activeDropdownUserId = null; activeDropdownUser = null; }} 
  onscroll={() => { activeDropdownUserId = null; activeDropdownUser = null; }} 
/>
