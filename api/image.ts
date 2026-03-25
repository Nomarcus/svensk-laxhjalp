import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin, verifyToken } from '../src/lib/supabase-server';
import { deductCredits, enforceUsageAccess } from '../src/lib/subscription';

const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid: string;
  try {
    const verified = await verifyToken(req.headers.authorization);
    uid = verified.uid;
  } catch {
    return res.status(401).json({ error: 'Ogiltig token.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const access = await enforceUsageAccess(supabase, uid, 'illustration');
    if (!access.ok) {
      return res.status(access.status || 403).json({ error: access.error, state: access.state || 'expired' });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Beskrivning kravs.' });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: 'Skapa en pedagogisk illustration för barn: ' + prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1' }
      }
    });
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          await deductCredits(supabase, uid, 'illustration');
          return res.json({ imageData: `data:${mimeType};base64,${part.inlineData.data}` });
        }
      }
    }
    res.json({ imageData: null });
  } catch (error: any) {
    console.error('Image generation error:', error.message, error.stack);
    res.status(500).json({ error: 'Bildgenerering misslyckades: ' + (error.message || 'Okänt fel') });
  }
}
