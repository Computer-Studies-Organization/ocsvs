import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";
import { load } from "./+page";

const { mockCacheGet, mockListResults } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockListResults: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

vi.mock("$lib/api/elections", () => ({
  listResults: mockListResults,
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

describe("admin results mobile layout", () => {
  it("keeps navigation and result controls usable on narrow screens", () => {
    const { body } = render(Page, {
      props: {
        data: {
          elections: [
            {
              id: "election-1",
              name: "Freedom",
              description: null,
              status: "archived",
              opensAt: null,
              closesAt: null,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
          selectedElectionId: "election-1",
          resultsData: {
            results: [
              {
                positionId: "position-1",
                positionName: "Mayor",
                candidates: [
                  {
                    candidateId: "candidate-1",
                    candidateName: "Lilith Gomez",
                    positionId: "position-1",
                    positionName: "Mayor",
                    voteCount: 4,
                  },
                ],
              },
            ],
            meta: { totalVotes: 4, totalPositions: 1 },
          },
          resultsError: "",
        },
      },
    });

    expect(body).toContain('href="/admin-dashboard"');
    expect(body).toContain("min-h-11");
    expect(body).not.toContain(">Back</button>");
    expect(body).not.toContain("absolute right-0");
    expect(body).toMatch(/id="election-select"[^>]*class="[^"]*min-h-11[^"]*w-full/);
    expect(body).toMatch(/<button class="[^"]*min-h-11[^"]*w-full[^"]*sm:w-auto/);
    expect(body).toContain("grid grid-cols-2 gap-3 sm:gap-4");
    expect(body).toContain("mb-4 flex flex-col items-start gap-3");
    expect(body).toContain("flex flex-wrap items-center gap-x-4 gap-y-1");
  });

  it("uses effective status for result visibility and labels", () => {
    const { body } = render(Page, {
      props: {
        data: {
          elections: [
            {
              id: "scheduled-election",
              name: "Scheduled",
              description: null,
              status: "open",
              opensAt: 4_000_000_000,
              closesAt: 4_000_000_100,
              createdAt: 0,
              updatedAt: 0,
            },
            {
              id: "expired-election",
              name: "Expired",
              description: null,
              status: "open",
              opensAt: 1,
              closesAt: 2,
              createdAt: 0,
              updatedAt: 0,
            },
            {
              id: "active-election",
              name: "Active",
              description: null,
              status: "open",
              opensAt: 1,
              closesAt: 4_000_000_000,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
          selectedElectionId: "expired-election",
          resultsData: {
            results: [],
            meta: { totalVotes: 0, totalPositions: 0 },
          },
          resultsError: "",
        },
      },
    });

    expect(body).toContain(">Expired (Closed)</option>");
    expect(body).toContain(">Active (Open)</option>");
    expect(body).not.toContain('value="scheduled-election"');
    expect(body).not.toContain("Scheduled");
  });
});

describe("admin results loader", () => {
  it("does not select or fetch results for a scheduled election", async () => {
    const fetch = vi.fn();
    const scheduledElection = {
      id: "scheduled-election",
      name: "Scheduled",
      description: null,
      status: "open",
      opensAt: 4_000_000_000,
      closesAt: 4_000_000_100,
      createdAt: 0,
      updatedAt: 0,
    };
    const expiredElection = {
      id: "expired-election",
      name: "Expired",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 0,
      updatedAt: 0,
    };

    mockCacheGet.mockImplementation((resource: string) => ({
      fetch: vi
        .fn()
        .mockResolvedValue(
          resource === "elections"
            ? [scheduledElection, expiredElection]
            : resource === "votingState"
              ? { open: null, nextDraft: null, lastClosed: null, myVotes: {} }
              : [],
        ),
    }));
    mockListResults.mockResolvedValue([]);

    const result = (await load({
      url: new URL("http://localhost/admin/results?electionId=scheduled-election"),
      fetch,
    } as any)) as any;

    expect(result.selectedElectionId).toBe("expired-election");
    expect(result.selectedElectionId).not.toBe("scheduled-election");
    expect(mockListResults).toHaveBeenCalledWith("expired-election", { fetch });
    expect(mockListResults).not.toHaveBeenCalledWith("scheduled-election", { fetch });
  });
});
