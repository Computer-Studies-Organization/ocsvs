import { beforeEach, expect, it, vi } from "vitest";

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock("./client", () => ({ apiFetch: mockApiFetch }));

import { extendElection } from "./elections";

beforeEach(() => mockApiFetch.mockReset());

it("submits an absolute election extension deadline", async () => {
  await extendElection("election-1", 1_800_000_000);

  expect(mockApiFetch).toHaveBeenCalledWith("/elections/election-1/extensions", {
    method: "POST",
    body: JSON.stringify({ closesAt: 1_800_000_000 }),
  });
});
