import { render } from "svelte/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";
import { load } from "./+page";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

beforeEach(() => {
  mockCacheGet.mockReset();
});

describe("admin results mobile layout", () => {
  it("renders the latest results from the reactive cache", () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      data:
        resource === "results"
          ? {
              results: [
                {
                  positionId: "position-1",
                  positionName: "Mayor",
                  totalVotes: 2,
                  candidates: [
                    {
                      candidateId: "candidate-2",
                      fullName: "Fresh Candidate",
                      voteCount: 2,
                      percentage: 100,
                    },
                  ],
                },
              ],
              turnout: {
                electionId: "election-1",
                totalEligibleVoters: 10,
                totalBallotsCast: 2,
                turnoutPercentage: 20,
              },
            }
          : null,
      fetch: vi.fn(),
    }));

    const { body } = render(Page, {
      props: {
        data: {
          elections: [
            {
              id: "election-1",
              name: "Freedom",
              description: null,
              status: "closed",
              opensAt: null,
              closesAt: null,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
          selectedElectionId: "election-1",
          results: [
            {
              positionId: "position-1",
              positionName: "Mayor",
              totalVotes: 1,
              candidates: [
                {
                  candidateId: "candidate-1",
                  fullName: "Stale Candidate",
                  voteCount: 1,
                  percentage: 100,
                },
              ],
            },
          ],
          turnout: null,
          resultsError: "",
        },
      },
    });

    expect(body).toContain("Fresh Candidate");
    expect(body).not.toContain("Stale Candidate");
  });

  it("uses refreshed election metadata for final result status", () => {
    const openElection = {
      id: "election-1",
      name: "Freedom",
      description: null,
      status: "open" as const,
      opensAt: 1,
      closesAt: 9_999_999_999,
      createdAt: 0,
      updatedAt: 0,
    };
    const closedElection = { ...openElection, status: "closed" as const, closesAt: 100 };

    mockCacheGet.mockImplementation((resource: string) => ({
      data:
        resource === "election"
          ? closedElection
          : resource === "results"
            ? {
                results: [
                  {
                    positionId: "position-1",
                    positionName: "Mayor",
                    totalVotes: 1,
                    candidates: [],
                  },
                ],
                turnout: {
                  electionId: "election-1",
                  totalEligibleVoters: 10,
                  totalBallotsCast: 1,
                  turnoutPercentage: 10,
                },
              }
            : null,
      fetch: vi.fn(),
    }));

    const { body } = render(Page, {
      props: {
        data: {
          elections: [openElection],
          selectedElectionId: "election-1",
          results: [],
          turnout: null,
          resultsError: "",
        },
      },
    });

    expect(body).toContain("Official Final Results");
    expect(body).not.toContain("Live Unofficial Count");
  });

  it("shows recovered cached results after an initial load error", () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      data:
        resource === "results"
          ? {
              results: [
                {
                  positionId: "position-1",
                  positionName: "Mayor",
                  totalVotes: 1,
                  candidates: [
                    {
                      candidateId: "candidate-1",
                      fullName: "Recovered Candidate",
                      voteCount: 1,
                      percentage: 100,
                    },
                  ],
                },
              ],
              turnout: {
                electionId: "election-1",
                totalEligibleVoters: 10,
                totalBallotsCast: 1,
                turnoutPercentage: 10,
              },
            }
          : null,
      fetch: vi.fn(),
    }));

    const { body } = render(Page, {
      props: {
        data: {
          elections: [
            {
              id: "election-1",
              name: "Freedom",
              description: null,
              status: "closed",
              opensAt: null,
              closesAt: null,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
          selectedElectionId: "election-1",
          results: [],
          turnout: null,
          resultsError: "Initial request failed",
        },
      },
    });

    expect(body).toContain("Recovered Candidate");
    expect(body).not.toContain("Initial request failed");
  });

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
          results: [
            {
              positionId: "position-1",
              positionName: "Mayor",
              totalVotes: 4,
              candidates: [
                {
                  candidateId: "candidate-1",
                  fullName: "Lilith Gomez",
                  voteCount: 4,
                  percentage: 100,
                },
              ],
            },
          ],
          turnout: {
            electionId: "election-1",
            totalEligibleVoters: 10,
            totalBallotsCast: 4,
            turnoutPercentage: 40,
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
    expect(body).toContain("Mayor");
    expect(body).toContain("Lilith Gomez");
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
          results: [],
          turnout: null,
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
    const fetchResults = vi.fn().mockResolvedValue({
      results: [],
      turnout: {
        electionId: "expired-election",
        totalEligibleVoters: null,
        totalBallotsCast: 0,
        turnoutPercentage: null,
      },
    });
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

    mockCacheGet.mockImplementation((resource: string) =>
      resource === "results"
        ? { fetchOrThrow: fetchResults }
        : {
            fetch: vi
              .fn()
              .mockResolvedValue(
                resource === "elections"
                  ? [scheduledElection, expiredElection]
                  : { open: null, nextDraft: null, lastClosed: null, myVotes: {} },
              ),
          },
    );

    const result = (await load({
      url: new URL("http://localhost/admin/results?electionId=scheduled-election"),
      fetch,
    } as any)) as any;

    expect(result.selectedElectionId).toBe("expired-election");
    expect(result.selectedElectionId).not.toBe("scheduled-election");
    expect(mockCacheGet).toHaveBeenCalledWith("results", { electionId: "expired-election" });
    expect(mockCacheGet).not.toHaveBeenCalledWith("results", {
      electionId: "scheduled-election",
    });
  });

  it("force-refreshes closed election results through the cache", async () => {
    const fetch = vi.fn();
    const freshResults = [
      {
        positionId: "position-1",
        positionName: "Mayor",
        totalVotes: 2,
        candidates: [],
      },
    ];
    const fetchResults = vi.fn().mockResolvedValue({
      results: freshResults,
      turnout: {
        electionId: "closed-election",
        totalEligibleVoters: 10,
        totalBallotsCast: 2,
        turnoutPercentage: 20,
      },
    });

    mockCacheGet.mockImplementation((resource: string) => {
      if (resource === "results") {
        return {
          data: { results: [{ totalVotes: 1 }], turnout: null },
          fetchOrThrow: fetchResults,
        };
      }
      return {
        fetch: vi.fn().mockResolvedValue(
          resource === "elections"
            ? [
                {
                  id: "closed-election",
                  name: "Closed",
                  description: null,
                  status: "closed",
                  opensAt: 1,
                  closesAt: 2,
                  createdAt: 0,
                  updatedAt: 0,
                },
              ]
            : { open: null, nextDraft: null, lastClosed: null, myVotes: {} },
        ),
      };
    });

    const result = (await load({
      url: new URL("http://localhost/admin/results?electionId=closed-election"),
      fetch,
    } as any)) as any;

    expect(fetchResults).toHaveBeenCalledWith(true, { fetch });
    expect(result.results).toBe(freshResults);
  });
});
