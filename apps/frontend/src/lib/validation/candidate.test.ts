import { describe, expect, it } from "vitest";
import { createCandidateSchema, updateCandidateSchema } from "./candidate";

describe("optional candidate manifesto", () => {
  it("accepts blank manifestos for create and update", () => {
    expect(createCandidateSchema.safeParse({ fullName: "Candidate", manifesto: "" }).success).toBe(
      true,
    );
    expect(updateCandidateSchema.safeParse({ manifesto: "   " }).success).toBe(true);
  });

  it("retains the maximum manifesto length", () => {
    const manifesto = "x".repeat(5001);
    expect(createCandidateSchema.safeParse({ fullName: "Candidate", manifesto }).success).toBe(
      false,
    );
    expect(updateCandidateSchema.safeParse({ manifesto }).success).toBe(false);
  });
});

describe("updateCandidateSchema", () => {
  it("rejects isActive because candidate status changes use DELETE", () => {
    expect(updateCandidateSchema.safeParse({ isActive: 0 }).success).toBe(false);
  });

  it("continues to accept candidate metadata updates", () => {
    expect(updateCandidateSchema.safeParse({ manifesto: "Updated manifesto" }).success).toBe(true);
  });
});
