import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "$lib/api/client";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

import { load } from "./+page";

describe("election detail loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads expired open elections as closed results", async () => {
    const now = Math.floor(Date.now() / 1000);
    const election = {
      id: "e1",
      name: "Past election",
      description: null,
      status: "open",
      opensAt: now - 3600,
      closesAt: now - 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const fetchResults = vi.fn().mockResolvedValue({
      results: [],
      turnout: {
        electionId: "e1",
        totalEligibleVoters: 10,
        totalBallotsCast: 0,
        turnoutPercentage: 0,
      },
    });
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow:
        resource === "results"
          ? fetchResults
          : vi
              .fn()
              .mockResolvedValue(
                resource === "election"
                  ? election
                  : { open: null, nextDraft: null, lastClosed: { id: "e1" }, myVotes: {} },
              ),
    }));

    const fetch = vi.fn();
    const result = (await load({
      params: { electionId: "e1" },
      fetch,
      depends: vi.fn(),
    } as any)) as any;

    expect(result.election.status).toBe("closed");
    expect(result.results).toEqual([]);
    expect(mockCacheGet).toHaveBeenCalledWith("results", { electionId: "e1" });
    expect(fetchResults).toHaveBeenCalledWith(true, { fetch });
    expect(mockCacheGet).not.toHaveBeenCalledWith("votingState", {});
  });

  it("keeps a future open election as draft when another draft is next", async () => {
    const now = Math.floor(Date.now() / 1000);
    const election = {
      id: "e1",
      name: "Future election",
      description: null,
      status: "open",
      opensAt: now + 3600,
      closesAt: now + 7200,
      createdAt: 1,
      updatedAt: 1,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockResolvedValue(
        resource === "election"
          ? election
          : resource === "votingState"
            ? {
                open: null,
                nextDraft: {
                  id: "e2",
                  name: "Earlier draft",
                  opensAt: now + 1800,
                  closesAt: now + 5400,
                },
                lastClosed: null,
                myVotes: { electionId: null, hasVoted: false },
              }
            : [],
      ),
    }));

    const result = (await load({
      params: { electionId: "e1" },
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any)) as any;

    expect(result.election.status).toBe("draft");
    expect(result.results).toBeNull();
    expect(mockCacheGet).not.toHaveBeenCalledWith("results", { electionId: "e1" });
  });

  it("propagates an election service failure instead of rendering a false 404", async () => {
    const failure = new ApiError(503, "Service unavailable");
    mockCacheGet.mockReturnValue({ fetchOrThrow: vi.fn().mockRejectedValue(failure) });

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toBe(failure);
  });

  it("keeps a missing election as a 404", async () => {
    mockCacheGet.mockReturnValue({
      fetchOrThrow: vi.fn().mockRejectedValue(new ApiError(404, "Election not found")),
    });

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("redirects to /auth when election request is unauthorized (401)", async () => {
    mockCacheGet.mockReturnValue({
      fetchOrThrow: vi.fn().mockRejectedValue(new ApiError(401, "Unauthorized")),
    });

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/auth" });
  });

  it("redirects to /auth when voting-state request is unauthorized (401)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const election = {
      id: "e1",
      name: "Active Election",
      status: "open",
      opensAt: now - 100,
      closesAt: now + 1000,
      createdAt: 1,
      updatedAt: 1,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        throw new ApiError(401, "Unauthorized");
      }),
    }));

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/auth" });
  });

  it("redirects to /auth when results request is unauthorized (401)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const election = {
      id: "e1",
      name: "Active Election",
      status: "open",
      opensAt: now - 100,
      closesAt: now + 1000,
      createdAt: 1,
      updatedAt: 1,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "votingState") {
          return { myVotes: { electionId: "e1", hasVoted: true } };
        }
        throw new ApiError(401, "Unauthorized");
      }),
    }));

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/auth" });
  });
});
