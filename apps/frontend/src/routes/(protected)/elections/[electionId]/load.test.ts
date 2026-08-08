import { beforeEach, describe, expect, it, vi } from "vitest";

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

    mockCacheGet.mockImplementation((resource: string) => ({
      fetch: vi
        .fn()
        .mockResolvedValue(
          resource === "election"
            ? election
            : resource === "votingState"
              ? { open: null, nextDraft: null, lastClosed: { id: "e1" }, myVotes: {} }
              : [],
        ),
    }));

    const result = (await load({
      params: { electionId: "e1" },
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any)) as any;

    expect(result.election.status).toBe("closed");
    expect(result.results).toEqual([]);
    expect(mockCacheGet).toHaveBeenCalledWith("results", { electionId: "e1" });
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
      fetch: vi.fn().mockResolvedValue(
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
                myVotes: { electionId: null, votes: [] },
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
});
