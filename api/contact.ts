import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyApiSecurity } from './_lib/httpSecurity';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Alla fält krävs.' });
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safeMessage = message.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);
  if (!safeName || !safeMessage || !validEmail) {
    return res.status(400).json({ error: 'Kontrollera att alla fält är korrekt ifyllda.' });
  }
  if (safeName.length > 100 || safeEmail.length > 254 || safeMessage.length > 5000) {
    return res.status(413).json({ error: 'Kontaktmeddelandet är för långt.' });
  }

  const RECIPIENT = 'marcus.mpai@gmail.com';

  // Use Resend or a simple mailto-style approach via a free email API
  // For now, we'll use the Fetch API with a simple email service
  // If no email service is configured, log it and return success

  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Föräldrahjälpen <noreply@resend.dev>',
          to: RECIPIENT,
          subject: `Kontaktformulär: ${safeName}`,
          text: `Namn: ${safeName}\nE-post: ${safeEmail}\n\nMeddelande:\n${safeMessage}`,
          reply_to: safeEmail,
        }),
      });

      if (!response.ok) {
        console.error('Resend error:', await response.text());
        return res.status(500).json({ error: 'Kunde inte skicka meddelandet.' });
      }
    } catch (err) {
      console.error('Email send failed:', err);
      return res.status(500).json({ error: 'Kunde inte skicka meddelandet.' });
    }
  } else {
    // Do not silently claim delivery or write contact details to provider logs.
    return res.status(503).json({ error: 'Kontaktformuläret är tillfälligt inte konfigurerat.' });
  }

  return res.status(200).json({ ok: true });
}
