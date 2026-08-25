import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(fileURLToPath(new URL("./+page.svelte", import.meta.url)), "utf8");

describe("bulk import mobile layout", () => {
  it("keeps the import flow compact and touch-friendly on small screens", () => {
    expect(pageSource).toContain("px-3 py-4 sm:px-6 sm:py-6");
    expect(pageSource).toContain("min-h-11 min-w-11");
    expect(pageSource).toContain("p-6 text-center");
    expect(pageSource).toContain("overflow-x-auto");
  });

  it("neutralizes spreadsheet formulas in credentials CSV exports", () => {
    expect(pageSource).toContain('replace(/^[=+\\-@\\t\\r]/, "\'$&")');
  });

  it("automatically downloads credentials after importing accounts", () => {
    expect(pageSource).toContain("downloadCredentialsCsv(false)");
    expect(pageSource).toContain("If the file didn't download, use Download CSV below.");
  });

  it("accepts CSV roster files and blocks imports with parse errors", () => {
    expect(pageSource).toContain('accept=".pdf,.csv"');
    expect(pageSource).toContain("parseStudentCsv");
    expect(pageSource).toContain("Import student lists from PDF or CSV rosters");
    expect(pageSource).toContain("invalidCount > 0");
  });

  it("uses unique keys for repeated skipped IDs", () => {
    expect(pageSource).toContain("{#each skippedList as skip, idx (idx)}");
  });
});
