import { expect, test, vi } from "vitest";

import {
  buildStepperPositions,
  deriveVotingPageState,
  hasVotedIn,
  pickEmptyCardVariant,
  preserveVotingState,
  refreshExpiredElectionState,
  shouldNotifyElectionClosed,
} from "./voting-page-state";
import type { TVotingPageState } from "./voting-page-state";
import type { TCandidate, TElection, TPosition, TVotingState } from "./types";

const base: TVotingState = {
  open: null,
  nextDraft: null,
  lastClosed: null,
  ballot: null,
  myVotes: { electionId: null, hasVoted: false },
};

test("pickEmptyCardVariant returns 'next-draft' when only nextDraft is present", () => {
  const state: TVotingState = {
    ...base,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
  };
  expect(pickEmptyCardVariant(state)).toBe("next-draft");
});

test("pickEmptyCardVariant returns 'last-closed' when only lastClosed is present", () => {
  const state: TVotingState = {
    ...base,
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
  };
  expect(pickEmptyCardVariant(state)).toBe("last-closed");
});

test("pickEmptyCardVariant returns 'both' when nextDraft and lastClosed are both present", () => {
  const state: TVotingState = {
    ...base,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
  };
  expect(pickEmptyCardVariant(state)).toBe("both");
});

test("pickEmptyCardVariant returns 'none' when neither nextDraft nor lastClosed is present", () => {
  expect(pickEmptyCardVariant(base)).toBe("none");
});

test("hasVotedIn returns true when participation matches the open election", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: "e1", hasVoted: true },
  };
  expect(hasVotedIn(state, "e1")).toBe(true);
});

test("hasVotedIn returns false when myVotes are for a different election", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: "e0", hasVoted: true },
  };
  expect(hasVotedIn(state, "e1")).toBe(false);
});

const emptyInput = {
  apiState: null,
  positions: null,
  candidates: null,
  loadError: null,
  isAdmin: false,
};

const openElection: TElection = {
  id: "e1",
  name: "Spring",
  description: null,
  status: "open",
  opensAt: 1,
  closesAt: 2,
  createdAt: 1,
  updatedAt: 1,
};

const apiStateWithOpen: TVotingState = {
  open: openElection,
  nextDraft: null,
  lastClosed: null,
  ballot: null,
  myVotes: { electionId: null, hasVoted: false },
};

const apiStateVoted: TVotingState = {
  ...apiStateWithOpen,
  myVotes: { electionId: "e1", hasVoted: true },
};

test("notifies closure when refreshed state has no open election", () => {
  expect(shouldNotifyElectionClosed(base, "e1")).toBe(true);
});

test("does not notify closure when the same election returns with a later deadline", () => {
  expect(
    shouldNotifyElectionClosed(
      {
        ...apiStateWithOpen,
        open: { ...openElection, closesAt: openElection.closesAt! + 3600 },
      },
      "e1",
    ),
  ).toBe(false);
});

test("retries after the inclusive server deadline while the same expired election remains open", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(200_000);
    const stillOpen = { ...apiStateWithOpen, open: { ...openElection, closesAt: 200 } };
    const closed = { ...base, open: null };
    const refresh = vi.fn().mockResolvedValueOnce(stillOpen).mockResolvedValueOnce(closed);

    const result = refreshExpiredElectionState(refresh, "e1", 200);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBe(closed);
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

test("stops after one boundary retry if the expired election remains open", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(200_000);
    const stillOpen = { ...apiStateWithOpen, open: { ...openElection, closesAt: 200 } };
    const refresh = vi.fn().mockResolvedValue(stillOpen);

    const result = refreshExpiredElectionState(refresh, "e1", 200);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBe(stillOpen);
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

const samplePositions: TPosition[] = [
  { id: "p2", electionId: "e1", name: "Vice", displayOrder: 2, createdAt: 1, updatedAt: 1 },
  { id: "p1", electionId: "e1", name: "President", displayOrder: 1, createdAt: 1, updatedAt: 1 },
];

const sampleCandidates: TCandidate[] = [
  {
    id: "c1",
    fullName: "Alice",
    accountId: "a1",
    positionId: "p1",
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
  {
    id: "c2",
    fullName: "Bob",
    accountId: "a2",
    positionId: "p2",
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
  {
    id: "c3",
    fullName: "Carol",
    accountId: "a3",
    positionId: "p1",
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
];

test("deriveVotingPageState returns loading when apiState is null and no error", () => {
  expect(deriveVotingPageState(emptyInput)).toEqual({ kind: "loading" });
});

test("deriveVotingPageState returns error when loadError is set, even if apiState is also set", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    loadError: "boom",
  });
  expect(result).toEqual({ kind: "error", message: "boom" });
});

test("deriveVotingPageState returns empty/next-draft when only nextDraft is present", () => {
  const apiState: TVotingState = {
    open: null,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
    lastClosed: null,
    ballot: null,
    myVotes: { electionId: null, hasVoted: false },
  };
  const result = deriveVotingPageState({ ...emptyInput, apiState });
  expect(result.kind).toBe("empty");
  if (result.kind !== "empty") throw new Error("narrow");
  expect(result.variant).toBe("next-draft");
  expect(result.nextDraft?.name).toBe("Fall");
  expect(result.lastClosed).toBeNull();
  expect(result.isAdmin).toBe(false);
});

test("deriveVotingPageState returns empty/last-closed when only lastClosed is present", () => {
  const apiState: TVotingState = {
    open: null,
    nextDraft: null,
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
    ballot: null,
    myVotes: { electionId: null, hasVoted: false },
  };
  const result = deriveVotingPageState({ ...emptyInput, apiState });
  expect(result.kind).toBe("empty");
  if (result.kind !== "empty") throw new Error("narrow");
  expect(result.variant).toBe("last-closed");
});

test("deriveVotingPageState returns empty/both when nextDraft and lastClosed are both present", () => {
  const apiState: TVotingState = {
    open: null,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
    ballot: null,
    myVotes: { electionId: null, hasVoted: false },
  };
  const result = deriveVotingPageState({ ...emptyInput, apiState });
  expect(result.kind).toBe("empty");
  if (result.kind !== "empty") throw new Error("narrow");
  expect(result.variant).toBe("both");
});

test("deriveVotingPageState returns empty/none when neither is present", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: { ...apiStateWithOpen, open: null },
  });
  expect(result.kind).toBe("empty");
  if (result.kind !== "empty") throw new Error("narrow");
  expect(result.variant).toBe("none");
});

