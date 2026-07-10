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
  it("every emitted audit action literal is in AUDIT_ACTIONS.options", () => {
    const files = [
      ...walk(path.join(process.cwd(), "src", "handlers")),
      ...walk(path.join(process.cwd(), "src", "lib")),
      ...walk(path.join(process.cwd(), "scripts")),
    ];
    const re =
      /(?:(?:auditLogRepo|auditLogger)\.insert\(\s*\w+\s*,\s*\{\s*action:\s*"([^"]+)"|const\s+\w+_AUDIT_ACTION\s*=\s*"([^"]+)"\s+satisfies\s+AuditAction)/g;

    const found = new Set<string>();
    for (const f of files) {
      const content = fs.readFileSync(f, "utf8");
      for (const m of content.matchAll(re)) {
        found.add(m[1] ?? m[2]);
      }
    }

    // All canonical actions must appear as emitted literals in handlers or scripts.
    expect(found.size).toBe(AUDIT_ACTIONS.options.length);

    // Every literal must be a valid action.
    const valid = new Set<string>(AUDIT_ACTIONS.options);
    for (const action of found) {
      expect(valid.has(action)).toBe(true);
    }
  });
});
