import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import ErrorPage from "./+error.svelte";
import { UserRole } from "$lib/types";

const mockPageState = vi.hoisted(() => ({
  status: 404,
  error: { message: "Page Not Found" } as { message?: string; stack?: string } | null,
  url: new URL("https://example.test/elections/nonexistent"),
}));

const mockAuthUser = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; username: string; role: UserRole },
  loading: false,
}));

vi.mock("$app/state", () => ({
  page: mockPageState,
}));

vi.mock("$lib/stores/auth.svelte", () => ({
  authStore: {
    get user() {
      return mockAuthUser.user;
    },
    get loading() {
      return mockAuthUser.loading;
    },
    logout: vi.fn(),
  },
}));

vi.mock("$lib/api/auth", () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    invalidate: vi.fn(),
  },
}));

const errorHtmlSource = readFileSync(
  fileURLToPath(new URL("../error.html", import.meta.url)),
  "utf8",
);
const errorSvelteSource = readFileSync(
  fileURLToPath(new URL("./+error.svelte", import.meta.url)),
  "utf8",
);

describe("static fallback error template (src/error.html)", () => {
  it("contains dark theme styles and SvelteKit error placeholders", () => {
    expect(errorHtmlSource).toContain("%sveltekit.status%");
    expect(errorHtmlSource).toContain("%sveltekit.error.message%");
    expect(errorHtmlSource).toContain("#020617");
    expect(errorHtmlSource).toContain("Unable to load application");
    expect(errorHtmlSource).toContain("window.location.reload()");
  });
});

describe("root error boundary (+error.svelte)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageState.status = 404;
    mockPageState.error = { message: "Election not found" };
    mockPageState.url = new URL("https://example.test/elections/unknown-id");
    mockAuthUser.user = null;
  });

  describe("404 Not Found", () => {
    it("renders custom resource missing message when provided", () => {
      mockPageState.status = 404;
      mockPageState.error = { message: "Election not found" };
      const { body } = render(ErrorPage);

      expect(body).toContain("404 • Not Found");
      expect(body).toContain("Election not found");
      expect(body).toContain("The requested resource could not be found");
    });

    it("renders Admin Dashboard CTA when logged in as admin", () => {
      mockPageState.status = 404;
      mockAuthUser.user = {
        id: "admin-1",
        email: "admin@test.com",
        username: "admin_user",
        role: UserRole.ADMIN,
      };

      const { body } = render(ErrorPage);
      expect(body).toContain('href="/admin-dashboard"');
      expect(body).toContain("Admin Dashboard");
    });

    it("renders Return to Voting CTA when logged in as voter", () => {
      mockPageState.status = 404;
      mockAuthUser.user = {
        id: "voter-1",
        email: "voter@test.com",
        username: "voter_user",
        role: UserRole.USER,
      };

      const { body } = render(ErrorPage);
      expect(body).toContain('href="/voting"');
      expect(body).toContain("Return to Voting");
    });

    it("renders Sign In CTA when not authenticated", () => {
      mockPageState.status = 404;
      mockAuthUser.user = null;

      const { body } = render(ErrorPage);
      expect(body).toContain('href="/auth"');
      expect(body).toContain("Sign In");
    });
  });

  describe("403 Forbidden / Access Denied", () => {
    it("renders access denied view and user role badge", () => {
      mockPageState.status = 403;
      mockPageState.error = { message: "You do not have permission to view this resource." };
      mockAuthUser.user = {
        id: "voter-1",
        email: "voter@test.com",
        username: "voter_user",
        role: UserRole.USER,
      };

      const { body } = render(ErrorPage);
      expect(body).toContain("403 • Access Restricted");
      expect(body).toContain("Access Denied");
      expect(body).toContain("@voter_user");
      expect(body).toContain("user");
      expect(body).toContain('href="/voting"');
      expect(body).toContain("Voter Portal");
      expect(body).toContain("Sign Out");
    });
  });

  describe("500 Server Error", () => {
    it("renders server error with neutral recovery text and retry CTA", () => {
      mockPageState.status = 500;
      mockPageState.error = { message: "Database connection failed" };
      mockAuthUser.user = {
        id: "voter-1",
        email: "voter@test.com",
        username: "voter_user",
        role: UserRole.USER,
      };

      const { body } = render(ErrorPage);
      expect(body).toContain("500 • Server Error");
      expect(body).toContain("Internal Server Error");
      expect(body).toContain("Please try again.");
      expect(body).toContain("Try Again");
    });

    it("renders the actual status for other server errors", () => {
      mockPageState.status = 503;
      mockPageState.error = { message: "Service unavailable" };

      const { body } = render(ErrorPage);

      expect(body).toContain("503 • Server Error");
      expect(body).not.toContain("500 • Server Error");
    });
  });

  describe("navigation header integration", () => {
    it("renders full Header component when user is authenticated", () => {
      mockAuthUser.user = {
        id: "voter-1",
        email: "voter@test.com",
        username: "voter_user",
        role: UserRole.USER,
      };

      const { body } = render(ErrorPage);
      expect(body).toContain("voter_user");
      expect(body).toContain('href="/voting"');
      expect(body).toContain('href="/settings"');
    });

    it("renders guest header with Sign In link when user is not authenticated", () => {
      mockAuthUser.user = null;

      const { body } = render(ErrorPage);
      expect(body).toContain("CSO Voting System");
      expect(body).toContain('href="/auth"');
    });
  });

  describe("structure and diagnostics", () => {
    it("includes developer diagnostic details and accessible touch target styles", () => {
      expect(errorSvelteSource).toContain("import.meta.env.DEV");
      expect(errorSvelteSource).toContain("Technical Diagnostics (Development Only)");
      expect(errorSvelteSource).toContain("min-h-11");
      expect(errorSvelteSource).toContain("CSO Voting System");
    });
  });
});
