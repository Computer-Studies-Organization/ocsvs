import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '@/middleware'
// import { useAllCandidates } from '@/data'
// import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
// import { getStoredVotes } from '@/lib/voteStorage'
// import { useEffect, useMemo, useState } from 'react'

export const Route = createFileRoute('/dashboard/my-ballot/')({
  component: () => (
    <ProtectedRoute>
      <MyBallotComponent />
    </ProtectedRoute>
  ),
})

function MyBallotComponent() {
//   const navigate = useNavigate()
//   const categories = useAllCandidates()

//   // Get votes from localStorage only
//   const [localVotes, setLocalVotes] = useState<Record<string, string | null>>(() => getStoredVotes())

//   // Update local votes when localStorage changes
//   useEffect(() => {
//     const handleStorageChange = () => {
//       setLocalVotes(getStoredVotes())
//     }

//     // Listen for storage events (from other tabs/windows)
//     window.addEventListener('storage', handleStorageChange)

//     const interval = setInterval(handleStorageChange, 500)

//     return () => {
//       window.removeEventListener('storage', handleStorageChange)
//       clearInterval(interval)
//     }
//   }, [])

//   // Calculate voted nominees from localVotes
//   const votedNominees = useMemo(() => {
//     return Object.entries(localVotes)
//       .filter(([_, nomineeId]) => nomineeId !== null)
//       .map(([categoryId, nomineeId]) => ({
//         categoryId,
//         nomineeId: nomineeId as string,
//       }))
//   }, [localVotes])

//   // Check if there are any votes in localStorage
//   const hasLocalVotes = votedNominees.length > 0

  return (
    <div>My Ballot</div>
    // <div className="relative min-h-[100dvh] flex justify-center items-center w-full overflow-hidden bg-slate-900">
    //   {/* Background orbs */}
    //   <div className="absolute top-[-10%] left-[-10%] h-96 w-96 rounded-full bg-blue-600/20 blur-[100px]" />
    //   <div className="absolute bottom-[-10%] right-[-10%] h-96 w-96 rounded-full bg-red-600/20 blur-[100px]" />

    //   <div className="relative z-10 flex min-h-[100dvh] w-full md:max-w-6xl flex-col px-4 py-6">
    //     {/* HEADER */}
    //     <header className="mb-4 flex items-start justify-between">
    //       <div className="max-w-3xl">
    //         <h1 className="text-xl font-bold text-slate-50">
    //           My Ballot
    //         </h1>

    //         <p className="mt-1 text-sm text-slate-400">
    //           View the nominees you have voted for
    //         </p>
    //       </div>
    //       <button
    //         onClick={() => navigate({ to: '/dashboard' })}
    //         className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors text-slate-300"
    //       >
    //         <span className="text-sm">Back to Dashboard</span>
    //         <ArrowRight size={16} />
    //       </button>
    //       <button
    //         onClick={() => navigate({ to: '/dashboard' })}
    //         className="md:hidden flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors text-slate-300"
    //       >
    //         <ArrowRight size={16} />
    //       </button>
    //     </header>

    //     {/* BODY */}
    //     <main>
    //       <section className="rounded-xl border border-slate-800 min-h-[80dvh] bg-slate-950 p-4 shadow-lg">
    //         {!hasLocalVotes ? (
    //           <div className="flex flex-col items-center justify-center min-h-[60dvh]">
    //             <p className="text-slate-400 mb-2">You haven't voted yet.</p>
    //             <button
    //               onClick={() => navigate({ to: '/dashboard' })}
    //               className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
    //             >
    //               Go to Voting Dashboard
    //             </button>
    //           </div>
    //         ) : (
    //           <div className="space-y-6">
    //             {categories.map((category) => {
    //               // Get vote from localStorage only
    //               const localVoteId = localVotes[category.id]

    //               // Find the voted nominee
    //               const votedNominee = localVoteId
    //                 ? category.nominees.find(nominee => nominee.id === localVoteId)
    //                 : null

    //               if (!votedNominee) return null

    //               return (
    //                 <div
    //                   key={category.id}
    //                   className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4"
    //                 >
    //                   <div className="mb-3">
    //                     <p className="text-[11px] text-slate-400 mb-1">
    //                       {category.title}
    //                     </p>
    //                     <h2 className="text-lg font-semibold text-slate-50">
    //                       {category.title}
    //                     </h2>
    //                     <p className="text-xs text-slate-400">
    //                       {category.description}
    //                     </p>
    //                   </div>

    //                   <div className="flex items-start justify-between rounded-lg border border-blue-500/50 bg-blue-500/20 px-4 py-4">
    //                     <div className="flex-1">
    //                       <div className="flex items-center gap-2 mb-2">
    //                         <CheckCircle2 className="text-green-400" size={20} />
    //                         <p className="font-medium text-slate-50">
    //                           {votedNominee.name}
    //                         </p>
    //                       </div>

    //                       <p className="text-[11px] text-slate-400 mb-2">
    //                         {votedNominee.course}
    //                       </p>

    //                       <p className="text-[11px] italic text-slate-300/80">
    //                         "{votedNominee.manifesto}"
    //                       </p>
    //                     </div>

    //                     <span className="text-xs font-semibold text-green-300 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
    //                       Your Vote
    //                     </span>
    //                   </div>
    //                 </div>
    //               )
    //             })}
    //           </div>
    //         )}
    //       </section>
    //     </main>

    //     <div className="mt-6 text-center">
    //       <p className="text-[10px] text-slate-500">
    //         Your votes are confidential and securely recorded.
    //       </p>
    //     </div>
    //   </div>
    // </div>
  )
}
