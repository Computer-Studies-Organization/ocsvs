import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Writable } from "node:stream";
import readline from "node:readline";
import {
  isStudentId,
  isSupportedCourse,
  parseStudentCsv as parseCsv,
  toYearLevel,
} from "@cso-voting/student-csv-parser";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { accounts, users, auditLog } from "../src/database/schema";
import * as schema from "../src/database/schema";
import type { AuditAction } from "../src/lib/constants/audit-actions";
import { isAdminRole } from "../src/lib/election-visibility";
import { assertElectorateMutable } from "../src/lib/user-lifecycle-coordinator";
import { hashPassword, verifyPassword } from "../src/lib/password";
import "dotenv/config";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const USER_CREATE_AUDIT_ACTION = "user.create" satisfies AuditAction;

export interface StudentRecord {
  studentId: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  course: string;
  yearLevel: string;
}

interface PlannedStudentImport {
  student: StudentRecord;
  username: string;
}

interface PdfTextPage {
  text: string;
}

interface SplitEnrollmentRow {
  middleName: string | null;
  course: string;
  yearLevel: string;
}

const SPLIT_ROSTER_ID = /[AC]\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}/;
export function parseStudentCsv(text: string): StudentRecord[] {
  return parseCsv(text).map((row) => {
    if (row.errorMessage) throw new Error(row.errorMessage);

    return {
      studentId: row.studentId,
      lastName: row.lastName,
      firstName: row.firstName,
      middleName: null,
      course: row.course,
      yearLevel: row.yearLevel,
    };
  });
}

function tableCells(line: string): string[] {
  return line
    .split("\t")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function isIdentityPage(text: string): boolean {
  return text.includes("Student No.") && text.includes("Last Name") && text.includes("First Name");
}

function isEnrollmentPage(text: string): boolean {
  return (
    text.includes("M.i.") &&
    text.includes("Course") &&
    text.includes("Level") &&
    text.includes("Type")
  );
}

function isIdentityRowStart(cells: string[]): boolean {
  const firstCell = cells[0] ?? "";
  return (
    (/^\d+$/.test(firstCell) || /^\d+\s+[AC]\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}\b/.test(firstCell)) &&
    cells.some((cell) => SPLIT_ROSTER_ID.test(cell))
  );
}

function collectIdentityRows(pages: PdfTextPage[]): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] | null = null;

  for (const page of pages) {
    for (const line of page.text.split("\n")) {
      const cells = tableCells(line);
      if (cells.length === 0 || cells.includes("Student No.")) continue;

      if (isIdentityRowStart(cells)) {
        if (currentRow) rows.push(currentRow);
        currentRow = cells;
      } else if (currentRow) {
        currentRow.push(...cells);
      }
    }
  }

  if (currentRow) rows.push(currentRow);
  return rows;
}

function collectEnrollmentRows(pages: PdfTextPage[]): SplitEnrollmentRow[] {
  const rows: SplitEnrollmentRow[] = [];

  for (const page of pages) {
    for (const line of page.text.split("\n")) {
      const cells = tableCells(line);
      if (cells.length === 0 || cells.includes("Course")) continue;

      const [rawMiddleName, rawCourse, rawLevel] = cells;
      const yearLevel = rawLevel ? toYearLevel(rawLevel) : null;
      if (!rawMiddleName || !/^[A-Z]+$/i.test(rawCourse ?? "") || !yearLevel) {
        throw new Error("Split roster enrollment row is malformed.");
      }

      rows.push({
        middleName: rawMiddleName === "-" ? null : rawMiddleName,
        course: rawCourse.toUpperCase(),
        yearLevel,
      });
    }
  }

  return rows;
}

function parseSplitIdentityRow(
  cells: string[],
): Pick<StudentRecord, "studentId" | "lastName" | "firstName"> {
  const idIndex = cells.findIndex((cell) => SPLIT_ROSTER_ID.test(cell));
  const idMatch = idIndex >= 0 ? SPLIT_ROSTER_ID.exec(cells[idIndex]) : null;
  const studentId = idMatch?.[0];
  if (!studentId || !isStudentId(studentId)) {
    throw new Error("Split roster has an invalid student ID for a supported-course row.");
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
    throw new Error("Split roster identity row is malformed.");
  }

  return { studentId, lastName, firstName };
}

