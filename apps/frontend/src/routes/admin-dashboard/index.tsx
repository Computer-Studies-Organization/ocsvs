import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ArrowRight, BarChart3, Loader2Icon, Plus, XIcon } from 'lucide-react'
import { useCreateCandidateMutation, useAllCandidatesQuery } from '@/hooks/candidateHooks'
import { UserData, useAllUsersQuery } from '@/hooks/userHooks'
import { getCandidateVoteCount } from '@/api/votes_api'
import type { TCandidate, TUsersData } from '@/@types'
import { AdminRoute } from '@/middleware'

export const Route = createFileRoute('/admin-dashboard/')({
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


function RouteComponent() {
  const userData = UserData()
  const navigate = useNavigate()
  const createCandidate = useCreateCandidateMutation()
  const { data: candidatesData, isLoading: isLoadingCandidates } = useAllCandidatesQuery()
  const { data: usersData, isLoading: isLoadingUsers } = useAllUsersQuery(1, 100)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>("")
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})

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

  const [formData, setFormData] = useState<Omit<TCandidate, "id">>({
    fullName: '',
    position: '',
    manifesto: '',
    accountId: '',
  })

  const users = useMemo<TUsersData[]>(() => {
    if (!usersData?.data || !Array.isArray(usersData.data)) {
      return []
    }
    return usersData.data.map((user: { id: string; accountId: string; firstName: string; lastName: string }) => ({
      id: user.id,
      accountId: user.accountId,
      fullName: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
    }))
  }, [usersData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })

    if (name === 'fullName') {
      const selectedUser = users.find((user) => user.fullName === value)
      if (selectedUser) {
        setFormData((prev) => ({ ...prev, accountId: selectedUser.accountId }))
      } else {
        setFormData((prev) => ({ ...prev, accountId: '' }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    if (!formData.fullName.trim() || !formData.position.trim() || !formData.manifesto.trim()) {
      setMessage("All fields are required")
      setIsLoading(false)
      return
    }

    if (!formData.accountId) {
      setMessage("Please select a valid user from the list")
      setIsLoading(false)
      return
    }

    await createCandidate.mutateAsync({
      fullName: formData.fullName,
      accountId: formData.accountId,
      position: formData.position,
      manifesto: formData.manifesto,
    }, {
      onSuccess: (data) => {
        setIsLoading(false)
        setMessage(data.message)

        setTimeout(() => {
          setMessage("")
          setFormData({
            fullName: '',
            position: '',
            manifesto: '',
            accountId: '',
          })
        }, 2500)

        setIsModalOpen(false)
      },
      onError: (error: any) => {
        setIsLoading(false)
        if (error.response) {
          setMessage(error.response?.data.message || "Failed to create candidate")
        } else {
          setMessage("Failed to create candidate")
        }
      }
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
            {/* <button
              type="button"
              onClick={() => navigate({ to: '/admin-dashboard/view-results' })}
              className={cn(
                'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg',
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
            </button> */}
            <button
              type="button"
              onClick={() => {
                setMessage("")
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

        {/* Message Banner */}
        {message && (
          <div
            className={cn(
              'fixed z-50 bottom-2 right-2 rounded-lg px-4 py-3 text-sm sm:text-base transition-all duration-300',
              'border-2',
              message.includes('successfully')
                ? 'border-emerald-500/40 bg-emerald-500 text-white'
                : 'border-red-500/40 bg-red-500/10 text-white'
            )}
          >
            {message}
          </div>
        )}

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
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => {
                if (!isLoading && !createCandidate.isPending) {
                  setIsModalOpen(false)
                  setMessage("")
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
                  htmlFor="fullName"
                  className="block text-sm font-medium text-slate-300"
                >
                  Full Name
                </label>
                <select
                  id="fullName"
                  value={formData.fullName}
                  name="fullName"
                  onChange={handleChange}
                  required
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                    'text-slate-100',
                    message && !message.includes('successfully')
                      ? 'border-red-500/50 ring-2 ring-red-500/60 focus:ring-red-500/60 focus:border-red-500/50'
                      : 'border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                    'text-base sm:text-base'
                  )}
                >
                  <option value="">Select a candidate</option>
                  {isLoadingUsers ? (
                    <option value="" disabled>Loading users...</option>
                  ) : (
                    users.map((user: TUsersData, index: number) => (
                      <option key={index} value={user.fullName}>
                        {user.fullName}
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
                    message && !message.includes('successfully')
                      ? 'border-red-500/50 ring-2 ring-red-500/60 focus:ring-red-500/60 focus:border-red-500/50'
                      : 'border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
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
                    message && !message.includes('successfully')
                      ? 'border-red-500/50 ring-2 ring-red-500/60 focus:ring-red-500/60 focus:border-red-500/50'
                      : 'border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                    'text-base sm:text-base'
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={!formData.fullName.trim() || !formData.position.trim() || !formData.manifesto.trim() || !formData.accountId || isLoading}
                className={cn(
                  'w-full py-3 flex flex-row justify-center items-center gap-1.5 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200',
                  'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500',
                  'text-base sm:text-base'
                )}
              >
                {(isLoading || createCandidate.isPending) && <Loader2Icon className='animate-spin' size={20} />}
                {(isLoading || createCandidate.isPending) ? "Creating..." : "Add Candidate"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
