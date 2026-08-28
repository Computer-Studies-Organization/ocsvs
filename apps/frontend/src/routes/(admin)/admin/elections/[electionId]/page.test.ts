import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import type { TCandidate, TElection, TPartyList, TPosition } from "$lib/types";
import Page from "./+page.svelte";
import { load } from "./+page";

const { mockCacheGet, mockCacheInvalidate, mockListPartyLists } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheInvalidate: vi.fn(),
  mockListPartyLists: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: mockCacheGet,
    invalidate: mockCacheInvalidate,
  },
}));

vi.mock("$lib/api/parties", () => ({
  listPartyLists: mockListPartyLists,
}));

const election: TElection = {
  id: "election-1",
  name: "CSO Election",
  description: null,
  status: "draft",
  opensAt: null,
  closesAt: null,
  createdAt: 1,
  updatedAt: 1,
};

const party: TPartyList = {
  id: "party-1",
  electionId: "election-1",
  name: "Innovators",
  code: "INNOV",
  color: "#3B82F6",
  description: null,
  createdAt: 1,
  updatedAt: 1,
};

const position: TPosition = {
  id: "position-1",
  electionId: "election-1",
  name: "President",
  displayOrder: 1,
  createdAt: 1,
  updatedAt: 1,
};

const partyCandidates: TCandidate[] = [
  {
    id: "candidate-1",
    fullName: "Ada Candidate",
    accountId: "account-1",
    positionId: position.id,
    partyId: party.id,
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
  {
    id: "candidate-2",
    fullName: "Inactive Candidate",
    accountId: "account-2",
    positionId: position.id,
    partyId: party.id,
    manifesto: "",
    isActive: 0,
    imageUrl: null,
  },
  {
    id: "candidate-3",
    fullName: "Other Party Candidate",
    accountId: "account-3",
    positionId: position.id,
    partyId: "party-2",
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
];

describe("admin election loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "election") return election;
        if (resource === "partyLists") return mockListPartyLists();
        return [];
      }),
    }));
  });

  it("propagates party-list loading failures", async () => {
    const failure = new Error("party-list request failed");
    mockListPartyLists.mockRejectedValueOnce(failure);

    await expect(
      load({
        params: { electionId: "election-1" },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any),
    ).rejects.toBe(failure);
  });
});

describe("admin election party controls", () => {
  const nonDraftStatuses = ["open", "closed", "archived"] as const;

  it("renders party management controls for draft elections", () => {
    const { body } = render(Page, {
      props: { data: { election, positions: [], partyLists: [party], candidates: [] } },
    });

    expect(body).toContain("Add Party List");
    expect(body).toContain('title="Edit Party"');
  });

  it("labels an expired open election's close action as finalizing closure", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election: { ...election, status: "open", opensAt: 1, closesAt: 2 },
          positions: [],
          partyLists: [],
          candidates: [],
        },
      },
    });

    expect(body).toContain("Closed for voting");
    expect(body).toContain("Finalize closure");
    expect(body).not.toContain("Transition to Closed");
  });

  it("labels a scheduled open election's close action clearly without enabling edits", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election: {
            ...election,
            status: "open",
            opensAt: 4_000_000_000,
            closesAt: 4_000_000_100,
          },
          positions: [],
          partyLists: [],
          candidates: [],
        },
      },
    });

    expect(body).toContain("Draft for setup");
    expect(body).toContain("Close scheduled election");
    expect(body).not.toContain("Transition to Closed");
    expect(body).not.toContain("Add Party List");
    expect(body).not.toContain("Add position");
  });

  it("shows the assigned candidate roster with position and inactive status", () => {
    const { body } = render(Page, {
      props: {
        data: {
          election,
          positions: [position],
          partyLists: [party],
          candidates: partyCandidates,
        },
      },
    });

    expect(body).toContain("<details");
    expect(body).toContain("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start");
    expect(body).toContain("2 candidates");
    expect(body).toContain("Ada Candidate");
    expect(body).toContain("Inactive Candidate");
    expect(body).toContain("President");
    expect(body).toContain("Inactive");
    expect(body).not.toContain("Other Party Candidate");
    expect(body).toContain(
      "/admin/elections/election-1/positions/position-1/candidates/candidate-1",
    );
    expect(body).toContain('title="Edit Party"');
  });

  it("shows an empty roster message when a party has no candidates", () => {
    const { body } = render(Page, {
      props: { data: { election, positions: [position], partyLists: [party], candidates: [] } },
    });

    expect(body).toContain("No candidates assigned to this party list yet.");
  });

  it.each(nonDraftStatuses)(
    "hides party management controls when election status is %s",
    (status) => {
      const { body } = render(Page, {
        props: {
          data: {
            election: { ...election, status },
            positions: [],
            partyLists: [party],
            candidates: [],
          },
        },
      });

      expect(body).not.toContain("Add Party List");
      expect(body).not.toContain('title="Edit Party"');
    },
  );

  it("keeps the election detail controls usable on narrow screens", () => {
    const { body } = render(Page, {
      props: { data: { election, positions: [], partyLists: [party], candidates: [] } },
    });

    expect(body).toContain("min-h-11");
    expect(body).toContain("grid grid-cols-1 gap-4 sm:grid-cols-3");
    expect(body).toContain("h-11 w-11");
  });
});
