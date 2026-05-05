import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2Icon, X, Menu, ChevronDown } from 'lucide-react'
import { AdminRoute } from '@/middleware'
import { useAllUsersQuery, useDeleteUserMutation, useRestoreUserMutation, useUpdateUserMutation } from '@/hooks/userHooks'
import { COURSE_VALUES, YEAR_LEVEL_VALUES } from '@/@types'
import { UsersTable } from './users-table'

export const Route = createFileRoute('/admin-dashboard/users')({
  component: () => (
    <AdminRoute>
      <RouteComponent />
    </AdminRoute>
  ),
})

type ModalType = 'view' | 'edit' | 'archive' | 'restore' | null

function RouteComponent() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [modalType, setModalType] = useState<ModalType>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [message, setMessage] = useState<{ text: string; isSuccess: boolean } | null>(null)

  const { data: usersData, isLoading } = useAllUsersQuery(
    1,
    100, // Max allowed by backend
    undefined,
    undefined,
    undefined,
    includeDeleted
  )

  const updateUser = useUpdateUserMutation()
  const deleteUser = useDeleteUserMutation()
  const restoreUser = useRestoreUserMutation()

  const users = usersData?.data || []
  const meta = usersData?.meta || { total: 0, page: 1, limit: 100, totalPages: 0 }

  const openModal = (type: ModalType, user: any) => {
    setSelectedUser(user)
    setModalType(type)
    if (type === 'edit') {
      setEditForm({
        username: user.username,
        email: user.email || '',
        firstName: user.firstName,
        lastName: user.lastName,
        yearLevel: user.yearLevel,
        course: user.course,
      })
    }
  }

  const closeModal = () => {
    setModalType(null)
    setSelectedUser(null)
    setEditForm({})
    setMessage(null)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    await updateUser.mutateAsync(
      { userId: selectedUser.id, data: editForm },
      {
        onSuccess: () => {
          setMessage({ text: 'User updated successfully', isSuccess: true })
          setTimeout(() => {
            closeModal()
          }, 1500)
        },
        onError: (error: any) => {
          setMessage({ 
            text: error.response?.data?.message || 'Failed to update user', 
            isSuccess: false 
          })
        }
      }
    )
  }

  const handleArchive = async () => {
    if (!selectedUser) return

    await deleteUser.mutateAsync(selectedUser.id, {
      onSuccess: () => {
        setMessage({ text: 'User archived successfully', isSuccess: true })
        setTimeout(() => {
          closeModal()
        }, 1500)
      },
      onError: (error: any) => {
        setMessage({ 
          text: error.response?.data?.message || 'Failed to archive user', 
          isSuccess: false 
        })
      }
    })
  }

  const handleRestore = async () => {
    if (!selectedUser) return

    await restoreUser.mutateAsync(selectedUser.id, {
      onSuccess: () => {
        setMessage({ text: 'User restored successfully', isSuccess: true })
        setTimeout(() => {
          closeModal()
        }, 1500)
      },
      onError: (error: any) => {
        setMessage({ 
          text: error.response?.data?.message || 'Failed to restore user', 
          isSuccess: false 
        })
      }
    })
  }

  return (
    <div 
      className="min-h-screen"
      style={{ background: 'oklch(0.16 0.020 250)' }}
    >
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'oklch(0.10 0.015 250 / 0.8)' }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 bottom-0 border-r flex flex-col z-50 transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-0 lg:w-16'
        }`}
        style={{
          background: 'oklch(0.18 0.022 250)',
          borderColor: 'oklch(0.25 0.025 250)'
        }}
      >
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'oklch(0.25 0.025 250)' }}>
          {isSidebarOpen && (
            <>
              <div>
                <h1 
                  className="text-xl font-black tracking-tight"
                  style={{ color: 'oklch(0.95 0.008 250)' }}
                >
                  OCSVS Admin
                </h1>
                <p 
                  className="text-xs font-semibold mt-1"
                  style={{ color: 'oklch(0.60 0.015 250)' }}
                >
                  Election Control Panel
                </p>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="hidden lg:block p-1.5 rounded-lg transition-colors"
                style={{ color: 'oklch(0.60 0.015 250)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'oklch(0.25 0.025 250)'
                  e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'oklch(0.60 0.015 250)'
                }}
              >
                <ChevronDown size={20} strokeWidth={2.5} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </>
          )}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:block p-1.5 rounded-lg transition-colors mx-auto"
              style={{ color: 'oklch(0.60 0.015 250)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'oklch(0.25 0.025 250)'
                e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'oklch(0.60 0.015 250)'
              }}
            >
              <ChevronDown size={20} strokeWidth={2.5} style={{ transform: 'rotate(90deg)' }} />
            </button>
          )}
        </div>

        {isSidebarOpen && (
          <>
            <nav className="flex-1 p-4 space-y-2">
              <button
                onClick={() => navigate({ to: '/admin-dashboard-v2' })}
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors"
                style={{ color: 'oklch(0.70 0.015 250)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'oklch(0.20 0.022 250)'
                  e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'oklch(0.70 0.015 250)'
                }}
              >
                Candidates
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: 'oklch(0.55 0.15 250)',
                  color: 'oklch(0.98 0.005 250)'
                }}
              >
                Users
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors"
                style={{ color: 'oklch(0.70 0.015 250)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'oklch(0.20 0.022 250)'
                  e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'oklch(0.70 0.015 250)'
                }}
              >
                Results
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors"
                style={{ color: 'oklch(0.70 0.015 250)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'oklch(0.20 0.022 250)'
                  e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'oklch(0.70 0.015 250)'
                }}
              >
                Settings
              </button>
            </nav>

            <div 
              className="p-4 m-4 rounded-xl"
              style={{ background: 'oklch(0.20 0.022 250)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black"
                  style={{
                    background: 'oklch(0.55 0.15 250)',
                    color: 'oklch(0.98 0.005 250)'
                  }}
                >
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <p 
                    className="font-bold text-sm truncate"
                    style={{ color: 'oklch(0.95 0.008 250)' }}
                  >
                    Admin User
                  </p>
                  <p 
                    className="text-xs truncate"
                    style={{ color: 'oklch(0.60 0.015 250)' }}
                  >
                    admin@ocsvs.edu
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
      {/* Header */}
      <header 
        className="border-b"
        style={{
          background: 'oklch(0.18 0.022 250)',
          borderColor: 'oklch(0.25 0.025 250)'
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl transition-colors"
              style={{ color: 'oklch(0.70 0.015 250)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'oklch(0.25 0.025 250)'
                e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'oklch(0.70 0.015 250)'
              }}
            >
              <Menu size={24} strokeWidth={2.5} />
            </button>
            <div>
              <h1 
                className="text-3xl font-black"
                style={{ color: 'oklch(0.95 0.008 250)' }}
              >
                User Management
              </h1>
              <p 
                className="text-sm font-medium mt-1"
                style={{ color: 'oklch(0.65 0.015 250)' }}
              >
                {meta.total} registered users
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Users Table */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <UsersTable
          users={users}
          isLoading={isLoading}
          includeDeleted={includeDeleted}
          onIncludeDeletedChange={setIncludeDeleted}
          onView={(user) => openModal('view', user)}
          onEdit={(user) => openModal('edit', user)}
          onArchive={(user) => openModal('archive', user)}
          onRestore={(user) => openModal('restore', user)}
        />
      </div>

      {/* Modals */}
      {modalType && selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(0.10 0.015 250 / 0.8)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto border"
            style={{
              background: 'oklch(0.20 0.022 250)',
              borderColor: 'oklch(0.30 0.025 250)',
              boxShadow: '0 25px 50px -12px oklch(0.10 0.015 250 / 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* View Modal */}
            {modalType === 'view' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black" style={{ color: 'oklch(0.95 0.008 250)' }}>
                    User Details
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-xl transition-colors"
                    style={{ color: 'oklch(0.60 0.015 250)' }}
                  >
                    <X size={24} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                      Student ID
                    </p>
                    <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                      {selectedUser.studentId}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        First Name
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.firstName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Last Name
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.lastName}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Username
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.username}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Email
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.email || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Year Level
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.yearLevel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Course
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.course}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Has Voted
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.hasVoted ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Role
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                        {selectedUser.role}
                      </p>
                    </div>
                  </div>
                  {selectedUser.deletedAt && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.60 0.015 250)' }}>
                        Archived At
                      </p>
                      <p className="font-semibold" style={{ color: 'oklch(0.70 0.12 30)' }}>
                        {new Date(selectedUser.deletedAt * 1000).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Edit Modal */}
            {modalType === 'edit' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black" style={{ color: 'oklch(0.95 0.008 250)' }}>
                    Edit User
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-xl transition-colors"
                    style={{ color: 'oklch(0.60 0.015 250)' }}
                  >
                    <X size={24} strokeWidth={2.5} />
                  </button>
                </div>
                <form onSubmit={handleEdit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.70 0.015 250)' }}>
                        Username
                      </label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                        style={{
                          background: 'oklch(0.16 0.020 250)',
                          borderColor: 'oklch(0.28 0.025 250)',
                          color: 'oklch(0.95 0.008 250)'
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.70 0.015 250)' }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                        style={{
                          background: 'oklch(0.16 0.020 250)',
                          borderColor: 'oklch(0.28 0.025 250)',
                          color: 'oklch(0.95 0.008 250)'
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.70 0.015 250)' }}>
                        First Name
                      </label>
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                        style={{
                          background: 'oklch(0.16 0.020 250)',
                          borderColor: 'oklch(0.28 0.025 250)',
                          color: 'oklch(0.95 0.008 250)'
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.70 0.015 250)' }}>
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                        style={{
                          background: 'oklch(0.16 0.020 250)',
                          borderColor: 'oklch(0.28 0.025 250)',
                          color: 'oklch(0.95 0.008 250)'
                        }}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.70 0.015 250)' }}>
                        Year Level
                      </label>
                      <select
                        value={editForm.yearLevel}
                        onChange={(e) => setEditForm({ ...editForm, yearLevel: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                        style={{
                          background: 'oklch(0.16 0.020 250)',
                          borderColor: 'oklch(0.28 0.025 250)',
                          color: 'oklch(0.95 0.008 250)'
                        }}
                        required
                      >
                        {YEAR_LEVEL_VALUES.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.70 0.015 250)' }}>
                        Course
                      </label>
                      <select
                        value={editForm.course}
                        onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                        style={{
                          background: 'oklch(0.16 0.020 250)',
                          borderColor: 'oklch(0.28 0.025 250)',
                          color: 'oklch(0.95 0.008 250)'
                        }}
                        required
                      >
                        {COURSE_VALUES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {message && (
                    <div
                      className="px-4 py-3 rounded-xl font-bold text-sm"
                      style={{
                        background: message.isSuccess ? 'oklch(0.70 0.12 140)' : 'oklch(0.70 0.12 30)',
                        color: 'oklch(0.98 0.005 250)'
                      }}
                    >
                      {message.text}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-3 rounded-xl font-bold transition-all"
                      style={{
                        background: 'oklch(0.25 0.025 250)',
                        color: 'oklch(0.70 0.015 250)'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateUser.isPending}
                      className="flex-1 px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'oklch(0.55 0.15 250)',
                        color: 'oklch(0.98 0.005 250)'
                      }}
                    >
                      {updateUser.isPending && <Loader2Icon className="animate-spin" size={20} />}
                      {updateUser.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Archive Modal */}
            {modalType === 'archive' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black" style={{ color: 'oklch(0.95 0.008 250)' }}>
                    Archive User?
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-xl transition-colors"
                    style={{ color: 'oklch(0.60 0.015 250)' }}
                  >
                    <X size={24} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="space-y-4">
                  <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                    Archive {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.studentId})?
                  </p>
                  <div className="p-4 rounded-xl" style={{ background: 'oklch(0.18 0.022 250)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: 'oklch(0.95 0.008 250)' }}>
                      This user will:
                    </p>
                    <ul className="text-sm space-y-1" style={{ color: 'oklch(0.70 0.015 250)' }}>
                      <li>• No longer appear in active users list</li>
                      <li>• Be unable to log in</li>
                      <li>• Retain all voting records</li>
                      <li>• Can be restored later</li>
                    </ul>
                  </div>
                  {message && (
                    <div
                      className="px-4 py-3 rounded-xl font-bold text-sm"
                      style={{
                        background: message.isSuccess ? 'oklch(0.70 0.12 140)' : 'oklch(0.70 0.12 30)',
                        color: 'oklch(0.98 0.005 250)'
                      }}
                    >
                      {message.text}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-3 rounded-xl font-bold transition-all"
                      style={{
                        background: 'oklch(0.25 0.025 250)',
                        color: 'oklch(0.70 0.015 250)'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={deleteUser.isPending}
                      className="flex-1 px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'oklch(0.70 0.12 30)',
                        color: 'oklch(0.98 0.005 250)'
                      }}
                    >
                      {deleteUser.isPending && <Loader2Icon className="animate-spin" size={20} />}
                      {deleteUser.isPending ? 'Archiving...' : 'Archive User'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Restore Modal */}
            {modalType === 'restore' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black" style={{ color: 'oklch(0.95 0.008 250)' }}>
                    Restore User?
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-xl transition-colors"
                    style={{ color: 'oklch(0.60 0.015 250)' }}
                  >
                    <X size={24} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="space-y-4">
                  <p className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
                    Restore {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.studentId})?
                  </p>
                  <div className="p-4 rounded-xl" style={{ background: 'oklch(0.18 0.022 250)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: 'oklch(0.95 0.008 250)' }}>
                      This user will:
                    </p>
                    <ul className="text-sm space-y-1" style={{ color: 'oklch(0.70 0.015 250)' }}>
                      <li>• Appear in active users list</li>
                      <li>• Be able to log in again</li>
                      <li>• Retain all previous data and votes</li>
                    </ul>
                  </div>
                  {message && (
                    <div
                      className="px-4 py-3 rounded-xl font-bold text-sm"
                      style={{
                        background: message.isSuccess ? 'oklch(0.70 0.12 140)' : 'oklch(0.70 0.12 30)',
                        color: 'oklch(0.98 0.005 250)'
                      }}
                    >
                      {message.text}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-3 rounded-xl font-bold transition-all"
                      style={{
                        background: 'oklch(0.25 0.025 250)',
                        color: 'oklch(0.70 0.015 250)'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRestore}
                      disabled={restoreUser.isPending}
                      className="flex-1 px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'oklch(0.70 0.12 140)',
                        color: 'oklch(0.98 0.005 250)'
                      }}
                    >
                      {restoreUser.isPending && <Loader2Icon className="animate-spin" size={20} />}
                      {restoreUser.isPending ? 'Restoring...' : 'Restore User'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
