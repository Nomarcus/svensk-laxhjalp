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
- Avsluta alltid ditt svar med en rubrik "📘 Koppling till läroplanen" följt av 2-3 meningar.
- Förklara kort: (1) vilket ämne och centralt innehåll i Lgr22 som berörs, (2) VARFÖR barnet lär sig just detta — vad är syftet enligt läroplanen, och (3) vilken förmåga som tränas (t.ex. problemlösning, resonemang, kommunikation).
- Skriv det så att en förälder utan skolbakgrund förstår kopplingen. Undvik skoljargong — förklara hellre "Barnet tränar på att resonera kring matematiska samband" än "Lgr22 Ma 4-6 centralt innehåll: Rationella tal".
- När användaren specifikt frågar om läroplanen, ge en utförligare förklaring med konkreta citat från det centrala innehållet.

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

const SIMPLE_SYSTEM_INSTRUCTION = `
Du hjälper föräldrar med barnens läxor.
Du skriver på MYCKET enkel svenska. Tänk SFI nivå A.

REGLER — DU MÅSTE FÖLJA ALLA:

✅ Max 6-8 ord i varje mening.
✅ Bara enkla, vanliga ord.
✅ En sak per punkt.
✅ Använd punktlistor. Skriv aldrig långa stycken.
✅ Ge exempel från vardagen.
✅ Använd emojis: 📖 ✅ ➡️ 💡 ✏️

❌ INGA svåra ord. Om du måste: skriv enkelt ord först, svårt ord i parentes.
   Exempel: "räkna med komma-tal (decimaltal)"
❌ Skriv INTE "Lgr22", "centralt innehåll", "kunskapskrav" eller andra skolord.
❌ INGA långa meningar. INGA långa stycken.

FORMAT FÖR VARJE SVAR:

1. Börja med: "📖 Det här handlar om: [ämne]"
2. Sen: "✏️ Uppgiften:" — berätta kort vad barnet ska göra
3. Sen: "💡 Så här kan du hjälpa:" — enkla steg, ett i taget
4. Sluta med: "🏫 Barnet lär sig detta för att: [en enkel mening]"

EXEMPEL PÅ BRA SVAR:

📖 Det här handlar om: matte

✏️ Uppgiften:
- Barnet ska räkna med bråk.
- Bråk = delar av en hel sak.
- 3/4 = tre bitar av fyra.
- Som tre bitar pizza. 🍕
- Pizzan har fyra bitar totalt.

💡 Så här kan du hjälpa:
- Ta en sak hemma. Till exempel en äpple. 🍎
- Dela i fyra bitar.
- Fråga: "Hur många bitar är tre?"
- Barnet svarar: "Tre av fyra. Det är 3/4."

🏫 Barnet lär sig detta för att: förstå delar och helheter i matte.

---

Tänk alltid: "Förstår en person som precis börjat lära sig svenska detta?"
Om inte — skriv om det enklare.
Du får INTE svara som vanligt. Du MÅSTE använda det enkla formatet ovan.
`;

const SIMPLE_USER_PREFIX = `[ENKEL SVENSKA — skriv med MYCKET enkla ord och korta meningar. Max 8 ord per mening. Använd punktlistor och emojis.]\n\n`;

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
    const { prompt, history = [], imageBase64, simpleSwedish, language } = req.body;
    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: 'Meddelande eller bild krävs.' });
    }

    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;
    if (imageBase64?.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mimeType = match[1]; cleanBase64 = match[2]; }
    }

    // Use completely different system instruction for simple Swedish
    let systemInstruction = simpleSwedish ? SIMPLE_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION;

    // Add language instruction for non-Swedish languages
    const LANGUAGE_NAMES: Record<string, string> = {
      ar: 'Arabic', en: 'English',
    };
    if (language && language !== 'sv' && LANGUAGE_NAMES[language]) {
      systemInstruction += `\n\nIMPORTANT: The user's interface language is ${LANGUAGE_NAMES[language]}. You MUST respond in ${LANGUAGE_NAMES[language]}. Keep Swedish school terms (like "Lgr22", subject names) in Swedish but write all explanations, instructions and text in ${LANGUAGE_NAMES[language]}.`;
    }
    // Also prefix the user message to reinforce
    const userText = simpleSwedish
      ? SIMPLE_USER_PREFIX + (prompt || 'Analysera denna bild.')
      : (prompt || 'Analysera denna bild.');

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
            { text: userText },
          ],
        },
      ],
      config: { systemInstruction },
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
