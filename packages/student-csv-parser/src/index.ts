export const STUDENT_ID_PATTERN = /^[AC]\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}$/;
const SUPPORTED_COURSES = new Set(["BSCS", "BSIT", "WADT"]);
const CSV_COLUMN_COUNT = 10;

export interface ParsedStudentCsvRow {
  rowNumber: number;
  studentId: string;
  lastName: string;
  firstName: string;
  course: string;
  yearLevel: string;
  errorMessage?: string;
  isStructuralError?: boolean;
}

export function isStudentId(value: string): boolean {
  return STUDENT_ID_PATTERN.test(value);
}

export function isSupportedCourse(value: string): boolean {
  return SUPPORTED_COURSES.has(value);
}

export function toYearLevel(rawLevel: string): string | null {
  switch (rawLevel.toUpperCase()) {
    case "1ST":
      return "1st Year";
    case "2ND":
      return "2nd Year";
    case "3RD":
      return "3rd Year";
    case "4TH":
      return "4th Year";
    default:
      return null;
  }
}

function parseCsvRows(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  let rowNumber = 1;

  const pushRow = () => {
    row.push(field.trim());
    rows.push(row);
    row = [];
    field = "";
    closedQuote = false;
    rowNumber++;
  };

  for (let index = 0; index < source.length; index++) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (closedQuote) {
      if (character === ",") {
        row.push(field.trim());
        field = "";
        closedQuote = false;
        continue;
      }
      if (character === "\r" || character === "\n") {
        pushRow();
        if (character === "\r" && source[index + 1] === "\n") index++;
        continue;
      }
      throw new Error(`CSV row ${rowNumber}: characters after a closing quote are not allowed.`);
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error(`CSV row ${rowNumber}: quoted cells must start with a quote.`);
      }
      inQuotes = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\r" || character === "\n") {
      pushRow();
      if (character === "\r" && source[index + 1] === "\n") index++;
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error(`CSV row ${rowNumber}: unterminated quoted cell.`);
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

export function parseStudentCsv(text: string): ParsedStudentCsvRow[] {
  const rows = parseCsvRows(text);
  const header = rows[0];
  if (!header || header.length !== CSV_COLUMN_COUNT || header.some((cell) => cell !== "")) {
    throw new Error("CSV must start with a blank ten-cell row.");
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    throw new Error("CSV contains no student records.");
  }

  return dataRows.map((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== CSV_COLUMN_COUNT) {
      return {
        rowNumber,
        studentId: row[1] ?? "",
        lastName: row[3] ?? "",
        firstName: row[4] ?? "",
        course: "",
        yearLevel: row[7] ?? "",
        errorMessage: `CSV row ${rowNumber}: expected ${CSV_COLUMN_COUNT} columns, found ${row.length}.`,
        isStructuralError: true,
      };
    }

    const studentId = row[1];
    const lastName = row[3];
    const firstName = row[4];
    const rawCourse = row[6].toUpperCase();
    const rawLevel = row[7];
    const parsedYearLevel = toYearLevel(rawLevel);
    const course = isSupportedCourse(rawCourse) ? rawCourse : "";
    const errors: string[] = [];

    if (!isStudentId(studentId)) errors.push("invalid student ID");
    if (!lastName) errors.push("last name is required");
    if (!firstName) errors.push("first name is required");
    if (!course) errors.push(`unsupported course: ${row[6]}`);
    if (!parsedYearLevel) errors.push(`unknown year level: ${row[7]}`);

    return {
      rowNumber,
      studentId,
      lastName,
      firstName,
      course,
      yearLevel: parsedYearLevel ?? rawLevel,
      errorMessage: errors.length > 0 ? `CSV row ${rowNumber}: ${errors.join("; ")}.` : undefined,
    };
  });
}
