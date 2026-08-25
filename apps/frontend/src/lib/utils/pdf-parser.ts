import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface ParsedStudentRecord {
  studentId: string;
  lastName: string;
  firstName: string;
  course: string;
  yearLevel: string;
  hasParseError?: boolean;
  parseErrorMessage?: string;
  error?: string;
}

interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
}

interface SplitEnrollmentRow {
  course: string;
  yearLevel: string;
  isUnsupportedCourse: boolean;
  error?: string;
}

interface SplitIdentityRow {
  studentId: string;
  lastName: string;
  firstName: string;
  error?: string;
}

const SPLIT_ROSTER_ID = /C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}/;
const STUDENT_ID = /^C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}$/;
const SUPPORTED_COURSES = new Set(["BSCS", "BSIT", "WADT"]);
const CSV_COLUMN_COUNT = 10;

function toYearLevel(rawLevel: string): string | null {
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

export function parseStudentCsv(text: string): ParsedStudentRecord[] {
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
      throw new Error(
        `CSV row ${rowNumber}: expected ${CSV_COLUMN_COUNT} columns, found ${row.length}.`,
      );
    }

    const studentId = row[1];
    const lastName = row[3];
    const firstName = row[4];
    const rawCourse = row[6].toUpperCase();
    const rawLevel = row[7];
    const parsedYearLevel = toYearLevel(rawLevel);
    const course = SUPPORTED_COURSES.has(rawCourse) ? rawCourse : "";
    const errors: string[] = [];

    if (!STUDENT_ID.test(studentId)) errors.push("invalid student ID");
    if (!lastName) errors.push("last name is required");
    if (!firstName) errors.push("first name is required");
    if (!course) errors.push(`unsupported course: ${row[6]}`);
    if (!parsedYearLevel) errors.push(`unknown year level: ${row[7]}`);

    return {
      studentId,
      lastName,
      firstName,
      course,
      yearLevel: parsedYearLevel ?? rawLevel,
      hasParseError: errors.length > 0,
      parseErrorMessage:
        errors.length > 0 ? `CSV row ${rowNumber}: ${errors.join("; ")}.` : undefined,
    };
  });
}

function toPageRows(items: PdfTextItem[]): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];

  for (const item of items) {
    const value = item.str.trim();
    if (value) row.push(value);
    if (item.hasEOL) {
      if (row.length > 0) rows.push(row);
      row = [];
    }
  }

  if (row.length > 0) rows.push(row);
  return rows;
}

function isIdentityPage(rows: string[][]): boolean {
  return rows.some(
    (row) => row.includes("Student No.") && row.includes("Last Name") && row.includes("First Name"),
  );
}

function isEnrollmentPage(rows: string[][]): boolean {
  return rows.some(
    (row) =>
      row.includes("M.i.") &&
      row.includes("Course") &&
      row.includes("Level") &&
      row.includes("Type"),
  );
}

function isIdentityRowStart(row: string[]): boolean {
  const firstCell = row[0] ?? "";
  return (
    (/^\d+$/.test(firstCell) || /^\d+\s+C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}\b/.test(firstCell)) &&
    row.some((cell) => SPLIT_ROSTER_ID.test(cell))
  );
}

function collectIdentityRows(pages: string[][][]): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] | null = null;

  for (const page of pages) {
    for (const row of page) {
      if (row.length === 0 || row.includes("Student No.")) continue;

      if (isIdentityRowStart(row)) {
        if (currentRow) rows.push(currentRow);
        currentRow = row;
      } else if (currentRow) {
        currentRow.push(...row);
      }
    }
  }

  if (currentRow) rows.push(currentRow);
  return rows;
}

