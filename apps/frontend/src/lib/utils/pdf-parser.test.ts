import { describe, expect, it } from "vitest";
import { parseLines } from "./pdf-parser";

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

  it("should parse single-line student IDs", () => {
    const lines = [
      "ACLC College",
      "C23-01-095",
      "DOE",
      "JOHN BSCS 2ND OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-095",
      lastName: "DOE",
      firstName: "JOHN",
      course: "BSCS",
      yearLevel: "2nd Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });

  it("should flag missing year level on course info line", () => {
    const lines = ["ACLC College", "C23-01-095", "DOE", "JOHN BSCS", "Showing 1 to 1 of 1 entries"];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-095",
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
      "C23-01-095",
      "DOE",
      "JOHN BSCS 5TH OLD PAYMENT",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-095",
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
      "C23-01-095",
      "ROSALES, KIM R",
      "BSCS 1ST YEAR",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-095",
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
      "C23-01-095",
      "DELA CRUZ, JUAN CARLOS",
      "BSCS 1ST YEAR",
      "Showing 1 to 1 of 1 entries",
    ];

    const result = parseLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      studentId: "C23-01-095",
      lastName: "DELA CRUZ",
      firstName: "JUAN CARLOS",
      course: "BSCS",
      yearLevel: "1st Year",
      hasParseError: false,
      parseErrorMessage: undefined,
    });
  });
});
