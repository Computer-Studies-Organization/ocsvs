import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TLoginUser } from '@/@types'
import { Eye, EyeOff } from 'lucide-react'
import { useLoginUserMutation } from '@/hooks/userHooks'

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const login = useLoginUserMutation()
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [formData, setFormData] = useState<TLoginUser>({
    identifier: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.identifier.trim() || !formData.password.trim()) return
    
    await login.mutateAsync(formData,{
      onSuccess: (data) => {
        console.log(data.message)
      },
      onError: (error: any) => {
        if (error.response) console.log(error.response?.data.message)
      }
    })
  }

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-slate-900 px-4 py-6 sm:px-6 sm:py-8">
      {/* Background orbs - same as home */}
      <div className="absolute top-[-10%] left-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-red-600/20 blur-[100px]" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10">
          {/* Logo */}
          <div className="relative inline-flex w-full flex justify-center mb-6 sm:mb-8">
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full" />
            <img
              src="../../../src/assets/aclcLogo.webp"
              alt="ACLC Computer Studies Organization Logo"
              className="relative h-20 w-auto sm:h-24 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            />
          </div>

          <p className="text-slate-400 text-sm sm:text-base text-center mb-6 sm:mb-8">
            Sign in to vote
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Username */}
            <div className="space-y-1.5 sm:space-y-2">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-300"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.identifier}
                name="identifier"
                onChange={handleChange}
                placeholder="Enter your username"
                autoComplete="username"
                required
                className={cn(
                  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                  'text-slate-100 placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                  'text-base sm:text-base'
                )}
              />
            </div>

            {/* Password */}
            <div className="relative space-y-1.5 sm:space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                name="password"
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className={cn(
                  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3',
                  'text-slate-100 placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50',
                  'text-base sm:text-base'
                )}
              />
               <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-10 text-gray-500/60 hover:text-gray-500/80 cursor-pointer"
                >
                  {showPassword ? <Eye /> : <EyeOff />}
                </button>
            </div>

            <button
              type="submit"
              disabled={!formData.identifier.trim() || !formData.password.trim()}
              className={cn(
                'w-full py-3 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200',
                'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500',
                'text-base sm:text-base'
              )}
            >
             Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/auth/register"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Create account to vote
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
