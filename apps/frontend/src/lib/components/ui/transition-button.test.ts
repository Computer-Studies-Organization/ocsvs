import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import TransitionButton from "./transition-button.svelte";
import type { TElection } from "$lib/types";

vi.mock("$lib/api/elections", () => ({
  transitionElection: vi.fn(),
}));
vi.mock("$lib/stores/toast.svelte", () => ({
  addToast: vi.fn(),
}));

const now = Math.floor(Date.now() / 1000);

describe("TransitionButton component", () => {
  it("renders allowed transitions for a draft election", () => {
    const draftElection: TElection = {
      id: "election-1",
      name: "Draft Election",
      description: null,
      status: "draft",
      opensAt: null,
      closesAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const { body } = render(TransitionButton, {
      props: {
        election: draftElection,
      },
    });

    expect(body).toContain("Transition to Open");
  });

  it("renders transition to closed for an open election", () => {
    const openElection: TElection = {
      id: "election-2",
      name: "Open Election",
      description: null,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
      createdAt: now,
      updatedAt: now,
    };

    const { body } = render(TransitionButton, {
      props: {
        election: openElection,
      },
    });

    expect(body).toContain("Transition to Closed");
  });
});
