import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import VotingCandidateCard from "./voting-candidate-card.svelte";

describe("VotingCandidateCard component", () => {
  const baseCandidate = {
    id: "cand-1",
    fullName: "John Roben Garote Manayon",
    imageUrl: "https://example.com/candidate.jpg",
    manifesto: "Leading innovation in Computer Studies.",
    partyId: "party-tech",
  };

  const sampleParties = [
    {
      id: "party-tech",
      name: "Technology Advocates",
      code: "TECH",
      color: "#3B82F6",
    },
  ];

  it("renders a prominent portrait image when imageUrl is present", () => {
    const { body } = render(VotingCandidateCard, {
      props: {
        candidate: baseCandidate,
        partyLists: sampleParties,
        selected: false,
        onclick: () => {},
      },
    });

    expect(body).toContain("<img");
    expect(body).toContain('src="https://example.com/candidate.jpg"');
    expect(body).toContain('alt="John Roben Garote Manayon"');
    expect(body).toContain("aspect-[4/3]");
    expect(body).toContain("object-cover object-top");
  });

  it("renders a candidate silhouette fallback when imageUrl is null", () => {
    const { body } = render(VotingCandidateCard, {
      props: {
        candidate: { ...baseCandidate, imageUrl: null },
        partyLists: sampleParties,
        selected: false,
        onclick: () => {},
      },
    });

    expect(body).not.toContain("<img");
    expect(body).toContain('data-testid="candidate-portrait-silhouette"');
    expect(body).toContain("<svg");
    expect(body).toContain("aspect-[4/3]");
  });

  it("renders the party badge code when partyId is linked", () => {
    const { body } = render(VotingCandidateCard, {
      props: {
        candidate: baseCandidate,
        partyLists: sampleParties,
        selected: false,
        onclick: () => {},
      },
    });

    expect(body).toContain("TECH");
  });

  it("links a party badge to its platform", () => {
    const { body } = render(VotingCandidateCard, {
      props: {
        candidate: baseCandidate,
        partyLists: sampleParties,
        electionId: "election-1",
        selected: false,
        onclick: () => {},
      },
    });

    expect(body).toContain('href="/elections/election-1/parties/party-tech"');
    expect(body).not.toContain('role="button"');
    expect(body).toContain('aria-label="Select John Roben Garote Manayon"');
    expect(body.indexOf('href="/elections/election-1/parties/party-tech"')).toBeGreaterThan(
      body.indexOf("</button>"),
    );
  });

  it("renders the INDEPENDENT badge when partyId is null or not found", () => {
    const { body } = render(VotingCandidateCard, {
      props: {
        candidate: { ...baseCandidate, partyId: null },
        partyLists: sampleParties,
        selected: false,
        onclick: () => {},
      },
    });

    expect(body).toContain("INDEPENDENT");
  });

  it("sets aria-pressed correctly based on selected prop", () => {
    const unselected = render(VotingCandidateCard, {
      props: {
        candidate: baseCandidate,
        partyLists: sampleParties,
        selected: false,
        onclick: () => {},
      },
    });
    expect(unselected.body).toContain('aria-pressed="false"');

    const selected = render(VotingCandidateCard, {
      props: {
        candidate: baseCandidate,
        partyLists: sampleParties,
        selected: true,
        onclick: () => {},
      },
    });
    expect(selected.body).toContain('aria-pressed="true"');
    expect(selected.body).toContain("border-blue-500");
  });

  it("renders candidate full name and manifesto content", () => {
    const { body } = render(VotingCandidateCard, {
      props: {
        candidate: baseCandidate,
        partyLists: sampleParties,
        selected: false,
        onclick: () => {},
      },
    });

    expect(body).toContain("John Roben Garote Manayon");
    expect(body).toContain("Leading innovation in Computer Studies.");
    expect(body).toContain("feat/john-roben-garote-manayon");
  });
});
