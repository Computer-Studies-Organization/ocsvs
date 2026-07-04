import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generatePassword,
  parseStudentText,
  planStudentImports,
  writeCredentialsCsv,
  type StudentRecord,
} from "./import-students";

const tempDirs: string[] = [];

function student(overrides: Partial<StudentRecord> = {}): StudentRecord {
  return {
    studentId: "C25-01-10306-MAN121",
    lastName: "Rosales",
    firstName: "Kim",
    middleName: "R",
    course: "BSCS",
    yearLevel: "1st Year",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseStudentText", () => {
  it("extracts student fields from the enrollment PDF text layout", () => {
    const text = [
      "ACLC College",
      "C25-01-",
      "10306-",
      "MAN121",
      "ROSALES",
      "KIM R BSCS 1ST OLD PAYMENT",
      "C25-01-",
      "10307-",
      "MAN121",
      "SANTOS",
      "ANA MARIE P BSCS 2ND OLD PAYMENT",
      "Showing 1 to 2 of 2 entries",
    ].join("\n");

    expect(parseStudentText(text)).toEqual([
      {
        studentId: "C25-01-10306-MAN121",
        lastName: "ROSALES",
        firstName: "KIM",
        middleName: "R",
        course: "BSCS",
        yearLevel: "1st Year",
      },
      {
        studentId: "C25-01-10307-MAN121",
        lastName: "SANTOS",
        firstName: "ANA MARIE",
        middleName: "P",
        course: "BSCS",
        yearLevel: "2nd Year",
      },
    ]);
  });

  it("joins PDF line breaks split across hyphenated names", () => {
    const text = ["C25-01-", "10308-", "MAN121", "CRUZ", "JO-", "AN Q BSCS 3RD OLD PAYMENT"].join(
      "\n",
    );

    expect(parseStudentText(text)[0]).toMatchObject({
      studentId: "C25-01-10308-MAN121",
      lastName: "CRUZ",
      firstName: "JO-AN",
      middleName: "Q",
      yearLevel: "3rd Year",
    });
  });
});

describe("generatePassword", () => {
  it("uses Web Crypto instead of Math.random", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used for passwords");
    });

    const password = generatePassword();

    expect(password).toHaveLength(10);
    expect(password).toMatch(/^[abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});

describe("planStudentImports", () => {
  it("skips duplicate student IDs from both the database and current PDF", () => {
    const existingStudentIds = new Set(["C25-01-00000-MAN121"]);
    const existingUsernames = new Set<string>();
    const duplicateInPdf = student({ studentId: "C25-01-10306-MAN121" });

    const result = planStudentImports(
      [
        student({ studentId: "C25-01-00000-MAN121" }),
        duplicateInPdf,
        duplicateInPdf,
        student({ studentId: "C25-01-10307-MAN121", firstName: "Ana", lastName: "Santos" }),
      ],
      existingStudentIds,
      existingUsernames,
    );

    expect(result.planned.map((entry) => entry.student.studentId)).toEqual([
      "C25-01-10306-MAN121",
      "C25-01-10307-MAN121",
    ]);
    expect(result.skipped.map((entry) => entry.studentId)).toEqual([
      "C25-01-00000-MAN121",
      "C25-01-10306-MAN121",
    ]);
    expect(existingStudentIds.has("C25-01-10306-MAN121")).toBe(true);
    expect(existingStudentIds.has("C25-01-10307-MAN121")).toBe(true);
  });
});

describe("writeCredentialsCsv", () => {
  it("does not write plaintext credentials during dry-run", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-students-"));
    tempDirs.push(dir);
    const csvPath = path.join(dir, "credentials.csv");

    expect(writeCredentialsCsv(["Student ID,Username,Password"], true, csvPath)).toBeNull();
    expect(fs.existsSync(csvPath)).toBe(false);
  });

  it("writes plaintext credentials for live imports", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-students-"));
    tempDirs.push(dir);
    const csvPath = path.join(dir, "credentials.csv");

    expect(writeCredentialsCsv(["header", "row"], false, csvPath)).toBe(csvPath);
    expect(fs.readFileSync(csvPath, "utf8")).toBe("header\nrow");
  });
});
