import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { accounts, users, auditLog } from "../src/database/schema";
import type { AuditAction } from "../src/lib/constants/audit-actions";
import { hashPassword } from "../src/lib/password";
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

export function parseStudentText(text: string): StudentRecord[] {
  const lines = text.split("\n").map((l) => l.trim());
  const records: StudentRecord[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a student number, e.g. C25-01-
    if (line.match(/^C\d{2}-\d{2}-$/)) {
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
          nextLine.match(/^C\d{2}-\d{2}-$/) ||
          nextLine.includes("Showing") ||
          nextLine.includes("ACLC")
        ) {
          break;
        }

        if (nextLine.toLowerCase().includes("bscs")) {
          courseInfoLine = nextLine;
          break;
        } else {
          nameParts.push(nextLine);
        }
        j++;
      }

      // Parse the course info line
      // e.g. "KIM ROSALES \t BSCS 1ST OLD \t PAYMENT \t   "
      const bscsIndex = courseInfoLine.toLowerCase().indexOf("bscs");
      if (bscsIndex !== -1) {
        const namePartOnCourseLine = courseInfoLine.substring(0, bscsIndex).trim();
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
        const afterBscs = courseInfoLine.substring(bscsIndex).replace(/\s+/g, " ").trim();
        const partsAfterBscs = afterBscs.split(" ");
        const course = partsAfterBscs[0] || "BSCS";
        const rawLevel = partsAfterBscs[1] || "1ST";

        // Map rawLevel to friendly year_level
        let yearLevel = "1st Year";
        if (rawLevel.toUpperCase() === "1ST") yearLevel = "1st Year";
        else if (rawLevel.toUpperCase() === "2ND") yearLevel = "2nd Year";
        else if (rawLevel.toUpperCase() === "3RD") yearLevel = "3rd Year";
        else if (rawLevel.toUpperCase() === "4TH") yearLevel = "4th Year";

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

async function main() {
  const args = process.argv.slice(2);
  const pdfPathArg = args.find((arg) => !arg.startsWith("-"));

  if (!pdfPathArg) {
    console.error("Error: Please provide a path to the PDF file.");
    console.error("Usage: pnpm db:import-students <path-to-pdf> [--dry-run]");
    process.exit(1);
  }

  const absolutePath = path.resolve(pdfPathArg);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at path: ${absolutePath}`);
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run") || args.includes("-d");

  console.log(`Loading PDF from: ${absolutePath}`);
  if (dryRun) {
    console.log("Running in DRY-RUN mode (no database writes will be made).\n");
  }

  const dataBuffer = fs.readFileSync(absolutePath);

  try {
    const parser = new pdf.PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();

    const students = parseStudentText(textResult.text);
    console.log(`Parsed ${students.length} student records from PDF.`);

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
    const db = drizzle(client);

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

    // Fetch an admin user to act as actor for the audit log
    const adminUser = await db
      .select({ id: accounts.id, username: accounts.username })
      .from(accounts)
      .where(eq(accounts.role, "admin"))
      .get();

    const actorId = adminUser?.id || "00000000-0000-0000-0000-000000000000";
    const actorUsername = adminUser?.username || "system";

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
        `"${student.studentId}","${username}","${plainPassword}","${student.firstName}","${student.lastName}","${student.course}","${student.yearLevel}"`,
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
