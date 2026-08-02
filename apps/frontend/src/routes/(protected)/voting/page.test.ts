import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "./+page";

const { mockCacheGet, mockListPartyLists } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockListPartyLists: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: mockCacheGet,
  },
}));

vi.mock("$lib/api/parties", () => ({
  listPartyLists: mockListPartyLists,
}));

describe("voting page loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => ({
      fetch: vi.fn().mockResolvedValue(
        resource === "votingState"
          ? {
              open: { id: "election-1" },
              nextDraft: null,
              lastClosed: null,
              myVotes: { electionId: "election-1", votes: [] },
            }
          : [],
      ),
    }));
  });

  it("surfaces party-list loading failures through loadError", async () => {
    mockListPartyLists.mockRejectedValueOnce(new Error("party-list request failed"));

    const result = (await load({
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any)) as any;

    expect(result.partyLists).toEqual([]);
    expect(result.loadError).toBe("party-list request failed");
  });

  it("propagates voting-state cache failures to the page data", async () => {
    const errorEntry = {
      error: "voting-state request failed",
      fetch: vi.fn().mockResolvedValue(null),
    };
    mockCacheGet.mockReturnValueOnce(errorEntry);

    const result = await load({ fetch: vi.fn(), depends: vi.fn() } as any);

    expect(result).toMatchObject({
      votingState: null,
      candidates: null,
      positions: null,
      partyLists: [],
      loadError: "voting-state request failed",
    });
  });

  it("rejects partial ballot data when a required cache request fails", async () => {
    const openState = {
      open: { id: "election-1" },
      nextDraft: null,
      lastClosed: null,
      myVotes: { electionId: "election-1", votes: [] },
    };
    mockCacheGet.mockImplementation((resource: string) => {
      if (resource === "votingState") {
        return { error: null, fetch: vi.fn().mockResolvedValue(openState) };
      }
      if (resource === "candidates") {
        return {
          error: "candidate request failed",
          fetch: vi.fn().mockResolvedValue(null),
        };
      }
      return { error: null, fetch: vi.fn().mockResolvedValue([]) };
    });
    mockListPartyLists.mockResolvedValue([]);

    const result = (await load({ fetch: vi.fn(), depends: vi.fn() } as any)) as any;

    expect(result.loadError).toBe("candidate request failed");
    expect(result.candidates).toBeNull();
  });
});
