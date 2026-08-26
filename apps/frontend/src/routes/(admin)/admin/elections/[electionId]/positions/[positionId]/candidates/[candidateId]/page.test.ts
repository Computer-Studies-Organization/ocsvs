import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import Page from "./+page.svelte";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");

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
  it("marks the full-page edit content as keyboard-scrollable", () => {
    expect(pageSource).toContain("keyboard-scroll-content");
  });

  it("does not expose candidate status as an editable field", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            userId: "user-1",
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
          partyLists: [],
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
            userId: "user-1",
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
          position: {
            id: "position-1",
            electionId: "election-1",
            name: "President",
            displayOrder: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          user: null,
          partyLists: [],
        },
      },
    });

    expect(body).toContain("Candidate details are locked once the election leaves draft.");
    expect(body).not.toContain("Save changes");
    expect(body).not.toContain("Save &amp; return");
    expect(body).not.toContain("Delete candidate?");
  });

  it("renders mutation controls including Save changes and Save & return during draft edit", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            userId: "user-1",
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
          partyLists: [],
        },
      },
    });

    expect(body).toContain("Save changes");
    expect(body).toContain("Save &amp; return");
    expect(body).toContain("Delete");
  });

  it("renders party list selection dropdown during draft edit", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            userId: "user-1",
            positionId: "position-1",
            partyId: "party-1",
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
          partyLists: [
            {
              id: "party-1",
              electionId: "election-1",
              name: "Progressives",
              code: "PROG",
              color: null,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
    });

    expect(body).toContain("Party List");
    expect(body).toContain("Progressives");
    expect(body).toContain("PROG");
    expect(body).toContain("Independent (No Party)");
  });

  it("displays assigned party list when election is locked", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            userId: "user-1",
            positionId: "position-1",
            partyId: "party-1",
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
          position: {
            id: "position-1",
            electionId: "election-1",
            name: "President",
            displayOrder: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          user: null,
          partyLists: [
            {
              id: "party-1",
              electionId: "election-1",
              name: "Innovators",
              code: "INNOV",
              color: null,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
    });

    expect(body).toContain("Party List");
    expect(body).toContain("Innovators (INNOV)");
  });

  it("renders silhouette avatar in the header when candidate has no image", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            userId: "user-1",
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
          partyLists: [],
        },
      },
    });

    expect(body).toContain('data-testid="candidate-avatar"');
    expect(body).toContain('data-testid="candidate-avatar-silhouette"');
  });

  it("renders candidate image in the header when candidate has an image", () => {
    const { body } = render(Page, {
      props: {
        data: {
          candidate: {
            id: "candidate-1",
            fullName: "Alex Candidate",
            accountId: "account-1",
            userId: "user-1",
            positionId: "position-1",
            manifesto: "Manifesto",
            isActive: 1,
            imageUrl: "https://example.com/carl.jpg",
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
          position: {
            id: "position-1",
            electionId: "election-1",
            name: "President",
            displayOrder: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          user: null,
          partyLists: [],
        },
      },
    });

    expect(body).toContain('data-testid="candidate-avatar"');
    expect(body).toContain('src="https://example.com/carl.jpg"');
    expect(body).toContain('alt="Avatar for Alex Candidate"');
  });
});
