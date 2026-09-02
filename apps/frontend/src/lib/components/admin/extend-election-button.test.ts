import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import ExtendElectionButton from "./extend-election-button.svelte";
import type { TElection } from "$lib/types";

vi.mock("$lib/api/elections", () => ({ extendElection: vi.fn() }));
vi.mock("$lib/stores/toast.svelte", () => ({ addToast: vi.fn() }));

const now = Math.floor(Date.now() / 1000);
const election: TElection = {
  id: "election-1",
  name: "CSO Election",
  description: null,
  status: "open",
  opensAt: now - 60,
  closesAt: now + 3600,
  createdAt: 1,
  updatedAt: 1,
};

describe("extend election control", () => {
  it("renders only while the election is effectively open", () => {
    expect(render(ExtendElectionButton, { props: { election } }).body).toContain("Extend voting");
    expect(
      render(ExtendElectionButton, {
        props: { election: { ...election, opensAt: now + 60 } },
      }).body,
    ).not.toContain("Extend voting");
    expect(
      render(ExtendElectionButton, {
        props: { election: { ...election, closesAt: now - 1 } },
      }).body,
    ).not.toContain("Extend voting");
  });
});
