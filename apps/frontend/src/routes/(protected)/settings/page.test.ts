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

  it("implements responsive two-column grid layout with sticky sidebar", () => {
    expect(pageSource).toContain("lg:grid-cols-12");
    expect(pageSource).toContain("lg:col-span-4");
    expect(pageSource).toContain("lg:col-span-8");
    expect(pageSource).toContain("lg:sticky");
  });

  it("presents a digital identity card with institutional record and copy control", () => {
    expect(pageSource).toContain("Institutional Record");
    expect(pageSource).toContain("Verified");
    expect(pageSource).toContain("Student ID");
    expect(pageSource).toContain("aria-label='Copy Student ID'");
    expect(pageSource).toContain("min-h-11 min-w-11");
  });

  it("provides real-time password feedback indicators", () => {
    expect(pageSource).toContain("8+ characters");
    expect(pageSource).toContain("Passwords match");
    expect(pageSource).toContain("Passwords do not match");
  });
});
