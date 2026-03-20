import { verifyAuth } from './_lib/auth';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    results['genai'] = typeof GoogleGenAI === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['genai'] = 'FAIL: ' + e.message;
  }

  try {
    const user = await verifyAuth(req, res);
    results['auth-import'] = 'OK (user: ' + JSON.stringify(user) + ')';
  } catch (e: any) {
    results['auth-import'] = 'FAIL: ' + e.message;
  }

  if (!res.headersSent) {
    res.json(results);
  }
}
