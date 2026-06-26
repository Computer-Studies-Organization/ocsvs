import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "./audit-actions";

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("audit-actions enum drift", () => {
  it("every auditLogRepo.insert() action literal in handlers is in AUDIT_ACTIONS.options", () => {
    const handlersDir = path.join(process.cwd(), "src", "handlers");
    const files = walk(handlersDir);
    const re = /auditLogRepo\.insert\(\s*\w+\s*,\s*\{\s*action:\s*"([^"]+)"/g;

    const found = new Set<string>();
    for (const f of files) {
      const content = fs.readFileSync(f, "utf8");
      for (const m of content.matchAll(re)) {
        found.add(m[1]);
      }
    }

    // All 12 actions must appear as string literals in the handlers.
    expect(found.size).toBe(12);

    // Every literal must be a valid action.
    const valid = new Set<string>(AUDIT_ACTIONS.options);
    for (const action of found) {
      expect(valid.has(action)).toBe(true);
    }
  });
});
