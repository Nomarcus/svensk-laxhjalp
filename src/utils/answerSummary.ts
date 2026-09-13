/**
 * Delar ett svar utan att gissa innehåll. Parsern känner bara igen uttryckliga
 * rubriker. Om svaret inte har en tillräckligt säker struktur får anroparen
 * tillbaka originalet oförändrat.
 */
export interface AnswerSections {
  task: string | null;
  brief: string | null;
  solution: string | null;
  child: string | null;
  coach: string | null;
  answer: string | null;
  remaining: string | null;
  isCoach: boolean;
  structured: boolean;
}

type SectionKey = Exclude<keyof AnswerSections, 'isCoach' | 'structured'>;

const headings: Array<[SectionKey, RegExp]> = [
  ['task', /^(?:uppgiften|uppgift(?:stext)?(?:\s+\d+[a-z]?)?)(?:\s*:|$)/i],
  ['brief', /^(?:kort om uppgiften|det här ska ni göra)(?:\s*:|$)/i],
  ['solution', /^(?:så löser ni den|till dig som vuxen|förklaring|lösning|steg för steg)(?:\s*:|$)/i],
  ['child', /^(?:så säger du till barnet|så kan du förklara för ditt barn|så kan du säga till barnet)(?:\s*:|$)/i],
  ['coach', /^(?:fråga barnet|om barnet fastnar|när barnet är nära rätt|förankra|undvik)(?:\s*:|$)/i],
  ['answer', /^(?:facit(?:\s*\(.*?\))?|visa svaret)(?:\s*:|$)/i],
];

function headingInfo(line: string): { key: SectionKey; remainder: string } | null {
  const normalized = line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^(?:🎯|🪜|✅|🔁|🚫|📘)\s*/, '')
    .trim();
  for (const [key, expression] of headings) {
    const match = normalized.match(expression);
    if (match) return { key, remainder: normalized.slice(match[0].length).trim() };
  }
  return null;
}

export function parseAnswerSections(content: string): AnswerSections {
  const empty: AnswerSections = {
    task: null, brief: null, solution: null, child: null, coach: null,
    answer: null, remaining: content || null, isCoach: false, structured: false,
  };
  if (!content.trim()) return empty;

  const buckets: Record<SectionKey, string[]> = {
    task: [], brief: [], solution: [], child: [], coach: [], answer: [], remaining: [],
  };
  let current: SectionKey = 'remaining';
  let recognized = 0;
  for (const line of content.split('\n')) {
    const heading = headingInfo(line);
    if (heading) {
      current = heading.key;
      recognized += 1;
      // Coach-rubrikerna är själva instruktionen (fråga, ledtråd, förankring).
      // Behåll dem när flera sådana delar samlas i samma synliga sektion.
      if (heading.key === 'coach') buckets.coach.push(line.replace(/\s*:\s*.*$/, ':'));
      if (heading.remainder) buckets[heading.key].push(heading.remainder);
      continue;
    }
    buckets[current].push(line);
  }
  const value = (key: SectionKey) => buckets[key].join('\n').trim() || null;
  const isCoach = Boolean(value('coach') || value('answer')) && /(?:fråga barnet|om barnet fastnar|facit\s*\(för dig)/i.test(content);
  // En ensam rubrik räcker inte för att säkert kasta om ett äldre svar.
  const structured = isCoach ? recognized >= 2 : recognized >= 2 && Boolean(value('brief') || value('child'));
  if (!structured) return empty;
  return {
    task: value('task'), brief: value('brief'), solution: value('solution'),
    child: value('child'), coach: value('coach'), answer: value('answer'),
    remaining: value('remaining'), isCoach, structured: true,
  };
}

/** Bakåtkompatibel export för äldre anrop. */
export function extractAnswerSummary(content: string) {
  const parsed = parseAnswerSections(content);
  if (!parsed.structured) return null;
  return { answers: [] as string[], brief: parsed.brief, briefIsFallback: false };
}
