import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import Page from "./+page.svelte";

vi.mock("$app/state", () => ({
  page: {
    url: new URL("https://example.test/admin/audit-log"),
  },
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: {
    get: vi.fn(),
  },
}));

describe("audit log filters", () => {
  it("offers party actions and party targets", () => {
    const { body } = render(Page);

    expect(body).toContain('<option value="party.create">party.create</option>');
    expect(body).toContain('<option value="party.update">party.update</option>');
    expect(body).toContain('<option value="party.delete">party.delete</option>');
    expect(body).toContain('<option value="party">party</option>');
  });
});
