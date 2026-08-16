import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render } from "svelte/server";
import Page from "./+page.svelte";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");

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

  it("keeps the desktop table and adds a compact mobile card branch", () => {
    expect(pageSource).toContain('class="hidden md:block overflow-x-auto"');
    expect(pageSource).toContain('class="md:hidden space-y-3 p-3"');
    expect(pageSource).toContain("formatAuditAction(entry.action)");
    expect(pageSource).toContain("aria-controls={`audit-details-${entry.id}`}");
  });

  it("preserves expanded audit details and readable action fallbacks", () => {
    expect(pageSource).toContain("Candidate updated");
    expect(pageSource).toContain(".split(/[._-]+/)");
    expect(pageSource).toContain("actorAccountIdSnapshot");
    expect(pageSource).toContain("entry.description");
    expect(pageSource).toContain("getTargetLink(entry)");
    expect(pageSource).toContain("aria-expanded={expandedId === entry.id}");
  });
});
