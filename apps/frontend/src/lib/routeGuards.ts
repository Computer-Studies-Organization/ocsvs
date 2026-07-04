import type { TUserData } from "$lib/types";
import { UserRole } from "$lib/types";

export function getPublicRouteRedirectPath(data: TUserData | null | undefined) {
  if (data) {
    return data.user.role === UserRole.ADMIN || data.user.role === UserRole.SUPER_ADMIN
      ? "/admin-dashboard"
      : "/voting";
  }
  return null;
}

export function getProtectedRouteRedirectPath(data: TUserData | null | undefined) {
  if (!data) {
    return "/auth";
  }
  return null;
}

export function getAdminRouteRedirectPath(data: TUserData | null | undefined) {
  if (!data) {
    return "/auth";
  }
  if (data.user.role !== UserRole.ADMIN && data.user.role !== UserRole.SUPER_ADMIN) {
    return "/voting";
  }
  return null;
}

// Alias — same logic, kept as a separate export so callers can import the more
// specific name without changing the behaviour if the elections guard diverges later.
export const getAdminElectionsRouteRedirectPath = getAdminRouteRedirectPath;
