/**
 * Plockar ut de delar av ett AI-svar som en förälder oftast vill se först:
 * kortsvaret och meningen om hur man förklarar för barnet.
 *
 * Svaren följer systemprompten i server/routes/ai.ts — den kräver alltid
 * "Så kan du förklara för ditt barn:" i vanligt läge och "Facit (för dig...)"
 * i coach-läge, samt "Svar:" per deluppgift i facit. Modellen avviker ändå
 * ibland, så allt här är best-effort: hittas inget returneras null och
 * anroparen visar hela svaret som vanligt.
 */

export interface AnswerSummary {
  /** Kortsvar, en rad per deluppgift. */
  answers: string[];
  /**
   * Texten till gröna rutan: vad uppgiften går ut på och hur man löser den.
   * Kommer från "Kort om uppgiften:", med "Så säger du till barnet:" som reserv
   * så rutan inte blir tom mot en server som ännu kör den äldre systemprompten.
   */
  brief: string | null;
  /** True när `brief` är reservtexten, dvs. barnraden och inte orienteringen. */
  briefIsFallback: boolean;
}

/** Rubriker som avslutar en sektion. Håll i synk med systemprompten i server/routes/ai.ts. */
const SECTION_END =
  '(?=\\n\\s*(?:📘|#{1,3}\\s|(?:\\*\\*)?\\s*(?:Kort om uppgiften|Till dig som vuxen|Så säger du till barnet|Så kan du förklara för ditt barn|Vanliga fel|Nästa bästa steg|Steg \\d))|$)';

/**
 * "Kort om uppgiften:" — orienteringen som gröna rutan visar. Konkret beskrivning
 * av vad uppgiften går ut på och hur man löser den, inte en liknelse.
 */
const BRIEF_RE = new RegExp(
  `(?:\\*\\*)?\\s*Kort om uppgiften\\s*:?\\s*(?:\\*\\*)?\\s*([\\s\\S]*?)${SECTION_END}`,
  'i',
);

/**
 * Rubriken har haft två stavningar över tid — "Så säger du till barnet" i nuvarande
 * systemprompt, "Så kan du förklara för ditt barn" i den äldre. Båda accepteras, så
 * kortet fungerar oavsett vilken version av servern som är deployad.
 */
const CHILD_EXPLANATION_RE = new RegExp(
  `(?:\\*\\*)?\\s*(?:Så säger du till barnet|Så kan du förklara för ditt barn)\\s*:?\\s*(?:\\*\\*)?\\s*([\\s\\S]*?)${SECTION_END}`,
  'i',
);

/** Coach-läget visar svaret som "Facit (för dig, inte för barnet): ..." */
const COACH_ANSWER_RE = /(?:\*\*)?\s*Facit\s*\(för dig[^)]*\)\s*:?\s*(?:\*\*)?\s*(.+)/i;

/** Rader som "Svar: 42", "- Svar: `2 * 2`", "**Svar: 42**" */
const ANSWER_LINE_RE = /^[\s>]*(?:[-*•]\s*)?(?:\*\*)?\s*Svar\s*:?\s*(?:\*\*)?\s*(.+?)\s*$/gim;

const MAX_ANSWERS = 8;
const MAX_ANSWER_CHARS = 160;
const MAX_EXPLANATION_CHARS = 600;
const MAX_BRIEF_CHARS = 700;

/**
 * Tar bort fetstil och kodmarkering men lämnar enkla asterisker i fred —
 * de är oftast multiplikationstecken i mattesvar (t.ex. "2 * 2 * 5").
 */
function cleanInline(text: string): string {
  return text
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Som cleanInline men behåller radbrytningarna. Orienteringen består av korta
 * rader — vad uppgiften går ut på, metoden, svaret — och blir obegriplig om de
 * slås ihop till ett stycke. Punktlistor får en synlig punkt i stället för
 * markdown-strecket.
 */
function cleanBlock(text: string): string {
  return text
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*[-*+]\s+/, '• ').replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function extractAnswerSummary(content: string): AnswerSummary | null {
  if (!content) return null;

  const answers: string[] = [];
  const seen = new Set<string>();

  const pushAnswer = (raw: string) => {
    const cleaned = truncate(cleanInline(raw), MAX_ANSWER_CHARS);
    if (!cleaned || seen.has(cleaned) || answers.length >= MAX_ANSWERS) return;
    seen.add(cleaned);
    answers.push(cleaned);
  };

  const coachMatch = content.match(COACH_ANSWER_RE);
  if (coachMatch?.[1]) pushAnswer(coachMatch[1]);

  ANSWER_LINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANSWER_LINE_RE.exec(content)) !== null) {
    if (match[1]) pushAnswer(match[1]);
  }

  const briefMatch = content.match(BRIEF_RE);
  let briefRaw = briefMatch?.[1] ? cleanBlock(briefMatch[1]) : '';
  if (briefRaw) {
    // Orienteringen avslutas med slutsvaret, som redan står i egen ruta ovanför.
    // Visa det inte två gånger i samma kort — men behåll raden om svarslistan är tom.
    briefRaw = briefRaw
      .split('\n')
      .filter((line) => {
        const m = /^\s*(?:•\s*)?Svar\s*:?\s*(.+)$/i.exec(line);
        return !m || !seen.has(truncate(cleanInline(m[1]), MAX_ANSWER_CHARS));
      })
      .join('\n');
  }
  if (briefRaw) {
    return { answers, brief: truncate(briefRaw, MAX_BRIEF_CHARS), briefIsFallback: false };
  }

  // Servern kan fortfarande köra den äldre systemprompten utan "Kort om uppgiften".
  // Då är barnraden det närmaste en orientering som finns — bättre än en tom ruta.
  const explanationMatch = content.match(CHILD_EXPLANATION_RE);
  const explanationRaw = explanationMatch?.[1] ? cleanInline(explanationMatch[1]) : '';
  const fallback = explanationRaw ? truncate(explanationRaw, MAX_EXPLANATION_CHARS) : null;

  if (answers.length === 0 && !fallback) return null;
  return { answers, brief: fallback, briefIsFallback: fallback !== null };
}
