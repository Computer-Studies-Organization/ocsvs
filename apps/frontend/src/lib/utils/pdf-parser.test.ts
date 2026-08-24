import { describe, expect, it } from "vitest";
import { parseLegacyRosterPages, parseLines, parseSplitRosterPages } from "./pdf-parser";

describe("pdf-parser parseLines", () => {
  it("should parse split student IDs spanning 3 lines", () => {
    const lines = [
      "ACLC College",
      "C25-01-",
      "10306-",
      "MAN121",
      "ROSALES",
      "KIM R BSCS 1ST OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C25-01-10306-MAN121",
      lastName: "ROSALES",
      firstName: "KIM R",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });

  it("should parse split student IDs spanning 2 lines (prefix + full remainder)", () => {
    // Regression: previously the parser always consumed 3 lines, pulling the
    // student's last name into the ID and skipping it during name parsing.
    const lines = [
      "ACLC College",
      "C25-01-",
      "10306-MAN121",
      "ROSALES",
      "KIM R BSCS 1ST OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C25-01-10306-MAN121",
      lastName: "ROSALES",
      firstName: "KIM R",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });

  it("should parse single-line student IDs", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-BSC301",
      "DOE",
      "JOHN BSCS 2ND OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-BSC301",
      lastName: "DOE",
      firstName: "JOHN",
      course: "BSCS",
      yearLevel: "2nd Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });

  it("should ignore leading row numbers in legacy roster rows", () => {
    const result = parseLegacyRosterPages([
      [
        ["464 C25-01-10919-MAN121", "BABATUAN", "BRANDON", "ROMERO", "BSCS", "2ND", "OLD"],
        ["465 C24-01-8877-MAN121", "GODORNES", "JAY SHAN", "DEGAMO", "BSCS", "2ND", "OLD"],
      ],
    ]);

    expect(result).toEqual([
      {
        studentId: "C25-01-10919-MAN121",
        lastName: "BABATUAN",
        firstName: "BRANDON ROMERO",
        course: "BSCS",
        yearLevel: "2nd Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
      {
        studentId: "C24-01-8877-MAN121",
        lastName: "GODORNES",
        firstName: "JAY SHAN DEGAMO",
        course: "BSCS",
        yearLevel: "2nd Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
    ]);
  });

  it("should parse split roster pages without shifting supported rows", () => {
    const pages = [
      [
        ["#", "Student No.", "USN", "Last Name", "First Name"],
        ["1 C26-01-114512-MAN121 26001042600 IGNORED", "STUDENT"],
        ["2", "C26-01-15049-MAN121", "26001042601 ALAGBAN", "JONNA MAE"],
      ],
      [
        ["#", "Student No.", "USN", "Last Name", "First Name"],
        ["3", "C26-01-15158-MAN121", "00281495", "HASIM", "HADJALA"],
        ["4", "C26-01-14564-MAN121", "0900062210"],
        ["0", "SUELLO", "AARON"],
      ],
      [
        ["M.i.", "Course", "Level", "Type", "Contact #"],
        ["AUXTERO", "BSA", "1ST", "NEW"],
      ],
      [
        ["M.i.", "Course", "Level", "Type", "Contact #"],
        ["ABELLA", "BSIT", "1ST", "NEW"],
        ["-", "BSCS", "2ND", "TRANSFEREE"],
        ["SANTOS", "WADT", "3RD", "NEW"],
      ],
    ];

    expect(parseSplitRosterPages(pages)).toEqual([
      {
        studentId: "C26-01-15049-MAN121",
        lastName: "ALAGBAN",
        firstName: "JONNA MAE",
        course: "BSIT",
        yearLevel: "1st Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
      {
        studentId: "C26-01-15158-MAN121",
        lastName: "HASIM",
        firstName: "HADJALA",
        course: "BSCS",
        yearLevel: "2nd Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
      {
        studentId: "C26-01-14564-MAN121",
        lastName: "SUELLO",
        firstName: "AARON",
        course: "WADT",
        yearLevel: "3rd Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
    ]);
  });

  it("should reject incomplete split rosters and leave legacy layouts alone", () => {
    expect(parseSplitRosterPages([[["ACLC College"]]])).toBeNull();
    expect(() =>
      parseSplitRosterPages([
        [
          ["#", "Student No.", "USN", "Last Name", "First Name"],
          ["1", "C26-01-15049-MAN121", "ALAGBAN", "JONNA MAE"],
        ],
        [
          ["M.i.", "Course", "Level", "Type", "Contact #"],
          ["ABELLA", "BSIT", "1ST", "NEW"],
          ["SANTOS", "BSCS", "1ST", "NEW"],
        ],
      ]),
    ).toThrow("Split roster columns cannot be aligned.");

    expect(() =>
      parseSplitRosterPages([
        [
          ["#", "Student No.", "USN", "Last Name", "First Name"],
          ["2", "C26-01-15049-MAN121", "ALAGBAN", "JONNA MAE"],
        ],
        [
          ["M.i.", "Course", "Level", "Type", "Contact #"],
          ["ABELLA", "BSIT", "1ST", "NEW"],
        ],
      ]),
    ).toThrow("Split roster columns cannot be aligned.");
  });

  it("keeps malformed split rows editable and accepts six-digit IDs", () => {
    const pages = [
      [
        ["#", "Student No.", "USN", "Last Name", "First Name"],
        ["1", "C26-01-114512-MAN121", "SIX", "DIGITS"],
        ["2", "C26-01-15049-MAN121", "VALID", "STUDENT"],
      ],
      [
        ["M.i.", "Course", "Level", "Type", "Contact #"],
        ["-", "BSIT", "1ST", "NEW"],
        ["-", "BSCS", "5TH", "NEW"],
      ],
    ];

    expect(parseSplitRosterPages(pages)).toEqual([
      {
        studentId: "C26-01-114512-MAN121",
        lastName: "SIX",
        firstName: "DIGITS",
        course: "BSIT",
        yearLevel: "1st Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
      {
        studentId: "C26-01-15049-MAN121",
        lastName: "VALID",
        firstName: "STUDENT",
        course: "BSCS",
        yearLevel: "1st Year",
        hasParseError: true,
        parseErrorMessage: "Split roster enrollment row is malformed.",
      },
    ]);
  });

  it("skips unsupported rows even when another enrollment field is malformed", () => {
    expect(
      parseSplitRosterPages([
        [
          ["#", "Student No.", "USN", "Last Name", "First Name"],
          ["1", "C26-01-15049-MAN121", "SUPPORTED", "STUDENT"],
          ["2", "C26-01-15158-MAN121", "UNSUPPORTED", "STUDENT"],
        ],
        [
          ["M.i.", "Course", "Level", "Type", "Contact #"],
          ["-", "BSIT", "1ST", "NEW"],
          ["AUXTERO", "BSA", "5TH", "NEW"],
        ],
      ]),
    ).toEqual([
      {
        studentId: "C26-01-15049-MAN121",
        lastName: "SUPPORTED",
        firstName: "STUDENT",
        course: "BSIT",
        yearLevel: "1st Year",
        hasParseError: false,
        parseErrorMessage: undefined,
      },
    ]);
  });

  it("should flag missing year level on course info line", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-BSC301",
      "DOE",
      "JOHN BSCS",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-BSC301",
      lastName: "DOE",
      firstName: "JOHN",
      course: "BSCS",
      yearLevel: "1st Year", // Default fallback
      hasParseError: true,
      parseErrorMessage: "Missing year level. Defaulted to 1st Year.",
    });
  });

  it("should flag unparseable year level on course info line", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-BSC301",
      "DOE",
      "JOHN BSCS 5TH OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-BSC301",
      lastName: "DOE",
      firstName: "JOHN",
      course: "BSCS",
      yearLevel: "1st Year", // Default fallback
      hasParseError: true,
      parseErrorMessage: 'Unparseable year level: "5TH". Defaulted to 1st Year.',
    });
  });

  it("should parse student names with trailing commas (LASTNAME, FIRSTNAME format)", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-BSC301",
      "ROSALES, KIM R",
      "BSCS 1ST YEAR",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-BSC301",
      lastName: "ROSALES",
      firstName: "KIM R",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });

  it("should parse student names with multi-word last names separated by comma", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-BSC301",
      "DELA CRUZ, JUAN CARLOS",
      "BSCS 1ST YEAR",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-BSC301",
      lastName: "DELA CRUZ",
      firstName: "JUAN CARLOS",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });

  it("should flag a parse error when the course info line is missing entirely", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-BSC301",
      "DELA CRUZ, JUAN CARLOS",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-BSC301",
      lastName: "DELA CRUZ",
      firstName: "JUAN CARLOS",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: true,
      parseErrorMessage: "Could not detect student course information.",
    });
  });

  it("should not drop the next record when a preceding record has no course line", () => {
    // Regression: the inner loop broke on the second student's ID (the sentinel),
    // leaving j pointing at it. i = j; i++ then skipped it entirely.
    const lines = [
      "ACLC College",
      "C23-01-0001-BSC301", // student 1 — no course line; second ID becomes the break sentinel
      "DOE",
      "C23-01-0002-BSC301", // student 2 — was silently skipped before the fix
      "SMITH",
      "JOHN BSCS 1ST",
      "Showing 1 to 2 of 2 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      studentId: "C23-01-0001-BSC301",
      lastName: "DOE",
      hasParseError: true,
      parseErrorMessage: "Could not detect student course information.",
    });
    expect(result[1]).toMatchObject({
      studentId: "C23-01-0002-BSC301",
      lastName: "SMITH",
      firstName: "JOHN",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: false,
    });
  });

  it("should not match substring 'wadt' inside student names (e.g. WADSWORTH, JOHN)", () => {
    const lines = [
      "ACLC College",
      "C23-01-0095-WADT301",
      "WADSWORTH, JOHN",
      "WADT 2ND YEAR",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-0095-WADT301",
      lastName: "WADSWORTH",
      firstName: "JOHN",
      course: "WADT",
      yearLevel: "2nd Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });
});
