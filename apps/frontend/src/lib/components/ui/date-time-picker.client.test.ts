// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount, type ComponentProps } from "svelte";
import { extendElection } from "$lib/api/elections";
import ExtendElectionButton from "../admin/extend-election-button.svelte";
import DateTimePicker from "./date-time-picker.svelte";

vi.mock("$lib/api/elections", () => ({ extendElection: vi.fn() }));
vi.mock("$lib/stores/toast.svelte", () => ({ addToast: vi.fn() }));
vi.mock("svelte/transition", () => ({ fade: () => ({}), fly: () => ({}) }));

const mounted = new Set<ReturnType<typeof mount>>();

function renderPicker(props: ComponentProps<typeof DateTimePicker>) {
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(DateTimePicker, { target, props });
  mounted.add(component);
  return target;
}

function findButton(target: HTMLElement, text: string) {
  const button = [...target.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  return button!;
}

function localTimestamp(year: number, month: number, day: number, hour: number, minute = 0) {
  return Math.floor(new Date(year, month, day, hour, minute).getTime() / 1000);
}

afterEach(async () => {
  await Promise.all([...mounted].map((component) => unmount(component)));
  mounted.clear();
  document.body.replaceChildren();
});

describe("DateTimePicker interactions", () => {
  it("associates its label with a generated trigger id", () => {
    const target = renderPicker({ label: "Election Start Time" });
    const label = target.querySelector("label");
    const trigger = target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']");

    expect(label?.htmlFor).toBeTruthy();
    expect(label?.htmlFor).toBe(trigger?.id);
  });

  it("moves focus into the dialog, exposes date state, and restores focus", async () => {
    const selected = new Date();
    selected.setHours(10, 0, 0, 0);
    const target = renderPicker({ value: Math.floor(selected.getTime() / 1000) });
    const trigger = target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!;

    trigger.click();
    await tick();
    await tick();

    const dialog = target.querySelector<HTMLElement>("[role='dialog']")!;
    const selectedDate = dialog.querySelector<HTMLButtonElement>("button[aria-pressed='true']")!;
    expect(document.activeElement).toBe(dialog);
    expect(selectedDate.getAttribute("aria-label")).toBe(
      selected.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
    expect(selectedDate.getAttribute("aria-current")).toBe("date");

    findButton(target, "Done").click();
    await tick();
    await tick();
    expect(document.activeElement).toBe(trigger);
  });

  it("bounds presets and reports the assigned value", async () => {
    const changes: Array<number | null> = [];
    const target = renderPicker({
      min: 100,
      max: 200,
      presets: [
        { label: "Too early", getTimestamp: () => 50 },
        { label: "Too late", getTimestamp: () => 250 },
      ],
      onchange: (value) => changes.push(value),
    });

    findButton(target, "Too early").click();
    await tick();
    expect(changes.at(-1)).toBe(100);

    findButton(target, "Too late").click();
    await tick();
    expect(changes.at(-1)).toBe(200);
  });

  it("uses the displayed reference day when time is selected before a date", async () => {
    const changes: Array<number | null> = [];
    const min = localTimestamp(2099, 1, 20, 10);
    const target = renderPicker({ min, onchange: (value) => changes.push(value) });

    target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!.click();
    await tick();
    const hour = target.querySelector<HTMLSelectElement>("select[aria-label='Hour']")!;
    hour.value = "11";
    hour.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();

    expect(changes.at(-1)).toBe(localTimestamp(2099, 1, 20, 11));
  });

  it("applies bounds to calendar and time changes", async () => {
    const changes: Array<number | null> = [];
    const initial = localTimestamp(2026, 0, 15, 10);
    const expectedDateSelection = localTimestamp(2026, 0, 16, 10);
    const max = localTimestamp(2026, 0, 16, 12);
    const target = renderPicker({
      value: initial,
      min: localTimestamp(2026, 0, 15, 8),
      max,
      onchange: (value) => changes.push(value),
    });

    target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")?.click();
    await tick();
    findButton(target, "16").click();
    await tick();
    expect(changes.at(-1)).toBe(expectedDateSelection);

    findButton(target, "PM").click();
    await tick();
    expect(changes.at(-1)).toBe(max);
  });

  it("reports clearing through onchange", async () => {
    const changes: Array<number | null> = [];
    const target = renderPicker({
      value: localTimestamp(2026, 0, 15, 10),
      onchange: (value) => changes.push(value),
    });

    target.querySelector<HTMLButtonElement>("button[aria-label='Clear date']")?.click();
    await tick();

    expect(changes).toEqual([null]);
  });

  it("keeps all picker controls touch-friendly", async () => {
    const target = renderPicker({
      value: localTimestamp(2026, 0, 15, 10),
      presets: [{ label: "Preset", getTimestamp: () => localTimestamp(2026, 0, 15, 11) }],
    });

    target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")?.click();
    await tick();

    expect(target.querySelector("button[aria-label='Clear date']")?.className).toContain(
      "min-h-11",
    );
    expect(target.querySelector("button[aria-haspopup='dialog']")?.className).toContain("pr-12");
    expect(findButton(target, "Preset").className).toContain("min-w-11");
    expect(target.querySelector("button[aria-label='Previous month']")?.className).toContain(
      "min-w-11",
    );
    expect(target.querySelector("button[aria-label='Next month']")?.className).toContain(
      "min-w-11",
    );
    expect(findButton(target, "AM").className).toContain("min-w-11");
    expect(findButton(target, "PM").className).toContain("min-w-11");
    expect(findButton(target, "Done").className).toContain("min-w-11");
    expect(target.querySelector("[role='dialog'] .grid")?.className).toContain("overflow-x-auto");
    expect(
      [...target.querySelectorAll<HTMLButtonElement>("[role='dialog'] .grid button")].every(
        (button) => button.className.includes("min-h-11") && button.className.includes("min-w-11"),
      ),
    ).toBe(true);
    expect(
      [...target.querySelectorAll<HTMLSelectElement>("[role='dialog'] select")].every(
        (select) => select.className.includes("min-h-11") && select.className.includes("min-w-11"),
      ),
    ).toBe(true);
  });

  it("closes only the picker when Escape is pressed inside a modal", async () => {
    const now = Math.floor(Date.now() / 1000);
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(ExtendElectionButton, {
      target,
      props: {
        election: {
          id: "election-1",
          name: "Election",
          description: null,
          status: "open",
          opensAt: now - 60,
          closesAt: now + 3600,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    mounted.add(component);

    findButton(target, "Extend voting").click();
    await tick();
    target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!.click();
    await tick();
    target
      .querySelector<HTMLButtonElement>("button[aria-label='Previous month']")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();

    expect(target.querySelector("[aria-label='Date and time selector']")).toBeNull();
    expect(target.querySelector("#extend-election-title")).not.toBeNull();
  });

  it("submits the closing timestamp selected through the picker", async () => {
    vi.spyOn(Date, "now").mockReturnValue(localTimestamp(2026, 0, 15, 9) * 1000);
    vi.mocked(extendElection).mockClear();

    const election = {
      id: "election-2",
      name: "Election",
      description: null,
      status: "open" as const,
      opensAt: localTimestamp(2026, 0, 15, 8),
      closesAt: localTimestamp(2026, 0, 15, 10),
      createdAt: 1,
      updatedAt: 1,
    };
    const target = document.createElement("div");
    document.body.append(target);
    const component = mount(ExtendElectionButton, { target, props: { election } });
    mounted.add(component);

    findButton(target, "Extend voting").click();
    await tick();
    target.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!.click();
    await tick();

    findButton(target, "16").click();
    await tick();
    findButton(target, "PM").click();
    await tick();
    target.querySelector<HTMLButtonElement>("form button[type='submit']")!.click();
    await tick();

    expect(extendElection).toHaveBeenCalledWith(election.id, localTimestamp(2026, 0, 16, 23));
  });
});
