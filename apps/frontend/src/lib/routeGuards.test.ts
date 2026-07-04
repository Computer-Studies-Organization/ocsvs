import { describe, expect, test } from "vitest";

import {
  getAdminElectionsRouteRedirectPath,
  getAdminRouteRedirectPath,
  getProtectedRouteRedirectPath,
  getPublicRouteRedirectPath,
} from "./routeGuards";
import { UserRole } from "./types";

const adminUser = {
  user: {
    id: "admin-id",
    email: "admin@example.com",
    username: "admin",
    role: UserRole.ADMIN,
  },
};

const superAdminUser = {
  user: {
    id: "superadmin-id",
    email: "superadmin@example.com",
    username: "superadmin",
    role: UserRole.SUPER_ADMIN,
  },
};

const standardUser = {
  user: {
    id: "user-id",
    email: "user@example.com",
    username: "user",
    role: UserRole.USER,
  },
};

describe("routeGuards", () => {
  test("public routes redirect authenticated admins to the admin dashboard", () => {
    expect(getPublicRouteRedirectPath(adminUser)).toBe("/admin-dashboard");
  });

  test("public routes redirect authenticated super_admins to the admin dashboard", () => {
    expect(getPublicRouteRedirectPath(superAdminUser)).toBe("/admin-dashboard");
  });

  test("public routes redirect authenticated users to the dashboard", () => {
    expect(getPublicRouteRedirectPath(standardUser)).toBe("/voting");
  });

  test("public routes allow unauthenticated users to continue", () => {
    expect(getPublicRouteRedirectPath(null)).toBeNull();
  });

  test("protected routes redirect unauthenticated users to login", () => {
    expect(getProtectedRouteRedirectPath(null)).toBe("/auth");
  });

  test("protected routes allow authenticated users to continue", () => {
    expect(getProtectedRouteRedirectPath(standardUser)).toBeNull();
  });

  test("admin routes redirect unauthenticated users to login", () => {
    expect(getAdminRouteRedirectPath(null)).toBe("/auth");
  });

  test("admin routes redirect non-admin users to the dashboard", () => {
    expect(getAdminRouteRedirectPath(standardUser)).toBe("/voting");
  });

  test("admin routes allow admins to continue", () => {
    expect(getAdminRouteRedirectPath(adminUser)).toBeNull();
  });

  test("admin routes allow super_admins to continue", () => {
    expect(getAdminRouteRedirectPath(superAdminUser)).toBeNull();
  });

  test("admin-elections routes redirect unauthenticated users to login", () => {
    expect(getAdminElectionsRouteRedirectPath(null)).toBe("/auth");
  });

  test("admin-elections routes redirect non-admin users to the dashboard", () => {
    expect(getAdminElectionsRouteRedirectPath(standardUser)).toBe("/voting");
  });

  test("admin-elections routes allow admins to continue", () => {
    expect(getAdminElectionsRouteRedirectPath(adminUser)).toBeNull();
  });

  test("admin-elections routes allow super_admins to continue", () => {
    expect(getAdminElectionsRouteRedirectPath(superAdminUser)).toBeNull();
  });
});
