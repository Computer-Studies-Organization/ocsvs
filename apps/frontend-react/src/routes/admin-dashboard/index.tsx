import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AdminRoute } from "@/middleware";

export const Route = createFileRoute("/admin-dashboard/")({
  component: () => (
    <AdminRoute>
      <Navigate to="/admin-dashboard-v2" replace />
    </AdminRoute>
  ),
});
