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
    mockCacheGet.mockReturnValue({
      data: freshResults,
      fetch: vi.fn(),
    });
  });

  it("renders refreshed results from the cache entry", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election,
          results: staleResults,
          hasVoted: true,
        },
      },
    });

    expect(body).toContain("Fresh Candidate");
    expect(body).not.toContain("Stale Candidate");
  });
});
