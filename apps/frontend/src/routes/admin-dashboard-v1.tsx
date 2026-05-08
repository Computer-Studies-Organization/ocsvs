import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ArrowRight, BarChart3, Loader2Icon, Plus, XIcon, UserPlus } from 'lucide-react'
import { useCreateCandidateMutation, useAllCandidatesQuery } from '@/hooks/candidateHooks'
import { UserData, useAllUsersQuery, useRegisterUserMutation } from '@/hooks/userHooks'
import { getCandidateVoteCount } from '@/api/votes_api'
import { COURSE_VALUES, YEAR_LEVEL_VALUES, type TCandidate, type TUsersData } from '@/@types'
import { getCandidateUserLabel, resolveCandidateUserSelection } from '@/lib/adminUsers'
import {
  CANDIDATE_FIELD_LABELS,
  EMPTY_REGISTER_USER_DRAFT,
  REGISTER_FIELD_LABELS,
  getMutationErrorMessage,
  getRegisterUserDraftValidationMessage,
  isRegisterUserDraftComplete,
} from '@/lib/userRegistration'
import { useToast } from '@/lib/toast'
import { AdminRoute } from '@/middleware'

export const Route = createFileRoute('/admin-dashboard-v1')({
  component: () => (
    <AdminRoute>
      <RouteComponent />
    </AdminRoute>
  ),
})

export const POSITIONS = [
  { id: 1, value: "Chairman" },
  { id: 2, value: "Internal Vice Chairman" },
  { id: 3, value: "External Vice Chairman" },
  { id: 4, value: "Internal Secretary" },
  { id: 5, value: "External Secretary" },
  { id: 6, value: "Treasurer" },
  { id: 7, value: "Auditor" },
  { id: 8, value: "PIOs (Freshman)" },
  { id: 9, value: "PIOs (Sophomore)" },
  { id: 10, value: "PIOs (Junior)" },
  { id: 11, value: "PIOs (Senior)" },
  { id: 12, value: "Head Committee" },
  { id: 13, value: "Vice Head Committee" },
  { id: 14, value: "Committee Leader (Programming)" },
  { id: 15, value: "Committee Leader (Graphics and Design)" },
  { id: 16, value: "Committee Leader (Networking)" },
  { id: 17, value: "Committee Leader (Gaming)" },
]

const YEAR_LEVELS = YEAR_LEVEL_VALUES.map((value) => ({ value, label: value }))
const COURSES = COURSE_VALUES.map((value) => ({ value, label: value }))
const EMPTY_CANDIDATE_FORM_DATA: Omit<TCandidate, "id"> = {
  fullName: '',
  position: '',
  manifesto: '',
  accountId: '',
}


