import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");

describe("settings page", () => {
  it("marks profile and password forms as keyboard-scrollable", () => {
    expect(pageSource).toContain("keyboard-scroll-content");
  });

  it("keeps mobile navigation, cards, and submit actions touch-friendly", () => {
    expect(pageSource).toContain("min-h-11");
    expect(pageSource).toContain("p-4 sm:p-6");
    expect(pageSource).toContain("min-h-11 w-full");
  });
});
