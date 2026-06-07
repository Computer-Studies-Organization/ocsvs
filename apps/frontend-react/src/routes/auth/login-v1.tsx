import type { TLoginUser } from '@/@types'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2Icon, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import aclcLogo from '@/assets/aclcLogo.webp'
import csoLogo from '@/assets/cso-logo.webp'
import { useLoginUserMutation } from '@/hooks/userHooks'
import { cn } from '@/lib/utils'
import { PublicRoute } from '@/middleware'

export const Route = createFileRoute('/auth/login-v1')({
  component: () => (
    <PublicRoute>
      <RouteComponent />
    </PublicRoute>
  ),
})

/**
 * V1: Split-panel institutional design
 * Left: Brand immersion with dual logos and organizational context
 * Right: Clean, focused credential form
 * Strategy: Restrained with committed blue accent
 * Theme: Light mode — academic daytime context, official institutional process
 */
function RouteComponent() {
  const login = useLoginUserMutation()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [formData, setFormData] = useState<TLoginUser>({
    studentNumber: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    if (!formData.studentNumber.trim() || !formData.password.trim())
      return

    await login.mutateAsync(formData, {
      onSuccess: (_data) => {
        setIsLoading(false)
      },
      onError: (error: any) => {
        setIsLoading(false)
        if (error.response) {
          setMessage(error.response?.data.message)
        }
      },
    })
  }

  return (
    <div className="min-h-[100dvh] w-full flex">
      {/* Left Panel - Brand */}
      <div
        className="hidden lg:flex lg:w-[45%] relative overflow-hidden"
        style={{
          background: 'oklch(0.28 0.08 250)',
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(165deg, oklch(0.32 0.09 250) 0%, oklch(0.24 0.07 250) 100%)',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top - School Logo */}
          <div>
            <img
              src={aclcLogo}
              alt="ACLC Logo"
              className="h-16 w-auto opacity-95"
            />
          </div>

          {/* Center - CSO Logo & Message */}
          <div className="flex flex-col items-start space-y-8">
            <img
              src={csoLogo}
              alt="Computer Studies Organization"
              className="h-32 w-auto"
            />
            <div className="space-y-3 max-w-md">
              <h1
                className="text-4xl font-bold tracking-tight"
                style={{ color: 'oklch(0.95 0.01 250)' }}
              >
                Student Voice,
                <br />
                Digital Choice
              </h1>
              <p
                className="text-lg leading-relaxed"
                style={{ color: 'oklch(0.75 0.02 250)' }}
              >
                Secure, transparent elections for the Computer Studies Organization community.
              </p>
            </div>
          </div>

          {/* Bottom - Trust indicator */}
          <div
            className="flex items-center gap-2.5 text-sm"
            style={{ color: 'oklch(0.65 0.02 250)' }}
          >
            <ShieldCheck size={18} strokeWidth={2} />
            <span>Encrypted & auditable voting system</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div
        className="flex-1 flex items-center justify-center p-6 sm:p-8"
        style={{ background: 'oklch(0.98 0.002 250)' }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logos */}
          <div className="lg:hidden flex items-center justify-center gap-6 mb-10">
            <img
              src={aclcLogo}
              alt="ACLC Logo"
              className="h-14 w-auto"
            />
            <div
              className="h-12 w-px"
              style={{ background: 'oklch(0.85 0.005 250)' }}
            />
            <img
              src={csoLogo}
              alt="CSO Logo"
              className="h-14 w-auto"
            />
          </div>

          <div className="space-y-2 mb-8">
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'oklch(0.25 0.01 250)' }}
            >
              Sign in
            </h2>
            <p
              className="text-base"
              style={{ color: 'oklch(0.50 0.01 250)' }}
            >
              Access your ballot and participate in CSO elections
            </p>
          </div>

          {message && (
            <div
              className="mb-6 p-4 rounded-lg text-sm font-medium"
              style={{
                background: 'oklch(0.95 0.03 25)',
                color: 'oklch(0.45 0.15 25)',
                border: '1px solid oklch(0.85 0.05 25)',
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="studentNumber"
                className="block text-sm font-semibold"
                style={{ color: 'oklch(0.30 0.01 250)' }}
              >
                Student Number
              </label>
              <input
                id="studentNumber"
                type="text"
                value={formData.studentNumber}
                name="studentNumber"
                onChange={handleChange}
                placeholder="20XX-XXXXX"
                autoComplete="username"
                required
                className={cn(
                  'w-full rounded-lg px-4 py-3 text-base font-medium transition-all',
                  'focus:outline-none',
                  message
                    ? 'ring-2'
                    : 'ring-1',
                )}
                style={message
                  ? {
                      'background': 'oklch(0.99 0.005 25)',
                      'color': 'oklch(0.20 0.01 250)',
                      '--tw-ring-color': 'oklch(0.55 0.15 25)',
                    } as React.CSSProperties
                  : {
                      'background': 'oklch(1 0 0)',
                      'color': 'oklch(0.20 0.01 250)',
                      '--tw-ring-color': 'oklch(0.88 0.005 250)',
                    } as React.CSSProperties}
                onFocus={(e) => {
                  if (!message) {
                    (e.target.style as any)['--tw-ring-color'] = 'oklch(0.55 0.15 250)'
                  }
                }}
                onBlur={(e) => {
                  if (!message) {
                    (e.target.style as any)['--tw-ring-color'] = 'oklch(0.88 0.005 250)'
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-semibold"
                style={{ color: 'oklch(0.30 0.01 250)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  name="password"
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className={cn(
                    'w-full rounded-lg px-4 py-3 pr-11 text-base font-medium transition-all',
                    'focus:outline-none',
                    message ? 'ring-2' : 'ring-1',
                  )}
                  style={message
                    ? {
                        'background': 'oklch(0.99 0.005 25)',
                        'color': 'oklch(0.20 0.01 250)',
                        '--tw-ring-color': 'oklch(0.55 0.15 25)',
                      } as React.CSSProperties
                    : {
                        'background': 'oklch(1 0 0)',
                        'color': 'oklch(0.20 0.01 250)',
                        '--tw-ring-color': 'oklch(0.88 0.005 250)',
                      } as React.CSSProperties}
                  onFocus={(e) => {
                    if (!message) {
                      (e.target.style as any)['--tw-ring-color'] = 'oklch(0.55 0.15 250)'
                    }
                  }}
                  onBlur={(e) => {
                    if (!message) {
                      (e.target.style as any)['--tw-ring-color'] = 'oklch(0.88 0.005 250)'
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'oklch(0.55 0.01 250)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'oklch(0.35 0.01 250)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.55 0.01 250)'}
                >
                  {showPassword ? <Eye size={20} strokeWidth={2} /> : <EyeOff size={20} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!formData.studentNumber.trim() || !formData.password.trim() || isLoading || login.isPending}
              className={cn(
                'w-full py-3.5 font-semibold text-base rounded-lg transition-all',
                'flex items-center justify-center gap-2',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
              style={{
                background: 'oklch(0.55 0.15 250)',
                color: 'oklch(0.99 0.005 250)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'oklch(0.50 0.16 250)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'oklch(0.55 0.15 250)'
              }}
            >
              {(isLoading || login.isPending) && <Loader2Icon className="animate-spin" size={20} />}
              {(isLoading || login.isPending) ? 'Authenticating' : 'Sign in'}
            </button>
          </form>

          <div
            className="mt-8 pt-6 text-center text-sm"
            style={{
              borderTop: '1px solid oklch(0.90 0.005 250)',
              color: 'oklch(0.50 0.01 250)',
            }}
          >
            New to the system?
            {' '}
            <Link
              to="/auth/register"
              className="font-semibold transition-colors"
              style={{ color: 'oklch(0.55 0.15 250)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'oklch(0.45 0.16 250)'}
              onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.55 0.15 250)'}
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
