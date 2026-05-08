import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ToastProvider } from '@/lib/toast'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <ToastProvider>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </ToastProvider>
  )
}