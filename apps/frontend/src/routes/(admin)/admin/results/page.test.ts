import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

describe("admin results mobile layout", () => {
  it("keeps navigation and result controls usable on narrow screens", () => {
    const { body } = render(Page, {
      props: {
        data: {
          elections: [
            {
              id: "election-1",
              name: "Freedom",
              description: null,
              status: "archived",
              opensAt: null,
              closesAt: null,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
          selectedElectionId: "election-1",
          resultsData: {
            results: [
              {
                positionId: "position-1",
                positionName: "Mayor",
                candidates: [
                  {
                    candidateId: "candidate-1",
                    candidateName: "Lilith Gomez",
                    positionId: "position-1",
                    positionName: "Mayor",
                    voteCount: 4,
                  },
                ],
              },
            ],
            meta: { totalVotes: 4, totalPositions: 1 },
          },
          resultsError: "",
        },
      },
    });

    expect(body).toContain('href="/admin-dashboard"');
    expect(body).toContain("min-h-11");
    expect(body).not.toContain(">Back</button>");
    expect(body).not.toContain("absolute right-0");
    expect(body).toMatch(/id="election-select"[^>]*class="[^"]*min-h-11[^"]*w-full/);
    expect(body).toMatch(/<button class="[^"]*min-h-11[^"]*w-full[^"]*sm:w-auto/);
    expect(body).toContain("grid grid-cols-2 gap-3 sm:gap-4");
    expect(body).toContain("mb-4 flex flex-col items-start gap-3");
    expect(body).toContain("flex flex-wrap items-center gap-x-4 gap-y-1");
  });
});
