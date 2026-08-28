import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import Page from "./+page.svelte";

describe("party detail page", () => {
  it("renders the loaded platform description", () => {
    const { body } = render(Page, {
      props: {
        data: {
          electionId: "election-1",
          party: {
            id: "party-1",
            electionId: "election-1",
            name: "Innovators",
            code: "INNOV",
            color: "#3B82F6",
            description: "A student-first platform.",
            createdAt: 1,
            updatedAt: 1,
          },
        },
      },
    });

    expect(body).toContain("A student-first platform.");
    expect(body).toContain("Back to election");
  });
});
