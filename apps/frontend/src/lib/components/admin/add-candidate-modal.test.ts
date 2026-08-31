import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const modalSource = readFileSync(
  fileURLToPath(new URL("./add-candidate-modal.svelte", import.meta.url)),
  "utf8",
);

describe("add candidate user picker", () => {
  it("uses bounded debounced server search instead of a fixed user dropdown", () => {
    expect(modalSource).not.toContain("limit: 100");
    expect(modalSource).toContain("limit: 20");
    expect(modalSource).toContain("includeDeleted: false");
    expect(modalSource).toContain("setTimeout(() => {");
    expect(modalSource).toContain("}, 300)");
    expect(modalSource).toContain("query.length < 2");
    expect(modalSource).not.toContain('id="createAccountId"');
    expect(modalSource).not.toContain("Select a user");
  });

  it("keeps identity selection separate from visible search text", () => {
    expect(modalSource).toContain("selectedUser = user");
    expect(modalSource).toContain(
      "const createAccountId = $derived(selectedUser?.accountId ?? '')",
    );
    expect(modalSource).toContain("const createFullName = $derived(selectedUser ?");
    expect(modalSource).toContain("accountId: createAccountId");
    expect(modalSource).toContain("function clearUserSelection()");
    expect(modalSource).toContain("getCandidateUserLabel(selectedUser)");
  });

  it("allows candidate submission without a manifesto", () => {
    const manifestoOpeningTag =
      modalSource.match(/<textarea\b[^>]*id="createManifesto"[^>]*>/)?.[0] ?? "";

    expect(modalSource).toContain(
      'Manifesto <span style="color: oklch(0.55 0.015 250)">(optional)</span>',
    );
    expect(modalSource).toContain("manifesto: createManifesto.trim()");
    expect(modalSource).not.toContain("!createManifesto.trim()");
    expect(manifestoOpeningTag).not.toContain("required");
  });

  it("exposes result, empty, error, and keyboard-accessible combobox states", () => {
    expect(modalSource).toContain('role="combobox"');
    expect(modalSource).toContain('role="listbox"');
    expect(modalSource).toContain('role="option"');
    expect(modalSource).toContain("aria-activedescendant");
    expect(modalSource).toContain("Searching users…");
    expect(modalSource).toContain("No users found.");
    expect(modalSource).toContain("Failed to search users");
    expect(modalSource).toContain("e.key === 'ArrowDown'");
    expect(modalSource).toContain("e.key === 'ArrowUp'");
    expect(modalSource).toContain("e.key === 'Enter'");
    expect(modalSource).toContain("e.key === 'Escape'");
  });
});
