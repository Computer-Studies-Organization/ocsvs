import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppCache, serializeParams } from "./app-cache.svelte";
import { appCache as productionAppCache } from "./index";
import type { ApiClientAdapter } from "./api-client";
import { authStore } from "$lib/stores/auth.svelte";
import { UserRole } from "$lib/types";

describe("serializeParams", () => {
  it("serializes objects stably by sorting keys alphabetically", () => {
    const p1 = { electionId: "e1", includeInactive: true };
    const p2 = { includeInactive: true, electionId: "e1" };
    expect(serializeParams(p1)).toBe(serializeParams(p2));
    expect(serializeParams(p1)).toBe('{"electionId":"e1","includeInactive":true}');
  });

  it("handles null or undefined params gracefully", () => {
    expect(serializeParams(null as any)).toBe("");
    expect(serializeParams(undefined as any)).toBe("");
  });
});

describe("AppCache", () => {
  let mockApi: ApiClientAdapter;

  beforeEach(() => {
    mockApi = {
      listPartyLists: vi.fn(),
      listElections: vi.fn(),
      getElection: vi.fn(),
      getVotingState: vi.fn(),
      listPositions: vi.fn(),
      allCandidates: vi.fn(),
      listResults: vi.fn(),
      fetchUsers: vi.fn(),
    };
  });

  it("retrieves cache entries idempotently for structural identical parameters", () => {
    const cache = new AppCache(mockApi);
    const entry1 = cache.get("candidates", { electionId: "e1", positionId: "p1" });
    const entry2 = cache.get("candidates", { positionId: "p1", electionId: "e1" });
    expect(entry1).toBe(entry2);
  });

  it("resolves cache queries and caches subsequent requests", async () => {
    vi.mocked(mockApi.listElections).mockResolvedValue([{ id: "e1", name: "CSO Elec" } as any]);
    const cache = new AppCache(mockApi);

    const first = await cache.get("elections", {}).fetch();
    expect(first).toEqual([{ id: "e1", name: "CSO Elec" }]);
    expect(mockApi.listElections).toHaveBeenCalledTimes(1);

    const second = await cache.get("elections", {}).fetch();
    expect(second).toEqual([{ id: "e1", name: "CSO Elec" }]);
    expect(mockApi.listElections).toHaveBeenCalledTimes(1); // Cached
  });

  it("allows forcing reload bypass", async () => {
    vi.mocked(mockApi.listElections).mockResolvedValue([{ id: "e1" } as any]);
    const cache = new AppCache(mockApi);

    await cache.get("elections", {}).fetch();
    await cache.get("elections", {}).fetch(true);
    expect(mockApi.listElections).toHaveBeenCalledTimes(2);
  });

  it("refetches voting state after an authentication cache boundary", async () => {
    const firstState = { myVotes: { electionId: "e1", hasVoted: true } };
    const secondState = { myVotes: { electionId: "e1", hasVoted: false } };
    vi.mocked(mockApi.getVotingState)
      .mockResolvedValueOnce(firstState as any)
      .mockResolvedValueOnce(secondState as any);
    const cache = new AppCache(mockApi);

    await cache.get("votingState", {}).fetch();
    cache.invalidate();

    await expect(cache.get("votingState", {}).fetch()).resolves.toEqual(secondState);
    expect(mockApi.getVotingState).toHaveBeenCalledTimes(2);
  });

  it("does not return stale voting state after an authentication identity or role transition", async () => {
    const firstState = {
      open: null,
      nextDraft: null,
      lastClosed: null,
      ballot: null,
      myVotes: { electionId: "e1", hasVoted: true },
    };
    const secondState = { ...firstState, myVotes: { electionId: null, hasVoted: false } };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstState), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondState), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    productionAppCache.invalidate();
    authStore.set({
      user: {
        user: { id: "user-1", email: "user@example.com", username: "user", role: UserRole.USER },
      },
      loading: false,
    });

    const entry = productionAppCache.get("votingState", { includeBallot: true });
    await entry.fetchOrThrow(false, { fetch });
    expect(entry.data).toEqual(firstState);

    authStore.set({
      user: {
        user: { id: "user-1", email: "user@example.com", username: "user", role: UserRole.ADMIN },
      },
      loading: false,
    });

    expect(entry.data).toBeNull();
    await expect(entry.fetchOrThrow(false, { fetch })).resolves.toEqual(secondState);
    expect(fetch).toHaveBeenCalledTimes(2);
    productionAppCache.invalidate();
  });

  it("supports partial parameters cascading invalidation", async () => {
    vi.mocked(mockApi.listPositions).mockResolvedValue([{ id: "pos-1", electionId: "e1" } as any]);
    vi.mocked(mockApi.listResults).mockResolvedValue({
      results: [{ positionId: "pos-1" } as any],
      turnout: {
        electionId: "e1",
        totalEligibleVoters: null,
        totalBallotsCast: 0,
        turnoutPercentage: null,
      },
    });
    const cache = new AppCache(mockApi);

    const posEntry = cache.get("positions", { electionId: "e1" });
    const resEntry = cache.get("results", { electionId: "e1" });
    const otherEntry = cache.get("positions", { electionId: "e2" });

    await posEntry.fetch();
    await resEntry.fetch();
    await otherEntry.fetch();

    expect(posEntry.data).not.toBeNull();
    expect(resEntry.data).not.toBeNull();
    expect(otherEntry.data).not.toBeNull();

    // Invalidate everything related to election e1
    cache.invalidate({ params: { electionId: "e1" } });

    expect(posEntry.data).toBeNull();
    expect(resEntry.data).toBeNull();
    expect(otherEntry.data).not.toBeNull(); // Untouched
  });

  it("invalidates all entries when no filter is provided", async () => {
    vi.mocked(mockApi.listElections).mockResolvedValue([{ id: "e1" } as any]);
    const cache = new AppCache(mockApi);

    const entry = cache.get("elections", {});
    await entry.fetch();
    expect(entry.data).not.toBeNull();

    cache.invalidate();
    expect(entry.data).toBeNull();
  });

  it("invalidates only entries matching both resource and params when both are supplied", async () => {
    vi.mocked(mockApi.listPositions).mockResolvedValue([{ id: "pos-1" } as any]);
    vi.mocked(mockApi.listElections).mockResolvedValue([{ id: "e1" } as any]);
    const cache = new AppCache(mockApi);

    const posE1 = cache.get("positions", { electionId: "e1" });
    const posE2 = cache.get("positions", { electionId: "e2" });
    const electionsEntry = cache.get("elections", {});

    await posE1.fetch();
    await posE2.fetch();
    await electionsEntry.fetch();

    expect(posE1.data).not.toBeNull();
    expect(posE2.data).not.toBeNull();
    expect(electionsEntry.data).not.toBeNull();

    cache.invalidate({ resource: "positions", params: { electionId: "e1" } });

    expect(posE1.data).toBeNull();
    expect(posE2.data).not.toBeNull(); // different electionId, untouched
    expect(electionsEntry.data).not.toBeNull(); // different resource, untouched
  });

  it("invalidates only entries matching the specified resource when resource-only filter is provided", async () => {
    vi.mocked(mockApi.listPositions).mockResolvedValue([{ id: "pos-1" } as any]);
    vi.mocked(mockApi.listElections).mockResolvedValue([{ id: "e1" } as any]);
    const cache = new AppCache(mockApi);

    const posEntry = cache.get("positions", { electionId: "e1" });
    const electionsEntry = cache.get("elections", {});

    await posEntry.fetch();
    await electionsEntry.fetch();

    expect(posEntry.data).not.toBeNull();
    expect(electionsEntry.data).not.toBeNull();

    cache.invalidate({ resource: "elections" });

    expect(electionsEntry.data).toBeNull();
    expect(posEntry.data).not.toBeNull(); // different resource, untouched
  });

  it("caches fetchUsers returns the full paginated response", async () => {
    const mockResponse = {
      data: [{ id: "u1", firstName: "Alice" }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    vi.mocked(mockApi.fetchUsers).mockResolvedValue(mockResponse as any);
    const cache = new AppCache(mockApi);

    const result = await cache.get("users", { page: 1, limit: 10 }).fetch();
    expect(result).toEqual(mockResponse);
    expect(mockApi.fetchUsers).toHaveBeenCalledWith({ page: 1, limit: 10 }, undefined);
  });
});
