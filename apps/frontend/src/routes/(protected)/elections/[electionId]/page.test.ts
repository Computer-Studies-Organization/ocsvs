import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import type { TElection, TResults } from "$lib/types";
import Page from "./+page.svelte";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

const election: TElection = {
  id: "election-1",
  name: "CSO Election",
  description: null,
  status: "open",
  opensAt: 1,
  closesAt: 9_999_999_999,
  createdAt: 1,
  updatedAt: 1,
};

const staleResults: TResults = [
  {
    positionId: "position-1",
    positionName: "President",
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
];

const freshResults: TResults = [
  {
    positionId: "position-1",
    positionName: "President",
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
];

describe("election detail results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => ({
      data: resource === "results" ? { results: freshResults, turnout: null } : null,
      fetch: vi.fn(),
    }));
  });

  it("renders refreshed results from the cache entry", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election,
          results: staleResults,
          turnout: null,
          hasVoted: true,
        },
      },
    });

    expect(body).toContain("Fresh Candidate");
    expect(body).not.toContain("Stale Candidate");
  });

  it("renders expired open elections as closed instead of requiring a vote", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(101_000);
    mockCacheGet.mockReturnValue({ data: null, fetch: vi.fn() });

    try {
      const { body } = render(Page, {
        props: {
          data: {
            election: { ...election, opensAt: 1, closesAt: 100 },
            results: [],
            turnout: null,
            hasVoted: false,
          },
        },
      });

      expect(body).not.toContain("Voting required");
      expect(body).toContain("No votes cast yet");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("uses refreshed election metadata for final result status", () => {
    const openElection = { ...election, closesAt: 9_999_999_999 };
    const closedElection = { ...openElection, status: "closed" as const, closesAt: 100 };
    mockCacheGet.mockImplementation((resource: string) => ({
      data:
        resource === "election"
          ? closedElection
          : resource === "results"
            ? { results: freshResults, turnout: null }
            : null,
      fetch: vi.fn(),
    }));

    const { body } = render(Page, {
      props: {
        data: {
          election: openElection,
          results: staleResults,
          turnout: null,
          hasVoted: true,
        },
      },
    });

    expect(body).toContain("Official Final Results");
    expect(body).not.toContain("Live Unofficial Count");
  });

  it("keeps result controls and cards flexible on narrow screens", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election: { ...election, status: "closed" },
          results: staleResults,
          turnout: {
            electionId: "election-1",
            totalEligibleVoters: 10,
            totalBallotsCast: 1,
            turnoutPercentage: 10,
          },
          hasVoted: true,
        },
      },
    });

    expect(body).toContain("min-h-11");
    expect(body).toContain("Fresh Candidate");
  });
});
