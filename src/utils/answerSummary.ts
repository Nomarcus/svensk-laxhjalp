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
  /** Texten från "Så kan du förklara för ditt barn:". */
  childExplanation: string | null;
}

/**
 * Rubriken har haft två stavningar över tid — "Så säger du till barnet" i nuvarande
 * systemprompt, "Så kan du förklara för ditt barn" i den äldre. Båda accepteras, så
 * kortet fungerar oavsett vilken version av servern som är deployad.
 * Slutar vid Lgr22-raden, nästa rubrik eller "Vanliga fel".
 */
const CHILD_EXPLANATION_RE =
  /(?:\*\*)?\s*(?:Så säger du till barnet|Så kan du förklara för ditt barn)\s*:?\s*(?:\*\*)?\s*([\s\S]*?)(?=\n\s*(?:📘|#{1,3}\s|(?:\*\*)?\s*(?:Vanliga fel|Nästa bästa steg|Till dig som vuxen))|$)/i;

/** Coach-läget visar svaret som "Facit (för dig, inte för barnet): ..." */
const COACH_ANSWER_RE = /(?:\*\*)?\s*Facit\s*\(för dig[^)]*\)\s*:?\s*(?:\*\*)?\s*(.+)/i;

/** Rader som "Svar: 42", "- Svar: `2 * 2`", "**Svar: 42**" */
const ANSWER_LINE_RE = /^[\s>]*(?:[-*•]\s*)?(?:\*\*)?\s*Svar\s*:?\s*(?:\*\*)?\s*(.+?)\s*$/gim;

const MAX_ANSWERS = 8;
const MAX_ANSWER_CHARS = 160;
const MAX_EXPLANATION_CHARS = 600;

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

  const explanationMatch = content.match(CHILD_EXPLANATION_RE);
  const explanationRaw = explanationMatch?.[1] ? cleanInline(explanationMatch[1]) : '';
  const childExplanation = explanationRaw ? truncate(explanationRaw, MAX_EXPLANATION_CHARS) : null;

  if (answers.length === 0 && !childExplanation) return null;
  return { answers, childExplanation };
}
