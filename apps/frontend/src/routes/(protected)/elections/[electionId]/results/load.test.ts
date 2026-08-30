import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "$lib/api/client";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

import { load } from "./+page";

describe("voter election results loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("force-refreshes cached results for a closed election", async () => {
    const election = {
      id: "e1",
      name: "CSO 2026",
      status: "closed",
      opensAt: 1000,
      closesAt: 2000,
      createdAt: 500,
      updatedAt: 600,
    };
    const results = [
      {
        positionId: "pos-1",
        positionName: "President",
        totalVotes: 10,
        candidates: [
          {
            candidateId: "c1",
            fullName: "Alice",
            voteCount: 10,
            percentage: 100,
            imageUrl: null,
            partyName: "LEAD",
          },
        ],
      },
    ];
    const turnout = {
      electionId: "e1",
      totalEligibleVoters: 50,
      totalBallotsCast: 10,
      turnoutPercentage: 20,
    };

    const fetchResults = vi.fn().mockResolvedValue({ results, turnout });
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: resource === "results" ? fetchResults : vi.fn().mockResolvedValue(election),
    }));

    const fetch = vi.fn();
    const data = (await load({
      params: { electionId: "e1" },
      fetch,
    } as any)) as any;

    expect(data.election).toEqual(election);
    expect(data.results).toEqual(results);
    expect(data.turnout).toEqual(turnout);
    expect(fetchResults).toHaveBeenCalledWith(true, { fetch });
  });

  it("throws 404 for a draft election when user is a non-admin", async () => {
    const election = {
      id: "e1",
      name: "Draft Election",
      status: "draft",
      opensAt: null,
      closesAt: null,
      createdAt: 500,
      updatedAt: 600,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "results") throw new ApiError(404, "Election not found");
        return null;
      }),
    }));

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("loads a draft election when the backend authorizes the admin request", async () => {
    const election = {
      id: "e1",
      name: "Draft Election",
      status: "draft",
      opensAt: null,
      closesAt: null,
      createdAt: 500,
      updatedAt: 600,
    };
    const results = [
      { positionId: "p1", positionName: "President", totalVotes: 0, candidates: [] },
    ];

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "results") {
          return {
            results,
            turnout: {
              electionId: "e1",
              totalEligibleVoters: 50,
              totalBallotsCast: 0,
              turnoutPercentage: 0,
            },
          };
        }
        return null;
      }),
    }));

    const data = (await load({
      params: { electionId: "e1" },
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any)) as any;

    expect(data.election).toEqual(election);
    expect(data.results).toEqual(results);
  });

  it("redirects non-voted user on open election to voting", async () => {
    const now = Math.floor(Date.now() / 1000);
    const election = {
      id: "e1",
      name: "Active Election",
      status: "open",
      opensAt: now - 100,
      closesAt: now + 1000,
      createdAt: 500,
      updatedAt: 600,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "results") throw new ApiError(403, "Results unavailable");
        return null;
      }),
    }));

    await expect(
      load({
        params: { electionId: "e1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/voting" });
  });

  it("allows user who voted on open election to view results", async () => {
    const now = Math.floor(Date.now() / 1000);
    const election = {
      id: "e1",
      name: "Active Election",
      status: "open",
      opensAt: now - 100,
      closesAt: now + 1000,
      createdAt: 500,
      updatedAt: 600,
    };
    const results = [{ positionId: "p1", positionName: "Pres", totalVotes: 1, candidates: [] }];

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "results") {
          return {
            results,
            turnout: {
              electionId: "e1",
              totalEligibleVoters: 10,
              totalBallotsCast: 1,
              turnoutPercentage: 10,
            },
          };
        }
        return null;
      }),
    }));

    const data = (await load({
      params: { electionId: "e1" },
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any)) as any;

    expect(data.results).toEqual(results);
  });

  it("redirects to /auth when election request is unauthorized (401)", async () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") throw new ApiError(401, "Unauthorized");
        return null;
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
    const election = {
      id: "e1",
      name: "CSO 2026",
      status: "closed",
      opensAt: 1000,
      closesAt: 2000,
      createdAt: 500,
      updatedAt: 600,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "results") throw new ApiError(401, "Unauthorized");
        return [];
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

  it("redirects to /auth when party-list request is unauthorized (401)", async () => {
    const election = {
      id: "e1",
      name: "CSO 2026",
      status: "closed",
      opensAt: 1000,
      closesAt: 2000,
      createdAt: 500,
      updatedAt: 600,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "results") {
          return {
            results: [],
            turnout: {
              electionId: "e1",
              totalEligibleVoters: 10,
              totalBallotsCast: 0,
              turnoutPercentage: 0,
            },
          };
        }
        if (resource === "partyLists") throw new ApiError(401, "Unauthorized");
        return [];
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
