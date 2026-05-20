import type { TCandidate, TUsersData } from '@/@types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Award, BarChart3, ChevronDown, Loader2Icon, Menu, Plus, TrendingUp, Users2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getCandidateVoteCount } from '@/api/votes_api'
import { useAllCandidatesQuery, useCreateCandidateMutation } from '@/hooks/candidateHooks'
import { useAllUsersQuery } from '@/hooks/userHooks'
import { getCandidateUserLabel, resolveCandidateUserSelection } from '@/lib/adminUsers'
import { useToast } from '@/lib/toast'
import {
  CANDIDATE_FIELD_LABELS,
  getMutationErrorMessage,
} from '@/lib/userRegistration'
import { AdminRoute } from '@/middleware'

export const Route = createFileRoute('/admin-dashboard-v2')({
  component: () => (
    <AdminRoute>
      <RouteComponent />
    </AdminRoute>
  ),
})

/**
 * V2: Card-based kanban layout (Production Ready)
 * Organized by position with visual hierarchy
 * Strategy: Committed — deep blue carries 45% of surface
 * Theme: Dark mode — focused admin work, reduced eye strain
 * Features: Real API integration, vote counting, user management
 */

export const POSITIONS = [
  { id: 1, value: 'Chairman' },
  { id: 2, value: 'Internal Vice Chairman' },
  { id: 3, value: 'External Vice Chairman' },
  { id: 4, value: 'Internal Secretary' },
  { id: 5, value: 'External Secretary' },
  { id: 6, value: 'Treasurer' },
  { id: 7, value: 'Auditor' },
  { id: 8, value: 'PIOs (Freshman)' },
  { id: 9, value: 'PIOs (Sophomore)' },
  { id: 10, value: 'PIOs (Junior)' },
  { id: 11, value: 'PIOs (Senior)' },
  { id: 12, value: 'Head Committee' },
  { id: 13, value: 'Vice Head Committee' },
  { id: 14, value: 'Committee Leader (Programming)' },
  { id: 15, value: 'Committee Leader (Graphics and Design)' },
  { id: 16, value: 'Committee Leader (Networking)' },
  { id: 17, value: 'Committee Leader (Gaming)' },
]

const EMPTY_CANDIDATE_FORM_DATA: Omit<TCandidate, 'id'> = {
  fullName: '',
  position: '',
  manifesto: '',
  accountId: '',
}

