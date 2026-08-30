import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "$lib/api/client";

const { mockGetMyProfile } = vi.hoisted(() => ({
  mockGetMyProfile: vi.fn(),
}));

vi.mock("$lib/api/profile", () => ({
  getMyProfile: mockGetMyProfile,
}));

import { load } from "./+page";

describe("settings loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthorized users to /auth", async () => {
    mockGetMyProfile.mockRejectedValue(new ApiError(401, "Unauthorized"));

    await expect(load({ depends: vi.fn() } as any)).rejects.toMatchObject({
      status: 302,
      location: "/auth",
    });
  });
});
