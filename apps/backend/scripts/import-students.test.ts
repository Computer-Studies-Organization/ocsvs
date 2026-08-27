import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  escapeCsvCell,
  generatePassword,
  parseSplitRosterPages,
  parseStudentCsv,
  parseStudentText,
  planStudentImports,
  writeCredentialsCsv,
  authenticateAdmin,
  type StudentRecord,
} from "./import-students";
import { verifyPassword } from "../src/lib/password";

vi.mock("../src/lib/password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/password")>();
  return {
    ...actual,
    verifyPassword: vi.fn(),
  };
});

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

  it("accepts A-prefixed student IDs", () => {
    const text = [
      "ACLC College",
      "A25-01-",
      "1240-",
      "MAN121",
      "DOE",
      "JANE BSCS 1ST OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ].join("\n");

    expect(parseStudentText(text)[0]).toEqual({
      studentId: "A25-01-1240-MAN121",
      lastName: "DOE",
      firstName: "JANE",
      middleName: null,
      course: "BSCS",
      yearLevel: "1st Year",
    });
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

  it.each([
    ["missing", "JOHN BSCS", "Missing year level."],
    ["unparseable", "JOHN BSCS 5TH OLD PAYMENT", 'Unparseable year level: "5TH".'],
  ])("rejects %s legacy year levels instead of defaulting", (_label, courseInfo, message) => {
    const text = [
      "C23-01-",
      "0095-",
      "BSC301",
      "DOE",
      courseInfo,
      "Showing 1 to 1 of 1 entries",
    ].join("\n");

    expect(() => parseStudentText(text)).toThrow(message);
  });

  it("keeps split roster rows aligned across page groups", () => {
    const pages = [
      {
        text: [
          "#\tStudent No.\tUSN\tLast Name\tFirst Name",
          "1 C26-01-114512-MAN121 26001042600 IGNORED\tSTUDENT",
          "2\tC26-01-15049-MAN121\t26001042601 ALAGBAN\tJONNA MAE",
        ].join("\n"),
      },
      {
        text: [
          "#\tStudent No.\tUSN\tLast Name\tFirst Name",
          "3\tC26-01-15158-MAN121\t00281495\tHASIM\tHADJALA",
          "4\tC26-01-14564-MAN121 0900062210",
          "0 SUELLO\tAARON",
        ].join("\n"),
      },
      {
        text: ["M.i.\tCourse\tLevel\tType\tContact #", "AUXTERO\tBSA\t1ST\tNEW"].join("\n"),
      },
      {
        text: [
          "M.i.\tCourse\tLevel\tType\tContact #",
          "ABELLA\tBSIT\t1ST\tOLD",
          "-\tBSCS\t2ND\tTRANSFEREE",
          "SANTOS\tWADT\t3RD\tNEW",
        ].join("\n"),
      },
    ];

    expect(parseSplitRosterPages(pages)).toEqual([
      {
        studentId: "C26-01-15049-MAN121",
        lastName: "ALAGBAN",
        firstName: "JONNA MAE",
        middleName: "ABELLA",
        course: "BSIT",
        yearLevel: "1st Year",
      },
      {
        studentId: "C26-01-15158-MAN121",
        lastName: "HASIM",
        firstName: "HADJALA",
        middleName: null,
        course: "BSCS",
        yearLevel: "2nd Year",
      },
      {
        studentId: "C26-01-14564-MAN121",
        lastName: "SUELLO",
        firstName: "AARON",
        middleName: "SANTOS",
        course: "WADT",
        yearLevel: "3rd Year",
      },
    ]);
  });

  it("accepts six-digit IDs for supported courses", () => {
    expect(
      parseSplitRosterPages([
        {
          text: [
            "#\tStudent No.\tUSN\tLast Name\tFirst Name",
            "1\tC26-01-114512-MAN121\tSIX\tDIGITS",
          ].join("\n"),
        },
        {
          text: ["M.i.\tCourse\tLevel\tType\tContact #", "-\tBSIT\t1ST\tNEW"].join("\n"),
        },
      ]),
    ).toEqual([
      {
        studentId: "C26-01-114512-MAN121",
        lastName: "SIX",
        firstName: "DIGITS",
        middleName: null,
        course: "BSIT",
        yearLevel: "1st Year",
      },
    ]);
  });

  it("rejects incomplete split rosters and leaves legacy layouts alone", () => {
    expect(parseSplitRosterPages([{ text: "ACLC College" }])).toBeNull();
    expect(() =>
      parseSplitRosterPages([
        {
          text: [
            "#\tStudent No.\tUSN\tLast Name\tFirst Name",
            "1\tC26-01-15049-MAN121\tALAGBAN\tJONNA MAE",
          ].join("\n"),
        },
        {
          text: [
            "M.i.\tCourse\tLevel\tType\tContact #",
            "ABELLA\tBSIT\t1ST\tNEW",
            "SANTOS\tBSCS\t1ST\tNEW",
          ].join("\n"),
        },
      ]),
    ).toThrow("Split roster columns cannot be aligned.");

    expect(() =>
      parseSplitRosterPages([
        {
          text: [
            "#\tStudent No.\tUSN\tLast Name\tFirst Name",
            "2\tC26-01-15049-MAN121\tALAGBAN\tJONNA MAE",
          ].join("\n"),
        },
        {
          text: ["M.i.\tCourse\tLevel\tType\tContact #", "ABELLA\tBSIT\t1ST\tNEW"].join("\n"),
        },
      ]),
    ).toThrow("Split roster columns cannot be aligned.");
  });
});

describe("parseStudentCsv", () => {
  it("ignores source-only enrollment status", () => {
    const csv = [
      ",,,,,,,,,",
      '1,C25-01-10001-MAN121,,SMITH,"JANE DOE",M,BSCS,1ST,NEW,',
      '2,C26-01-10002-MAN121,,"DOE, JR","ANN MARIE",M,BSIT,1ST,OLD,',
    ].join("\r\n");

    expect(parseStudentCsv(`\uFEFF${csv}\r\n`)).toEqual([
      {
        studentId: "C25-01-10001-MAN121",
        lastName: "SMITH",
        firstName: "JANE DOE",
        middleName: null,
        course: "BSCS",
        yearLevel: "1st Year",
      },
      {
        studentId: "C26-01-10002-MAN121",
        lastName: "DOE, JR",
        firstName: "ANN MARIE",
        middleName: null,
        course: "BSIT",
        yearLevel: "1st Year",
      },
    ]);
  });

  it("reports row numbers for wrong-width and invalid rows", () => {
    expect(() =>
      parseStudentCsv([",,,,,,,,,", "1,C25-01-10001-MAN121,SMITH,JANE"].join("\r\n")),
    ).toThrow("CSV row 2: expected 10 columns");

    expect(() =>
      parseStudentCsv([",,,,,,,,,", "1,BAD,,SMITH,JANE,,BSA,5TH,NEW,"].join("\r\n")),
    ).toThrow("CSV row 2: invalid student ID");

    expect(() =>
      parseStudentCsv(
        [",,,,,,,,,", "1,B25-01-10001-MAN121,,SMITH,JANE,,BSCS,1ST,NEW,"].join("\r\n"),
      ),
    ).toThrow("CSV row 2: invalid student ID");
  });

  it("rejects malformed quoted cells before import", () => {
    expect(() =>
      parseStudentCsv([",,,,,,,,,", '1,C25-01-10001-MAN121,,"SMITH'].join("\r\n")),
    ).toThrow("CSV row 2: unterminated quoted cell");
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
  it("escapes formulas and quotes in CSV cells", () => {
    expect(escapeCsvCell('=HYPERLINK("https://example.com")')).toBe(
      `"'=HYPERLINK(""https://example.com"")"`,
    );
  });

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

describe("authenticateAdmin", () => {
  const originalExit = process.exit;
  const mockExit = vi.fn() as any;
  const mockConsoleError = vi.fn();

  // Reset env variables before/after
  const oldEnv = { ...process.env };

  beforeEach(() => {
    process.exit = mockExit;
    vi.spyOn(console, "error").mockImplementation(mockConsoleError);
    mockExit.mockReset();
    mockConsoleError.mockReset();
  });

  afterEach(() => {
    process.exit = originalExit;
    process.env = { ...oldEnv };
  });

  it("authenticates admin using env variables and username lookup", async () => {
    process.env.ADMIN_IDENTIFIER = "admin_user";
    process.env.ADMIN_PASSWORD = "secretpassword";

    vi.mocked(verifyPassword).mockResolvedValue(true);

    const mockGet = vi.fn().mockReturnValue({
      id: "admin-uuid",
      username: "admin_user",
      passwordHash: "hashed-pw",
      role: "admin",
    });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: mockGet,
    };

    const result = await authenticateAdmin(mockDb);

    expect(result).toEqual({ id: "admin-uuid", username: "admin_user" });
    expect(mockGet).toHaveBeenCalled();
    expect(verifyPassword).toHaveBeenCalledWith("secretpassword", "hashed-pw");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("authenticates a super admin", async () => {
    process.env.ADMIN_IDENTIFIER = "super_admin";
    process.env.ADMIN_PASSWORD = "secretpassword";

    vi.mocked(verifyPassword).mockResolvedValue(true);

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue({
        id: "super-admin-uuid",
        username: "super_admin",
        passwordHash: "hashed-pw",
        role: "super_admin",
      }),
    };

    await expect(authenticateAdmin(mockDb)).resolves.toEqual({
      id: "super-admin-uuid",
      username: "super_admin",
    });
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("authenticates admin using env variables and studentId lookup", async () => {
    process.env.ADMIN_IDENTIFIER = "C25-01-12345-CSA001";
    process.env.ADMIN_PASSWORD = "secretpassword";

    vi.mocked(verifyPassword).mockResolvedValue(true);

    // First lookup (username): return null/undefined
    const mockGet = vi
      .fn()
      .mockReturnValueOnce(undefined) // username check fails
      .mockReturnValueOnce({
        // studentId check succeeds
        id: "admin-uuid",
        username: "admin_user",
        passwordHash: "hashed-pw",
        role: "admin",
      });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: mockGet,
    };

    const result = await authenticateAdmin(mockDb);

    expect(result).toEqual({ id: "admin-uuid", username: "admin_user" });
    expect(verifyPassword).toHaveBeenCalledWith("secretpassword", "hashed-pw");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("fails if account is not an admin", async () => {
    process.env.ADMIN_IDENTIFIER = "normal_user";
    process.env.ADMIN_PASSWORD = "secretpassword";

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue({
        id: "user-uuid",
        username: "normal_user",
        passwordHash: "hashed-pw",
        role: "user",
      }),
    };

    await authenticateAdmin(mockDb);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Access denied. The specified account is not an admin."),
    );
  });

  it("fails if password is incorrect", async () => {
    process.env.ADMIN_IDENTIFIER = "admin_user";
    process.env.ADMIN_PASSWORD = "wrongpassword";

    vi.mocked(verifyPassword).mockResolvedValue(false);

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnValue({
        id: "admin-uuid",
        username: "admin_user",
        passwordHash: "hashed-pw",
        role: "admin",
      }),
    };

    await authenticateAdmin(mockDb);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Invalid admin credentials (password incorrect)."),
    );
  });
});
