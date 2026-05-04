import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TLoginUser } from '@/@types'
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useLoginUserMutation } from '@/hooks/userHooks'
import { PublicRoute } from '@/middleware'
import { Loader2Icon } from 'lucide-react'
import csoLogo from '@/assets/cso-logo.webp'
import aclcLogo from '@/assets/aclcLogo.webp'

export const Route = createFileRoute('/auth/login-v3')({
  component: () => (
    <PublicRoute>
      <RouteComponent />
    </PublicRoute>
  ),
})

/**
 * V3: Editorial typographic with color drenched accent
 * Asymmetric layout with bold color block
 * Strategy: Full palette — navy base + saturated blue accent + amber trust signal
 * Theme: Light mode with high-contrast color zones
 * Avoids: centered card grid, uses editorial asymmetry instead
 */
function RouteComponent() {
  const login = useLoginUserMutation()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>("")
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
    setMessage("")

    if (!formData.studentNumber.trim() || !formData.password.trim()) return

    await login.mutateAsync(formData, {
      onSuccess: (data) => {
        setIsLoading(false)
        console.log(data.message)
      },
      onError: (error: any) => {
        setIsLoading(false)
        if (error.response) {
          console.log(error.response?.data.message);
          setMessage(error.response?.data.message)
        }
      }
    })
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row">
      {/* Left - Form section */}
      <div 
        className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16"
        style={{ background: 'oklch(0.97 0.003 250)' }}
      >
        <div className="w-full max-w-md">
          {/* Logo stack */}
          <div className="mb-12 space-y-6">
            <div className="flex items-center gap-5">
              <img
                src={aclcLogo}
                alt="ACLC Logo"
                className="h-14 w-auto"
              />
              <img
                src={csoLogo}
                alt="CSO Logo"
                className="h-14 w-auto"
              />
            </div>
            <div>
              <h1 
                className="text-5xl font-black tracking-tight mb-3"
                style={{ 
                  color: 'oklch(0.20 0.025 250)',
                  lineHeight: '1.1'
                }}
              >
                Student
                <br />
                Elections
              </h1>
              <p 
                className="text-lg font-medium"
                style={{ color: 'oklch(0.45 0.015 250)' }}
              >
                Authenticate to access your ballot
              </p>
            </div>
          </div>

          {message && (
            <div 
              className="mb-7 p-5 rounded-2xl"
              style={{
                background: 'oklch(0.92 0.04 25)',
                border: '2px solid oklch(0.75 0.12 25)'
              }}
            >
              <p 
                className="text-sm font-bold"
                style={{ color: 'oklch(0.35 0.15 25)' }}
              >
                {message}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label
                htmlFor="studentNumber"
                className="block text-xs font-black uppercase tracking-wider"
                style={{ 
                  color: 'oklch(0.40 0.015 250)',
                  letterSpacing: '0.1em'
                }}
              >
                Student ID
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
                className="w-full rounded-2xl px-5 py-4 text-lg font-semibold transition-all focus:outline-none border-2"
                style={{
                  background: 'oklch(1 0 0)',
                  color: 'oklch(0.20 0.020 250)',
                  borderColor: message ? 'oklch(0.60 0.15 25)' : 'oklch(0.85 0.008 250)'
                }}
                onFocus={(e) => {
                  if (!message) {
                    e.target.style.borderColor = 'oklch(0.50 0.18 250)'
                  }
                }}
                onBlur={(e) => {
                  if (!message) {
                    e.target.style.borderColor = 'oklch(0.85 0.008 250)'
                  }
                }}
              />
            </div>

            <div className="space-y-3">
              <label
                htmlFor="password"
                className="block text-xs font-black uppercase tracking-wider"
                style={{ 
                  color: 'oklch(0.40 0.015 250)',
                  letterSpacing: '0.1em'
                }}
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
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-2xl px-5 py-4 pr-14 text-lg font-semibold transition-all focus:outline-none border-2"
                  style={{
                    background: 'oklch(1 0 0)',
                    color: 'oklch(0.20 0.020 250)',
                    borderColor: message ? 'oklch(0.60 0.15 25)' : 'oklch(0.85 0.008 250)'
                  }}
                  onFocus={(e) => {
                    if (!message) {
                      e.target.style.borderColor = 'oklch(0.50 0.18 250)'
                    }
                  }}
                  onBlur={(e) => {
                    if (!message) {
                      e.target.style.borderColor = 'oklch(0.85 0.008 250)'
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'oklch(0.50 0.015 250)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'oklch(0.30 0.020 250)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'oklch(0.50 0.015 250)'}
                >
                  {showPassword ? <Eye size={22} strokeWidth={2.5} /> : <EyeOff size={22} strokeWidth={2.5} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!formData.studentNumber.trim() || !formData.password.trim() || isLoading || login.isPending}
              className={cn(
                'w-full py-5 font-black text-lg rounded-2xl transition-all mt-8',
                'flex items-center justify-center gap-3',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'group'
              )}
              style={{
                background: 'oklch(0.25 0.025 250)',
                color: 'oklch(0.98 0.003 250)'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'oklch(0.20 0.030 250)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'oklch(0.25 0.025 250)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {(isLoading || login.isPending) ? (
                <>
                  <Loader2Icon className='animate-spin' size={22} strokeWidth={3} />
                  <span>AUTHENTICATING</span>
                </>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <ArrowRight 
                    size={22} 
                    strokeWidth={3} 
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          <div 
            className="mt-10 text-sm font-semibold"
            style={{ color: 'oklch(0.50 0.015 250)' }}
          >
            New voter?{' '}
            <Link
              to="/auth/register"
              className="font-black transition-colors inline-flex items-center gap-1.5"
              style={{ color: 'oklch(0.50 0.18 250)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'oklch(0.40 0.20 250)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'oklch(0.50 0.18 250)'}
            >
              Create account
              <ArrowRight size={16} strokeWidth={3} />
            </Link>
          </div>
        </div>
      </div>

      {/* Right - Color drenched brand panel */}
      <div 
        className="lg:w-[42%] relative overflow-hidden flex items-center justify-center p-10 lg:p-16 min-h-[40vh] lg:min-h-0"
        style={{
          background: 'linear-gradient(165deg, oklch(0.50 0.18 250) 0%, oklch(0.45 0.20 255) 100%)'
        }}
      >
        {/* Decorative elements */}
        <div 
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, oklch(0.70 0.15 250) 0%, transparent 70%)',
            transform: 'translate(30%, -30%)'
          }}
        />
        <div 
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, oklch(0.35 0.22 260) 0%, transparent 70%)',
            transform: 'translate(-25%, 25%)'
          }}
        />

        <div className="relative z-10 max-w-md space-y-10">
          <div className="space-y-5">
            <h2 
              className="text-4xl lg:text-5xl font-black tracking-tight leading-tight"
              style={{ color: 'oklch(0.98 0.005 250)' }}
            >
              Your voice
              <br />
              shapes our
              <br />
              community
            </h2>
            <p 
              className="text-lg font-medium leading-relaxed"
              style={{ color: 'oklch(0.88 0.008 250)' }}
            >
              Participate in transparent, secure elections that determine the future of the Computer Studies Organization.
            </p>
          </div>

          <div className="space-y-4">
            {[
              'End-to-end encrypted voting',
              'One student, one vote guarantee',
              'Real-time result transparency'
            ].map((feature, i) => (
              <div 
                key={i}
                className="flex items-center gap-3"
              >
                <CheckCircle2 
                  size={24} 
                  strokeWidth={2.5}
                  style={{ 
                    color: 'oklch(0.75 0.15 140)',
                    flexShrink: 0
                  }}
                />
                <span 
                  className="text-base font-bold"
                  style={{ color: 'oklch(0.95 0.005 250)' }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* Trust badge */}
          <div 
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full"
            style={{
              background: 'oklch(0.40 0.20 250)',
              border: '2px solid oklch(0.60 0.15 250)'
            }}
          >
            <div 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: 'oklch(0.75 0.15 140)' }}
            />
            <span 
              className="text-sm font-black uppercase tracking-wider"
              style={{ 
                color: 'oklch(0.98 0.005 250)',
                letterSpacing: '0.08em'
              }}
            >
              System Active
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
