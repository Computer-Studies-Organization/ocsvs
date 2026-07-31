import { describe, expect, it, vi } from "vitest";
import { load } from "./+page";

vi.mock("$lib/api/candidates", () => ({
  getCandidate: vi.fn(),
}));

vi.mock("$lib/api/users", () => ({
  fetchUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/api/parties", () => ({
  listPartyLists: vi.fn().mockResolvedValue([]),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: vi.fn((key: string) => ({
      fetch: vi.fn().mockImplementation(async () => {
        if (key === "election") {
          return { id: "election-1", name: "CSO Election", status: "draft" };
        }
        if (key === "positions") {
          return [
            { id: "position-1", electionId: "election-1", name: "President" },
            { id: "position-2", electionId: "election-1", name: "Vice President" },
          ];
        }
        return null;
      }),
    })),
  },
}));

import { getCandidate } from "$lib/api/candidates";

describe("candidate detail loader", () => {
  it("loads candidate successfully when hierarchy matches", async () => {
    vi.mocked(getCandidate).mockResolvedValueOnce({
      id: "candidate-1",
      fullName: "Alex Candidate",
      accountId: "account-1",
      positionId: "position-1",
      manifesto: "Manifesto",
      isActive: 1,
      imageUrl: null,
    } as any);

    const result = await load({
      params: {
        electionId: "election-1",
        positionId: "position-1",
        candidateId: "candidate-1",
      },
      fetch: vi.fn(),
      depends: vi.fn(),
    } as any);

    expect((result as any).candidate.id).toBe("candidate-1");
    expect((result as any).position?.id).toBe("position-1");
  });

  it("throws 404 when candidate positionId does not match positionId param", async () => {
    vi.mocked(getCandidate).mockResolvedValueOnce({
      id: "candidate-1",
      fullName: "Alex Candidate",
      accountId: "account-1",
      positionId: "position-2", // Belongs to position-2, but URL specifies position-1
      manifesto: "Manifesto",
      isActive: 1,
      imageUrl: null,
    } as any);

    try {
      await load({
        params: {
          electionId: "election-1",
          positionId: "position-1",
          candidateId: "candidate-1",
        },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any);
      expect.fail("Expected 404 error");
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.body.message).toBe("Candidate not found in this position");
    }
  });

  it("throws 404 when positionId is not found in the election", async () => {
    vi.mocked(getCandidate).mockResolvedValueOnce({
      id: "candidate-1",
      fullName: "Alex Candidate",
      accountId: "account-1",
      positionId: "position-nonexistent",
      manifesto: "Manifesto",
      isActive: 1,
      imageUrl: null,
    } as any);

    try {
      await load({
        params: {
          electionId: "election-1",
          positionId: "position-nonexistent",
          candidateId: "candidate-1",
        },
        fetch: vi.fn(),
        depends: vi.fn(),
      } as any);
      expect.fail("Expected 404 error");
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.body.message).toBe("Candidate not found in this position");
    }
  });
});