function collectEnrollmentRows(pages: string[][][]): SplitEnrollmentRow[] {
  const rows: SplitEnrollmentRow[] = [];

  for (const page of pages) {
    for (const row of page) {
      if (row.length === 0 || row.includes("Course")) continue;

      const [, rawCourse, rawLevel] = row;
      const detectedCourse = rawCourse?.toUpperCase() ?? "";
      const isReadableCourse = /^[A-Z]+$/i.test(rawCourse ?? "");
      const course = SUPPORTED_COURSES.has(detectedCourse) ? detectedCourse : "";
      const yearLevel = toYearLevel(rawLevel ?? "") ?? rawLevel ?? "";
      if (!isReadableCourse || !toYearLevel(rawLevel ?? "")) {
        rows.push({
          course,
          yearLevel,
          isUnsupportedCourse: isReadableCourse && !SUPPORTED_COURSES.has(detectedCourse),
          error: "Split roster enrollment row is malformed.",
        });
        continue;
      }

      rows.push({
        course,
        yearLevel,
        isUnsupportedCourse: !SUPPORTED_COURSES.has(detectedCourse),
      });
    }
  }

  return rows;
}

function parseSplitIdentityRow(cells: string[]): SplitIdentityRow {
  const idIndex = cells.findIndex((cell) => SPLIT_ROSTER_ID.test(cell));
  const idMatch = idIndex >= 0 ? SPLIT_ROSTER_ID.exec(cells[idIndex]) : null;
  const studentId = idMatch?.[0];
  if (!studentId || !STUDENT_ID.test(studentId)) {
    return {
      studentId: studentId ?? "",
      lastName: "",
      firstName: "",
      error: "Split roster has an invalid student ID for a supported-course row.",
    };
  }

  const nameCells = [
    cells[idIndex].slice((idMatch.index ?? 0) + studentId.length).trim(),
    ...cells.slice(idIndex + 1),
  ].filter(Boolean);

  while (nameCells.length > 0) {
    const numericPrefix = /^(\d+)(?:\s+|$)/.exec(nameCells[0]);
    if (!numericPrefix) break;

    const remaining = nameCells[0].slice(numericPrefix[0].length).trim();
    if (remaining) {
      nameCells[0] = remaining;
      break;
    }
    nameCells.shift();
  }

  const [lastName, ...firstNameParts] = nameCells;
  const firstName = firstNameParts.join(" ");
  if (!lastName || !firstName) {
    return {
      studentId,
      lastName: lastName ?? "",
      firstName,
      error: "Split roster identity row is malformed.",
    };
  }

  return { studentId, lastName, firstName };
}

export function parseSplitRosterPages(pages: string[][][]): ParsedStudentRecord[] | null {
  const firstEnrollmentPage = pages.findIndex(isEnrollmentPage);
  const hasIdentityPages = pages.some(isIdentityPage);

  if (firstEnrollmentPage === -1 && !hasIdentityPages) return null;
  if (firstEnrollmentPage <= 0 || !hasIdentityPages) {
    throw new Error("Split roster columns cannot be aligned.");
  }

  const identityPages = pages.slice(0, firstEnrollmentPage);
  const enrollmentPages = pages.slice(firstEnrollmentPage);
  if (!identityPages.every(isIdentityPage) || !enrollmentPages.every(isEnrollmentPage)) {
    throw new Error("Split roster columns cannot be aligned.");
  }

  const identityRows = collectIdentityRows(identityPages);
  const enrollmentRows = collectEnrollmentRows(enrollmentPages);
  if (
    identityRows.length === 0 ||
    identityRows.length !== enrollmentRows.length ||
    identityRows.some((row, index) => Number.parseInt(row[0] ?? "", 10) !== index + 1)
  ) {
    throw new Error("Split roster columns cannot be aligned.");
  }

  const records: ParsedStudentRecord[] = [];
  for (const [index, enrollment] of enrollmentRows.entries()) {
    // ponytail: no row key survives this PDF layout; require equal streams, use CSV/XLSX if its order changes.
    if (enrollment.isUnsupportedCourse) continue;

    const identity = parseSplitIdentityRow(identityRows[index]);
    const parseErrorMessage = identity.error ?? enrollment.error;

    records.push({
      ...identity,
      course: enrollment.course,
      yearLevel: enrollment.yearLevel,
      hasParseError: Boolean(parseErrorMessage),
      parseErrorMessage,
    });
  }

  return records;
}

