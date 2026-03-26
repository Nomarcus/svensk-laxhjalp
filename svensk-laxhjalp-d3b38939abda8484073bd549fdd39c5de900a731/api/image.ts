import { GoogleGenAI } from '@google/genai';
import { checkSubscription } from './_subscriptionCheck';
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
async function getFirebaseAdmin() { const mod = await import('firebase-admin'); const admin = mod.default; if (!admin.apps?.length) { const sa = process.env.FIREBASE_SERVICE_ACCOUNT; if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) }); else admin.initializeApp(); } return admin; }
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  let uid: string;
  try { const admin = await getFirebaseAdmin(); const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]); uid = decoded.uid; } catch { return res.status(401).json({ error: 'Ogiltig token.' }); }
  const check = await checkSubscription(uid, 'illustration');
  if (!check.allowed) return res.status(check.statusCode).json({ error: check.error, upgradeRequired: true });
  try {
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
