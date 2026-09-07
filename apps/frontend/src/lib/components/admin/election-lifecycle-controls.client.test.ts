// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { redirect } from "@sveltejs/kit";
import { goto, invalidate } from "$app/navigation";
import { appCache } from "$lib/cache";
import { loadElectionData } from "$lib/load-election-data";
import { extendElection, transitionElection } from "$lib/api/elections";
import { addToast } from "$lib/stores/toast.svelte";
import type { TElection } from "$lib/types";
import ElectionLifecycleControls from "./election-lifecycle-controls.svelte";

vi.mock("$app/navigation", () => ({ goto: vi.fn(), invalidate: vi.fn() }));
vi.mock("$lib/cache", () => ({ appCache: { invalidate: vi.fn() } }));
vi.mock("$lib/load-election-data", () => ({ loadElectionData: vi.fn() }));
vi.mock("$lib/api/elections", () => ({ extendElection: vi.fn(), transitionElection: vi.fn() }));
vi.mock("$lib/stores/toast.svelte", () => ({ addToast: vi.fn() }));
vi.mock("svelte/transition", () => ({ fade: () => ({}), fly: () => ({}) }));

const now = 1_800_000_000;
const election: TElection = {
  id: "election-1",
  name: "Election",
  description: null,
  status: "open",
  opensAt: now - 3600,
  closesAt: now + 3600,
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now * 1000);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it.each([
  ["Transition to Closed", "Election transitioned", transitionElection],
  ["Extend voting", "Election closing time extended successfully", extendElection],
] as const)(
  "preserves %s after refresh failure and retries only the refresh",
  async (label, message, mutation) => {
    vi.mocked(loadElectionData).mockRejectedValueOnce(new Error("offline"));
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(ElectionLifecycleControls, { target, props: { election } });
    const controls = () => target.querySelector<HTMLFieldSetElement>("fieldset")!;
    const click = async (text: string) => {
      [...target.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.trim() === text)!
        .click();
      await tick();
    };

    try {
      await click(label);
      target
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(target.textContent).toContain("The election change was saved"));

      expect(mutation).toHaveBeenCalledOnce();
      expect(addToast).toHaveBeenCalledExactlyOnceWith("success", message);
      expect(controls().disabled).toBe(true);
      expect(
        [...controls().querySelectorAll("button")].every((button) => button.matches(":disabled")),
      ).toBe(true);
      expect(appCache.invalidate).toHaveBeenCalledWith({ resource: "elections" });
      expect(appCache.invalidate).toHaveBeenCalledWith({
        resource: "election",
        params: { id: election.id },
      });
      expect(appCache.invalidate).toHaveBeenCalledWith({ params: { electionId: election.id } });
      expect(appCache.invalidate).toHaveBeenCalledWith({ resource: "votingState" });
      expect(loadElectionData).toHaveBeenCalledWith(election.id, {
        fetch,
        depends: expect.any(Function),
      });
      expect(invalidate).not.toHaveBeenCalled();

      // Another failed refresh keeps the warning and controls locked.
      vi.mocked(loadElectionData).mockRejectedValueOnce(new Error("still offline"));
      await click("Refresh page");
      await vi.waitFor(() => expect(loadElectionData).toHaveBeenCalledTimes(2));
      expect(invalidate).not.toHaveBeenCalled();
      expect(controls().disabled).toBe(true);
      expect(target.textContent).toContain("The election change was saved");

      let finishRefresh!: () => void;
      vi.mocked(invalidate).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishRefresh = resolve;
          }),
      );
      await click("Refresh page");
      expect(controls().disabled).toBe(true);
      expect(target.textContent).toContain("Refreshing…");
      finishRefresh();
      await vi.waitFor(() => expect(controls().disabled).toBe(false));
      expect(target.textContent).not.toContain("The election change was saved");
      expect(mutation).toHaveBeenCalledOnce();
      expect(addToast).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenLastCalledWith("app:election");
    } finally {
      await unmount(component);
    }
  },
);

it.each([
  ["Transition to Closed", transitionElection],
  ["Extend voting", extendElection],
] as const)("keeps a failed %s distinct from refresh failure", async (label, mutation) => {
  vi.mocked(mutation).mockRejectedValueOnce(new Error("Election changed elsewhere"));
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(ElectionLifecycleControls, { target, props: { election } });
  try {
    [...target.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === label)!
      .click();
    await tick();
    target
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(addToast).toHaveBeenCalledWith("error", "Election changed elsewhere"),
    );
    expect(invalidate).not.toHaveBeenCalled();
    expect(loadElectionData).not.toHaveBeenCalled();
    expect(appCache.invalidate).not.toHaveBeenCalled();
    expect(target.querySelector("fieldset")!.disabled).toBe(false);
    expect(target.textContent).not.toContain("The election change was saved");
  } finally {
    await unmount(component);
  }
});

it.each([
  ["Transition to Closed", "Election transitioned", transitionElection],
  ["Extend voting", "Election closing time extended successfully", extendElection],
] as const)("navigates after %s refresh redirect", async (label, message, mutation) => {
  vi.mocked(loadElectionData).mockImplementationOnce(async () => redirect(302, "/auth"));
  vi.mocked(goto).mockResolvedValue(undefined);

  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(ElectionLifecycleControls, { target, props: { election } });
  try {
    [...target.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === label)!
      .click();
    await tick();
    target
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(goto).toHaveBeenCalledWith("/auth"));
    expect(mutation).toHaveBeenCalledOnce();
    expect(addToast).toHaveBeenCalledExactlyOnceWith("success", message);
    expect(addToast).not.toHaveBeenCalledWith("error", expect.anything());
    expect(invalidate).not.toHaveBeenCalled();
    expect(target.textContent).not.toContain("The election change was saved");
  } finally {
    await unmount(component);
  }
});
