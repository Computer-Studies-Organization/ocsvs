import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import CommonPositionsModal from "./common-positions-modal.svelte";
import type { TPosition } from "$lib/types";
import { COMMON_POSITION_PRESETS } from "$lib/position-presets";

vi.mock("$app/navigation", () => ({
  invalidate: vi.fn(),
}));

vi.mock("$lib/api/positions", () => ({
  createPosition: vi.fn(),
}));

vi.mock("$lib/stores/toast.svelte", () => ({
  addToast: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    invalidate: vi.fn(),
  },
}));

const modalSource = readFileSync(
  fileURLToPath(new URL("./common-positions-modal.svelte", import.meta.url)),
  "utf8",
);

describe("common positions modal component structure", () => {
  it("renders as a responsive bottom sheet with accessible labels and 44px touch targets on all interactive elements", () => {
    expect(modalSource).toContain('presentation="sheet"');
    expect(modalSource).toContain('ariaLabelledby="common-positions-title"');
    expect(modalSource).toContain('type="checkbox"');
    expect(modalSource).toContain("min-h-11");
    expect(modalSource).toContain("Common positions");
    expect(modalSource).toContain("Already added");

    // Verify Select all and Deselect all specifically have min-h-11 touch targets
    expect(modalSource).toMatch(/onclick=\{selectAllAvailable\}[\s\S]*?class="[^"]*min-h-11[^"]*"/);
    expect(modalSource).toMatch(/onclick=\{deselectAll\}[\s\S]*?class="[^"]*min-h-11[^"]*"/);
  });

  it("creates selected missing positions sequentially without displayOrder", () => {
    expect(modalSource).toContain("createPosition(electionId, { name })");
    expect(modalSource).not.toContain("displayOrder:");
    expect(modalSource).toContain("for (let i = 0; i < toCreate.length; i++)");
    expect(modalSource).toContain("await createPosition");
  });

  it("handles duplicate prevention, cache invalidation, and partial failure reporting", () => {
    expect(modalSource).toContain("appCache.invalidate({ resource: 'elections' })");
    expect(modalSource).toContain("appCache.invalidate({ resource: 'election'");
    expect(modalSource).toContain("await invalidate('app:election')");
    expect(modalSource).toContain("Partially completed:");
    expect(modalSource).toContain("selectedPositions.has(preset)");
    expect(modalSource).toContain("disabled={isBusy");
  });

  it("safely resets isBusy in a finally block even if invalidation or submission throws", () => {
    expect(modalSource).toContain("finally {");
    expect(modalSource).toContain("isBusy = false");
    expect(modalSource).toContain("currentCreatingIndex = null");
    expect(modalSource).toContain("currentCreatingName = ''");
  });

  it("supports quick select all and deselect all actions for available presets", () => {
    expect(modalSource).toContain("selectAllAvailable");
    expect(modalSource).toContain("deselectAll");
    expect(modalSource).toContain("Select all");
    expect(modalSource).toContain("Deselect all");
  });
});

describe("common positions modal rendering behavior", () => {
  it("renders all 17 presets as selected by default when no positions exist", () => {
    const { body } = render(CommonPositionsModal, {
      props: {
        electionId: "elec-123",
        existingPositions: [],
        onclose: () => {},
        onsuccess: () => {},
      },
    });

    expect(body).toContain("17 of 17 available selected");
    expect(body).toContain("Add 17 positions");
    expect(body).toContain("Select all");
    expect(body).toContain("Deselect all");
    expect(body).not.toContain(
      "tracking-wider px-2 py-0.5 rounded bg-slate-800/90 text-slate-400 shrink-0",
    );
  });

  it("marks existing positions as already added and disables them", () => {
    const existing: TPosition[] = [
      {
        id: "pos-1",
        electionId: "elec-123",
        name: "Chairman",
        displayOrder: 1,
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: "pos-2",
        electionId: "elec-123",
        name: "Internal Vice-Chairman",
        displayOrder: 2,
        createdAt: 100,
        updatedAt: 100,
      },
    ];

    const { body } = render(CommonPositionsModal, {
      props: {
        electionId: "elec-123",
        existingPositions: existing,
        onclose: () => {},
        onsuccess: () => {},
      },
    });

    expect(body).toContain("15 of 15 available selected");
    expect(body).toContain("Add 15 positions");
    expect(body).toContain(
      "tracking-wider px-2 py-0.5 rounded bg-slate-800/90 text-slate-400 shrink-0",
    );
  });

  it("displays empty state notice when all presets have already been added", () => {
    const allExisting: TPosition[] = COMMON_POSITION_PRESETS.map((name, i) => ({
      id: `pos-${i}`,
      electionId: "elec-123",
      name,
      displayOrder: i + 1,
      createdAt: 100,
      updatedAt: 100,
    }));

    const { body } = render(CommonPositionsModal, {
      props: {
        electionId: "elec-123",
        existingPositions: allExisting,
        onclose: () => {},
        onsuccess: () => {},
      },
    });

    expect(body).toContain("All 17 common positions have already been added to this election.");
    expect(body).not.toContain("17 of 17 available selected");
    expect(body).toContain("No positions to add");
  });
});
