import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    if (!admin.apps.length) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (sa) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
      }
    }
    results['firebase'] = 'OK - apps: ' + admin.apps.length;
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
