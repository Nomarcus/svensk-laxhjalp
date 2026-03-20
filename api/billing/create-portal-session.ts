import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_lib/auth';
import { getDb } from '../_lib/firebase';
import { getStripe } from '../_lib/stripe';

const CLIENT_URL = process.env.CLIENT_URL || 'https://svensk-laxhjalp.vercel.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req, res);
  if (!user) return;

  try {
    const db = await getDb();
    const userDoc = await db.doc(`users/${user.uid}`).get();
    const customerId = userDoc.data()?.stripeCustomerId;

    if (!customerId) {
      res.status(400).json({ error: 'Inget aktivt abonnemang hittades.' });
      return;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: CLIENT_URL,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Portal session error:', error.message);
    res.status(500).json({ error: 'Kunde inte öppna abonnemangsportalen.' });
  }
}
