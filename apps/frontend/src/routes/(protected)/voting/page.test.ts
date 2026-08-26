import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "./+page";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: mockCacheGet,
  },
}));

describe("voting page loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => {
      const entry: { error: string | null; fetch: any } = {
        error: null,
        fetch: null,
      };
      entry.fetch = vi.fn().mockImplementation(async () => {
        if (resource === "votingState") {
          return {
            open: { id: "election-1" },
            nextDraft: null,
            lastClosed: null,
            myVotes: { electionId: "election-1", hasVoted: false },
            ballot: {
              positions: [{ id: "position-1" }],
              candidates: [{ id: "candidate-1" }],
              parties: [{ id: "party-1" }],
            },
          };
        }
        return [];
      });
      return entry;
    });
  });

  it("uses ballot data from voting state without fetching separate resources", async () => {
    const result = (await load({
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any)) as any;

    expect(mockCacheGet).toHaveBeenCalledTimes(1);
    expect(mockCacheGet).toHaveBeenCalledWith("votingState", { includeBallot: true });
    expect(result.positions).toEqual([{ id: "position-1" }]);
    expect(result.candidates).toEqual([{ id: "candidate-1" }]);
    expect(result.partyLists).toEqual([{ id: "party-1" }]);
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
      myVotes: { electionId: "election-1", hasVoted: false },
      ballot: null,
    };
    mockCacheGet.mockReturnValue({
      error: null,
      fetch: vi.fn().mockResolvedValue(openState),
    });

    const result = (await load({ fetch: vi.fn(), depends: vi.fn() } as any)) as any;

    expect(result.loadError).toBe("Failed to load ballot data");
    expect(result.candidates).toBeNull();
  });
});

describe("voting page overview dates", () => {
  it("uses a long-month formatter only for the empty-state overview dates", () => {
    expect(pageSource).toContain(
      "const overviewDateFormatter = new Intl.DateTimeFormat(undefined, {",
    );
    expect(pageSource).toContain("month: 'long'");
    expect(pageSource).toContain("day: 'numeric'");
    expect(pageSource).toContain("year: 'numeric'");
    expect(pageSource).toContain("return 'To Be Determined'");
    expect(pageSource).toContain("{formatOverviewDate(d.opensAt)}");
    expect(pageSource).toContain("Ended {formatOverviewDate(c.closesAt)}");
    expect(pageSource).toContain(
      "Latest: {c.name} (ended {formatOverviewDate(c.closesAt)}). Next: {d.name} opens {formatOverviewDate(d.opensAt)}.",
    );
    expect(pageSource).not.toContain("formatTimestamp");
  });
});