export function parseLegacyRosterPages(pages: string[][][]): ParsedStudentRecord[] | null {
  const rows = pages.flat();
  if (!rows.some((row) => row.some((cell) => SPLIT_ROSTER_ID.test(cell)))) return null;

  const records: ParsedStudentRecord[] = [];
  for (const row of rows) {
    const idCell = row.find((cell) => SPLIT_ROSTER_ID.test(cell));
    const studentId = idCell ? SPLIT_ROSTER_ID.exec(idCell)?.[0] : undefined;
    if (!studentId) continue;

    let courseIndex = -1;
    let courseMatch: RegExpExecArray | null = null;
    for (let index = 1; index < row.length; index++) {
      const match = /(?:BSCS|BSIT|WADT)$/i.exec(row[index]);
      if (match) {
        courseIndex = index;
        courseMatch = match;
        break;
      }
    }
    if (courseIndex === -1 || !courseMatch) continue;

    const [lastName = "", ...firstNameParts] = row
      .slice(1, courseIndex)
      .concat(row[courseIndex].slice(0, courseMatch.index).trim())
      .filter(Boolean)
      .filter((cell) => cell !== "-");
    const rawLevel = row[courseIndex + 1] ?? "";
    const parsedYearLevel = toYearLevel(rawLevel);
    const parseErrorMessage =
      !lastName || firstNameParts.length === 0
        ? "Legacy roster name fields are malformed."
        : !parsedYearLevel
          ? `Unparseable year level: "${rawLevel}".`
          : undefined;

    records.push({
      studentId,
      lastName,
      firstName: firstNameParts.join(" "),
      course: courseMatch[0].toUpperCase(),
      yearLevel: parsedYearLevel ?? rawLevel,
      hasParseError: Boolean(parseErrorMessage),
      parseErrorMessage,
    });
  }

  return records;
}

export async function parseRosterPdf(file: File): Promise<ParsedStudentRecord[]> {
  // 1. Dynamic import of pdfjs; worker is served from local origin via Vite ?url import
  const pdfjs = (await import("pdfjs-dist")) as any;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = "";
  const pages: string[][][] = [];

  // 2. Iterate pages and join text content
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as PdfTextItem[];
    const pageText = items.map((item) => item.str).join("\n");
    fullText += pageText + "\n";
    pages.push(toPageRows(items));
  }

  const splitRecords = parseSplitRosterPages(pages);
  if (splitRecords) return splitRecords;

  const legacyRecords = parseLegacyRosterPages(pages);
  if (legacyRecords) return legacyRecords;

  const lines = fullText.split("\n").map((l) => l.trim());
  return parseLines(lines);
}

