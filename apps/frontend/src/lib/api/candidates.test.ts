import { beforeEach, expect, it, vi } from "vitest";

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock("./client", () => ({ apiFetch: mockApiFetch }));

import { createCandidate } from "./candidates";

beforeEach(() => {
  mockApiFetch.mockReset();
});

it("returns the nested candidate from the create response", async () => {
  const candidate = {
    id: "candidate-1",
    fullName: "Alex Candidate",
    accountId: "account-1",
    positionId: "position-1",
    userId: "user-1",
    manifesto: "Manifesto",
    isActive: 1,
    imageUrl: null,
  };
  mockApiFetch.mockResolvedValue({ message: "Created", candidate });

  await expect(
    createCandidate({
      fullName: candidate.fullName,
      accountId: candidate.accountId,
      positionId: candidate.positionId,
      manifesto: candidate.manifesto,
    }),
  ).resolves.toEqual(candidate);
});
