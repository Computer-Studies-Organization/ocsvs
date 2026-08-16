import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync(
  fileURLToPath(new URL("./Header.svelte", import.meta.url)),
  "utf8",
);
const stepperNavigationSource = readFileSync(
  fileURLToPath(new URL("./stepper-navigation.svelte", import.meta.url)),
  "utf8",
);
const stepperProgressSource = readFileSync(
  fileURLToPath(new URL("./stepper-progress.svelte", import.meta.url)),
  "utf8",
);
const modalSource = readFileSync(fileURLToPath(new URL("./modal.svelte", import.meta.url)), "utf8");
const authSource = readFileSync(
  fileURLToPath(new URL("../../../routes/(public)/auth/+page.svelte", import.meta.url)),
  "utf8",
);
const settingsSource = readFileSync(
  fileURLToPath(new URL("../../../routes/(protected)/settings/+page.svelte", import.meta.url)),
  "utf8",
);
const auditLogSource = readFileSync(
  fileURLToPath(new URL("../../../routes/(admin)/admin/audit-log/+page.svelte", import.meta.url)),
  "utf8",
);
const usersSource = readFileSync(
  fileURLToPath(new URL("../../../routes/(admin)/admin/users/+page.svelte", import.meta.url)),
  "utf8",
);
const userImportSource = readFileSync(
  fileURLToPath(
    new URL("../../../routes/(admin)/admin/users/import/+page.svelte", import.meta.url),
  ),
  "utf8",
);

describe("mobile touch targets", () => {
  it("keeps header action controls at least 44px square", () => {
    expect(headerSource).toMatch(/href='\/settings'[\s\S]*?class="[^"]*min-h-11[^"]*min-w-11/);
    expect(headerSource).toMatch(
      /onclick=\{handleLogout\}[\s\S]*?class='[^']*min-h-11[^']*min-w-11/,
    );
    expect(headerSource).toMatch(
      /aria-label=\{mobileMenuOpen \? 'Close menu' : 'Open menu'\}[\s\S]*?class='[^']*min-h-11[^']*min-w-11/,
    );
    expect(headerSource).toContain("aria-label='Settings'");
    expect(headerSource).toContain("aria-label='Log out'");
  });

  it("keeps mobile drawer links at least 44px tall", () => {
    const drawerSource = headerSource.split("<!-- Mobile Navigation Drawer -->")[1] ?? "";
    const drawerLinks = drawerSource.match(/<a[\s\S]*?<\/a>/g) ?? [];

    expect(drawerLinks.length).toBeGreaterThan(0);
    expect(drawerLinks.every((tag) => tag.includes("min-h-11"))).toBe(true);
  });

  it("keeps all voting step navigation buttons at least 44px tall", () => {
    const buttonTags = stepperNavigationSource.match(/<button[\s\S]*?<\/button>/g) ?? [];

    expect(buttonTags).toHaveLength(3);
    expect(buttonTags.every((tag) => tag.includes("min-h-11"))).toBe(true);
  });

  it("keeps password and modal controls touchable and state-labeled", () => {
    expect(authSource).toMatch(
      /aria-label=\{showPassword \? 'Hide password' : 'Show password'\}[\s\S]*?class='[^']*min-h-11[^']*min-w-11/,
    );
    expect(settingsSource).toContain(
      "aria-label={showCurrent ? 'Hide current password' : 'Show current password'}",
    );
    expect(settingsSource).toContain(
      "aria-label={showNew ? 'Hide new password' : 'Show new password'}",
    );
    expect(settingsSource).toContain(
      "aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}",
    );
    expect(modalSource).toMatch(
      /aria-label='Close modal'[\s\S]*?class='[^']*min-h-11[^']*min-w-11/,
    );
  });

  it("keeps audit dismissal and pagination controls at least 44px tall", () => {
    expect(auditLogSource).toContain(
      'class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg',
    );
    expect(auditLogSource).toContain('aria-label="Dismiss error"');
    expect(auditLogSource).toContain(
      "min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-red-500/10",
    );
    expect(auditLogSource).toMatch(/onclick=\{handlePrev\}[\s\S]*?class="min-h-11/);
    expect(auditLogSource).toMatch(/onclick=\{handleNext\}[\s\S]*?class="min-h-11/);
  });

  it("uses plain-language voter stepper labels", () => {
    expect(stepperNavigationSource).toContain("Previous");
    expect(stepperNavigationSource).toContain("Next");
    expect(stepperNavigationSource).toContain("Submit ballot");
    expect(stepperNavigationSource).not.toContain("Prev_Step");
    expect(stepperNavigationSource).not.toContain("Next_Step");
    expect(stepperProgressSource).toContain(
      "Step ${currentPositionIndex + 1} of ${totalPositions}",
    );
    expect(stepperProgressSource).toContain("Review ballot");
    expect(stepperProgressSource).not.toContain("CSO_VOTE://step-");
  });

  it("keeps user modal and action-menu buttons at least 44px tall", () => {
    const addModalSource =
      usersSource.split("<!-- Add User Modal -->")[1]?.split("{#if activeDropdownUserId")[0] ?? "";
    const actionMenuSource =
      usersSource.split("{#if activeDropdownUserId && activeDropdownUser}")[1] ?? "";
    const addModalButtons = addModalSource.match(/<button[\s\S]*?<\/button>/g) ?? [];
    const actionMenuButtons = actionMenuSource.match(/<button[\s\S]*?<\/button>/g) ?? [];

    expect(addModalButtons.length).toBeGreaterThan(0);
    expect(actionMenuButtons.length).toBeGreaterThan(0);
    expect(addModalButtons.every((tag) => tag.includes("min-h-11"))).toBe(true);
    expect(actionMenuButtons.every((tag) => tag.includes("min-h-11"))).toBe(true);
  });

  it("keeps student-import row deletion touchable", () => {
    const deleteButton = userImportSource.match(
      /<button\s+onclick=\{\(\) => deleteRecord\(index\)\}[\s\S]*?<\/button>/,
    )?.[0];

    expect(deleteButton).toBeDefined();
    expect(deleteButton).toContain("min-h-11");
    expect(deleteButton).toContain("min-w-11");
  });
});
