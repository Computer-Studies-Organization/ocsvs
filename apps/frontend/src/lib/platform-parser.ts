export interface PlatformPillar {
  id: string;
  letter?: string;
  title: string;
  body?: string;
  bullets: string[];
}

export interface ParsedPlatform {
  tagline?: string;
  acronymMeaning?: string;
  intro?: string;
  isStructured: boolean;
  pillars: PlatformPillar[];
  rawParagraphs: string[];
}

const BULLET_REGEX = /^\s*(?:[•\-*+✓→]|\d+[.)])\s+(.+)$/;
const EXPLICIT_LETTER_PILLAR_REGEX = /^(?:#{1,4}\s+)?([A-Za-z])\s*(?:[—–\-:.]|\s-\s)\s+(.+)$/;
const NUMBERED_PILLAR_REGEX = /^#{1,4}\s+(\d+)[.)]\s+(.+)$/;
const UNPREFIXED_NUMBERED_PILLAR_REGEX = /^(\d+)[.)]\s+(.+)$/;
const BRACKETED_LETTER_PILLAR_REGEX = /^(?:#{1,4}\s+)?\[([A-Za-z])\]\s*(?:[—–\-:.]|\s-\s)\s+(.+)$/;
const MARKDOWN_HEADER_REGEX = /^#{2,4}\s+(.+)$/;
const GENERIC_HEADING_REGEX =
  /^(?:OUR\s+PLATFORM|PLATFORM|PILLARS|KEY\s+PRIORITIES|AGENDA)[\s:]*$/i;
const ACRONYM_LABEL_REGEX = /^[A-Z0-9]{2,}:?$/;
const UPPERCASE_LABEL_REGEX = /^[A-Z0-9][A-Z0-9\s&-]{1,39}$/;
const TAGLINE_LABEL_REGEX = /^(?:#{1,4}\s+)?Tagline\s*:?\s*$/i;
const QUOTED_TAGLINE_REGEX = /^(?:[“"]([^”"\n]{10,})[”"]|['‘]([^'’\n]{10,})['’])$/;
const UNQUOTED_INLINE_TAGLINE_REGEX = /^(?:#{1,4}\s+)?Tagline\s*:?\s*(.+)$/i;

function stripMarkdownPrefix(line: string): string {
  return line.replace(/^#{1,4}\s+/, "").trim();
}

function isGenericHeading(line: string): boolean {
  return GENERIC_HEADING_REGEX.test(stripMarkdownPrefix(line));
}

function stripTaglineDecorators(value: string): string {
  return value
    .trim()
    .replace(/^[“"'‘]/, "")
    .replace(/[”"'’]$/, "")
    .trim();
}

function matchNumberedPillar(lines: string[], index: number): RegExpMatchArray | undefined {
  const line = lines[index].trim();
  const markdownMatch = line.match(NUMBERED_PILLAR_REGEX);
  if (markdownMatch) return markdownMatch;

  const unprefixedMatch = line.match(UNPREFIXED_NUMBERED_PILLAR_REGEX);
  if (!unprefixedMatch || lines[index] !== lines[index].trimStart()) return undefined;

  const previousLine = lines[index - 1]?.trim();
  const nextLine = lines[index + 1]?.trim();

  // ponytail: adjacent numeric lines are body lists; one-item lists remain ambiguous without a Markdown AST.
  if (previousLine && UNPREFIXED_NUMBERED_PILLAR_REGEX.test(previousLine)) return undefined;
  if (nextLine && UNPREFIXED_NUMBERED_PILLAR_REGEX.test(nextLine)) return undefined;
  if (previousLine?.endsWith(":")) return undefined;
  return unprefixedMatch;
}

function extractTagline(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const inlineMatch = line.match(
      /^(?:#{1,4}\s+)?Tagline\s*:?\s*(?:[“"]([^”"\n]{10,})[”"]|['‘]([^'’\n]{10,})['’])$/i,
    );
    if (inlineMatch) return (inlineMatch[1] || inlineMatch[2]).trim();

    const unquotedInlineMatch = line.match(UNQUOTED_INLINE_TAGLINE_REGEX);
    if (unquotedInlineMatch) return stripTaglineDecorators(unquotedInlineMatch[1]);

    const quoteMatch = line.match(QUOTED_TAGLINE_REGEX);
    if (quoteMatch) return (quoteMatch[1] || quoteMatch[2]).trim();

    const blockquoteMatch = line.match(/^>\s*(.+)$/);
    if (blockquoteMatch) return stripTaglineDecorators(blockquoteMatch[1]);

    if (TAGLINE_LABEL_REGEX.test(line)) {
      const nextLineIndex = lines.findIndex(
        (candidate, index) => index > i && candidate.trim().length > 0,
      );
      if (nextLineIndex === -1) continue;
      const nextLine = lines[nextLineIndex].trim();

      const nextQuoteMatch = nextLine.match(QUOTED_TAGLINE_REGEX);
      if (nextQuoteMatch) return (nextQuoteMatch[1] || nextQuoteMatch[2]).trim();

      const nextBlockquoteMatch = nextLine.match(/^>\s*(.+)$/);
      if (nextBlockquoteMatch) return stripTaglineDecorators(nextBlockquoteMatch[1]);

      if (
        nextLine.length >= 10 &&
        !isGenericHeading(nextLine) &&
        !EXPLICIT_LETTER_PILLAR_REGEX.test(nextLine) &&
        !BRACKETED_LETTER_PILLAR_REGEX.test(nextLine) &&
        !NUMBERED_PILLAR_REGEX.test(nextLine) &&
        !UNPREFIXED_NUMBERED_PILLAR_REGEX.test(nextLine) &&
        !MARKDOWN_HEADER_REGEX.test(nextLine)
      ) {
        return stripTaglineDecorators(nextLine);
      }
    }
  }

  return undefined;
}

function isTaglineLine(line: string, tagline: string | undefined): boolean {
  if (!tagline) return false;
  return (
    stripTaglineDecorators(
      stripMarkdownPrefix(line)
        .replace(/^Tagline\s*:?\s*/i, "")
        .replace(/^>\s*/, ""),
    ) === tagline
  );
}

export function parsePlatformText(raw: string | null | undefined): ParsedPlatform {
  if (!raw || !raw.trim()) {
    return {
      isStructured: false,
      pillars: [],
      rawParagraphs: [],
    };
  }

  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");

  const tagline = extractTagline(lines);
  let acronymMeaning: string | undefined;
  let intro: string | undefined;

  // Scan lines to find structured pillar headers
  interface HeaderLine {
    lineIndex: number;
    letter?: string;
    title: string;
  }

  const headers: HeaderLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip generic section headings like "OUR PLATFORM" or "PLATFORM"
    if (isGenericHeading(line)) continue;

    // Skip standalone Tagline label
    if (TAGLINE_LABEL_REGEX.test(line)) {
      continue;
    }

    // Skip quote line if already identified as tagline
    if (isTaglineLine(line, tagline)) {
      continue;
    }

    // 1. Explicit letter pillar: "S — Strengthen CSO" or "S - Strengthen CSO"
    const letterMatch = line.match(EXPLICIT_LETTER_PILLAR_REGEX);
    if (letterMatch) {
      headers.push({
        lineIndex: i,
        letter: letterMatch[1].toUpperCase(),
        title: letterMatch[2].trim(),
      });
      continue;
    }

    // 2. Bracketed letter pillar: "[S] - Strengthen CSO"
    const bracketedLetterMatch = line.match(BRACKETED_LETTER_PILLAR_REGEX);
    if (bracketedLetterMatch) {
      headers.push({
        lineIndex: i,
        letter: bracketedLetterMatch[1].toUpperCase(),
        title: bracketedLetterMatch[2].trim(),
      });
      continue;
    }

    // 3. Numbered pillar: "1. Strengthen CSO"
    const numMatch = matchNumberedPillar(lines, i);
    if (numMatch) {
      headers.push({
        lineIndex: i,
        letter: numMatch[1],
        title: numMatch[2].trim(),
      });
      continue;
    }

    // 4. Markdown header: "### Strengthen CSO"
    const mdMatch = line.match(MARKDOWN_HEADER_REGEX);
    if (mdMatch) {
      headers.push({
        lineIndex: i,
        letter: undefined,
        title: mdMatch[1].trim(),
      });
      continue;
    }
  }

  // If we found at least one structured header, build structured pillars
  if (headers.length > 0) {
    const pillars: PlatformPillar[] = [];

    // Check pre-header lines for intro / acronym expansion
    const firstHeaderLine = headers[0].lineIndex;
    const preHeaderLines = lines
      .slice(0, firstHeaderLine)
      .map((l) => l.trim())
      .filter(Boolean);

    // ponytail: infer acronym expansions from a standalone uppercase label; use explicit platform metadata if formats outgrow this.
    const acronymMeaningIndex = preHeaderLines.findIndex((line, index) => {
      const previousLine = preHeaderLines[index - 1];
      return (
        previousLine !== undefined &&
        ACRONYM_LABEL_REGEX.test(previousLine) &&
        (line.includes(",") || line.length > 20)
      );
    });
    const introLines: string[] = [];

    for (const [index, line] of preHeaderLines.entries()) {
      if (isTaglineLine(line, tagline)) continue;
      if (TAGLINE_LABEL_REGEX.test(line) || isGenericHeading(line)) continue;
      if (index === acronymMeaningIndex) {
        acronymMeaning = line;
        continue;
      }
      if (UPPERCASE_LABEL_REGEX.test(line)) continue;
      introLines.push(line);
    }

    intro = introLines.length > 0 ? introLines.join("\n\n") : undefined;

    for (let h = 0; h < headers.length; h++) {
      const current = headers[h];
      const nextIndex = h + 1 < headers.length ? headers[h + 1].lineIndex : lines.length;
      const sectionLines = lines.slice(current.lineIndex + 1, nextIndex);

      const bodyParts: string[] = [];
      const bullets: string[] = [];

      for (const rawLine of sectionLines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (TAGLINE_LABEL_REGEX.test(line) || isTaglineLine(line, tagline)) continue;

        const bulletMatch = line.match(BULLET_REGEX);
        if (bulletMatch) {
          bullets.push(bulletMatch[1].trim());
        } else {
          bodyParts.push(line);
        }
      }

      pillars.push({
        id: `pillar-${h}`,
        letter: current.letter,
        title: current.title,
        body: bodyParts.length > 0 ? bodyParts.join("\n\n") : undefined,
        bullets,
      });
    }

    return {
      tagline,
      acronymMeaning,
      intro,
      isStructured: true,
      pillars,
      rawParagraphs: [],
    };
  }

  // Unstructured fallback: split by double newlines into clean paragraphs
  const rawParagraphs = normalized
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .filter((line) => !TAGLINE_LABEL_REGEX.test(line.trim()) && !isTaglineLine(line, tagline))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);

  return {
    tagline,
    acronymMeaning,
    isStructured: false,
    pillars: [],
    rawParagraphs,
  };
}
