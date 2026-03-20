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
    const { priceId } = req.body;

    if (!user.email) {
      res.status(400).json({ error: 'Du behöver ett konto med e-post för att prenumerera. Gästkonton stöds inte.' });
      return;
    }

    const priceMap: Record<string, string | undefined> = {
      monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ID_YEARLY,
    };
    const stripePriceId = priceMap[priceId] || priceId;

    if (!stripePriceId) {
      res.status(400).json({ error: 'Ogiltigt pris-ID.' });
      return;
    }

    const userDoc = await db.doc(`users/${user.uid}`).get();
    const userData = userDoc.data();
    let customerId = userData?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { firebaseUID: user.uid },
      });
      customerId = customer.id;
      await db.doc(`users/${user.uid}`).set({ stripeCustomerId: customerId }, { merge: true });
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${CLIENT_URL}?subscription=success`,
      cancel_url: `${CLIENT_URL}?subscription=canceled`,
      metadata: { firebaseUID: user.uid },
      subscription_data: { metadata: { firebaseUID: user.uid } },
      locale: 'sv',
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error.message);
    res.status(500).json({ error: 'Kunde inte skapa betalningssession.' });
  }
}
