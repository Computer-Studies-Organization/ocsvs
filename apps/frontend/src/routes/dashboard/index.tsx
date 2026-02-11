import { createFileRoute } from '@tanstack/react-router'
import { Activity, useState } from 'react'
import { categories } from '@/data'
import { ArrowRight, LockKeyhole, LogOut, Settings, Undo2 } from 'lucide-react'

export const Route = createFileRoute('/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string | null>>(
    () =>
      categories.reduce(
        (acc, category) => ({ ...acc, [category.id]: null }),
        {} as Record<string, string | null>,
      ),
  )

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0)

  const currentCategory = categories[currentCategoryIndex]
  const isFirstCategory = currentCategoryIndex === 0
  const isLastCategory = currentCategoryIndex === categories.length - 1
  const currentVoteSelected = selectedVotes[currentCategory.id] !== null

  const handleSelectNominee = (categoryId: string, nomineeId: string) => {
    setSelectedVotes(prev => ({ ...prev, [categoryId]: nomineeId }))
  }

  const handleSubmitVotes = () => {
    console.log('Submitting votes:', selectedVotes)
    alert("Na submit naba po !!")
  }

  const allCategoriesVoted = categories.every(
    category => selectedVotes[category.id] !== null,
  )

  return (
    <div className="relative min-h-[100dvh] flex justify-center items-center w-full overflow-hidden bg-slate-900">
      {/* Background orbs */}
      <div className="absolute top-[-10%] left-[-10%] h-96 w-96 rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-96 w-96 rounded-full bg-red-600/20 blur-[100px]" />

      <div className="relative z-10 flex min-h-[100dvh] w-full md:max-w-6xl flex-col px-4 py-6">
        {/* HEADER */}
        <header className="mb-4 flex items-start justify-between">
          <div className="max-w-3xl">
            <h1 className="text-xl font-bold text-slate-50">
              Voting Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Select your nominee for each position
            </p>

            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] text-slate-400">
              You may change your selection before submitting. Only one vote per position is allowed.
            </p>
          </div>
          <div className="relative ml-4 flex-shrink-0">
            <button onClick={() => setIsSettingsOpen((prev) => !prev)}>
              <Settings />
            </button>
            <Activity mode={isSettingsOpen ? "visible" : "hidden"}>
              <div className="absolute right-2 top-8 w-56 bg-slate-900 rounded-lg shadow-lg border border-slate-800 py-2">
                <div className="px-4 py-2 text-sm font-medium text-gray-300 border-b border-slate-800 hover:bg-slate-800 transition-colors">
                  <button>
                    My Ballot
                  </button>
                </div>
                <button className="w-full flex items-center justify-between px-4 py-2 text-sm text-red-500 hover:bg-slate-800 transition-colors">
                  <span>Logout</span>
                  <LogOut size={16} />
                </button>
              </div>
            </Activity>

          </div>
        </header>


        {/* BODY */}
        <main>
          <section className="rounded-xl border border-slate-800 min-h-[80dvh] bg-slate-950 p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[11px] text-slate-400">
                  Position {currentCategoryIndex + 1} of {categories.length}
                </p>

                <h2 className="text-lg font-semibold text-slate-50">
                  {currentCategory.title}
                </h2>

                <p className="text-xs text-slate-400">
                  {currentCategory.description}
                </p>
              </div>

              <div className="text-right">
                {currentVoteSelected && (
                  <span className="mb-1 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-300">
                    Selected
                  </span>
                )}
              </div>
            </div>

            {/* NOMINEES */}
            <div className="space-y-2">
              {currentCategory.nominees.map(nominee => {
                const isSelected =
                  selectedVotes[currentCategory.id] === nominee.id

                return (
                  <button
                    key={nominee.id}
                    type="button"
                    onClick={() =>
                      handleSelectNominee(currentCategory.id, nominee.id)
                    }
                    className={`flex w-full justify-between rounded-lg border px-3 py-4 text-left transition ${isSelected
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-slate-800 bg-slate-900 hover:bg-slate-800'
                      }`}
                  >
                    <div>
                      <p className="font-medium text-slate-50">
                        {nominee.name}
                      </p>

                      <p className="text-[11px] text-slate-400">
                        {nominee.course}
                      </p>

                      <p className="text-[11px] italic text-slate-300/80">
                        “{nominee.manifesto}”
                      </p>
                    </div>

                    <Activity mode={isSelected ? "visible" : "hidden"}>
                      <span className="text-xs font-semibold text-green-300">
                        Voted
                      </span>
                    </Activity>

                  </button>
                )
              })}
            </div>
          </section>
        </main>

        {/* Actions */}
        <footer className="mt-4">
          <p className="mb-2 text-center text-[11px] text-slate-500">
            {isLastCategory
              ? 'Review your selections before submitting.'
              : 'You must select a nominee to continue.'}
          </p>

          <div className="flex gap-3">
            
            <Activity mode={!isFirstCategory ? "visible" : "hidden"}>
              <button
                type="button"
                onClick={() => setCurrentCategoryIndex(i => i - 1)}
                className="flex justify-center flex-1 rounded-lg border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700/30"
              >
                <span className='text-slate-300 flex gap-1.5 justify-center items-center'>
                  <Undo2 size={20} />
                  Previous
                </span>
              </button>
            </Activity>

            {!isLastCategory ? (
              <button
                type="button"
                disabled={!currentVoteSelected}
                onClick={() => setCurrentCategoryIndex(i => i + 1)}
                className={`flex-1 rounded-lg py-3 text-sm font-semibold transition ${currentVoteSelected
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-slate-700 text-slate-400'
                  }`}
              >
                <span className='text-slate-300 flex gap-1.5 justify-center items-center'>
                  Next
                  <ArrowRight size={20} />
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!allCategoriesVoted}
                onClick={handleSubmitVotes}
                className={`flex-1 rounded-lg py-3 text-sm font-semibold transition ${allCategoriesVoted
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-slate-700 text-slate-400'
                  }`}
              >
                Submit Votes
              </button>
            )}
          </div>

          <Activity mode={isLastCategory ? "visible" : "hidden"}>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Once submitted, votes cannot be changed.
            </p>
          </Activity>

        </footer>
        <div className='flex justify-center items-center mt-6 gap-1.5 text-slate-600'>
          <LockKeyhole size={12} />
          <p className="text-center text-[10px] text-slate-600">
            All votes are confidential and securely recorded.
          </p>
        </div>
      </div>
    </div>

  )
}