function RouteComponent() {
  const navigate = useNavigate()
  const createCandidate = useCreateCandidateMutation()
  const { data: candidatesData, isLoading: isLoadingCandidates } = useAllCandidatesQuery()
  const { data: usersData, isLoading: isLoadingUsers } = useAllUsersQuery(1, 100)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set(POSITIONS.map(p => p.value)))
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
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
            }
            catch (error) {
              console.error(`Error fetching vote count for candidate ${candidate.id}:`, error)
              counts[candidate.id] = 0
            }
          }),
        )
        setVoteCounts(counts)
      }
      catch (error) {
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

  const [formData, setFormData] = useState<Omit<TCandidate, 'id'>>(EMPTY_CANDIDATE_FORM_DATA)

  const users = useMemo<TUsersData[]>(() => {
    if (!usersData?.data || !Array.isArray(usersData.data)) {
      return []
    }
    return usersData.data.map((user: { id: string, accountId: string, studentId: string, firstName: string, lastName: string }) => ({
      id: user.id,
      accountId: user.accountId,
      studentId: user.studentId,
      fullName: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
    }))
  }, [usersData])

  const togglePosition = (position: string) => {
    setExpandedPositions((prev) => {
      const next = new Set(prev)
      if (next.has(position)) {
        next.delete(position)
      }
      else {
        next.add(position)
      }
      return next
    })
  }

  const groupedCandidates = POSITIONS.map(pos => ({
    position: pos.value,
    candidates: candidates.filter((c: TCandidate & { percentage: number, voteCount: number }) => c.position === pos.value),
  })).filter(group => group.candidates.length > 0)

  const totalVotes = candidates.reduce((sum: number, c: TCandidate & { voteCount: number }) => sum + c.voteCount, 0)
  const totalCandidates = candidates.length

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    if (name === 'accountId') {
      const selectedUser = resolveCandidateUserSelection(users, value)
      setFormData(prev => ({
        ...prev,
        accountId: selectedUser?.accountId ?? '',
        fullName: selectedUser?.fullName ?? '',
      }))
      return
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const closeCandidateModal = () => {
    setIsModalOpen(false)
    setFormData(EMPTY_CANDIDATE_FORM_DATA)
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

  const openCreateModal = () => {
    setFormData(EMPTY_CANDIDATE_FORM_DATA)
    setIsModalOpen(true)
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
          borderColor: 'oklch(0.25 0.025 250)',
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
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: 'oklch(0.55 0.15 250)',
                  color: 'oklch(0.98 0.005 250)',
                }}
              >
                Candidates
              </button>
              <button
                onClick={() => navigate({ to: '/admin-dashboard/users' })}
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
                onClick={() => navigate({ to: '/settings' })}
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
              className="p-4 m-4 rounded-xl cursor-pointer transition-colors"
              style={{ background: 'oklch(0.20 0.022 250)' }}
              onClick={() => navigate({ to: '/settings' })}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'oklch(0.22 0.024 250)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'oklch(0.20 0.022 250)'
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black"
                  style={{
                    background: 'oklch(0.55 0.15 250)',
                    color: 'oklch(0.98 0.005 250)',
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
          className="sticky top-0 z-10 border-b"
          style={{
            background: 'oklch(0.18 0.022 250)',
            borderColor: 'oklch(0.25 0.025 250)',
          }}
        >
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
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
                  <h2
                    className="text-2xl font-black"
                    style={{ color: 'oklch(0.95 0.008 250)' }}
                  >
                    Candidate Management
                  </h2>
                  <p
                    className="text-sm font-medium mt-0.5"
                    style={{ color: 'oklch(0.65 0.015 250)' }}
                  >
                    {totalCandidates}
                    {' '}
                    candidates across
                    {groupedCandidates.length}
                    {' '}
                    positions
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex gap-3">
                <button
                  onClick={() => navigate({ to: '/admin-dashboard/view-results' })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg"
                  style={{
                    background: 'oklch(0.70 0.12 280)',
                    color: 'oklch(0.98 0.005 250)',
                    boxShadow: '0 10px 25px -5px oklch(0.70 0.12 280 / 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'oklch(0.75 0.13 280)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'oklch(0.70 0.12 280)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <BarChart3 size={18} strokeWidth={2.5} />
                  <span className="hidden sm:inline">View Results</span>
                </button>
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg"
                  style={{
                    background: 'oklch(0.55 0.15 250)',
                    color: 'oklch(0.98 0.005 250)',
                    boxShadow: '0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'oklch(0.60 0.16 250)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'oklch(0.55 0.15 250)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span className="hidden sm:inline">New Candidate</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div
          className="border-b"
          style={{ borderColor: 'oklch(0.25 0.025 250)' }}
        >
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Candidates', value: totalCandidates, icon: Users2, color: 'oklch(0.70 0.12 250)' },
                { label: 'Active Positions', value: groupedCandidates.length, icon: Award, color: 'oklch(0.70 0.12 280)' },
                { label: 'Total Votes Cast', value: totalVotes, icon: TrendingUp, color: 'oklch(0.70 0.12 140)' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl border"
                  style={{
                    background: 'oklch(0.20 0.022 250)',
                    borderColor: 'oklch(0.25 0.025 250)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 rounded-lg"
                      style={{ background: `${stat.color} / 0.15` }}
                    >
                      <stat.icon size={20} strokeWidth={2.5} style={{ color: stat.color }} />
                    </div>
                    <p
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'oklch(0.60 0.015 250)' }}
                    >
                      {stat.label}
                    </p>
                  </div>
                  <p
                    className="text-3xl font-black"
                    style={{ color: 'oklch(0.95 0.008 250)' }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Candidates Grid */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {isLoadingCandidates
            ? (
                <div
                  className="rounded-2xl border p-8 shadow-2xl"
                  style={{
                    background: 'oklch(0.20 0.022 250)',
                    borderColor: 'oklch(0.25 0.025 250)',
                  }}
                >
                  <div className="flex items-center justify-center gap-3">
                    <Loader2Icon className="animate-spin" size={24} style={{ color: 'oklch(0.55 0.15 250)' }} />
                    <p className="text-sm font-medium" style={{ color: 'oklch(0.70 0.015 250)' }}>
                      Loading candidates...
                    </p>
                  </div>
                </div>
              )
            : candidates.length === 0
              ? (
                  <div
                    className="rounded-2xl border p-8 shadow-2xl"
                    style={{
                      background: 'oklch(0.20 0.022 250)',
                      borderColor: 'oklch(0.25 0.025 250)',
                    }}
                  >
                    <p className="text-sm text-center" style={{ color: 'oklch(0.70 0.015 250)' }}>
                      No candidates yet. Click
                      {' '}
                      <span className="font-bold" style={{ color: 'oklch(0.55 0.15 250)' }}>New Candidate</span>
                      {' '}
                      to create one.
                    </p>
                  </div>
                )
              : (
                  <div className="space-y-6">
                    {groupedCandidates.map((group) => {
                      const isExpanded = expandedPositions.has(group.position)
                      return (
                        <div key={group.position}>
                          <button
                            onClick={() => togglePosition(group.position)}
                            className="w-full flex items-center justify-between mb-4 group"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                size={20}
                                strokeWidth={2.5}
                                className="transition-transform duration-200"
                                style={{
                                  color: 'oklch(0.70 0.12 250)',
                                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                              />
                              <h3
                                className="text-lg font-black transition-colors"
                                style={{ color: 'oklch(0.95 0.008 250)' }}
                              >
                                {group.position}
                              </h3>
                            </div>
                            <span
                              className="px-3 py-1 rounded-full text-xs font-bold"
                              style={{
                                background: 'oklch(0.25 0.025 250)',
                                color: 'oklch(0.70 0.12 250)',
                              }}
                            >
                              {group.candidates.length}
                              {' '}
                              {group.candidates.length === 1 ? 'candidate' : 'candidates'}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {group.candidates.map(candidate => (
                                <div
                                  key={candidate.id}
                                  className="p-5 rounded-2xl border transition-all cursor-pointer"
                                  style={{
                                    background: 'oklch(0.20 0.022 250)',
                                    borderColor: 'oklch(0.25 0.025 250)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'oklch(0.55 0.15 250)'
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'oklch(0.25 0.025 250)'
                                    e.currentTarget.style.transform = 'translateY(0)'
                                  }}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                      <h4
                                        className="font-bold text-base truncate"
                                        style={{ color: 'oklch(0.95 0.008 250)' }}
                                      >
                                        {candidate.fullName}
                                      </h4>
                                      <p
                                        className="text-xs font-medium mt-0.5"
                                        style={{ color: 'oklch(0.60 0.015 250)' }}
                                      >
                                        {candidate.position}
                                      </p>
                                    </div>
                                  </div>

                                  <p
                                    className="text-sm line-clamp-2 mb-4"
                                    style={{ color: 'oklch(0.75 0.015 250)' }}
                                  >
                                    {candidate.manifesto}
                                  </p>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span style={{ color: 'oklch(0.60 0.015 250)' }}>Vote Count</span>
                                      <span
                                        className="font-bold"
                                        style={{ color: 'oklch(0.95 0.008 250)' }}
                                      >
                                        {candidate.voteCount}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="flex-1 h-2 rounded-full overflow-hidden"
                                        style={{ background: 'oklch(0.25 0.025 250)' }}
                                      >
                                        <div
                                          className="h-full rounded-full transition-all"
                                          style={{
                                            width: `${candidate.percentage}%`,
                                            background: 'oklch(0.55 0.15 250)',
                                          }}
                                        />
                                      </div>
                                      <span
                                        className="text-sm font-bold"
                                        style={{ color: 'oklch(0.70 0.12 250)' }}
                                      >
                                        {candidate.percentage}
                                        %
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
        </div>
      </div>

      {/* FAB - Mobile only */}
      <div className="lg:hidden fixed bottom-6 right-6 z-30">
        <button
          onClick={openCreateModal}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all"
          style={{
            background: 'oklch(0.55 0.15 250)',
            color: 'oklch(0.98 0.005 250)',
            boxShadow: '0 10px 30px -5px oklch(0.55 0.15 250 / 0.5)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Add Candidate Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(0.10 0.015 250 / 0.8)' }}
          onClick={() => {
            if (!createCandidate.isPending) {
              closeCandidateModal()
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto border"
            style={{
              background: 'oklch(0.20 0.022 250)',
              borderColor: 'oklch(0.30 0.025 250)',
              boxShadow: '0 25px 50px -12px oklch(0.10 0.015 250 / 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-2xl font-black"
                style={{ color: 'oklch(0.95 0.008 250)' }}
              >
                Add New Candidate
              </h2>
              <button
                onClick={() => {
                  if (!createCandidate.isPending) {
                    closeCandidateModal()
                  }
                }}
                className="p-2 rounded-xl transition-colors"
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
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* User Selection */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: 'oklch(0.70 0.015 250)' }}
                >
                  User
                </label>
                <select
                  name="accountId"
                  value={formData.accountId}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: 'oklch(0.16 0.020 250)',
                    borderColor: 'oklch(0.28 0.025 250)',
                    color: 'oklch(0.95 0.008 250)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'oklch(0.55 0.15 250)'}
                  onBlur={e => e.target.style.borderColor = 'oklch(0.28 0.025 250)'}
                  required
                >
                  <option value="">Select a user</option>
                  {isLoadingUsers
                    ? (
                        <option value="" disabled>Loading users...</option>
                      )
                    : (
                        users.map((user: TUsersData) => (
                          <option key={user.accountId} value={user.accountId}>
                            {getCandidateUserLabel(user)}
                          </option>
                        ))
                      )}
                </select>
              </div>

              {/* Full Name (auto-filled) */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: 'oklch(0.70 0.015 250)' }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: 'oklch(0.16 0.020 250)',
                    borderColor: 'oklch(0.28 0.025 250)',
                    color: 'oklch(0.95 0.008 250)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'oklch(0.55 0.15 250)'}
                  onBlur={e => e.target.style.borderColor = 'oklch(0.28 0.025 250)'}
                  readOnly
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: 'oklch(0.70 0.015 250)' }}
                >
                  Position
                </label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: 'oklch(0.16 0.020 250)',
                    borderColor: 'oklch(0.28 0.025 250)',
                    color: 'oklch(0.95 0.008 250)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'oklch(0.55 0.15 250)'}
                  onBlur={e => e.target.style.borderColor = 'oklch(0.28 0.025 250)'}
                  required
                >
                  <option value="">Select position</option>
                  {POSITIONS.map(pos => (
                    <option key={pos.id} value={pos.value}>{pos.value}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: 'oklch(0.70 0.015 250)' }}
                >
                  Manifesto
                </label>
                <textarea
                  value={formData.manifesto}
                  onChange={e => setFormData({ ...formData, manifesto: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-3.5 rounded-xl border-2 font-semibold transition-all resize-none"
                  style={{
                    background: 'oklch(0.16 0.020 250)',
                    borderColor: 'oklch(0.28 0.025 250)',
                    color: 'oklch(0.95 0.008 250)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'oklch(0.55 0.15 250)'}
                  onBlur={e => e.target.style.borderColor = 'oklch(0.28 0.025 250)'}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!createCandidate.isPending) {
                      closeCandidateModal()
                    }
                  }}
                  className="flex-1 px-4 py-3.5 rounded-xl font-bold transition-all"
                  style={{
                    background: 'oklch(0.25 0.025 250)',
                    color: 'oklch(0.70 0.015 250)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'oklch(0.28 0.025 250)'
                    e.currentTarget.style.color = 'oklch(0.95 0.008 250)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'oklch(0.25 0.025 250)'
                    e.currentTarget.style.color = 'oklch(0.70 0.015 250)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.fullName.trim() || !formData.position.trim() || !formData.manifesto.trim() || !formData.accountId || createCandidate.isPending}
                  className="flex-1 px-4 py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: 'oklch(0.55 0.15 250)',
                    color: 'oklch(0.98 0.005 250)',
                    boxShadow: '0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    if (!createCandidate.isPending) {
                      e.currentTarget.style.background = 'oklch(0.60 0.16 250)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'oklch(0.55 0.15 250)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {createCandidate.isPending && <Loader2Icon className="animate-spin" size={20} />}
                  {createCandidate.isPending ? 'Creating...' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
