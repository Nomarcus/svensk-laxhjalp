import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Alla fält krävs.' });
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
          subject: `Kontaktformulär: ${name}`,
          text: `Namn: ${name}\nE-post: ${email}\n\nMeddelande:\n${message}`,
          reply_to: email,
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
    // No email service configured — log the message for now
    console.log('=== CONTACT FORM ===');
    console.log(`From: ${name} <${email}>`);
    console.log(`Message: ${message}`);
    console.log('====================');
  }

  return res.status(200).json({ ok: true });
}