test("deriveVotingPageState propagates isAdmin on the empty variant", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    isAdmin: true,
    apiState: { ...apiStateWithOpen, open: null },
  });
  expect(result.kind).toBe("empty");
  if (result.kind !== "empty") throw new Error("narrow");
  expect(result.isAdmin).toBe(true);
});

test("deriveVotingPageState returns voted when apiState.open is set and myVotes match", () => {
  const result = deriveVotingPageState({ ...emptyInput, apiState: apiStateVoted });
  expect(result).toEqual({ kind: "voted", election: openElection });
});

test("deriveVotingPageState returns an admin state instead of a ballot for an open election", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    isAdmin: true,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  expect(result).toEqual({ kind: "admin", election: openElection });
});

test("deriveVotingPageState returns stepper when apiState.open is set and user has not voted", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  expect(result.kind).toBe("stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  expect(result.election).toBe(openElection);
});

test("deriveVotingPageState stepper positions are sorted by displayOrder, candidates filtered by positionId, empty positions removed", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  expect(result.kind).toBe("stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  expect(result.positions.length).toBe(2);
  expect(result.positions[0]?.id).toBe("p1");
  expect(result.positions[1]?.id).toBe("p2");
  expect(result.positions[0]?.candidates.length).toBe(2);
  expect(result.positions[1]?.candidates.length).toBe(1);
  expect(result.positions[0]?.candidates.map((c) => c.id)).toEqual(["c1", "c3"]);
});

test("deriveVotingPageState stepper voting is initialised from createVotingState(positions)", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  expect(result.kind).toBe("stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  expect(result.voting.currentPositionIndex).toBe(0);
  expect(result.voting.selectedVotes["p1"]).toBeNull();
  expect(result.voting.selectedVotes["p2"]).toBeNull();
});

test("deriveVotingPageState stepper positions are empty when positions or candidates are null", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: null,
  });
  expect(result.kind).toBe("stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  expect(result.positions.length).toBe(0);
});

test("buildStepperPositions filters out positions with no candidates", () => {
  const positions: TPosition[] = [
    { id: "p1", electionId: "e1", name: "President", displayOrder: 1, createdAt: 1, updatedAt: 1 },
    {
      id: "p2",
      electionId: "e1",
      name: "Vice (empty)",
      displayOrder: 2,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const result = buildStepperPositions(positions, [
    {
      id: "c1",
      fullName: "Alice",
      positionId: "p1",
      manifesto: "",
      imageUrl: null,
    },
  ]);
  expect(result.length).toBe(1);
  expect(result[0]?.id).toBe("p1");
});

test("hasVotedIn returns false when there are no votes", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: null, hasVoted: false },
  };
  expect(hasVotedIn(state, "e1")).toBe(false);
});

test("hasVotedIn returns false when electionId is null", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: "e1", hasVoted: false },
  };
  expect(hasVotedIn(state, "e1")).toBe(false);
});