export function parseLines(lines: string[]): ParsedStudentRecord[] {
  const records: ParsedStudentRecord[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Match starting with CXX-XX-
    if (line.match(/^C\d{2}-\d{2}-/)) {
      let studentId = "";
      let j = i;
      if (line.match(/^C\d{2}-\d{2}-$/)) {
        const part1 = line;
        const part2 = lines[i + 1] || "";
        // A 3-part split has a trailing dash on part2 (e.g. "10306-");
        // a 2-part split has the full remainder in part2 (e.g. "10306-MAN121").
        if (part2.endsWith("-")) {
          const part3 = lines[i + 2] || "";
          studentId = (part1 + part2 + part3).trim();
          j = i + 3;
        } else {
          studentId = (part1 + part2).trim();
          j = i + 2;
        }
      } else {
        studentId = line.trim();
        j = i + 1;
      }

      let nameParts: string[] = [];
      let courseInfoLine = "";

      while (j < lines.length) {
        const nextLine = lines[j];
        if (
          nextLine.match(/^C\d{2}-\d{2}-/) ||
          nextLine.includes("Showing") ||
          nextLine.includes("ACLC")
        ) {
          break;
        }

        if (/\b(bscs|bsit|wadt)\b/i.test(nextLine)) {
          courseInfoLine = nextLine;
          break;
        } else {
          nameParts.push(nextLine);
        }
        j++;
      }

      // Extract course details
      let courseIndex = -1;
      let detectedCourse = "BSCS";

      const match = /\b(bscs|bsit|wadt)\b/i.exec(courseInfoLine);
      if (match) {
        courseIndex = match.index;
        detectedCourse = match[1].toUpperCase();
      }

      if (courseIndex !== -1) {
        const namePartOnCourseLine = courseInfoLine.substring(0, courseIndex).trim();
        nameParts.push(namePartOnCourseLine);

        let fullName = nameParts.join(" ").replace(/\s+/g, " ").trim();

        let lastName = "";
        let firstName = "";

        if (fullName.includes(",")) {
          const commaIndex = fullName.indexOf(",");
          lastName = fullName.substring(0, commaIndex).trim();
          firstName = fullName.substring(commaIndex + 1).trim();
          if (!lastName) lastName = "Unknown";
          if (!firstName) firstName = "Unknown";
        } else {
          const nameWords = fullName.split(" ");
          if (nameWords.length >= 2) {
            lastName = nameWords[0];
            firstName = nameWords.slice(1).join(" ");
          } else {
            lastName = nameWords[0] || "Unknown";
            firstName = "Unknown";
          }
        }

        const afterCourse = courseInfoLine.substring(courseIndex).replace(/\s+/g, " ").trim();
        const partsAfterCourse = afterCourse.split(" ");
        const rawLevel = partsAfterCourse[1];

        let yearLevel = rawLevel ?? "";
        let hasParseError = false;
        let parseErrorMessage: string | undefined = undefined;

        if (!rawLevel) {
          hasParseError = true;
          parseErrorMessage = "Missing year level.";
        } else if (rawLevel.toUpperCase() === "1ST") {
          yearLevel = "1st Year";
        } else if (rawLevel.toUpperCase() === "2ND") {
          yearLevel = "2nd Year";
        } else if (rawLevel.toUpperCase() === "3RD") {
          yearLevel = "3rd Year";
        } else if (rawLevel.toUpperCase() === "4TH") {
          yearLevel = "4th Year";
        } else {
          hasParseError = true;
          parseErrorMessage = `Unparseable year level: "${rawLevel}".`;
        }

        records.push({
          studentId,
          lastName,
          firstName,
          course: detectedCourse,
          yearLevel,
          hasParseError,
          parseErrorMessage,
        });
      } else {
        const fullName = nameParts.join(" ").replace(/\s+/g, " ").trim() || "Unknown";
        let lastName = "";
        let firstName = "";

        if (fullName.includes(",")) {
          const commaIndex = fullName.indexOf(",");
          lastName = fullName.substring(0, commaIndex).trim();
          firstName = fullName.substring(commaIndex + 1).trim();
          if (!lastName) lastName = "Unknown";
          if (!firstName) firstName = "Unknown";
        } else {
          const nameWords = fullName.split(" ");
          if (nameWords.length >= 2) {
            lastName = nameWords[0];
            firstName = nameWords.slice(1).join(" ");
          } else {
            lastName = nameWords[0] || "Unknown";
            firstName = "Unknown";
          }
        }

        records.push({
          studentId,
          lastName,
          firstName,
          course: "BSCS", // Fallback default
          yearLevel: "1st Year", // Fallback default
          hasParseError: true,
          parseErrorMessage: "Could not detect student course information.",
        });
      }
      i = j;
      continue; // bypass outer i++; j already points to the next line to examine
    }
    i++;
  }

  return records;
}
