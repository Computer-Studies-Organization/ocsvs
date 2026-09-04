// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { extendElection } from "$lib/api/elections";
import { toLocalDateTime } from "$lib/election-lifecycle-client";
import type { TElection } from "$lib/types";
import ExtendElectionButton from "./extend-election-button.svelte";

vi.mock("$lib/api/elections", () => ({ extendElection: vi.fn() }));
vi.mock("$lib/stores/toast.svelte", () => ({ addToast: vi.fn() }));
vi.mock("svelte/transition", () => ({ fade: () => ({}), fly: () => ({}) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe("ExtendElectionButton interactions", () => {
  it("submits a timestamp selected through the native datetime input", async () => {
    const currentClose = Math.floor(new Date(2026, 0, 15, 10).getTime() / 1000);
    const selectedClose = Math.floor(new Date(2026, 0, 16, 23).getTime() / 1000);
    vi.spyOn(Date, "now").mockReturnValue(new Date(2026, 0, 15, 9).getTime());

    const election: TElection = {
      id: "election-2",
      name: "Election",
      description: null,
      status: "open",
      opensAt: currentClose - 2 * 3600,
      closesAt: currentClose,
      createdAt: 1,
      updatedAt: 1,
    };
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(ExtendElectionButton, { target, props: { election } });

    try {
      target.querySelector<HTMLButtonElement>("button")!.click();
      await tick();

      const input = target.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
      expect(input).toBeDefined();
      expect(input.closest("label")?.querySelector("button")).toBeNull();
      expect(input.value).toBe(toLocalDateTime(currentClose + 3600));

      input.value = toLocalDateTime(selectedClose);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      target.querySelector<HTMLButtonElement>("form button[type='submit']")!.click();
      await tick();

      expect(extendElection).toHaveBeenCalledWith(election.id, selectedClose);
    } finally {
      await unmount(component);
    }
  });

  it("rejects a deadline less than one minute after the current close", async () => {
    const currentClose = Math.floor(new Date(2026, 0, 15, 10, 0, 30).getTime() / 1000);
    vi.spyOn(Date, "now").mockReturnValue(new Date(2026, 0, 15, 9).getTime());

    const election: TElection = {
      id: "election-3",
      name: "Election",
      description: null,
      status: "open",
      opensAt: currentClose - 2 * 3600,
      closesAt: currentClose,
      createdAt: 1,
      updatedAt: 1,
    };
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(ExtendElectionButton, { target, props: { election } });

    try {
      target.querySelector<HTMLButtonElement>("button")!.click();
      await tick();

      const input = target.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
      expect(input.min).toBe(toLocalDateTime(currentClose + 90));
      input.value = toLocalDateTime(currentClose + 30);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      target
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await tick();

      expect(extendElection).not.toHaveBeenCalled();
    } finally {
      await unmount(component);
    }
  });
});
