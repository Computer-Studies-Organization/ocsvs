import { useAuthMe } from "@/hooks/userHooks";
import { Navigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { ReactNode } from "react";

interface ChildProps {
    children: ReactNode
}

/**
 * Public route component - redirects authenticated users to dashboard
 * public route (e.g., landing page, login, register)
 */
export const PublicRoute = ({ children }: ChildProps) => {
  const { data, isLoading } = useAuthMe();

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center">
        <Loader2Icon className="animate-spin" size={40} />
      </div>
    );
  }

  if (data) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * Protected route component - redirects unauthenticated users to login
 * protected route (e.g., dashboard)
 */
export const ProtectedRoute = ({ children }: ChildProps) => {
  const { data, isLoading } = useAuthMe();

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center">
        <Loader2Icon className="animate-spin" size={40} />
      </div>
    );
  }

  if (!data) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};