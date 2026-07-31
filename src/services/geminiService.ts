import { auth } from '../firebase';
import { apiUrl } from '../utils/apiBase';

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Inte inloggad.');
  return user.getIdToken();
}

/** Premium TTS (Google Cloud). Returnerar rå response — kolla ok innan blob(). */
export async function requestPremiumTts(text: string, lang?: string): Promise<Response> {
  const token = await getAuthToken();
  return fetch(apiUrl('/api/tts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, lang: lang || 'sv' }),
  });
}

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function apiRequest(endpoint: string, body: object): Promise<any> {
  const token = await getAuthToken();
  const response = await fetch(apiUrl(`/api/${endpoint}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Nätverksfel' }));
    throw new ApiRequestError(error.error || `HTTP ${response.status}`, response.status);
  }

  return response.json();
}

function stripDataUrl(b64: string): string {
  const s = b64.trim();
  const i = s.indexOf(',');
  return i >= 0 && s.startsWith('data:') ? s.slice(i + 1) : s;
}

export async function generateHomeworkHelp(
  prompt: string,
  history: { role: 'user' | 'model'; content: string }[] = [],
  imageBase64?: string,
  simpleSwedish?: boolean,
  language?: string,
  imageBase64s?: string[],
  childGrade?: string,
  onDelta?: (delta: string, fullText: string) => void,
  coachMode?: boolean,
): Promise<string> {
  const manyRaw = imageBase64s?.filter((x) => typeof x === 'string' && x.length > 0) ?? [];
  const many = manyRaw.map(stripDataUrl);
  const single = imageBase64 ? stripDataUrl(imageBase64) : '';
  const body: Record<string, unknown> = { prompt, history, simpleSwedish, language, childGrade, coachMode };
  if (many.length > 0) {
    body.imageBase64s = many;
  } else if (single) {
    body.imageBase64 = single;
  }
  const token = await getAuthToken();
  const response = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Nätverksfel' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const ctype = response.headers.get('content-type') || '';
  if (!ctype.includes('application/x-ndjson') || !response.body) {
    const data = await response.json();
    return data.text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as { delta?: string; done?: boolean; text?: string };
        if (typeof obj.delta === 'string' && obj.delta.length > 0) {
          full += obj.delta;
          onDelta?.(obj.delta, full);
        } else if (obj.done && typeof obj.text === 'string') {
          full = obj.text;
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  if (pending.trim()) {
    try {
      const obj = JSON.parse(pending.trim()) as { text?: string };
      if (typeof obj.text === 'string') full = obj.text;
    } catch {
      // ignore
    }
  }
  return full;
}

function isImageRequestNonRetryable(err: unknown): boolean {
  // 429 (rate-limited / RESOURCE_EXHAUSTED) is deliberately NOT retried here either —
  // retrying a request that's already being rate-limited just amplifies the overload
  // it's meant to protect against. Checking `status` directly is more reliable than the
  // string match below, which breaks silently if a server error message ever changes.
  if (err instanceof ApiRequestError) {
    return err.status === 401 || err.status === 403 || err.status === 429;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /403|401|429|Uppgradera|abonnemang|upgrade|subscription|överbelastad|RESOURCE_EXHAUSTED/i.test(msg);
}

export async function generateImage(prompt: string, childGrade?: string): Promise<string | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await apiRequest('image', { prompt, childGrade });
      return data.imageData as string | null;
    } catch (e) {
      lastErr = e;
      if (isImageRequestNonRetryable(e)) throw e;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function analyzeHomeworkImage(
  imageBase64: string,
  prompt: string = 'Analysera denna läxa och förklara för mig som förälder hur jag kan hjälpa mitt barn.'
): Promise<string> {
  return generateHomeworkHelp(prompt, [], imageBase64);
}

export interface AutoTaskData {
  subject: string;
  description: string;
  suggestedWorkDays: string[];
  suggestedDueDay: string;
  minutesPerDay: number;
}

export async function analyzeHomeworkForTask(
  aiExplanation: string
): Promise<AutoTaskData> {
  const prompt = `Baserat på din analys av denna läxa, returnera ett JSON-objekt med följande fält:
- "subject": ämnet (t.ex. "Matematik", "Svenska", "Engelska", "NO", "SO")
- "description": kort beskrivning av uppgiften (max 80 tecken)
- "suggestedWorkDays": en lista med veckodagar att jobba (t.ex. ["måndag", "onsdag"]), välj 2-3 rimliga dagar
- "suggestedDueDay": inlämningsdag (t.ex. "fredag")
- "minutesPerDay": uppskattade minuter per dag (heltal, 10-60)

Svara BARA med JSON, inget annat. Ingen markdown, inga kodfält.

AI-analys av läxan: ${aiExplanation.slice(0, 800)}`;

  const text = await generateHomeworkHelp(prompt, []);
  try {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { subject: 'Allmänt', description: 'Läxa från foto', suggestedWorkDays: [], suggestedDueDay: 'fredag', minutesPerDay: 15 };
  }
}

export async function generateExamPrep(
  subject: string,
  description: string,
  aiNotes: string[] = [],
  linkedChatContext: string[] = [],
  imageBase64s: string[] = []
): Promise<string> {
  const context = aiNotes.length > 0 ? `\n\nTidigare AI-anteckningar om ämnet:\n${aiNotes.join('\n---\n')}` : '';
  const linkedChat = linkedChatContext.length > 0
    ? `\n\nRelevant tidigare AI-chatt kopplad till denna läxa:\n${linkedChatContext.join('\n---\n')}`
    : '';

  const prompt = `Skapa ett komplett studiepaket för ett prov i ${subject}.
Beskrivning av provet: ${description}${context}${linkedChat}

Inkludera:
1. **Sammanfattning** — De viktigaste koncepten att kunna (3-5 punkter)
2. **Nyckelbegrepp** — Lista med begrepp barnet måste kunna, med korta förklaringar
3. **Övningsfrågor** — 5-8 frågor i stigande svårighetsgrad
4. **Facit** — Korrekta svar på övningsfrågorna
5. **Tips till föräldern** — Hur föräldern kan förhöra barnet effektivt

Skriv på svenska. Anpassa till grundskolenivå. Använd tydliga rubriker och numrering.`;

  const data = await apiRequest('chat', {
    prompt,
    history: [],
    imageBase64s: imageBase64s.length > 0 ? imageBase64s : undefined,
  });
  return data.text;
}

export async function generateStudyPlan(
  tasks: Array<{ subject: string; description: string; dueDay?: string; workDays?: string[]; minutesPerDay?: number; completed: boolean; completedDays?: string[] }>
): Promise<string> {
  const taskSummary = tasks.map((t, i) =>
    `${i + 1}. ${t.subject}: ${t.description} (Inlämning: ${t.dueDay || 'ej satt'}, Tid: ${t.minutesPerDay || '?'} min/dag, Klar: ${t.completed ? 'ja' : 'nej'}, Klara dagar: ${t.completedDays?.join(', ') || 'inga'})`
  ).join('\n');

  const prompt = `Analysera dessa läxor för veckan och ge en optimal studieplan:

${taskSummary}

Ge:
1. **Prioriteringsordning** — Vilken läxa ska göras först och varför
2. **Dagsschema** — Förslag på vilka dagar och i vilken ordning läxorna bör göras
3. **Tidsuppskattning** — Ungefär hur lång tid varje dag bör ta
4. **Tips** — Praktiska råd till föräldern om hur veckan kan planeras

Tänk på: svårighetsgrad, deadlines, omväxling mellan ämnen, och att inte överbelasta någon dag.
Skriv på svenska, kortfattat och handlingsbart.`;

  return generateHomeworkHelp(prompt, []);
}

export async function correctHomeworkFromImages(
  imageBase64s: string[],
  extraContext?: string,
  language: string = 'sv'
): Promise<string> {
  const context = extraContext?.trim()
    ? `\n\nExtra kontext från föräldern:\n${extraContext.trim().slice(0, 1000)}`
    : '';

  const prompt = `Du är en pedagogisk rättningsassistent för svenska grundskolan.
Mål: Rätta elevens svar utifrån bilderna av läxan.

VIKTIGT ARBETSSÄTT:
1) Läs bilderna noggrant först (OCR/visuell tolkning): uppgiftstext, elevens svar, siffror, enheter, tecken, diagram, stavning.
2) Om någon del är oskarp eller saknas, säg exakt vilken del och vad som behövs.
3) Rätta sedan svaren ämnesoberoende (matte, svenska, språk, NO, SO m.m.).
4) Markera tydligt vad som är korrekt och vad som är fel.
5) För varje fel: förklara vad felet är, varför det blir fel och hur det blir rätt.
6) Ge ett kort nästa steg som barnet kan göra direkt.

SVARFORMAT (viktigt):
- Skriv på svenska.
- Använd INTE markdown-tecken som stjärnor, nummertecken eller tabeller.
- Använd tydliga rubriker exakt så här:
Din läxa i korthet:
Bedömning per uppgift:
Det som är fel och varför:
Så gör du rätt:
Sammanfattning till förälder:
- Under rubriker, använd enkla listor med "- ".
${context}`;

  return generateHomeworkHelp(
    prompt,
    [],
    undefined,
    false,
    language,
    imageBase64s.slice(0, 5)
  );
}
