import { describe, expect, test, vi } from "vitest";
import { render } from "svelte/server";
import type { TElection, TPosition } from "$lib/types";
import Page from "./+page.svelte";

vi.mock("lucide-svelte", () => {
  const DummyIcon = () => "";
  return {
    ArrowLeft: DummyIcon,
    Edit: DummyIcon,
    Plus: DummyIcon,
    Users: DummyIcon,
  };
});

vi.mock("$app/state", () => ({
  page: {
    params: {
      electionId: "elec-1",
      positionId: "pos-1",
    },
  },
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: vi.fn(),
  },
}));

vi.mock("$lib/components/admin/add-candidate-modal.svelte", () => ({
  default: vi.fn(),
}));

vi.mock("$lib/components/admin/edit-position-modal.svelte", () => ({
  default: vi.fn(),
}));

describe("Position Details Page - Candidate Creation Gating", () => {
  const dummyPosition: TPosition = {
    id: "pos-1",
    electionId: "elec-1",
    name: "President",
    displayOrder: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  test("renders 'Add candidate' button when election is in draft", () => {
    const draftElection: TElection = {
      id: "elec-1",
      name: "2026 General Election",
      description: null,
      status: "draft",
      opensAt: null,
      closesAt: null,
      createdAt: 1,
      updatedAt: 1,
    };

    const { body } = render(Page, {
      props: {
        data: {
          election: draftElection,
          position: dummyPosition,
          candidates: [],
          partyLists: [],
        },
      },
    });

    expect(body).toContain("Add candidate</button>");
  });

  test("hides 'Add candidate' button and CTA when election is not in draft", () => {
    const openElection: TElection = {
      id: "elec-1",
      name: "2026 General Election",
      description: null,
      status: "open",
      opensAt: null,
      closesAt: null,
      createdAt: 1,
      updatedAt: 1,
    };

    const { body } = render(Page, {
      props: {
        data: {
          election: openElection,
          position: dummyPosition,
          candidates: [],
          partyLists: [],
        },
      },
    });

    expect(body).not.toContain("Add candidate</button>");
  });
});
