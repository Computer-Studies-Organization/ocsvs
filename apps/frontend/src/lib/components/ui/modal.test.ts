import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const modalSource = readFileSync(fileURLToPath(new URL("./modal.svelte", import.meta.url)), "utf8");
const appHtmlSource = readFileSync(
  fileURLToPath(new URL("../../../app.html", import.meta.url)),
  "utf8",
);

describe("mobile sheet keyboard layout", () => {
  it("uses the dynamic viewport and native keyboard resize behavior", () => {
    expect(modalSource).toContain("max-h-[100dvh]");
    expect(modalSource).toContain("overflow-y-auto");
    expect(modalSource).toContain("overscroll-contain");
    expect(modalSource).toContain("scroll-pb-6");
    expect(modalSource).toContain("pb-[max(1.5rem,env(safe-area-inset-bottom))]");
    expect(modalSource).toContain("keyboard-sheet");
    expect(appHtmlSource).toContain("interactive-widget=resizes-content");
  });
});
