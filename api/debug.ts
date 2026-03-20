import { verifyAuth } from '../lib/auth';
import { GoogleGenAI } from '@google/genai';

export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};
  results['genai'] = typeof GoogleGenAI === 'function' ? 'OK' : 'FAIL';
  results['auth'] = typeof verifyAuth === 'function' ? 'OK' : 'FAIL';
  res.json(results);
}
