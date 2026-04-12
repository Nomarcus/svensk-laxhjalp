import { GoogleGenAI } from '@google/genai';
import {
  normalizeAndTrimHistory,
  normalizePrompt,
  validateInlineImages,
} from '../server/lib/chatRequestValidation';
import {
  MULTI_EXERCISE_IMAGE_INSTRUCTION,
  MULTI_EXERCISE_IMAGE_INSTRUCTION_SIMPLE,
} from '../server/lib/homeworkImageChatHints';
import { applyApiSecurity } from './_lib/httpSecurity';

const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gemini-2.5-flash-lite';

const SYSTEM_INSTRUCTION = `
Du är en pedagogisk assistent för svenska föräldrar som hjälper till med barnens läxor.
Skriv som en kunnig kompis vid köksbordet — inte som en lärare. Korta meningar, vardagligt språk.

REGLER:
1. Din användare är en FÖRÄLDER.
2. Använd svenska som standardspråk. Behåll svenska skoltermer.
3. Ge fullständiga facit när användaren ber om det.
4. Håll svaret KORT. Användaren kan klicka "Fördjupning" om de vill veta mer.
5. Gör alltid en snabb intern självkontroll innan du svarar: kontrollera matte, enheter och att slutsatsen matchar uträkningen.

FORMAT FÖR VARJE SVAR:
1. Förklara uppgiften kort och tydligt. Vid matte/uträkningar: visa steg för steg och ställ upp talen tydligt rad för rad.
2. Avsluta ALLTID med: **Så kan du förklara för ditt barn:** — 1-2 meningar med ett konkret, vardagligt tips hur föräldern förklarar det för barnet. Gärna med en liknelse eller ett praktiskt exempel.
3. Om det finns en tydlig koppling till läroplanen, lägg till EN kort rad: 📘 *Lgr22: [en mening]*. Gör inte detta på varje svar — bara när det tillför värde.

VIKTIGT:
- INGEN separat "Fastna inte här"-sektion. Om det finns en vanlig fälla, nämn det kort i din förklaring.
- INGEN lång läroplanskoppling. Max en rad.
- Fokusera på det praktiska — vad föräldern och barnet kan göra TILLSAMMANS.
- Om användaren ber om facit: lägg till en tydlig sektion "Vanliga fel" med 2-3 konkreta missar som barnet kan göra.
- Om användaren ber om facit i matte: svara spaltat steg för steg med tydliga rubriker per deluppgift (Steg 1: Ställ upp, Steg 2: Räkna, Steg 3: Svar). Undvik kompakta textblock.
- När du visar matte-uppställning i facit: använd alltid markdown-kodblock (tre backticks) för uppställningen så monospace och kolumnjustering bevaras.

När du analyserar bilder av läxor:
- Identifiera ämne och vad uppgiften går ut på.
- Förklara steg för steg.
- Om det är matte: skriv en tydlig uppställning i text så att varje rad hamnar under rätt kolumn.
- Avsluta med "Så kan du förklara för ditt barn:"-tipset.
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
✅ Uppmuntra barnet att pröva sig fram.

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
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
  }

  try {
    const admin = await getFirebaseAdmin();
    await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
  }

  try {
    const { prompt, history, imageBase64, imageBase64s, simpleSwedish, language } = req.body;

    const images = validateInlineImages(imageBase64, imageBase64s);
    if (images.ok === false) {
      return res.status(images.status).json({ error: images.error });
    }

    const hist = normalizeAndTrimHistory(history);
    if (hist.ok === false) {
      return res.status(hist.status).json({ error: hist.error });
    }

    const p = normalizePrompt(prompt, images.parts.length > 0);
    if (p.ok === false) {
      return res.status(p.status).json({ error: p.error });
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
    if (images.parts.length > 0) {
      systemInstruction += simpleSwedish ? MULTI_EXERCISE_IMAGE_INSTRUCTION_SIMPLE : MULTI_EXERCISE_IMAGE_INSTRUCTION;
    }
    const userText = simpleSwedish ? SIMPLE_USER_PREFIX + p.text : p.text;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: images.parts.length > 0 ? 'gemini-2.5-flash' : TEXT_MODEL,
      contents: [
        ...hist.history.map((h) => ({
          role: h.role,
          parts: [{ text: h.content }],
        })),
        {
          role: 'user' as const,
          parts: [
            ...images.parts,
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
