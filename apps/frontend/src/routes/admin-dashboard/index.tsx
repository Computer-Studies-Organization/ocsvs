import { createFileRoute, Navigate } from '@tanstack/react-router'
import { AdminRoute } from '@/middleware'

export const Route = createFileRoute('/admin-dashboard/')({
  component: () => (
    <AdminRoute>
      <Navigate to="/admin-dashboard-v2" replace />
    </AdminRoute>
  ),
})

// POSITIONS export for dashboard route
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
