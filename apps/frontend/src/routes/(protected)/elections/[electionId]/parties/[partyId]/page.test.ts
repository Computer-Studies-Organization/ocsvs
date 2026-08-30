import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import Page from "./+page.svelte";
import { load } from "./+page";
import { ApiError } from "$lib/api/client";
import type { TCandidate, TPartyList, TPosition } from "$lib/types";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: mockCacheGet,
  },
}));

const mockParty: TPartyList = {
  id: "party-1",
  electionId: "election-1",
  name: "SULONG PARTYLIST",
  code: "SULONG",
  color: "#3B82F6",
  description: `
This platform starts with practical service for every student.

SULONG
Student Unity, Leadership, Opportunities, and New Growth

Tagline
“Moving Forward. Growing Together. Leading the Future.”

OUR PLATFORM

S — Strengthen CSO
We will continue the growth and progress.
• Maintain and improve active programs.
• Build on existing achievements.

U — Unlock Student Skills
Opportunities to discover skills.
• Technical bootcamps and certifications.
`,
  createdAt: 1,
  updatedAt: 1,
};

const mockPosition: TPosition = {
  id: "pos-1",
  electionId: "election-1",
  name: "President",
  displayOrder: 1,
  createdAt: 1,
  updatedAt: 1,
};

const mockCandidates: TCandidate[] = [
  {
    id: "cand-1",
    fullName: "Ada Lovelace",
    accountId: "acc-1",
    positionId: "pos-1",
    partyId: "party-1",
    manifesto: "Tech first",
    isActive: 1,
    imageUrl: null,
  },
  {
    id: "cand-2",
    fullName: "Other Party Candidate",
    accountId: "acc-2",
    positionId: "pos-1",
    partyId: "party-2",
    manifesto: "Other",
    isActive: 1,
    imageUrl: null,
  },
];

describe("party platform page loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "partyLists") return [mockParty];
        if (resource === "candidates") return mockCandidates;
        if (resource === "positions") return [mockPosition];
        return [];
      }),
    }));
  });

  it("loads party, filters candidates by partyId, and loads positions", async () => {
    const result = (await load({
      params: { electionId: "election-1", partyId: "party-1" },
      fetch: vi.fn(),
    } as any)) as any;

    expect(result.party.id).toBe("party-1");
    expect(result.electionId).toBe("election-1");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].fullName).toBe("Ada Lovelace");
    expect(result.positions).toHaveLength(1);
  });

  it("redirects to /auth when partyLists request is unauthorized (401)", async () => {
    const failure = new ApiError(401, "Unauthorized");
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "partyLists") throw failure;
        return [];
      }),
    }));

    await expect(
      load({
        params: { electionId: "election-1", partyId: "party-1" },
        fetch: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/auth" });
  });

  it.each(["candidates", "positions"] as const)(
    "redirects to /auth when %s request is unauthorized (401)",
    async (failedResource) => {
      const failure = new ApiError(401, "Unauthorized");
      mockCacheGet.mockImplementation((resource: string) => ({
        fetchOrThrow: vi.fn().mockImplementation(async () => {
          if (resource === "partyLists") return [mockParty];
          if (resource === failedResource) throw failure;
          return resource === "candidates" ? mockCandidates : [mockPosition];
        }),
      }));

      await expect(
        load({
          params: { electionId: "election-1", partyId: "party-1" },
          fetch: vi.fn(),
        } as any),
      ).rejects.toMatchObject({ status: 302, location: "/auth" });
    },
  );

  it.each(["candidates", "positions"] as const)(
    "propagates %s fetch failures for non-401 errors",
    async (failedResource) => {
      const failure = new ApiError(503, "Service unavailable");
      mockCacheGet.mockImplementation((resource: string) => ({
        fetchOrThrow: vi.fn().mockImplementation(async () => {
          if (resource === "partyLists") return [mockParty];
          if (resource === failedResource) throw failure;
          return resource === "candidates" ? mockCandidates : [mockPosition];
        }),
      }));

      await expect(
        load({
          params: { electionId: "election-1", partyId: "party-1" },
          fetch: vi.fn(),
        } as any),
      ).rejects.toBe(failure);
    },
  );
});

describe("party platform page component", () => {
  it("renders structured acronym platform with tagline, pillar cards, and navigation", () => {
    const { body } = render(Page, {
      props: {
        data: {
          electionId: "election-1",
          party: mockParty,
          candidates: [mockCandidates[0]],
          positions: [mockPosition],
        },
      },
    });

    expect(body).toContain("SULONG PARTYLIST");
    expect(body).toContain("SULONG");
    expect(body).toContain("This platform starts with practical service for every student.");
    expect(body).toContain("Moving Forward. Growing Together. Leading the Future.");
    expect(body).toContain("Strengthen CSO");
    expect(body).toContain("Unlock Student Skills");
    expect(body).toContain("Maintain and improve active programs.");
    expect(body).toContain("Platform Navigator");
    expect(body).toContain("Candidate Slate");
    expect(body).toContain("Ada Lovelace");
    expect(body).toContain("President");
    expect(body).toContain("Back to election");
    expect(body.match(/href="\/elections\/election-1"/g)).toHaveLength(2);
  });

  it("renders unstructured platform description gracefully", () => {
    const { body } = render(Page, {
      props: {
        data: {
          electionId: "election-1",
          party: {
            ...mockParty,
            description: "A simple unified student platform statement.",
          },
          candidates: [],
          positions: [],
        },
      },
    });

    expect(body).toContain("A simple unified student platform statement.");
    expect(body).toContain("Platform Statement");
  });

  it("renders a standalone tagline only once in an unstructured platform", () => {
    const { body } = render(Page, {
      props: {
        data: {
          electionId: "election-1",
          party: {
            ...mockParty,
            description: `A platform built around practical service.

“Every student first”`,
          },
          candidates: [],
          positions: [],
        },
      },
    });

    expect(body.match(/Every student first/g)).toHaveLength(1);
  });

  it("renders empty state when description is null or empty", () => {
    const { body } = render(Page, {
      props: {
        data: {
          electionId: "election-1",
          party: {
            ...mockParty,
            description: null,
          },
          candidates: [],
          positions: [],
        },
      },
    });

    expect(body).toContain("No platform description provided.");
  });
});
