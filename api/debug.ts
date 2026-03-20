import { db, authAdmin } from './_lib/firebase';
import { GoogleGenAI } from '@google/genai';

export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    // Test firebase auth
    results['firebase-auth'] = typeof authAdmin.verifyIdToken === 'function' ? 'OK' : 'FAIL';
    results['firebase-db'] = typeof db.doc === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['firebase'] = 'FAIL: ' + e.message;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    results['genai'] = 'OK';
  } catch (e: any) {
    results['genai'] = 'FAIL: ' + e.message;
  }

  res.json(results);
}
