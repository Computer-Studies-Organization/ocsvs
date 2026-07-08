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

export async function parseRosterPdf(file: File): Promise<ParsedStudentRecord[]> {
  // 1. Dynamic import of pdfjs; worker is served from local origin via Vite ?url import
  const pdfjs = (await import("pdfjs-dist")) as any;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = "";

  // 2. Iterate pages and join text content
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join("\n");
    fullText += pageText + "\n";
  }

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

        if (/\b(bscs|bsit|act)\b/i.test(nextLine)) {
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

      const match = /\b(bscs|bsit|act)\b/i.exec(courseInfoLine);
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

        let yearLevel = "1st Year";
        let hasParseError = false;
        let parseErrorMessage: string | undefined = undefined;

        if (!rawLevel) {
          hasParseError = true;
          parseErrorMessage = "Missing year level. Defaulted to 1st Year.";
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
          parseErrorMessage = `Unparseable year level: "${rawLevel}". Defaulted to 1st Year.`;
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
    }
    i++;
  }

  return records;
}
