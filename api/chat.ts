
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '../lib/auth';
import { checkSubscription } from '../lib/subscription';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gemini-2.5-flash-lite';

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
- Nämn alltid kort i slutet av ditt svar vilket ämnesområde i läroplanen som berörs, t.ex. "Detta hör till det centrala innehållet i matematik, årskurs 4–6: Tal och räkning."
- Håll läroplanskopplingen till en kort mening — föräldern kan klicka på "Koppling till läroplanen" om de vill veta mer.
- När användaren specifikt frågar om läroplanen, ge en utförlig förklaring med:
  * Vilket centralt innehåll som berörs (enligt Lgr22).
  * Vilka kunskapskrav och förmågor som tränas.
  * Varför barnet lär sig just detta och hur det bygger vidare.

VANLIGA FÖRÄLDRFÄLLOR:
- Inkludera alltid ett kort avsnitt med rubriken "💡 Fastna inte här" där du nämner vad som INTE är det viktiga i just denna uppgift — saker som föräldrar lätt lägger för mycket energi på.
- Exempel: vid en matteläxa om problemlösning, påminn om att det inte är själva uträkningen som är viktigast utan att barnet förstår hur man tänker kring problemet. Vid en uppsats, påminn om att stavning inte är huvudfokus utan att barnet övar på att uttrycka sina tankar.
- Var konkret och specifik till just den aktuella uppgiften.
- Tonen ska vara stöttande och lugnande — "det är okej att inte fokusera på X just nu".

När du analyserar bilder av läxor:
- Identifiera ämne, nivå och vad uppgiften går ut på.
- Förklara för föräldern vad barnet förväntas lära sig.
- Tipsa om hur man kan förklara svåra delar.
- Nämn kort vilken del av läroplanen detta kopplar till.
- Inkludera "💡 Fastna inte här"-avsnittet.
`;

const MAX_HISTORY_PAIRS = 10;

function trimHistory(history: { role: string; content: string }[]) {
  if (history.length <= MAX_HISTORY_PAIRS * 2) return history;
  return history.slice(-MAX_HISTORY_PAIRS * 2);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = await verifyAuth(req, res);
  if (!user) return;

  const sub = await checkSubscription(req, res, user, 'chat');
  if (!sub) return;

  try {
    const { prompt, history = [], imageBase64 } = req.body;

    if (!prompt && !imageBase64) {
      res.status(400).json({ error: 'Meddelande eller bild krävs.' });
      return;
    }

    const trimmedHistory = trimHistory(history);

    // Detect mime type from base64 data URI or default to jpeg
    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;
    if (imageBase64 && imageBase64.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }

    const response = await ai.models.generateContent({
      model: imageBase64 ? 'gemini-2.5-flash' : TEXT_MODEL,
      contents: [
        ...trimmedHistory.map((h: { role: string; content: string }) => ({
          role: h.role as 'user' | 'model',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user' as const,
          parts: [
            ...(cleanBase64
              ? [{ inlineData: { mimeType: mimeType as any, data: cleanBase64 } }]
              : []),
            { text: prompt || 'Analysera denna bild.' },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const text = response.text;
    const usage = response.usageMetadata;

    if (usage) {
      console.log(`[usage] uid=${user.uid} prompt=${usage.promptTokenCount} response=${usage.candidatesTokenCount} total=${usage.totalTokenCount}`);
    }

    res.json({ text, usage });
  } catch (error: any) {
    console.error('Chat error:', error.message);
    if (error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 'RESOURCE_EXHAUSTED') {
      res.status(429).json({ error: 'AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund.' });
    } else {
      res.status(500).json({ error: 'Ett fel uppstod vid AI-generering.' });
    }
  }
}