export function parseSplitRosterPages(pages: PdfTextPage[]): StudentRecord[] | null {
  const firstEnrollmentPage = pages.findIndex((page) => isEnrollmentPage(page.text));
  const hasIdentityPages = pages.some((page) => isIdentityPage(page.text));

  if (firstEnrollmentPage === -1 && !hasIdentityPages) return null;
  if (firstEnrollmentPage <= 0 || !hasIdentityPages) {
    throw new Error("Split roster columns cannot be aligned.");
  }

  const identityPages = pages.slice(0, firstEnrollmentPage);
  const enrollmentPages = pages.slice(firstEnrollmentPage);
  if (
    !identityPages.every((page) => isIdentityPage(page.text)) ||
    !enrollmentPages.every((page) => isEnrollmentPage(page.text))
  ) {
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

  const records: StudentRecord[] = [];
  for (const [index, enrollment] of enrollmentRows.entries()) {
    // ponytail: no row key survives this PDF layout; require equal streams, use CSV/XLSX if its order changes.
    if (!isSupportedCourse(enrollment.course)) continue;

    records.push({
      ...parseSplitIdentityRow(identityRows[index]),
      middleName: enrollment.middleName,
      course: enrollment.course,
      yearLevel: enrollment.yearLevel,
    });
  }

  return records;
}

export function parseStudentText(text: string): StudentRecord[] {
  const lines = text.split("\n").map((l) => l.trim());
  const records: StudentRecord[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a student number, e.g. C25-01- or A25-01-
    if (line.match(/^[AC]\d{2}-\d{2}-$/)) {
      // Student number spans 3 lines:
      // i: C25-01-
      // i+1: 10306-
      // i+2: MAN121
      const part1 = line;
      const part2 = lines[i + 1] || "";
      const part3 = lines[i + 2] || "";

      const studentId = (part1 + part2 + part3).trim();

      // Collect name and details
      let nameParts: string[] = [];
      let courseInfoLine = "";

      let j = i + 3;
      while (j < lines.length) {
        const nextLine = lines[j];
        // If we hit another student number or footer, stop
        if (
          nextLine.match(/^[AC]\d{2}-\d{2}-$/) ||
          nextLine.includes("Showing") ||
          nextLine.includes("ACLC")
        ) {
          break;
        }

        if (/\b(BSCS|BSIT|WADT)\b/i.test(nextLine)) {
          courseInfoLine = nextLine;
          break;
        } else {
          nameParts.push(nextLine);
        }
        j++;
      }

      // Parse the course info line
      // e.g. "KIM ROSALES \t BSCS 1ST OLD \t PAYMENT \t   "
      const courseMatch = /\b(BSCS|BSIT|WADT)\b/i.exec(courseInfoLine);
      if (courseMatch) {
        const courseIndex = courseMatch.index;
        const namePartOnCourseLine = courseInfoLine.substring(0, courseIndex).trim();
        nameParts.push(namePartOnCourseLine);

        // Reconstruct full name
        let fullName = "";
        for (let k = 0; k < nameParts.length; k++) {
          const part = nameParts[k].trim();
          if (k > 0) {
            // If previous part ended with hyphen, join directly, otherwise join with space
            const prevPart = nameParts[k - 1].trim();
            if (prevPart.endsWith("-")) {
              fullName += part;
            } else {
              fullName += " " + part;
            }
          } else {
            fullName += part;
          }
        }

        // Normalize name: remove multiple spaces
        fullName = fullName.replace(/\s+/g, " ").trim();

        // Split name into Last Name, First Name, M.I.
        const nameWords = fullName.split(" ");
        let lastName = "";
        let firstName = "";
        let middleName: string | null = null;

        if (nameWords.length >= 3) {
          lastName = nameWords[0];
          middleName = nameWords[nameWords.length - 1];
          firstName = nameWords.slice(1, nameWords.length - 1).join(" ");
        } else if (nameWords.length === 2) {
          lastName = nameWords[0];
          firstName = nameWords[1];
        } else if (nameWords.length === 1) {
          lastName = nameWords[0];
          firstName = "Unknown";
        }

        // Extract remaining fields from courseInfoLine
        // e.g. "BSCS 1ST OLD \t PAYMENT ..."
        const afterCourse = courseInfoLine.substring(courseIndex).replace(/\s+/g, " ").trim();
        const partsAfterCourse = afterCourse.split(" ");
        const course = courseMatch[1].toUpperCase();
        const rawLevel = partsAfterCourse[1];
        const yearLevel = toYearLevel(rawLevel ?? "");
        if (!yearLevel) {
          throw new Error(
            rawLevel ? `Unparseable year level: "${rawLevel}".` : "Missing year level.",
          );
        }

        records.push({
          studentId,
          lastName,
          firstName,
          middleName,
          course,
          yearLevel,
        });
      }

      // Advance outer loop to the last parsed line
      i = j;
    }
    i++;
  }

  return records;
}

function secureRandomIndex(maxExclusive: number): number {
  const maxUnbiased = 256 - (256 % maxExclusive);
  const bytes = new Uint8Array(1);

  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= maxUnbiased);

  return bytes[0] % maxExclusive;
}

