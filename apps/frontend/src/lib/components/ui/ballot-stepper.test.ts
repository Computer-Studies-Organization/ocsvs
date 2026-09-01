import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import BallotStepper from "./ballot-stepper.svelte";
import { createVotingState, type TStepperPosition } from "$lib/voting-stepper-logic";

const positions: TStepperPosition[] = [
  {
    id: "position-1",
    name: "President",
    displayOrder: 1,
    candidates: [
      {
        id: "candidate-1",
        fullName: "Current Candidate",
        imageUrl: "/images/current.jpg",
        manifesto: "Current manifesto",
      },
    ],
  },
  {
    id: "position-2",
    name: "Vice President",
    displayOrder: 2,
    candidates: [
      {
        id: "candidate-2",
        fullName: "Next Candidate",
        imageUrl: "/images/next.jpg",
        manifesto: "Next manifesto",
      },
      {
        id: "candidate-3",
        fullName: "No Image Candidate",
        imageUrl: null,
        manifesto: "No image manifesto",
      },
    ],
  },
  {
    id: "position-3",
    name: "Secretary",
    displayOrder: 3,
    candidates: [
      {
        id: "candidate-4",
        fullName: "Later Candidate",
        imageUrl: "/images/later.jpg",
        manifesto: "Later manifesto",
      },
    ],
  },
];

function renderStepper(currentPositionIndex: number, stepperPositions = positions) {
  return render(BallotStepper, {
    props: {
      electionId: "election-1",
      positions: stepperPositions,
      partyLists: [],
      voting: {
        ...createVotingState(stepperPositions),
        currentPositionIndex,
      },
      onvotingchange: () => {},
      onsubmit: () => {},
    },
  });
}

describe("BallotStepper image prefetching", () => {
  it("prefetches only image URLs from the following position", () => {
    const { head } = renderStepper(0);

    expect(head).toContain('rel="prefetch" as="image" href="/images/next.jpg"');
    expect(head.match(/rel="prefetch"/g)).toHaveLength(1);
    expect(head).not.toContain("/images/current.jpg");
    expect(head).not.toContain("/images/later.jpg");
  });

  it("skips candidates without image URLs", () => {
    const noImagePosition: TStepperPosition = {
      id: "position-2",
      name: "Vice President",
      displayOrder: 2,
      candidates: [
        {
          id: "candidate-3",
          fullName: "No Image Candidate",
          imageUrl: null,
          manifesto: "No image manifesto",
        },
      ],
    };

    const { head } = renderStepper(0, [positions[0]!, noImagePosition]);

    expect(head).not.toContain('rel="prefetch"');
  });

  it.each([2, 3])("renders no prefetch hints at step index %i", (currentPositionIndex) => {
    const { head } = renderStepper(currentPositionIndex);

    expect(head).not.toContain('rel="prefetch"');
  });
});
