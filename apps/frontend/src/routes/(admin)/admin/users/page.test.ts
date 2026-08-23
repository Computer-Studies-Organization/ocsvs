import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");
const modalSource = readFileSync(
  fileURLToPath(new URL("../../../../lib/components/ui/modal.svelte", import.meta.url)),
  "utf8",
);

describe("admin users actions", () => {
  it("does not expose a reset-password action without an implemented reset flow", () => {
    expect(pageSource).not.toContain("Reset password");
  });

  it("opens chained action modals after the view sheet outro completes", () => {
    expect(pageSource).toContain("onOutroEnd={runPendingViewAction}");
    expect(pageSource).toContain("pendingViewAction");
    expect(pageSource).not.toContain("await tick()");
    expect(modalSource).toContain("onoutroend={onOutroEnd}");
  });

  it("only exposes unlock for active users", () => {
    const accountActions = pageSource.slice(
      pageSource.indexOf("<!-- Account actions -->"),
      pageSource.indexOf("<!-- Danger Zone -->"),
    );

    expect(accountActions).toContain("{#if !viewUser.deletedAt}");
    expect(accountActions).toContain("startMobileUnlock");
  });

  it("reserves mobile bottom space for the fixed add-user FAB", () => {
    expect(pageSource).toContain("pt-6 pb-24 md:pb-6");
    expect(pageSource).toContain("md:hidden fixed bottom-6 right-6");
  });

  it("exposes a link to the student bulk import page", () => {
    expect(pageSource).toContain("href='/admin/users/import'");
    expect(pageSource).toContain("Import Students");
  });
});
