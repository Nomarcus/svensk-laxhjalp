import { applyApiSecurity } from './_lib/httpSecurity';

/**
 * Thin proxy to the Cloud Run backend (server/routes/ai.ts).
 *
 * This used to be a second, independent Gemini integration with its own system
 * prompt, model selection, and no subscription/usage-limit enforcement — that
 * meant anyone reaching the app via the Vercel-served domain got unmetered
 * access to a paid Gemini key. Cloud Run is the single source of truth now:
 * auth, free-tier limits, caching, streaming, and prompts all live there.
 */
const CLOUD_RUN_API_ORIGIN =
  process.env.CLOUD_RUN_API_ORIGIN || 'https://laxhjalp-api-288867992327.europe-west1.run.app';

export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
  }

  try {
    const upstream = await fetch(`${CLOUD_RUN_API_ORIGIN}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(req.body),
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error('Chat proxy error:', error instanceof Error ? error.message : error);
    res.status(502).json({ error: 'Kunde inte nå AI-tjänsten. Försök igen.' });
  }
}
