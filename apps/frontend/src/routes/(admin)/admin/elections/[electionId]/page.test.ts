import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import type { TElection, TPartyList } from "$lib/types";
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
  createdAt: 1,
  updatedAt: 1,
};

describe("admin election loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockImplementation((resource: string) => ({
      fetch: vi.fn().mockImplementation(async () => {
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
});