function RouteComponent() {
  const userData = UserData()
  const navigate = useNavigate()
  const createCandidate = useCreateCandidateMutation()
  const createUser = useRegisterUserMutation()
  const { data: candidatesData, isLoading: isLoadingCandidates } = useAllCandidatesQuery()
  const { data: usersData, isLoading: isLoadingUsers } = useAllUsersQuery(1, 100)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const { showToast } = useToast()

  // Fetch vote counts for all candidates
  useEffect(() => {
    const fetchVoteCounts = async () => {
      if (!candidatesData?.data || !Array.isArray(candidatesData.data)) {
        return
      }

      const counts: Record<string, number> = {}

      try {
        await Promise.all(
          candidatesData.data.map(async (candidate: TCandidate) => {
            try {
              const response = await getCandidateVoteCount(candidate.id)
              counts[candidate.id] = response.voteCount || 0
            } catch (error) {
              console.error(`Error fetching vote count for candidate ${candidate.id}:`, error)
              counts[candidate.id] = 0
            }
          })
        )
        setVoteCounts(counts)
      } catch (error) {
        console.error('Error fetching vote counts:', error)
      }
    }

    if (!isLoadingCandidates && candidatesData?.data) {
      fetchVoteCounts()
    }
  }, [candidatesData, isLoadingCandidates])

  const candidates = useMemo(() => {
    if (!candidatesData?.data || !Array.isArray(candidatesData.data)) {
      return []
    }

    // First, add vote counts to candidates
    const candidatesWithVotes = candidatesData.data.map((candidate: TCandidate) => ({
      ...candidate,
      voteCount: voteCounts[candidate.id] || 0,
    }))

    // Group by position and calculate percentages
    const positionTotals: Record<string, number> = {}
    candidatesWithVotes.forEach((candidate) => {
      const position = candidate.position
      positionTotals[position] = (positionTotals[position] || 0) + candidate.voteCount
    })

    // Calculate percentages
    const transformed = candidatesWithVotes.map((candidate) => {
      const totalVotes = positionTotals[candidate.position] || 0
      const percentage = totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0
      return {
        ...candidate,
        percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
      }
    })

    return transformed
  }, [candidatesData, voteCounts])

  const [formData, setFormData] = useState<Omit<TCandidate, "id">>(EMPTY_CANDIDATE_FORM_DATA)
  const [userFormData, setUserFormData] = useState(EMPTY_REGISTER_USER_DRAFT)

  const users = useMemo<TUsersData[]>(() => {
    if (!usersData?.data || !Array.isArray(usersData.data)) {
      return []
    }
    return usersData.data.map((user: { id: string; accountId: string; studentId: string; firstName: string; lastName: string }) => ({
      id: user.id,
      accountId: user.accountId,
      studentId: user.studentId,
      fullName: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
    }))
  }, [usersData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    if (name === 'accountId') {
      const selectedUser = resolveCandidateUserSelection(users, value)
      setFormData((prev) => ({
        ...prev,
        accountId: selectedUser?.accountId ?? '',
        fullName: selectedUser?.fullName ?? '',
      }))
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const closeCandidateModal = () => {
    setIsModalOpen(false)
    setFormData(EMPTY_CANDIDATE_FORM_DATA)
  }

  const closeUserModal = () => {
    setIsUserModalOpen(false)
    setUserFormData(EMPTY_REGISTER_USER_DRAFT)
  }

  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as keyof typeof EMPTY_REGISTER_USER_DRAFT
    const { value } = e.target
    setUserFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationMessage = getRegisterUserDraftValidationMessage(userFormData)
    if (validationMessage) {
      showToast({ message: validationMessage, type: 'error' })
      return
    }

    if (!isRegisterUserDraftComplete(userFormData)) return

    await createUser.mutateAsync(userFormData, {
      onSuccess: (data) => {
        showToast({ message: data.message || 'User created successfully', type: 'success' })
        setUserFormData(EMPTY_REGISTER_USER_DRAFT)
        setIsUserModalOpen(false)
      },
      onError: (error: unknown) => {
        showToast({ message: getMutationErrorMessage(error, 'Failed to create user', REGISTER_FIELD_LABELS), type: 'error' })
      },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fullName.trim() || !formData.position.trim() || !formData.manifesto.trim()) {
      showToast({ message: 'All fields are required', type: 'error' })
      return
    }

    if (!formData.accountId) {
      showToast({ message: 'Please select a valid user from the list', type: 'error' })
      return
    }

    await createCandidate.mutateAsync({
      fullName: formData.fullName,
      accountId: formData.accountId,
      position: formData.position,
      manifesto: formData.manifesto,
    }, {
      onSuccess: (data) => {
        showToast({ message: data.message, type: 'success' })
        setFormData(EMPTY_CANDIDATE_FORM_DATA)
        setIsModalOpen(false)
      },
      onError: (error: unknown) => {
        showToast({ message: getMutationErrorMessage(error, 'Failed to create candidate', CANDIDATE_FIELD_LABELS), type: 'error' })
      },
    })
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-900">
      {/* Background orbs - same as login */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-red-600/20 blur-[100px]" />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        {/* Header */}
        <header className="relative mb-5 flex items-start justify-between gap-4 border-b border-slate-800/70 pb-4">
          <div className="space-y-3">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-blue-300/90">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
                Admin Panel
              </p>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Manage Election Candidates
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: '/admin-dashboard/view-results' })}
                className={cn(
                  'inline-flex items-center justify-center rounded-lg mt-2 px-4 py-2 text-sm font-semibold text-white shadow-lg',
                  'bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:ring-offset-2 focus:ring-offset-slate-900',
                  'transition-all duration-150'
                )}
              >
                <div className='flex items-center gap-1.5'>
                  <BarChart3 size={16} />
                  <span>
                    View Results
                  </span>
                </div>
              </button>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-md shadow-slate-950/40 backdrop-blur">
              <p className="text-sm text-slate-200">
                Welcome,{' '}
                <span className="font-semibold text-slate-50">
                  {userData?.user?.username || 'Admin'}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Create and manage candidates for the election. View vote statistics and results.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="absolute right-0 flex items-start justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                setIsUserModalOpen(true)
              }}
              className={cn(
                'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg',
                'bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:ring-offset-2 focus:ring-offset-slate-900',
                'transition-all duration-150'
              )}
            >
              <div className='flex items-center gap-1.5'>
                <UserPlus size={16} />
                <span>
                  Create User
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsUserModalOpen(false)
                setIsModalOpen(true)
              }}
              className={cn(
                'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg',
                'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:ring-offset-2 focus:ring-offset-slate-900',
                'transition-all duration-150'
              )}
            >
              <div className='flex items-center gap-1.5'>
                <Plus size={16} />
                <span>
                  Add Candidate
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: '/dashboard' })}
              className={cn(
                'inline-flex items-center justify-center rounded-lg p-2 text-white shadow-lg',
                'bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-slate-500/80 focus:ring-offset-2 focus:ring-offset-slate-900',
                'transition-all duration-150'
              )}
              aria-label="Back to Dashboard"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </header>

        {/* Candidates List */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-100">
                Candidates
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {isLoadingCandidates ? (
                  'Loading candidates...'
                ) : (
                  `Showing ${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}.`
                )}
              </p>
            </div>
          </div>

          {isLoadingCandidates ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
              <div className="flex items-center justify-center gap-3">
                <Loader2Icon className="animate-spin text-blue-400" size={24} />
                <p className="text-sm sm:text-base text-slate-400">
                  Loading candidates...
                </p>
              </div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
              <p className="text-sm sm:text-base text-slate-400 text-center">
                No candidates yet. Click <span className="font-semibold text-blue-400">Add Candidate</span> to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {(() => {
                // Group candidates by position
                const positionGroups = POSITIONS.map((pos) => ({
                  position: pos.value,
                  candidates: candidates.filter(
                    (candidate: TCandidate & { percentage: number; voteCount: number }) =>
                      candidate.position === pos.value
                  ),
                })).filter((group) => group.candidates.length > 0)

                return positionGroups.map((group, index) => (
                  <div
                    key={`${group.position}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-2xl"
                  >
                    <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4 gap-4">
                      <h3 className="text-md sm:text-xl font-bold text-slate-100 min-w-0 flex-1">
                        {group.position}
                      </h3>
                      <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs sm:text-sm font-medium text-blue-300 flex-shrink-0 whitespace-nowrap">
                        {group.candidates.length}{' '}
                        {group.candidates.length === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>

                    <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                      {group.candidates.map((candidate: TCandidate & { percentage: number; voteCount: number }) => (
                        <div
                          key={candidate.id}
                          className="flex h-full flex-col rounded-xl border border-white/10 bg-slate-900/40 p-4 sm:p-5 shadow-lg transition-all hover:border-blue-500/30 hover:shadow-xl"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <h4 className="text-base sm:text-lg font-semibold text-slate-100">
                                {candidate.fullName}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-slate-400">
                                {candidate.position}
                              </p>
                            </div>
                          </div>

                          <p className="mt-2 text-xs sm:text-sm text-slate-300 line-clamp-4 whitespace-pre-line">
                            {candidate.manifesto}
                          </p>

                          {/* Vote count and percentage */}
                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                              <span>Votes: {candidate.voteCount ?? 0}</span>
                              <span className="font-semibold text-slate-100">
                                {candidate.percentage ?? 0}%
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, candidate.percentage ?? 0)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Add Candidate Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => {
            if (!createCandidate.isPending) {
              closeCandidateModal()
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-6 sm:p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (!createCandidate.isPending) {
                  closeCandidateModal()
                }
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 text-sm"
            >
              <XIcon size={20} />
            </button>

            <h2 className="mb-1 text-xl sm:text-2xl font-semibold text-slate-100 text-center">
              Add New Candidate
            </h2>
            <p className="mb-5 text-xs sm:text-sm text-slate-400 text-center">
              Fill out the details below to register a new candidate.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="accountId"
                  className="block text-sm font-medium text-slate-300"
                >
                  User
                </label>
                <select
                  id="accountId"
                  value={formData.accountId}
                  name="accountId"
                  onChange={handleChange}
                  required
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                    'text-slate-100',
                    'border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                    'text-base sm:text-base'
                  )}
                >
                  <option value="">Select a user</option>
                  {isLoadingUsers ? (
                    <option value="" disabled>Loading users...</option>
                  ) : (
                    users.map((user: TUsersData, index: number) => (
                      <option key={user.accountId || index} value={user.accountId}>
                        {getCandidateUserLabel(user)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Position */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="position"
                  className="block text-sm font-medium text-slate-300"
                >
                  Position
                </label>
                <select
                  id="position"
                  value={formData.position}
                  name="position"
                  onChange={handleChange}
                  required
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                    'text-slate-100',
                    'border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                    'text-base sm:text-base'
                  )}
                >
                  <option value="">Select a position</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos.id} value={pos.value}>{pos.value}</option>
                  ))}
                </select>
              </div>

              {/* Manifesto */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="manifesto"
                  className="block text-sm font-medium text-slate-300"
                >
                  Manifesto
                </label>
                <textarea
                  id="manifesto"
                  value={formData.manifesto}
                  name="manifesto"
                  onChange={handleChange}
                  placeholder="Enter candidate's manifesto"
                  required
                  rows={5}
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                    'text-slate-100 placeholder:text-slate-500',
                    'resize-none',
                    'border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                    'text-base sm:text-base'
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={!formData.fullName.trim() || !formData.position.trim() || !formData.manifesto.trim() || !formData.accountId || createCandidate.isPending}
                className={cn(
                  'w-full py-3 flex flex-row justify-center items-center gap-1.5 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200',
                  'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500',
                  'text-base sm:text-base'
                )}
              >
                {createCandidate.isPending && <Loader2Icon className='animate-spin' size={20} />}
                {createCandidate.isPending ? "Creating..." : "Add Candidate"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isUserModalOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => {
            if (!createUser.isPending) {
              closeUserModal()
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (!createUser.isPending) {
                  closeUserModal()
                }
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 text-sm"
            >
              <XIcon size={20} />
            </button>

            <h2 className="mb-1 text-xl sm:text-2xl font-semibold text-slate-100 text-center">
              Create New User
            </h2>
            <p className="mb-5 text-xs sm:text-sm text-slate-400 text-center">
              Fill out the details below to create a new user account.
            </p>

            <form onSubmit={handleUserSubmit} className="space-y-4 sm:space-y-5">
              {/* Student ID */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="studentId"
                  className="block text-sm font-medium text-slate-300"
                >
                  Student ID
                </label>
                <input
                  id="studentId"
                  name="studentId"
                  type="text"
                  value={userFormData.studentId}
                  onChange={handleUserChange}
                  placeholder="C23-00-0000-MAN121"
                  required
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                    'text-slate-100 placeholder:text-slate-500',
                    'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                    'text-base sm:text-base'
                  )}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-4">
                {/* First Name */}
                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-slate-300"
                  >
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={userFormData.firstName}
                    onChange={handleUserChange}
                    placeholder="Enter first name"
                    required
                    className={cn(
                      'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                      'text-slate-100 placeholder:text-slate-500',
                      'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                      'text-base sm:text-base'
                    )}
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={userFormData.lastName}
                    onChange={handleUserChange}
                    placeholder="Enter last name"
                    required
                    className={cn(
                      'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                      'text-slate-100 placeholder:text-slate-500',
                      'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                      'text-base sm:text-base'
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-4">
                {/* Year Level */}
                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  <label
                    htmlFor="yearLevel"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Year Level
                  </label>
                  <select
                    id="yearLevel"
                    name="yearLevel"
                    value={userFormData.yearLevel}
                    onChange={handleUserChange}
                    required
                    className={cn(
                      'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                      'text-slate-100',
                      'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                      'text-base sm:text-base appearance-none cursor-pointer',
                      'bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                    )}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      paddingRight: '2.5rem',
                    }}
                  >
                    <option value="" className="bg-slate-800 text-slate-300">Select year level</option>
                    {YEAR_LEVELS.map((year) => (
                      <option key={year.value} value={year.value} className="bg-slate-800 text-slate-300">
                        {year.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Course */}
                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  <label
                    htmlFor="course"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Course
                  </label>
                  <select
                    id="course"
                    name="course"
                    value={userFormData.course}
                    onChange={handleUserChange}
                    required
                    className={cn(
                      'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                      'text-slate-100',
                      'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                      'text-base sm:text-base appearance-none cursor-pointer',
                      'bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                    )}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      paddingRight: '2.5rem',
                    }}
                  >
                    <option value="" className="bg-slate-800 text-slate-300">Select course</option>
                    {COURSES.map((course) => (
                      <option key={course.value} value={course.value} className="bg-slate-800 text-slate-300">
                        {course.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={userFormData.email}
                  onChange={handleUserChange}
                  placeholder="Enter email address"
                  required
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                    'text-slate-100 placeholder:text-slate-500',
                    'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                    'text-base sm:text-base'
                  )}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-4">
                {/* Username */}
                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={userFormData.username}
                    onChange={handleUserChange}
                    placeholder="Enter username"
                    required
                    className={cn(
                      'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                      'text-slate-100 placeholder:text-slate-500',
                      'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                      'text-base sm:text-base'
                    )}
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={userFormData.password}
                    onChange={handleUserChange}
                    placeholder="Enter password"
                    required
                    className={cn(
                      'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                      'text-slate-100 placeholder:text-slate-500',
                      'border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/50',
                      'text-base sm:text-base'
                    )}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isRegisterUserDraftComplete(userFormData) || createUser.isPending}
                className={cn(
                  'w-full py-3 flex flex-row justify-center items-center gap-1.5 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200',
                  'bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500',
                  'text-base sm:text-base'
                )}
              >
                {createUser.isPending && <Loader2Icon className='animate-spin' size={20} />}
                {createUser.isPending ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
