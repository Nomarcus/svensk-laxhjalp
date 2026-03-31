import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gemini-2.5-flash-lite';
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-2.5-flash-image';

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

När du analyserar bilder av läxor:
- Identifiera ämne och vad uppgiften går ut på.
- Förklara steg för steg.
- Om det är matte: skriv en tydlig uppställning i text så att varje rad hamnar under rätt kolumn.
- Avsluta med "Så kan du förklara för ditt barn:"-tipset.
`;

const MAX_HISTORY_PAIRS = 10;

function trimHistory(history: { role: string; content: string }[]) {
  if (history.length <= MAX_HISTORY_PAIRS * 2) return history;
  return history.slice(-MAX_HISTORY_PAIRS * 2);
}

router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
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
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: 'Beskrivning krävs för bildgenerering.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            text: `Skapa en pedagogisk illustration för en svensk skoluppgift. Ämne: ${prompt}. Illustrationen ska vara tydlig, vänlig och hjälpsam för en förälder som förklarar för sitt barn. Undvik text i bilden om möjligt.`,
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
