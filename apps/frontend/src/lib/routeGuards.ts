import type { TUserData } from "@/@types";
import { UserRole } from "@/@types";

export const getPublicRouteRedirectPath = (data: TUserData | null | undefined) => {
  if (data) {
    // Redirect admins to admin panel, regular users to dashboard
    return data.user.role === UserRole.ADMIN ? "/admin-dashboard" : "/dashboard";
  }

  return null;
};

export const getProtectedRouteRedirectPath = (data: TUserData | null | undefined) => {
  if (!data) {
    return "/auth/login";
  }

  return null;
};

export const getAdminRouteRedirectPath = (data: TUserData | null | undefined) => {
  if (!data) {
    return "/auth/login";
  }

  if (data.user.role !== UserRole.ADMIN) {
    return "/dashboard";
  }

  return null;
};
