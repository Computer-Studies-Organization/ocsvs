import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "$lib/api/client";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

import { load } from "./+page";

describe("admin position detail loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["election", "positions", "candidates", "partyLists"] as const)(
    "redirects to /auth when %s request is unauthorized (401)",
    async (failedResource) => {
      mockCacheGet.mockImplementation((resource: string) => ({
        fetchOrThrow: vi.fn().mockImplementation(async () => {
          if (resource === failedResource) throw new ApiError(401, "Unauthorized");
          if (resource === "election") {
            return {
              id: "e1",
              name: "CSO 2026",
              status: "draft",
              opensAt: null,
              closesAt: null,
              createdAt: 1,
              updatedAt: 1,
            };
          }
          if (resource === "positions") return [];
          if (resource === "candidates") return [];
          return [];
        }),
      }));

      await expect(
        load({
          params: { electionId: "e1", positionId: "p1" },
          fetch: vi.fn(),
          depends: vi.fn(),
        } as any),
      ).rejects.toMatchObject({ status: 302, location: "/auth" });
    },
  );
});
