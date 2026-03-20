import { getDb, getAuthAdmin } from './_lib/firebase';

export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    const authAdmin = await getAuthAdmin();
    results['firebase-auth'] = typeof authAdmin.verifyIdToken === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['firebase-auth'] = 'FAIL: ' + e.message;
  }

  try {
    const db = await getDb();
    results['firebase-db'] = typeof db.doc === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['firebase-db'] = 'FAIL: ' + e.message;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    results['genai'] = 'OK';
  } catch (e: any) {
    results['genai'] = 'FAIL: ' + e.message;
  }

  res.json(results);
}
