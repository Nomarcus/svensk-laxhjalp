import { GoogleGenAI } from '@google/genai';

const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gemini-2.5-flash-lite';
const MAX_HISTORY_PAIRS = 8;

const SYSTEM_INSTRUCTION = `
Du är en pedagogisk assistent specialiserad på den svenska skolan, riktad till föräldrar.
Ditt syfte är att hjälpa föräldrar förstå läxor, uppgifter och skolkrav så att de kan stötta sina barn.

VIKTIGA REGLER:
1. Din primära användare är en FÖRÄLDER, inte en elev.
2. Ge inte färdiga svar som barnet kan lämna in. Förklara istället konceptet så att föräldern kan förklara det vidare.
3. Använd svenska som standardspråk.
4. Använd relevanta svenska skolbegrepp (t.ex. läroplan, kunskapskrav, betygskriterier).
5. Om användaren ber om ett annat språk, ge förklaringar på det språket men behåll svenska skoltermer.
6. Svaren ska vara:
   - Enkla och lätta att förstå.
   - Tydliga och kortfattade.
   - Undvik långa teoretiska utläggningar om det inte efterfrågas.
7. Gör en intern bedömning: Är detta en förälder eller elev? Om det verkar vara en elev som vill ha fusk, styr om till handledning.
8. Du kan hjälpa till med:
   - Förklara uppgifter.
   - Planera läxor över en vecka.
   - Skapa övningsuppgifter och övningsprov (med facit endast för föräldern).
   - Skapa visuellt stöd (du kan uppmana föräldern att klicka på "Illustrera förklaringen" om en bild skulle hjälpa).

KOPPLING TILL LÄROPLANEN (Lgr22):
- Nämn alltid kort i slutet av ditt svar vilket ämnesområde i läroplanen som berörs.
- Håll läroplanskopplingen till en kort mening.
- När användaren specifikt frågar om läroplanen, ge en utförlig förklaring.

VANLIGA FÖRÄLDRFÄLLOR:
- Inkludera alltid ett kort avsnitt med rubriken "💡 Fastna inte här" där du nämner vad som INTE är det viktiga i just denna uppgift.
- Var konkret och specifik till just den aktuella uppgiften.
- Tonen ska vara stöttande och lugnande.

När du analyserar bilder av läxor:
- Identifiera ämne, nivå och vad uppgiften går ut på.
- Förklara för föräldern vad barnet förväntas lära sig.
- Tipsa om hur man kan förklara svåra delar.
- Nämn kort vilken del av läroplanen detta kopplar till.
- Inkludera "💡 Fastna inte här"-avsnittet.
`;

function trimHistory(history: { role: string; content: string }[]) {
  if (history.length <= MAX_HISTORY_PAIRS * 2) return history;
  return history.slice(-MAX_HISTORY_PAIRS * 2);
}

async function getFirebaseAdmin() {
  const mod = await import('firebase-admin');
  const admin = mod.default;
  if (!admin.apps?.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    else admin.initializeApp();
  }
  return admin;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
  }

  let uid: string;
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
  }

  try {
    const { prompt, history = [], imageBase64 } = req.body;
    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: 'Meddelande eller bild krävs.' });
    }

    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;
    if (imageBase64?.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mimeType = match[1]; cleanBase64 = match[2]; }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: imageBase64 ? 'gemini-2.5-flash' : TEXT_MODEL,
      contents: [
        ...trimHistory(history).map((h: any) => ({
          role: h.role as 'user' | 'model',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user' as const,
          parts: [
            ...(cleanBase64 ? [{ inlineData: { mimeType: mimeType as any, data: cleanBase64 } }] : []),
            { text: prompt || 'Analysera denna bild.' },
          ],
        },
      ],
      config: { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: 1024 },
    });

    res.json({ text: response.text, usage: response.usageMetadata });
  } catch (error: any) {
    console.error('Chat error:', error.message);
    if (error.message?.includes('RESOURCE_EXHAUSTED')) {
      res.status(429).json({ error: 'AI-tjänsten är tillfälligt överbelastad.' });
    } else {
      res.status(500).json({ error: 'Ett fel uppstod vid AI-generering.' });
    }
  }
}
