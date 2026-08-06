import { describe, expect, it } from "vitest";
import { isUniqueConstraintError } from "./errors";

describe("isUniqueConstraintError", () => {
  it("should return true if the error message matches 'UNIQUE constraint failed'", () => {
    const err = new Error("UNIQUE constraint failed: table.column");
    expect(isUniqueConstraintError(err)).toBe(true);
  });

  it("should return false if the error message does not match", () => {
    const err = new Error("Some other database error");
    expect(isUniqueConstraintError(err)).toBe(false);
  });

  it("should return false for null, undefined, or non-error objects", () => {
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
    expect(isUniqueConstraintError("UNIQUE constraint failed")).toBe(false);
    expect(isUniqueConstraintError({ message: "UNIQUE constraint failed" })).toBe(false);
  });

  it("should resolve single-level nested causes", () => {
    const root = new Error("Database transaction failed");
    const cause = new Error("UNIQUE constraint failed: table.column");
    root.cause = cause;

    expect(isUniqueConstraintError(root)).toBe(true);
  });

  it("should resolve deeply nested causes", () => {
    const root = new Error("Operation failed");
    const mid = new Error("Repository create failed");
    const cause = new Error("UNIQUE constraint failed: table.column");
    root.cause = mid;
    mid.cause = cause;

    expect(isUniqueConstraintError(root)).toBe(true);
  });

  it("should return false if cause chain is clean but none matches", () => {
    const root = new Error("Operation failed");
    const cause = new Error("Constraint failed, but not unique");
    root.cause = cause;

    expect(isUniqueConstraintError(root)).toBe(false);
  });

  it("should stop when an error cause references an earlier error", () => {
    const root = new Error("Operation failed");
    const cause = new Error("Constraint failed, but not unique");
    let rootReads = 0;
    let causeReads = 0;
    Object.defineProperty(root, "cause", {
      get: () => {
        rootReads += 1;
        if (rootReads > 1) throw new Error("root cause was read twice");
        return cause;
      },
    });
    Object.defineProperty(cause, "cause", {
      get: () => {
        causeReads += 1;
        if (causeReads > 1) throw new Error("cause cause was read twice");
        return root;
      },
    });

    expect(isUniqueConstraintError(root)).toBe(false);
  });
});
