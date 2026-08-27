import {
  isStudentId,
  isSupportedCourse,
  parseStudentCsv as parseCsv,
  toYearLevel,
} from "@cso-voting/student-csv-parser";
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

const SPLIT_ROSTER_ID = /[AC]\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}/;
export function parseStudentCsv(text: string): ParsedStudentRecord[] {
  const rows = parseCsv(text);
  for (const row of rows) {
    if (row.isStructuralError) throw new Error(row.errorMessage);
  }

  return rows.map((row) => {
    return {
      studentId: row.studentId,
      lastName: row.lastName,
      firstName: row.firstName,
      course: row.course,
      yearLevel: row.yearLevel,
      hasParseError: Boolean(row.errorMessage),
      parseErrorMessage: row.errorMessage,
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
    (/^\d+$/.test(firstCell) || /^\d+\s+[AC]\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}\b/.test(firstCell)) &&
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
      const course = isSupportedCourse(detectedCourse) ? detectedCourse : "";
      const yearLevel = toYearLevel(rawLevel ?? "") ?? rawLevel ?? "";
      if (!isReadableCourse || !toYearLevel(rawLevel ?? "")) {
        rows.push({
          course,
          yearLevel,
          isUnsupportedCourse: isReadableCourse && !isSupportedCourse(detectedCourse),
          error: "Split roster enrollment row is malformed.",
        });
        continue;
      }

      rows.push({
        course,
        yearLevel,
        isUnsupportedCourse: !isSupportedCourse(detectedCourse),
      });
    }
  }

  return rows;
}

function parseSplitIdentityRow(cells: string[]): SplitIdentityRow {
  const idIndex = cells.findIndex((cell) => SPLIT_ROSTER_ID.test(cell));
  const idMatch = idIndex >= 0 ? SPLIT_ROSTER_ID.exec(cells[idIndex]) : null;
  const studentId = idMatch?.[0];
  if (!studentId || !isStudentId(studentId)) {
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

    // Match starting with [AC]XX-XX-
    if (line.match(/^[AC]\d{2}-\d{2}-/)) {
      let studentId = "";
      let j = i;
      if (line.match(/^[AC]\d{2}-\d{2}-$/)) {
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
          nextLine.match(/^[AC]\d{2}-\d{2}-/) ||
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
