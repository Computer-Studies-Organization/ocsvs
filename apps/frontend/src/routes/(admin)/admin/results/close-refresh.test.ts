import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");

describe("admin results close refresh", () => {
  it("forces a final refresh when the effective status closes", () => {
    expect(pageSource).toContain("refreshResultsAfterClose(");
    expect(pageSource).toContain("() => poll(true)");
    expect(pageSource).toContain("async function poll(force = false)");
  });
});
