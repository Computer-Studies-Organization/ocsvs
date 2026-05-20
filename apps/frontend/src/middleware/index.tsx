import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { Loader2Icon } from 'lucide-react'
import { useAuthMe } from '@/hooks/userHooks'
import {
  getAdminRouteRedirectPath,
  getProtectedRouteRedirectPath,
  getPublicRouteRedirectPath,
} from '@/lib/routeGuards'

interface ChildProps {
  children: ReactNode
}

/**
 * Public route component - redirects authenticated users to dashboard
 * public route (e.g., landing page, login, register)
 */
export function PublicRoute({ children }: ChildProps) {
  const { data, isLoading } = useAuthMe()

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center">
        <Loader2Icon className="animate-spin" size={40} />
      </div>
    )
  }

  const redirectPath = getPublicRouteRedirectPath(data)

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}

/**
 * Protected route component - redirects unauthenticated users to login
 * protected route (e.g., dashboard)
 */
export function ProtectedRoute({ children }: ChildProps) {
  const { data, isLoading } = useAuthMe()

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center">
        <Loader2Icon className="animate-spin" size={40} />
      </div>
    )
  }

  const redirectPath = getProtectedRouteRedirectPath(data)

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}

/**
 * Admin route component - redirects unauthenticated users to login
 * and authenticated non-admin users to the dashboard
 */
export function AdminRoute({ children }: ChildProps) {
  const { data, isLoading } = useAuthMe()

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center">
        <Loader2Icon className="animate-spin" size={40} />
      </div>
    )
  }

  const redirectPath = getAdminRouteRedirectPath(data)

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}
