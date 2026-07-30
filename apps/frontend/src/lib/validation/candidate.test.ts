import { describe, expect, it } from "vitest";
import { updateCandidateSchema } from "./candidate";

describe("updateCandidateSchema", () => {
  it("rejects isActive because candidate status changes use DELETE", () => {
    expect(updateCandidateSchema.safeParse({ isActive: 0 }).success).toBe(false);
  });

  it("continues to accept candidate metadata updates", () => {
    expect(updateCandidateSchema.safeParse({ manifesto: "Updated manifesto" }).success).toBe(true);
  });
});
