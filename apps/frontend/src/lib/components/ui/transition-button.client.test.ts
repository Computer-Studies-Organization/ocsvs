// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { transitionElection } from "$lib/api/elections";
import type { TElection } from "$lib/types";
import TransitionButton from "./transition-button.svelte";

vi.mock("$lib/api/elections", () => ({ transitionElection: vi.fn() }));
vi.mock("$lib/stores/toast.svelte", () => ({ addToast: vi.fn() }));
vi.mock("svelte/transition", () => ({ fade: () => ({}), fly: () => ({}) }));

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("TransitionButton interactions", () => {
  it("submits the selected opening and closing timestamps", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const expectedOpensAt = 1_800_000_000;
    const election: TElection = {
      id: "election-3",
      name: "Draft Election",
      description: null,
      status: "draft",
      opensAt: null,
      closesAt: null,
      createdAt: expectedOpensAt,
      updatedAt: expectedOpensAt,
    };
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TransitionButton, { target, props: { election } });

    const click = async (label: string) => {
      [...target.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await tick();
    };

    try {
      await click("Transition to Open");
      await click("+2 hours");
      await click("Confirm");

      expect(transitionElection).toHaveBeenCalledWith(election.id, {
        to: "open",
        opensAt: expectedOpensAt,
        closesAt: expectedOpensAt + 2 * 3600,
      });
    } finally {
      await unmount(component);
    }
  });

  it("rejects a closing time below the displayed minimum", async () => {
    const opensAt = 1_800_000_000;
    const election: TElection = {
      id: "election-4",
      name: "Draft Election",
      description: null,
      status: "draft",
      opensAt,
      closesAt: opensAt + 30,
      createdAt: opensAt,
      updatedAt: opensAt,
    };
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(TransitionButton, { target, props: { election } });

    try {
      [...target.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Transition to Open")!
        .click();
      await tick();
      [...target.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Confirm")!
        .click();
      await tick();

      expect(transitionElection).not.toHaveBeenCalled();
      expect(target.textContent).toContain(
        "Closing time must be at least one minute after opening time",
      );
    } finally {
      await unmount(component);
    }
  });
});
