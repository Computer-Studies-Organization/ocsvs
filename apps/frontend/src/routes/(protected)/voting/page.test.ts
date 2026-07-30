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

  it("propagates party-list loading failures", async () => {
    const failure = new Error("party-list request failed");
    mockListPartyLists.mockRejectedValueOnce(failure);

    await expect(
      load({
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toBe(failure);
  });
});
