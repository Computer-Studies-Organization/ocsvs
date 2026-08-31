import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "$lib/api/client";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

import { loadElectionData } from "./load-election-data";

describe("loadElectionData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads election, positions, partyLists, and candidates successfully", async () => {
    const election = {
      id: "e1",
      name: "CSO 2026",
      status: "draft",
      opensAt: null,
      closesAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const positions = [{ id: "pos1", name: "President", displayOrder: 1, electionId: "e1" }];
    const partyLists = [{ id: "party1", name: "CSO Slate", code: "CSO", electionId: "e1" }];
    const candidates = [
      { id: "c1", fullName: "Alice", positionId: "pos1", partyId: "party1", isActive: 1 },
    ];

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "positions") return positions;
        if (resource === "partyLists") return partyLists;
        if (resource === "candidates") return candidates;
        return [];
      }),
    }));

    const depends = vi.fn();
    const result = await loadElectionData("e1", {
      fetch: vi.fn(),
      depends,
    } as any);

    expect(depends).toHaveBeenCalledWith("app:election");
    expect(result).toEqual({ election, positions, partyLists, candidates });
  });

  it.each(["positions", "partyLists", "candidates"] as const)(
    "redirects to /auth when %s request is unauthorized (401)",
    async (failedResource) => {
      const election = {
        id: "e1",
        name: "CSO 2026",
        status: "draft",
        opensAt: null,
        closesAt: null,
        createdAt: 1,
        updatedAt: 1,
      };

      mockCacheGet.mockImplementation((resource: string) => ({
        fetchOrThrow: vi.fn().mockImplementation(async () => {
          if (resource === "election") return election;
          if (resource === failedResource) throw new ApiError(401, "Unauthorized");
          return [];
        }),
      }));

      await expect(
        loadElectionData("e1", {
          fetch: vi.fn(),
          depends: vi.fn(),
        } as any),
      ).rejects.toMatchObject({ status: 302, location: "/auth" });
    },
  );

  it("throws 404 error if election is not found", async () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") throw new ApiError(404, "Not Found");
        return [];
      }),
    }));

    await expect(
      loadElectionData("nonexistent", {
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });
});
