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
const commonPositionsModalSource = readFileSync(
  fileURLToPath(new URL("../admin/common-positions-modal.svelte", import.meta.url)),
  "utf8",
);
const ballotStepperSource = readFileSync(
  fileURLToPath(new URL("./ballot-stepper.svelte", import.meta.url)),
  "utf8",
);
const ballotReviewSource = readFileSync(
  fileURLToPath(new URL("./ballot-review.svelte", import.meta.url)),
  "utf8",
);
const votingCandidateCardSource = readFileSync(
  fileURLToPath(new URL("./voting-candidate-card.svelte", import.meta.url)),
  "utf8",
);

describe("mobile touch targets", () => {
  it("keeps header action controls at least 44px square", () => {
    expect(headerSource).toMatch(/href='\/settings'[\s\S]*?class="[^"]*min-h-11[^"]*min-w-11/);
    expect(headerSource).toMatch(
      /onclick=\{\(\) => showLogoutConfirm = true\}[\s\S]*?class='[^']*min-h-11[^']*min-w-11/,
    );
    expect(headerSource).toMatch(
      /aria-label=\{mobileMenuOpen \? 'Close menu' : 'Open menu'\}[\s\S]*?class='[^']*min-h-11[^']*min-w-11/,
    );
    expect(headerSource).toContain("aria-label='Settings'");
    expect(headerSource).toContain("aria-label='Log out'");
    expect(headerSource).toContain("ariaLabelledby='logout-title'");
    expect(headerSource).toContain("Are you sure you want to log out?");
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

  it("keeps common position preset rows and all modal buttons at least 44px tall", () => {
    const labelTags = commonPositionsModalSource.match(/<label[\s\S]*?<\/label>/g) ?? [];
    const buttonTags = commonPositionsModalSource.match(/<button[\s\S]*?<\/button>/g) ?? [];

    expect(labelTags.length).toBeGreaterThan(0);
    expect(buttonTags.length).toBeGreaterThan(0);
    expect(labelTags.every((tag) => tag.includes("min-h-11"))).toBe(true);
    expect(buttonTags.every((tag) => tag.includes("min-h-11"))).toBe(true);
  });

  it("keeps ballot stepper fast-fill and clear selection buttons at least 44px tall with safe bottom spacing", () => {
    expect(ballotStepperSource).toContain("min-h-11 flex-1 sm:flex-initial inline-flex");
    expect(ballotStepperSource).toContain(
      "min-h-11 inline-flex items-center justify-center rounded-xl border border-slate-700",
    );
    expect(ballotStepperSource).toContain(
      "min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800",
    );
    expect(ballotStepperSource).toContain("calc(5.5rem + env(safe-area-inset-bottom, 0px))");
  });

  it("keeps ballot review action triggers at least 44px tall with human-friendly labels", () => {
    const actionButtons = ballotReviewSource.match(/<button[\s\S]*?<\/button>/g) ?? [];
    expect(actionButtons.length).toBeGreaterThan(0);
    expect(actionButtons.every((tag) => tag.includes("min-h-11"))).toBe(true);
    expect(ballotReviewSource).toContain("Edit selection");
    expect(ballotReviewSource).toContain("Choose candidate");
    expect(ballotReviewSource).not.toContain("Edit_selection");
    expect(ballotReviewSource).not.toContain("Choose_candidate");
  });

  it("positions mobile stepper progress banner below sticky header with safe margins and touch-friendly quick-jump tabs", () => {
    expect(stepperProgressSource).toContain("top-[calc(4rem+1px)] sm:top-[calc(4.25rem+1px)]");
    expect(stepperProgressSource).toContain("-mx-4 mb-6");
    expect(stepperProgressSource).toContain("sm:-mx-6 sm:px-6");
    expect(stepperProgressSource).toContain("min-h-11 min-w-11");
    expect(stepperProgressSource).toContain('<nav class="mt-2.5');
    expect(stepperProgressSource).toContain("aria-current={isActive ? 'step' : undefined}");
    expect(stepperProgressSource).not.toContain('role="tablist"');
    expect(stepperProgressSource).not.toContain('role="tab"');
  });

  it("docks stepper navigation with safe area padding and touch-friendly controls", () => {
    expect(stepperNavigationSource).toContain(
      "max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
    );
    expect(stepperNavigationSource).toContain("max-md:pt-3");
    expect(stepperNavigationSource).toContain("max-md:backdrop-blur-xl");
  });

  it("ensures candidate card party badge on mobile provides an accessible touch area", () => {
    expect(votingCandidateCardSource).toContain("min-h-11");
    expect(votingCandidateCardSource).not.toContain("min-h-9");
    expect(votingCandidateCardSource).toContain("max-sm:max-h-56");
  });

  it("keeps density toggle controls touch-friendly with accessible labels", () => {
    expect(ballotStepperSource).toMatch(
      /aria-label='Switch to detailed card view'[\s\S]*?class="[^"]*min-h-11[^"]*min-w-11/,
    );
    expect(ballotStepperSource).toMatch(
      /aria-label='Switch to compact card view'[\s\S]*?class="[^"]*min-h-11[^"]*min-w-11/,
    );
    expect(ballotStepperSource).toContain("aria-label='Ballot density'");
    expect(ballotStepperSource).toContain("title='Detailed view'");
    expect(ballotStepperSource).toContain("title='Compact view'");
  });
});
