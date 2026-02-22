import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PublicRoute } from '@/middleware'

export const Route = createFileRoute('/')({
  component: () => (
    <PublicRoute>
      <HomeComponent />
    </PublicRoute>
  )
})

function HomeComponent() {

  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-900">
      <div className="absolute top-[-10%] left-[-10%] w-125 h-125 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-125 h-125 rounded-full bg-red-600/20 blur-[120px]" />

      <div className="relative z-10 w-full max-w-2xl px-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-3xl shadow-2xl text-center">

          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full"></div>
            <img
              src={"../src/assets/aclcLogo.webp"}
              alt="CSO Organization Logo"
              className="relative h-32 w-auto mx-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            />
          </div>

          <h1 className="text-5xl flex flex-col md:text-7xl font-black mb-4 uppercase">
            <span className="text-blue-500">ACLC</span>
            <span className="text-red-500 text-2xl md:text-3xl">COMPUTER STUDIES ORGANIZATION</span>
          </h1>

          <p className="text-slate-400 text-lg mb-10 font-medium tracking-wide">
            Empowering Student Leadership Through Voting
          </p>

          <button onClick={() => navigate({ to: '/auth/login' })} className="cursor-pointer relative px-10 py-4 font-bold text-white bg-blue-500 rounded-md transition-all duration-300">
            <span className="relative uppercase tracking-[0.2em] text-xl">
              Start Voting
            </span>
          </button>

        </div>
      </div>
    </div>
  )
}