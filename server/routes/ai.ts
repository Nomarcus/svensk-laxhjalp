import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  normalizeAndTrimHistory,
  normalizeImageGenerationPrompt,
  normalizePrompt,
  validateInlineImages,
} from '../lib/chatRequestValidation';

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gemini-2.5-flash-lite';
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-2.5-flash-image';

function parseGradeLevel(raw?: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 12 ? n : null;
}

function buildAudienceGuidance(rawGrade?: unknown): string {
  const grade = parseGradeLevel(rawGrade);
  if (grade === null) {
    return 'Neutral nivå: tydligt men inte barnsligt språk. Undvik överförenkling.';
  }
  if (grade <= 3) {
    return 'Lågstadium: enkel och varm ton, mycket konkreta exempel, lekfull pedagogik.';
  }
  if (grade <= 6) {
    return 'Mellanstadium: tydlig och coachande ton, konkreta exempel, mindre lekfullt.';
  }
  if (grade <= 9) {
    return 'Högstadium: mer mogen ton, rak och respektfull, ämneskorrekt terminologi.';
  }
  return 'Gymnasienivå: vuxnare ton, precision och struktur, undvik barnsliga metaforer.';
}

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
1. Förklara uppgiften kort och tydligt. Vid matte/uträkningar: visa steg för steg och ställ upp uppgiften på ett tydligt sätt.
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

router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, history, imageBase64, imageBase64s, childGrade } = req.body;

    const images = validateInlineImages(imageBase64, imageBase64s);
    if (images.ok === false) {
      res.status(images.status).json({ error: images.error });
      return;
    }

    const hist = normalizeAndTrimHistory(history);
    if (hist.ok === false) {
      res.status(hist.status).json({ error: hist.error });
      return;
    }

    const p = normalizePrompt(prompt, images.parts.length > 0);
    if (p.ok === false) {
      res.status(p.status).json({ error: p.error });
      return;
    }

    const audienceGuidance = buildAudienceGuidance(childGrade);
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
            { text: p.text },
          ],
        },
      ],
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTION}

Anpassning för detta barn:
- ${audienceGuidance}
- För äldre elever: håll tonen mogen och undvik barnsliga formuleringar.
`,
      },
    });

    const text = response.text;
    const usage = response.usageMetadata;

    if (usage) {
      console.log(`[usage] uid=${req.uid} prompt=${usage.promptTokenCount} response=${usage.candidatesTokenCount} total=${usage.totalTokenCount}`);
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
});

router.post('/image', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, childGrade } = req.body;
    const np = normalizeImageGenerationPrompt(prompt);
    if (np.ok === false) {
      res.status(np.status).json({ error: np.error });
      return;
    }

    const audienceGuidance = buildAudienceGuidance(childGrade);
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            text: `Skapa en pedagogisk illustration för en svensk skoluppgift. Ämne: ${np.text}. Illustrationen ska vara tydlig, hjälpsam och åldersanpassad. Målgrupp: ${audienceGuidance} För äldre elever: mer neutral, mindre barnslig stil. Undvik text i bilden om möjligt.`,
          },
        ],
      },
      config: {
        responseModalities: ['image', 'text'],
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = `data:image/png;base64,${part.inlineData.data}`;
          res.json({ imageData });
          return;
        }
      }
    }

    res.json({ imageData: null });
  } catch (error: any) {
    console.error('Image generation error:', error.message);
    res.status(500).json({ error: 'Ett fel uppstod vid bildgenerering.' });
  }
});

export { router as aiRouter };
