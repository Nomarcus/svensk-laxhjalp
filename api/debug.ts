export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};

  // Test 1: dynamic import genai
  try {
    const { GoogleGenAI } = await import('@google/genai');
    results['genai'] = typeof GoogleGenAI === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['genai'] = 'FAIL: ' + e.message;
  }

  // Test 2: dynamic import auth
  try {
    const { verifyAuth } = await import('./_lib/auth');
    results['auth'] = typeof verifyAuth === 'function' ? 'OK' : 'FAIL';
  } catch (e: any) {
    results['auth'] = 'FAIL: ' + e.message;
  }

  res.json(results);
}
