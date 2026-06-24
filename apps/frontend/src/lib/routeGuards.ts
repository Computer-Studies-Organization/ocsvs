import type { TUserData } from "$lib/types";
import { UserRole } from "$lib/types";

export function getPublicRouteRedirectPath(data: TUserData | null | undefined) {
  if (data) {
    return data.user.role === UserRole.ADMIN ? "/admin-dashboard" : "/voting";
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
  if (data.user.role !== UserRole.ADMIN) {
    return "/voting";
  }
  return null;
}

export function getAdminElectionsRouteRedirectPath(data: TUserData | null | undefined) {
  if (!data) {
    return "/auth";
  }
  if (data.user.role !== UserRole.ADMIN) {
    return "/voting";
  }
  return null;
}
