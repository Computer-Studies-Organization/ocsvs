import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");
const modalSource = readFileSync(
  fileURLToPath(new URL("../../../../lib/components/ui/modal.svelte", import.meta.url)),
  "utf8",
);

describe("admin users actions", () => {
  it("exposes the reset-password flow and identifies the target", () => {
    const resetHandler = pageSource.slice(
      pageSource.indexOf("async function handleResetPasswordSave"),
      pageSource.indexOf("async function copyResetCredentials"),
    );
    const credentialsIndex = resetHandler.indexOf("resetSuccessDetails = res.credentials");
    const refreshIndex = resetHandler.indexOf("await invalidate('app:users')");

    expect(pageSource).toContain("Reset Password");
    expect(pageSource).toContain("{resetPasswordUser.username}");
    expect(credentialsIndex).toBeGreaterThanOrEqual(0);
    expect(refreshIndex).toBeGreaterThan(credentialsIndex);
    expect(resetHandler).toContain("const password = resetPasswordInput.trim()");
    expect(resetHandler).toContain("if (password && password.length < 8)");
    expect(resetHandler).toContain("password: password || undefined");
    expect(resetHandler).toContain("} catch {");
  });

  it("ignores reset responses after the modal target changes", () => {
    const resetHandler = pageSource.slice(
      pageSource.indexOf("async function handleResetPasswordSave"),
      pageSource.indexOf("async function copyResetCredentials"),
    );

    expect(pageSource).toContain("let resetRequestToken = 0");
    expect(pageSource).toContain("resetRequestToken += 1");
    expect(resetHandler).toContain("const requestToken = ++resetRequestToken");
    expect(resetHandler).toContain(
      "if (requestToken !== resetRequestToken || resetPasswordUser?.id !== userId) return",
    );
    expect(resetHandler).toContain(
      "if (requestToken === resetRequestToken && resetPasswordUser?.id === userId)",
    );
  });

  it("keeps the reset modal open while the request is saving", () => {
    const closeHandler = pageSource.slice(
      pageSource.indexOf("function closeResetModal"),
      pageSource.indexOf("async function handleResetPasswordSave"),
    );
    const resetModal = pageSource.slice(
      pageSource.indexOf("<!-- Reset Password Modal -->"),
      pageSource.indexOf("<!-- Hard Delete Confirm -->"),
    );

    expect(closeHandler).toContain("if (isResetSaving) return");
    expect(resetModal).toContain("onclick={closeResetModal}\n          disabled={isResetSaving}");
  });

  it("keeps reset password visible but disabled for archived users", () => {
    const accountActions = pageSource.slice(
      pageSource.indexOf("<!-- Account actions -->"),
      pageSource.indexOf("<!-- Danger Zone -->"),
    );
    const desktopMenu = pageSource.slice(
      pageSource.indexOf("{#if activeDropdownUserId && activeDropdownUser}"),
      pageSource.indexOf("<!-- Divider -->"),
    );

    expect(accountActions).toContain("disabled={viewUser.deletedAt !== null");
    expect(desktopMenu).toContain("Reset Password");
    expect(desktopMenu).toContain("disabled={activeDropdownUser.deletedAt !== null");
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
