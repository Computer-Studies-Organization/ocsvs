import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

describe("admin results navigation", () => {
  it("renders an inline dashboard link instead of the floating back button", () => {
    const { body } = render(Page, {
      props: {
        data: {
          elections: [],
          selectedElectionId: "",
          resultsData: {
            results: [],
            meta: { totalVotes: 0, totalPositions: 0 },
          },
          resultsError: "",
        },
      },
    });

    expect(body).toContain('href="/admin-dashboard"');
    expect(body).toContain("Dashboard</a>");
    expect(body).not.toContain(">Back</button>");
    expect(body).not.toContain("absolute right-0");
  });
});