export function generatePassword(): string {
  // Use readable secure character set (exclude confusing characters like 0, O, 1, l, I)
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    const randomIndex = secureRandomIndex(chars.length);
    password += chars[randomIndex];
  }
  return password;
}

export function escapeCsvCell(value: string): string {
  return `"${value.replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
}

function generateUsername(
  firstName: string,
  lastName: string,
  studentId: string,
  existingUsernames: Set<string>,
): string {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  let baseUsername = `${cleanFirst}.${cleanLast}`;

  if (baseUsername.length < 3) {
    baseUsername = studentId.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  let username = baseUsername;
  let counter = 1;
  while (existingUsernames.has(username)) {
    username = `${baseUsername}.${counter}`;
    counter++;
  }

  existingUsernames.add(username);
  return username;
}

export function planStudentImports(
  students: StudentRecord[],
  existingStudentIds: Set<string>,
  existingUsernames: Set<string>,
): { planned: PlannedStudentImport[]; skipped: StudentRecord[] } {
  const planned: PlannedStudentImport[] = [];
  const skipped: StudentRecord[] = [];

  for (const student of students) {
    if (existingStudentIds.has(student.studentId)) {
      skipped.push(student);
      continue;
    }

    const username = generateUsername(
      student.firstName,
      student.lastName,
      student.studentId,
      existingUsernames,
    );
    existingStudentIds.add(student.studentId);
    planned.push({ student, username });
  }

  return { planned, skipped };
}

export function writeCredentialsCsv(
  csvRows: string[],
  dryRun: boolean,
  csvPath = path.resolve("credentials.csv"),
): string | null {
  if (dryRun) {
    return null;
  }

  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");
  return csvPath;
}

async function askQuestion(query: string, isPassword = false): Promise<string> {
  return new Promise((resolve) => {
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!isPassword) {
          process.stdout.write(chunk, encoding);
        } else {
          const str = chunk.toString();
          if (str === query || str === "\n" || str === "\r\n") {
            process.stdout.write(chunk, encoding);
          }
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    if (isPassword) {
      process.stdout.write(query);
    }

    rl.question(isPassword ? "" : query, (answer) => {
      rl.close();
      if (isPassword) {
        process.stdout.write("\n");
      }
      resolve(answer.trim());
    });
  });
}

export async function authenticateAdmin(db: any): Promise<{ id: string; username: string }> {
  let identifier = process.env.ADMIN_IDENTIFIER || process.env.ADMIN_USERNAME;
  let password = process.env.ADMIN_PASSWORD;

  const args = process.argv;
  const adminUserArgIndex = args.findIndex((a) => a === "--admin-user" || a === "-u");
  if (adminUserArgIndex !== -1 && args[adminUserArgIndex + 1]) {
    identifier = args[adminUserArgIndex + 1];
  }
  const adminPassArgIndex = args.findIndex((a) => a === "--admin-pass" || a === "-p");
  if (adminPassArgIndex !== -1 && args[adminPassArgIndex + 1]) {
    password = args[adminPassArgIndex + 1];
  }

  if (!identifier) {
    identifier = await askQuestion("Admin Username or Student ID: ");
  }
  if (!password) {
    password = await askQuestion("Admin Password: ", true);
  }

  if (!identifier || !password) {
    console.error("Error: Authentication credentials cannot be empty.");
    process.exit(1);
  }

  // Look up account by username
  let adminAccount = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      passwordHash: accounts.password_hash,
      role: accounts.role,
    })
    .from(accounts)
    .where(eq(accounts.username, identifier))
    .get();

  // If not found, try by studentId via user join
  if (!adminAccount) {
    const joined = await db
      .select({
        id: accounts.id,
        username: accounts.username,
        passwordHash: accounts.password_hash,
        role: accounts.role,
      })
      .from(accounts)
      .innerJoin(users, eq(accounts.id, users.accountId))
      .where(eq(users.studentId, identifier))
      .get();
    if (joined) {
      adminAccount = joined;
    }
  }

  if (!adminAccount) {
    console.error("Error: Invalid admin credentials (user not found).");
    process.exit(1);
  }

  if (!isAdminRole(adminAccount.role)) {
    console.error("Error: Access denied. The specified account is not an admin.");
    process.exit(1);
  }

  const isValid = await verifyPassword(password, adminAccount.passwordHash);
  if (!isValid) {
    console.error("Error: Invalid admin credentials (password incorrect).");
    process.exit(1);
  }

  return { id: adminAccount.id, username: adminAccount.username };
}

async function main() {
  const args = process.argv.slice(2);
  const inputPathArg = args.find((arg) => !arg.startsWith("-"));

  if (!inputPathArg) {
    console.error("Error: Please provide a path to a PDF or CSV file.");
    console.error("Usage: pnpm db:import-students <path-to-pdf-or-csv> [--dry-run]");
    process.exit(1);
  }

  const absolutePath = path.resolve(inputPathArg);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at path: ${absolutePath}`);
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run") || args.includes("-d");

  if (dryRun) {
    console.log("Running in DRY-RUN mode (no database writes will be made).\n");
  }

  try {
    let students: StudentRecord[];
    if (path.extname(absolutePath).toLowerCase() === ".csv") {
      console.log(`Loading CSV from: ${absolutePath}`);
      students = parseStudentCsv(fs.readFileSync(absolutePath, "utf8"));
    } else {
      console.log(`Loading PDF from: ${absolutePath}`);
      const parser = new pdf.PDFParse({ data: fs.readFileSync(absolutePath) });
      const textResult = await parser.getText({ cellThreshold: 2 });
      students = parseSplitRosterPages(textResult.pages) ?? parseStudentText(textResult.text);
    }

    console.log(`Parsed ${students.length} student records.`);

    if (students.length === 0) {
      console.log("No student records found in PDF. Exiting.");
      return;
    }

    // Connect to database
    const dbUrl = process.env.TURSO_DATABASE_URL;
    if (!dbUrl) {
      console.error("Error: TURSO_DATABASE_URL environment variable is not set.");
      process.exit(1);
    }

    const client = createClient({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    const db = drizzle(client, { schema });

    // Fetch existing records for duplicate check
    console.log("Fetching existing usernames and student IDs from database...");
    const existingUsernames = new Set(
      (await db.select({ username: accounts.username }).from(accounts).all()).map(
        (r) => r.username,
      ),
    );
    const existingStudentIds = new Set(
      (await db.select({ studentId: users.studentId }).from(users).all()).map((r) => r.studentId),
    );

    // Authenticate the admin performing this operation
    console.log("Authenticating admin user...");
    const adminUser = await authenticateAdmin(db);
    const actorId = adminUser.id;
    const actorUsername = adminUser.username;

    const csvRows: string[] = [
      "Student ID,Username,Password,First Name,Last Name,Course,Year Level",
    ];
    console.log("\nProcessing students...");
    const { planned, skipped } = planStudentImports(
      students,
      existingStudentIds,
      existingUsernames,
    );

    for (const student of skipped) {
      console.log(
        `⚠️  Skipping duplicate student ID: ${student.studentId} (${student.lastName}, ${student.firstName})`,
      );
    }
    const skippedCount = skipped.length;

    let createdCount = 0;
    for (const { student, username } of planned) {
      if (dryRun) {
        createdCount++;
        continue;
      }

      const plainPassword = generatePassword();
      const hashedPassword = await hashPassword(plainPassword);

      const accountId = crypto.randomUUID();
      const userId = crypto.randomUUID();

      // Direct batch-insert via transaction
      await db.transaction(async (tx) => {
        await assertElectorateMutable(tx);

        await tx.insert(accounts).values({
          id: accountId,
          username,
          email: null,
          password_hash: hashedPassword,
          role: "user",
        });

        await tx.insert(users).values({
          id: userId,
          accountId,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          course: student.course,
          yearLevel: student.yearLevel,
        });

        await tx.insert(auditLog).values({
          id: crypto.randomUUID(),
          action: USER_CREATE_AUDIT_ACTION,
          targetType: "user",
          targetId: userId,
          actorAccountIdSnapshot: actorId,
          actorUsernameSnapshot: actorUsername,
          description: `Bulk imported student account: ${student.studentId}`,
        });
      });

      csvRows.push(
        [
          student.studentId,
          username,
          plainPassword,
          student.firstName,
          student.lastName,
          student.course,
          student.yearLevel,
        ]
          .map(escapeCsvCell)
          .join(","),
      );
      createdCount++;
    }

    // Write credentials CSV only for live imports. Dry-run should not create plaintext secrets.
    const csvPath = writeCredentialsCsv(csvRows, dryRun);

    console.log(
      "\n================================================================================",
    );
    console.log(`Bulk Import Summary (${dryRun ? "DRY RUN" : "LIVE DB"}):`);
    console.log(`- ${dryRun ? "Accounts to Create" : "Created Accounts"}: ${createdCount}`);
    console.log(`- Skipped (Exists):  ${skippedCount}`);
    console.log(`- Total Processed:   ${students.length}`);
    console.log(`- Credentials written to: ${csvPath ?? "skipped (dry-run)"}`);
    console.log("================================================================================");
    if (csvPath) {
      console.log("⚠️  WARNING: Keep 'credentials.csv' secure. It contains plaintext passwords.");
      console.log(
        "================================================================================",
      );
    }

    // Close database client
    client.close();
  } catch (error) {
    console.error("Error processing import:", error);
    process.exit(1);
  }
}

// Only execute main if running directly
if (process.argv[1] && process.argv[1].endsWith("import-students.ts")) {
  main().catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  });
}