test("preserveVotingState preserves voting progress when transitioning between stepper states of the same election", () => {
  const sharedPosition = { id: "p1", name: "President", displayOrder: 1, candidates: [] };
  const current: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [sharedPosition],
    voting: {
      currentPositionIndex: 1,
      selectedVotes: { p1: "c1" },
    },
  };

  const next: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [sharedPosition],
    voting: {
      currentPositionIndex: 0,
      selectedVotes: {},
    },
  };

  const result = preserveVotingState(next, current);
  expect(result.kind).toBe("stepper");
  if (result.kind === "stepper") {
    expect(result.voting.selectedVotes).toEqual({ p1: "c1" });
    expect(result.voting.currentPositionIndex).toBe(1);
    expect(result.positions.length).toBe(1);
  }
});

test("preserveVotingState does not preserve voting progress when transitioning to a different election", () => {
  const current: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [],
    voting: {
      currentPositionIndex: 1,
      selectedVotes: { p1: "c1" },
    },
  };

  const next: TVotingPageState = {
    kind: "stepper",
    election: { ...openElection, id: "e2" },
    positions: [],
    voting: {
      currentPositionIndex: 0,
      selectedVotes: {},
    },
  };

  const result = preserveVotingState(next, current);
  expect(result.kind).toBe("stepper");
  if (result.kind === "stepper") {
    expect(result.voting.selectedVotes).toEqual({});
    expect(result.voting.currentPositionIndex).toBe(0);
  }
});

test("preserveVotingState does not preserve voting progress when transitioning to a non-stepper state", () => {
  const current: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [],
    voting: {
      currentPositionIndex: 1,
      selectedVotes: { p1: "c1" },
    },
  };

  const next: TVotingPageState = {
    kind: "voted",
    election: openElection,
  };

  const result = preserveVotingState(next, current);
  expect(result.kind).toBe("voted");
});

test("preserveVotingState does not preserve voting progress when positions change structurally (added or removed)", () => {
  const current: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [{ id: "p1", name: "President", displayOrder: 1, candidates: [] }],
    voting: {
      currentPositionIndex: 1,
      selectedVotes: { p1: "c1" },
    },
  };

  const next: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    // p1 removed, p2 added
    positions: [{ id: "p2", name: "Vice", displayOrder: 2, candidates: [] }],
    voting: {
      currentPositionIndex: 0,
      selectedVotes: {},
    },
  };

  const result = preserveVotingState(next, current);
  expect(result.kind).toBe("stepper");
  if (result.kind === "stepper") {
    expect(result.voting.selectedVotes).toEqual({});
    expect(result.voting.currentPositionIndex).toBe(0);
    expect(result.positions.length).toBe(1);
    expect(result.positions[0]?.id).toBe("p2");
  }
});

test("preserveVotingState preserves voting progress when positions are reordered but structurally identical", () => {
  const p1 = {
    id: "p1",
    name: "President",
    displayOrder: 1,
    candidates: [{ id: "c1", fullName: "Alice", imageUrl: null, manifesto: "" }],
  };
  const p2 = {
    id: "p2",
    name: "Vice",
    displayOrder: 2,
    candidates: [{ id: "c2", fullName: "Bob", imageUrl: null, manifesto: "" }],
  };

  const current: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [p1, p2],
    voting: {
      currentPositionIndex: 1,
      selectedVotes: { p1: "c1", p2: "c2" },
    },
  };

  const next: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [p2, p1], // reordered
    voting: {
      currentPositionIndex: 0,
      selectedVotes: {},
    },
  };

  const result = preserveVotingState(next, current);
  expect(result.kind).toBe("stepper");
  if (result.kind === "stepper") {
    expect(result.voting.selectedVotes).toEqual({ p1: "c1", p2: "c2" });
    expect(result.voting.currentPositionIndex).toBe(1);
  }
});

test("preserveVotingState discards voting progress when candidates within a position change structurally", () => {
  const p1Current = {
    id: "p1",
    name: "President",
    displayOrder: 1,
    candidates: [{ id: "c1", fullName: "Alice", imageUrl: null, manifesto: "" }],
  };
  const current: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [p1Current],
    voting: {
      currentPositionIndex: 0,
      selectedVotes: { p1: "c1" },
    },
  };

  const p1Next = {
    id: "p1",
    name: "President",
    displayOrder: 1,
    // c1 deactivated/removed, c2 added instead
    candidates: [{ id: "c2", fullName: "Bob", imageUrl: null, manifesto: "" }],
  };
  const next: TVotingPageState = {
    kind: "stepper",
    election: openElection,
    positions: [p1Next],
    voting: {
      currentPositionIndex: 0,
      selectedVotes: {},
    },
  };

  const result = preserveVotingState(next, current);
  expect(result.kind).toBe("stepper");
  if (result.kind === "stepper") {
    expect(result.voting.selectedVotes).toEqual({});
  }
});
