import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import CouncilShowcase from "./council-showcase.svelte";
import TurnoutBanner from "./turnout-banner.svelte";
import PositionResultCard from "./position-result-card.svelte";
import ResultsPanel from "./results-panel.svelte";

describe("Results Components", () => {
  describe("CouncilShowcase", () => {
    it("renders winning candidates with avatars, party tags, and percentages", () => {
      const results = [
        {
          positionId: "pos-1",
          positionName: "Chairman",
          totalVotes: 100,
          candidates: [
            {
              candidateId: "c1",
              fullName: "John Manayon",
              voteCount: 66,
              percentage: 66.0,
              imageUrl: "https://example.com/john.jpg",
              partyId: "party-lead",
              partyCode: "LEAD",
              partyColor: "#3B82F6",
            },
            {
              candidateId: "c2",
              fullName: "Rhine Erazo",
              voteCount: 34,
              percentage: 34.0,
              imageUrl: null,
              partyCode: "SPARK",
              partyColor: "#F59E0B",
            },
          ],
        },
      ];

      const { body } = render(CouncilShowcase, {
        props: { results, electionId: "election-1" },
      });

      expect(body).toContain("Newly Elected Officers");
      expect(body).toContain("Chairman");
      expect(body).toContain("John Manayon");
      expect(body).toContain("LEAD");
      expect(body).toContain("66%");
      expect(body).toContain("Elected");
      expect(body).toContain('href="#position-pos-1"');
      expect(body).toContain('aria-label="View Chairman race"');
      expect(body).toContain('href="/elections/election-1/parties/party-lead"');
      expect(body.indexOf('href="/elections/election-1/parties/party-lead"')).toBeGreaterThan(
        body.indexOf("</a>"),
      );
      expect(body).not.toContain("opacity-0");
      expect(body).not.toContain('role="link"');
      expect(body).not.toContain('tabindex="0"');
    });

    it("uses leading language while the election is open", () => {
      const results = [
        {
          positionId: "pos-1",
          positionName: "Chairman",
          totalVotes: 10,
          candidates: [
            { candidateId: "c1", fullName: "Alice", voteCount: 7, percentage: 70 },
            { candidateId: "c2", fullName: "Bob", voteCount: 3, percentage: 30 },
          ],
        },
      ];
      const now = Math.floor(Date.now() / 1000);

      const { body } = render(ResultsPanel, {
        props: {
          election: {
            id: "e1",
            name: "CSO 2026",
            status: "open" as const,
            opensAt: now - 100,
            closesAt: now + 100,
            createdAt: 100,
            updatedAt: 200,
            description: null,
          },
          results,
          status: "open" as const,
        },
      });

      expect(body).toContain("Current Leaders");
      expect(body).toContain("Leading");
      expect(body).not.toContain("Elected");
      expect(body).not.toContain("Winner");
    });

    it("renders tie badge when top two candidates tie", () => {
      const results = [
        {
          positionId: "pos-1",
          positionName: "Treasurer",
          totalVotes: 10,
          candidates: [
            {
              candidateId: "c1",
              fullName: "Alice",
              voteCount: 5,
              percentage: 50.0,
            },
            {
              candidateId: "c2",
              fullName: "Bob",
              voteCount: 5,
              percentage: 50.0,
            },
            {
              candidateId: "c3",
              fullName: "Charlie",
              voteCount: 5,
              percentage: 50.0,
            },
          ],
        },
      ];

      const { body } = render(CouncilShowcase, {
        props: { results },
      });

      expect(body).toContain("Tie");
      expect(body).toContain("Alice");
      expect(body).toContain("Bob");
      expect(body).toContain("Charlie");
    });
  });

  describe("TurnoutBanner", () => {
    it("renders turnout percentage and ballots cast for closed election", () => {
      const election = {
        id: "e1",
        name: "CSO 2026",
        status: "closed" as const,
        opensAt: 1000,
        closesAt: 2000,
        createdAt: 100,
        updatedAt: 200,
        description: null,
      };
      const turnout = {
        electionId: "e1",
        totalEligibleVoters: 500,
        totalBallotsCast: 382,
        turnoutPercentage: 76.4,
      };

      const { body } = render(TurnoutBanner, {
        props: {
          election,
          turnout,
          totalPositions: 8,
          status: "closed" as const,
        },
      });

      expect(body).toContain("Official Final Results");
      expect(body).toContain("76.4%");
      expect(body).toContain("(382 of 500)");
      expect(body).toContain("382");
      expect(body).toContain("8");
    });

    it("renders live uncertified count badge when election is open", () => {
      const now = Math.floor(Date.now() / 1000);
      const election = {
        id: "e1",
        name: "CSO 2026",
        status: "open" as const,
        opensAt: now - 100,
        closesAt: now + 1000,
        createdAt: 100,
        updatedAt: 200,
        description: null,
      };
      const turnout = {
        electionId: "e1",
        totalEligibleVoters: 100,
        totalBallotsCast: 45,
        turnoutPercentage: 45.0,
      };

      const { body } = render(TurnoutBanner, {
        props: {
          election,
          turnout,
          totalPositions: 4,
          status: "open" as const,
        },
      });

      expect(body).toContain("Live Unofficial Count");
      expect(body).toContain("45%");
    });

    it("does not estimate ballots from position totals when turnout is unavailable", () => {
      const { body } = render(TurnoutBanner, {
        props: {
          election: null,
          turnout: null,
          totalPositions: 8,
          status: "closed" as const,
        },
      });

      expect(body).toContain("Unavailable");
      expect(body).not.toContain("submitted");
    });

    it("shows known ballots while marking an unreconstructable turnout denominator unavailable", () => {
      const { body } = render(TurnoutBanner, {
        props: {
          turnout: {
            electionId: "legacy-election",
            totalEligibleVoters: null,
            totalBallotsCast: 12,
            turnoutPercentage: null,
          },
          status: "closed" as const,
        },
      });

      expect(body).toContain("Unavailable");
      expect(body).toContain(">12</span>");
      expect(body).toContain("submitted");
      expect(body).not.toContain("null%");
    });
  });

  describe("PositionResultCard", () => {
    it("renders winner and runner-up with percentage bars and party badges", () => {
      const position = {
        positionId: "pos-1",
        positionName: "Chairman",
        totalVotes: 128,
        candidates: [
          {
            candidateId: "c1",
            fullName: "John Roben Manayon",
            voteCount: 85,
            percentage: 66.4,
            imageUrl: "https://example.com/john.jpg",
            partyId: "party-lead",
            partyName: "Leadership Alliance",
            partyCode: "LEAD",
            partyColor: "#3B82F6",
          },
          {
            candidateId: "c2",
            fullName: "Rhine Dave Erazo",
            voteCount: 43,
            percentage: 33.6,
            imageUrl: null,
            partyId: "party-spark",
            partyName: "Spark Movement",
            partyCode: "SPARK",
            partyColor: "#F59E0B",
          },
        ],
      };

      const { body } = render(PositionResultCard, {
        props: { position, electionId: "election-1" },
      });

      expect(body).toContain("Chairman");
      expect(body).toContain("128 ballots counted");
      expect(body).toContain("John Roben Manayon Elected");
      expect(body).toContain("John Roben Manayon");
      expect(body).toContain("Rhine Dave Erazo");
      expect(body).toContain("66.4%");
      expect(body).toContain("33.6%");
      expect(body).toContain("LEAD");
      expect(body).toContain("SPARK");
      expect(body).toContain('href="/elections/election-1/parties/');
    });

    it("renders tie alert when there is a tie for first place", () => {
      const position = {
        positionId: "pos-2",
        positionName: "Secretary",
        totalVotes: 20,
        candidates: [
          {
            candidateId: "c1",
            fullName: "Alice Smith",
            voteCount: 10,
            percentage: 50.0,
          },
          {
            candidateId: "c2",
            fullName: "Bob Jones",
            voteCount: 10,
            percentage: 50.0,
          },
          {
            candidateId: "c3",
            fullName: "Charlie Lee",
            voteCount: 10,
            percentage: 50.0,
          },
        ],
      };

      const { body } = render(PositionResultCard, {
        props: { position },
      });

      expect(body).toContain("Contested Tie");
      expect(body).toContain("Tie Detected:");
      expect(body).toContain("Alice Smith, Bob Jones, Charlie Lee all received 10 votes");
    });

    it("renders unopposed badge when only 1 candidate runs", () => {
      const position = {
        positionId: "pos-3",
        positionName: "Auditor",
        totalVotes: 50,
        candidates: [
          {
            candidateId: "c1",
            fullName: "Solo Candidate",
            voteCount: 50,
            percentage: 100.0,
          },
        ],
      };

      const { body } = render(PositionResultCard, {
        props: { position },
      });

      expect(body).toContain("Elected Unopposed");
    });
  });
});
