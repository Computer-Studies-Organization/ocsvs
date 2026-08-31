import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { TCandidate, TElection, TPartyList, TPosition } from "$lib/types";
import Page from "./+page.svelte";

const draftElection: TElection = {
  id: "election-1",
  name: "CSO 2026 Election",
  description: "Annual election for CSO officers",
  status: "draft",
  opensAt: null,
  closesAt: null,
  createdAt: 1,
  updatedAt: 1,
};

const openElection: TElection = {
  id: "election-1",
  name: "CSO 2026 Election",
  description: "Annual election for CSO officers",
  status: "open",
  opensAt: 1,
  closesAt: 9_999_999_999,
  createdAt: 1,
  updatedAt: 1,
};

const closedElection: TElection = {
  id: "election-1",
  name: "CSO 2026 Election",
  description: "Annual election for CSO officers",
  status: "closed",
  opensAt: 1,
  closesAt: 100,
  createdAt: 1,
  updatedAt: 1,
};

const party: TPartyList = {
  id: "party-1",
  electionId: "election-1",
  name: "Innovators Slate",
  code: "INNOV",
  color: "#3B82F6",
  description: "Innovation first",
  createdAt: 1,
  updatedAt: 1,
};

const position1: TPosition = {
  id: "position-1",
  electionId: "election-1",
  name: "President",
  displayOrder: 1,
  createdAt: 1,
  updatedAt: 1,
};

const position2Empty: TPosition = {
  id: "position-2",
  electionId: "election-1",
  name: "Vice President Internal",
  displayOrder: 2,
  createdAt: 1,
  updatedAt: 1,
};

const candidate1: TCandidate = {
  id: "candidate-1",
  fullName: "Ada Lovelace",
  accountId: "account-1",
  positionId: position1.id,
  partyId: party.id,
  manifesto: "Tech empowerment",
  isActive: 1,
  imageUrl: null,
};

const candidateInactive: TCandidate = {
  id: "candidate-2",
  fullName: "Inactive Candidate",
  accountId: "account-2",
  positionId: position1.id,
  partyId: null,
  manifesto: "",
  isActive: 0,
  imageUrl: null,
};

type PreviewData = {
  election: TElection;
  positions: TPosition[];
  partyLists: TPartyList[];
  candidates: TCandidate[];
};

function renderPreview(overrides: Partial<PreviewData> = {}) {
  return render(Page, {
    props: {
      data: {
        election: draftElection,
        positions: [position1],
        partyLists: [party],
        candidates: [candidate1],
        ...overrides,
      },
    },
  });
}

describe("admin election ballot preview page component", () => {
  it("renders draft preview banner, back navigation, and reset button for draft elections", () => {
    const { body } = renderPreview();

    expect(body).toContain("Draft Ballot Preview");
    expect(body).toContain("Sandbox Mode");
    expect(body).toContain("Back to election");
    expect(body).toContain('href="/admin/elections/election-1"');
    expect(body).toContain("Reset ballot");
  });

  it("renders live preview banner for open elections", () => {
    const { body } = renderPreview({ election: openElection });

    expect(body).toContain("Live Ballot Preview");
  });

  it("renders historical archive banner for closed elections", () => {
    const { body } = renderPreview({ election: closedElection });

    expect(body).toContain("Historical Ballot Archive");
  });

  it("displays pre-flight warning notice when a position has 0 active candidates", () => {
    const { body } = renderPreview({ positions: [position1, position2Empty] });

    expect(body).toContain("Pre-Flight Warning: 1 position has no active candidates");
    expect(body).toContain("Vice President Internal");
  });

  it("renders empty ballot state when no positions have active candidates", () => {
    const { body } = renderPreview({ positions: [position2Empty], partyLists: [], candidates: [] });

    expect(body).toContain("No active ballot positions");
    expect(body).toContain("Manage election positions");
  });

  it("renders slate fast-fill controls when party lists are configured", () => {
    const { body } = renderPreview();

    expect(body).toContain("Slate Fast-Fill");
    expect(body).toContain("Fill INNOV Slate");
    expect(body).toContain('href="/elections/election-1/parties/party-1"');
  });

  it("renders the position stepper and candidate details while excluding inactive candidates", () => {
    const { body } = renderPreview({ candidates: [candidate1, candidateInactive] });

    expect(body).toContain("President");
    expect(body).toContain("Ada Lovelace");
    expect(body).toContain("Tech empowerment");
    expect(body).not.toContain("Inactive Candidate");
  });
});
