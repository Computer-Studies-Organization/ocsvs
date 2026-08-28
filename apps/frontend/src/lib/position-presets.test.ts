import { describe, expect, it } from "vitest";
import {
  COMMON_POSITION_PRESETS,
  getMissingPresets,
  isPositionAlreadyAdded,
  normalizePositionName,
} from "./position-presets";

describe("COMMON_POSITION_PRESETS", () => {
  it("contains the exact 17 CSO positions in the specified canonical order", () => {
    expect(COMMON_POSITION_PRESETS).toEqual([
      "Chairman",
      "Internal Vice-Chairman",
      "External Vice-Chairman",
      "Internal Secretary",
      "External Secretary",
      "Auditor",
      "Treasurer",
      "Freshman PIO",
      "Junior PIO",
      "Sophomore PIO",
      "Senior PIO",
      "Head of Committees",
      "Editor in Chief",
      "Programming Committee Leader",
      "Gaming Committee Leader",
      "Graphics and Design Committee Leader",
      "Networking Committee Leader",
    ]);
  });

  it("includes Head of Committees as the 12th position", () => {
    expect(COMMON_POSITION_PRESETS[11]).toBe("Head of Committees");
  });
});

describe("normalizePositionName", () => {
  it("trims and lowercases position names", () => {
    expect(normalizePositionName("  Chairman  ")).toBe("chairman");
    expect(normalizePositionName("Internal Vice-Chairman")).toBe("internal vice-chairman");
    expect(normalizePositionName("HEAD OF COMMITTEES")).toBe("head of committees");
  });
});

describe("isPositionAlreadyAdded", () => {
  const existing = [
    { name: "Chairman" },
    { name: "  Treasurer " },
    { name: "FRESHMAN PIO" },
    { name: "Custom Officer" },
  ];

  it("identifies matching existing positions case-insensitively with trimmed whitespace", () => {
    expect(isPositionAlreadyAdded("Chairman", existing)).toBe(true);
    expect(isPositionAlreadyAdded("chairman", existing)).toBe(true);
    expect(isPositionAlreadyAdded("  Chairman  ", existing)).toBe(true);
    expect(isPositionAlreadyAdded("Treasurer", existing)).toBe(true);
    expect(isPositionAlreadyAdded("Freshman PIO", existing)).toBe(true);
  });

  it("returns false for positions not in the election", () => {
    expect(isPositionAlreadyAdded("Auditor", existing)).toBe(false);
    expect(isPositionAlreadyAdded("Head of Committees", existing)).toBe(false);
    expect(isPositionAlreadyAdded("Editor in Chief", existing)).toBe(false);
  });
});

describe("getMissingPresets", () => {
  it("returns all 17 presets when existing positions list is empty", () => {
    const missing = getMissingPresets([]);
    expect(missing).toEqual(COMMON_POSITION_PRESETS);
    expect(missing).toHaveLength(17);
  });

  it("excludes already added positions and preserves relative preset order", () => {
    const existing = [
      { name: "Chairman" },
      { name: "Auditor" },
      { name: "Head of Committees" },
      { name: "Networking Committee Leader" },
    ];
    const missing = getMissingPresets(existing);

    expect(missing).not.toContain("Chairman");
    expect(missing).not.toContain("Auditor");
    expect(missing).not.toContain("Head of Committees");
    expect(missing).not.toContain("Networking Committee Leader");
    expect(missing).toHaveLength(13);

    // Verify relative order is preserved
    expect(missing[0]).toBe("Internal Vice-Chairman");
    expect(missing[1]).toBe("External Vice-Chairman");
    expect(missing[2]).toBe("Internal Secretary");
    expect(missing[3]).toBe("External Secretary");
    expect(missing[4]).toBe("Treasurer");
    expect(missing[5]).toBe("Freshman PIO");
  });

  it("returns an empty array when all 17 presets are already added", () => {
    const existing = COMMON_POSITION_PRESETS.map((name) => ({ name }));
    const missing = getMissingPresets(existing);
    expect(missing).toEqual([]);
  });
});
