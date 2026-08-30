import { redirect } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
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

export function redirectOnUnauthorized(cause: unknown): void {
  if (cause instanceof ApiError && cause.status === 401) redirect(302, "/auth");
}
