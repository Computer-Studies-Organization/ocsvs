import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import Page from "./+page.svelte";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

describe("voter results page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => ({
      data:
        resource === "results"
          ? {
              results: [
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
  });

  it("renders refreshed results from the cache instead of stale page data", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election: {
            id: "election-1",
            name: "CSO Election",
            description: null,
            status: "closed",
            opensAt: 1,
            closesAt: 2,
            createdAt: 0,
            updatedAt: 0,
          },
          results: [
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
          ],
          turnout: {
            electionId: "election-1",
            totalEligibleVoters: 0,
            totalBallotsCast: 0,
            turnoutPercentage: 0,
          },
        },
      },
    });

    expect(body).toContain("Fresh Candidate");
    expect(body).not.toContain("Stale Candidate");
  });

  it("labels effectively open results as live and unofficial", () => {
    const now = Math.floor(Date.now() / 1000);
    const { body } = render(Page, {
      props: {
        data: {
          election: {
            id: "election-1",
            name: "CSO Election",
            description: null,
            status: "open",
            opensAt: now - 100,
            closesAt: now + 100,
            createdAt: 0,
            updatedAt: 0,
          },
          results: [],
          turnout: {
            electionId: "election-1",
            totalEligibleVoters: 0,
            totalBallotsCast: 0,
            turnoutPercentage: 0,
          },
        },
      },
    });

    expect(body).toContain("Live Unofficial Count");
    expect(body).not.toContain("Official Election Results & Outcomes");
  });
});
