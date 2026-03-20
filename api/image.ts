
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from './_lib/auth';
import { checkSubscription } from './_lib/subscription';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = await verifyAuth(req, res);
  if (!user) return;

  const sub = await checkSubscription(req, res, user, 'image');
  if (!sub) return;

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
}
