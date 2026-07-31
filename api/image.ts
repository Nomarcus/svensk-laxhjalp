import { applyApiSecurity } from './_lib/httpSecurity';

/**
 * Thin proxy to the Cloud Run backend (server/routes/ai.ts).
 * See api/chat.ts for why this no longer calls Gemini directly.
 */
const CLOUD_RUN_API_ORIGIN =
  process.env.CLOUD_RUN_API_ORIGIN || 'https://laxhjalp-api-288867992327.europe-west1.run.app';

export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ingen autentisering.' });
  }

  try {
    const upstream = await fetch(`${CLOUD_RUN_API_ORIGIN}/api/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(upstream.status);

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
    console.error('Image proxy error:', error instanceof Error ? error.message : error);
    res.status(502).json({ error: 'Kunde inte nå AI-tjänsten. Försök igen.' });
  }
}
