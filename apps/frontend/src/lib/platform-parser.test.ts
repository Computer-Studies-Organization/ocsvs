import { describe, expect, it } from "vitest";
import { parsePlatformText } from "./platform-parser";

describe("platform-parser", () => {
  it("returns empty result for null or empty input", () => {
    expect(parsePlatformText(null)).toEqual({
      isStructured: false,
      pillars: [],
      rawParagraphs: [],
    });
    expect(parsePlatformText("")).toEqual({
      isStructured: false,
      pillars: [],
      rawParagraphs: [],
    });
    expect(parsePlatformText("   ")).toEqual({
      isStructured: false,
      pillars: [],
      rawParagraphs: [],
    });
  });

  it("parses an acronym-based platform like SULONG with tagline and bullets", () => {
    const raw = `
SULONG PARTYLIST

SULONG

Student Unity, Leadership, Opportunities, and New Growth

Tagline
“Moving Forward. Growing Together. Leading the Future.”

OUR PLATFORM

S — Strengthen CSO

We will continue the growth and progress started by the previous administration.

• Maintain and improve programs that are already working.
• Build on existing achievements instead of starting from zero.
• Make CSO more active, united, and visible.

U — Unlock Student Skills

We will create opportunities for students to discover, develop, and showcase their skills.

• Technical workshops and certifications.
• Leadership training camps.
`;

    const parsed = parsePlatformText(raw);
    expect(parsed.isStructured).toBe(true);
    expect(parsed.tagline).toBe("Moving Forward. Growing Together. Leading the Future.");
    expect(parsed.acronymMeaning).toBe("Student Unity, Leadership, Opportunities, and New Growth");
    expect(parsed.pillars).toHaveLength(2);

    expect(parsed.pillars[0].letter).toBe("S");
    expect(parsed.pillars[0].title).toBe("Strengthen CSO");
    expect(parsed.pillars[0].body).toContain("We will continue the growth");
    expect(parsed.pillars[0].bullets).toEqual([
      "Maintain and improve programs that are already working.",
      "Build on existing achievements instead of starting from zero.",
      "Make CSO more active, united, and visible.",
    ]);

    expect(parsed.pillars[1].letter).toBe("U");
    expect(parsed.pillars[1].title).toBe("Unlock Student Skills");
    expect(parsed.pillars[1].bullets).toHaveLength(2);
  });

  it("parses numbered and markdown headings", () => {
    const raw = `
### 1. Transparent Leadership
Ensuring open communication.
- Regular financial reports
- Open town hall meetings

### 2. Student Welfare
Supporting every student.
* Mental health initiatives
* Affordable supplies
`;

    const parsed = parsePlatformText(raw);
    expect(parsed.isStructured).toBe(true);
    expect(parsed.pillars).toHaveLength(2);
    expect(parsed.pillars[0].title).toBe("Transparent Leadership");
    expect(parsed.pillars[0].bullets).toEqual([
      "Regular financial reports",
      "Open town hall meetings",
    ]);
    expect(parsed.pillars[1].title).toBe("Student Welfare");
    expect(parsed.pillars[1].bullets).toEqual(["Mental health initiatives", "Affordable supplies"]);
  });

  it("parses unprefixed numbered and bracketed section headers", () => {
    const numbered = parsePlatformText(`
1. Transparent Leadership
Ensuring open communication.
1. Regular financial reports.
2. Open town hall meetings.

2. Student Welfare
Supporting every student.
- Mental health initiatives
`);

    expect(numbered.isStructured).toBe(true);
    expect(numbered.pillars).toHaveLength(2);
    expect(numbered.pillars[0]).toMatchObject({
      letter: "1",
      title: "Transparent Leadership",
      body: "Ensuring open communication.",
      bullets: ["Regular financial reports.", "Open town hall meetings."],
    });
    expect(numbered.pillars[1].title).toBe("Student Welfare");

    const numberedWithoutBlank = parsePlatformText(`
1. Academic Support
Tutoring programs.
2. Student Welfare
Supporting every student.
`);

    expect(numberedWithoutBlank.pillars).toHaveLength(2);
    expect(numberedWithoutBlank.pillars[1].title).toBe("Student Welfare");

    const bracketed = parsePlatformText(`
[S] - Strengthen CSO
We will serve every student.

[U] - Unlock Student Skills
We will create more opportunities.
`);

    expect(bracketed.isStructured).toBe(true);
    expect(bracketed.pillars).toHaveLength(2);
    expect(bracketed.pillars[0].letter).toBe("S");
    expect(bracketed.pillars[0].title).toBe("Strengthen CSO");
    expect(bracketed.pillars[1].letter).toBe("U");
  });

  it("preserves quoted text inside a structured body", () => {
    const parsed = parsePlatformText(`
### Priorities
We will deliver “Every student first” through service.
`);

    expect(parsed.tagline).toBeUndefined();
    expect(parsed.pillars[0].body).toBe("We will deliver “Every student first” through service.");
  });

  it("removes a standalone tagline from unstructured fallback paragraphs", () => {
    const parsed = parsePlatformText(`
Our platform puts practical service first.

“Every student first”
`);

    expect(parsed.tagline).toBe("Every student first");
    expect(parsed.rawParagraphs).toEqual(["Our platform puts practical service first."]);
  });

  it("keeps pre-header intro text separate from acronym meaning", () => {
    const raw = `
SULONG PARTYLIST

This platform starts with practical service for every student.

SULONG
Student Unity, Leadership, Opportunities, and New Growth

S — Strengthen CSO
We will keep improving student programs.
`;

    const parsed = parsePlatformText(raw);

    expect(parsed.intro).toBe("This platform starts with practical service for every student.");
    expect(parsed.acronymMeaning).toBe("Student Unity, Leadership, Opportunities, and New Growth");
  });

  it("ignores generic markdown headings", () => {
    const raw = `
## OUR PLATFORM

### Student Welfare
Supporting every student.
`;

    const parsed = parsePlatformText(raw);

    expect(parsed.pillars).toHaveLength(1);
    expect(parsed.pillars[0].title).toBe("Student Welfare");
  });

  it("gracefully handles unstructured essays as clean raw paragraphs", () => {
    const raw = `
Our party believes in the power of united students.

We promise to represent your voices across all academic and extracurricular endeavors. Together, we can make our university experience unforgettable.
`;

    const parsed = parsePlatformText(raw);
    expect(parsed.isStructured).toBe(false);
    expect(parsed.pillars).toHaveLength(0);
    expect(parsed.rawParagraphs).toHaveLength(2);
    expect(parsed.rawParagraphs[0]).toBe("Our party believes in the power of united students.");
  });

  it("parses numbered body items as bullets instead of separate pillars", () => {
    const raw = `
S — Strengthen CSO

We will continue the growth and progress:
1. Maintain and improve existing programs.
2. Build on existing achievements.
3. Make CSO more active and visible.

U — Unlock Student Skills

Opportunities for students:
1. Technical workshops.
2. Leadership training camps.
`;

    const parsed = parsePlatformText(raw);
    expect(parsed.isStructured).toBe(true);
    expect(parsed.pillars).toHaveLength(2);

    expect(parsed.pillars[0].letter).toBe("S");
    expect(parsed.pillars[0].title).toBe("Strengthen CSO");
    expect(parsed.pillars[0].body).toBe("We will continue the growth and progress:");
    expect(parsed.pillars[0].bullets).toEqual([
      "Maintain and improve existing programs.",
      "Build on existing achievements.",
      "Make CSO more active and visible.",
    ]);

    expect(parsed.pillars[1].letter).toBe("U");
    expect(parsed.pillars[1].title).toBe("Unlock Student Skills");
    expect(parsed.pillars[1].body).toBe("Opportunities for students:");
    expect(parsed.pillars[1].bullets).toEqual([
      "Technical workshops.",
      "Leadership training camps.",
    ]);
  });

  it("does not treat markdown ## Tagline as a pillar titled Tagline", () => {
    const raw = `
## Tagline
“Moving Forward. Growing Together.”

### 1. Student Welfare
Supporting every student.
- Mental health initiatives
`;

    const parsed = parsePlatformText(raw);
    expect(parsed.isStructured).toBe(true);
    expect(parsed.tagline).toBe("Moving Forward. Growing Together.");
    expect(parsed.pillars).toHaveLength(1);
    expect(parsed.pillars[0].title).toBe("Student Welfare");
  });

  it("detects quoted taglines containing apostrophes", () => {
    const rawInline = `
Tagline: “Let's build a brighter future for CSO.”

### 1. Student Welfare
Supporting every student.
`;

    const parsedInline = parsePlatformText(rawInline);
    expect(parsedInline.tagline).toBe("Let's build a brighter future for CSO.");
    expect(parsedInline.pillars).toHaveLength(1);

    const rawStandalone = `
"It's time for real progress and student empowerment."

### 1. Academic Support
Tutoring programs.
`;

    const parsedStandalone = parsePlatformText(rawStandalone);
    expect(parsedStandalone.tagline).toBe("It's time for real progress and student empowerment.");
    expect(parsedStandalone.pillars).toHaveLength(1);
  });

  it("detects unquoted inline taglines", () => {
    const parsed = parsePlatformText(`
Tagline: Move forward

### 1. Student Welfare
Supporting every student.
`);

    expect(parsed.tagline).toBe("Move forward");
    expect(parsed.intro).toBeUndefined();
    expect(parsed.pillars).toHaveLength(1);
  });
});
