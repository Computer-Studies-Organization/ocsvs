import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn(),
}));

describe("admin dashboard turnout", () => {
  it("renders unavailable turnout without null values or a null progress width", () => {
    const { body } = render(Page, {
      props: {
        data: {
          stats: {
            votersCount: 25,
            electionsCount: 3,
            activeElection: {
              id: "legacy-election",
              name: "Legacy Election",
              opensAt: null,
              closesAt: null,
              votedCount: 12,
              votersCount: null,
              turnoutPct: null,
            },
            recentLogs: [],
          },
        },
      },
    });

    expect(body).toContain("Unavailable");
    expect(body).toContain("Ballot turnout unavailable");
    expect(body).not.toContain("null%");
    expect(body).not.toContain("width: null");
    expect(body).toContain("12 votes cast");
  });
});
