import type { TUserData } from "$lib/types";
import { UserRole } from "$lib/types";

type TUserSession = TUserData["user"];

export function getPublicRouteRedirectPath(user: TUserSession | null | undefined) {
  if (user) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN
      ? "/admin-dashboard"
      : "/voting";
  }
  return null;
}

export function getProtectedRouteRedirectPath(user: TUserSession | null | undefined) {
  if (!user) {
    return "/auth";
  }
  return null;
}

export function getAdminRouteRedirectPath(user: TUserSession | null | undefined) {
  if (!user) {
    return "/auth";
  }
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
    return "/voting";
  }
  return null;
}
