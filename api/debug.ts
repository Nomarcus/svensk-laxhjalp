import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const results: Record<string, string> = {};

  try {
    const admin = await import('firebase-admin');
    results['firebase-admin'] = 'OK - type: ' + typeof admin.default;
    results['firebase-admin-apps'] = String(admin.apps?.length ?? admin.default?.apps?.length ?? 'none');
  } catch (e: any) {
    results['firebase-admin'] = 'FAIL: ' + e.message;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    results['genai'] = 'OK';
    results['GEMINI_API_KEY'] = process.env.GEMINI_API_KEY ? 'SET (' + process.env.GEMINI_API_KEY.slice(0, 8) + '...)' : 'NOT SET';
  } catch (e: any) {
    results['genai'] = 'FAIL: ' + e.message;
  }

  results['FIREBASE_SERVICE_ACCOUNT'] = process.env.FIREBASE_SERVICE_ACCOUNT ? 'SET (' + process.env.FIREBASE_SERVICE_ACCOUNT.slice(0, 30) + '...)' : 'NOT SET';
  results['node'] = process.version;

  res.json(results);
}
