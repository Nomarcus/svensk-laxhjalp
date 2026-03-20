import { verifyAuth } from './_lib/auth';
import { checkSubscription } from './_lib/subscription';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    results['genai'] = typeof GoogleGenAI === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['genai'] = 'FAIL: ' + e.message;
  }

  try {
    // Test auth (will fail without token, but shows if import works)
    const user = await verifyAuth(req, res);
    results['auth-import'] = 'OK (user: ' + JSON.stringify(user) + ')';
  } catch (e: any) {
    results['auth-import'] = 'FAIL: ' + e.message;
  }

  // Only send response if not already sent by verifyAuth
  if (!res.headersSent) {
    res.json(results);
  }
}
