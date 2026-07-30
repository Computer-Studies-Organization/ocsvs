import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import Page from "./+page.svelte";

vi.mock("$app/state", () => ({
  page: {
    params: {
      electionId: "election-1",
      positionId: "position-1",
      candidateId: "candidate-1",
    },
  },
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    invalidate: vi.fn(),
  },
}));

describe("candidate detail page", () => {
  it("does not expose candidate status as an editable field", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            positionId: "position-1",
            manifesto: "Manifesto",
            isActive: 1,
            imageUrl: null,
          },
          election: {
            id: "election-1",
            name: "CSO Election",
            description: null,
            status: "draft",
            opensAt: null,
            closesAt: null,
            createdAt: 1,
            updatedAt: 1,
          },
          position: {
            id: "position-1",
            electionId: "election-1",
            name: "President",
            displayOrder: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          user: null,
        },
      },
    });

    expect(body).not.toContain('type="checkbox"');
    expect(body).not.toContain(">Active</span>");
  });

  it("hides mutation controls when the election is not in draft", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            positionId: "position-1",
            manifesto: "Manifesto",
            isActive: 1,
            imageUrl: null,
          },
          election: {
            id: "election-1",
            name: "CSO Election",
            description: null,
            status: "open",
            opensAt: null,
            closesAt: null,
            createdAt: 1,
            updatedAt: 1,
          },
          position: null,
          user: null,
        },
      },
    });

    expect(body).toContain("Candidate details are locked once the election leaves draft.");
    expect(body).not.toContain("Save changes");
    expect(body).not.toContain("Delete candidate?");
  });
});
