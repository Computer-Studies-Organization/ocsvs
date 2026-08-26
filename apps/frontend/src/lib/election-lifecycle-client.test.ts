import { describe, expect, it } from "vitest";
import {
  fromLocalDateTime,
  getEffectiveElectionStatus,
  toLocalDateTime,
} from "./election-lifecycle-client";

describe("election schedule conversion", () => {
  it("round-trips a datetime-local value without changing the selected minute", () => {
    const timestamp = 1_800_000_000 - (1_800_000_000 % 60);
    expect(fromLocalDateTime(toLocalDateTime(timestamp))).toBe(timestamp);
  });

  it("keeps missing or invalid values empty", () => {
    expect(toLocalDateTime(null)).toBe("");
    expect(fromLocalDateTime("")).toBeNull();
  });

  it("reports an expired open election as closed", () => {
    expect(
      getEffectiveElectionStatus({ status: "open", opensAt: 1_000, closesAt: 2_000 }, 2_001),
    ).toBe("closed");
  });
});
