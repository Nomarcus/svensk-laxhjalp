import { supabase } from '../supabase';

const GUEST_ID_KEY = 'laxhjalp_guest_id';

function getGuestId(): string {
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = (globalThis.crypto?.randomUUID?.() || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

async function apiRequest(endpoint: string, body: object): Promise<any> {
  const token = await getAuthToken();
  const guestId = getGuestId();
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'x-guest-user-id': guestId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Nätverksfel' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function generateHomeworkHelp(
  prompt: string,
  history: { role: 'user' | 'model'; content: string }[] = [],
  imageBase64?: string
): Promise<string> {
  const data = await apiRequest('chat', { prompt, history, imageBase64 });
  return data.text;
}

export async function generateImage(prompt: string): Promise<string | null> {
  const data = await apiRequest('image', { prompt });
  return data.imageData;
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

  const text = await generateHomeworkHelp(prompt);
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
  aiNotes: string[] = []
): Promise<string> {
  const context = aiNotes.length > 0 ? `\n\nTidigare AI-anteckningar om ämnet:\n${aiNotes.join('\n---\n')}` : '';

  const prompt = `Skapa ett komplett studiepaket för ett prov i ${subject}.
Beskrivning av provet: ${description}${context}

Inkludera:
1. **Sammanfattning** — De viktigaste koncepten att kunna (3-5 punkter)
2. **Nyckelbegrepp** — Lista med begrepp barnet måste kunna, med korta förklaringar
3. **Övningsfrågor** — 5-8 frågor i stigande svårighetsgrad
4. **Facit** — Korrekta svar på övningsfrågorna
5. **Tips till föräldern** — Hur föräldern kan förhöra barnet effektivt

Skriv på svenska. Anpassa till grundskolenivå. Använd tydliga rubriker och numrering.`;

  return generateHomeworkHelp(prompt);
}

export async function generateStudyPlan(
  tasks: Array<{ subject: string; description: string; due_day?: string; work_days?: string[]; minutes_per_day?: number; completed: boolean; completed_days?: string[] }>
): Promise<string> {
  const taskSummary = tasks.map((t, i) =>
    `${i + 1}. ${t.subject}: ${t.description} (Inlämning: ${t.due_day || 'ej satt'}, Tid: ${t.minutes_per_day || '?'} min/dag, Klar: ${t.completed ? 'ja' : 'nej'}, Klara dagar: ${t.completed_days?.join(', ') || 'inga'})`
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

  return generateHomeworkHelp(prompt);
}
