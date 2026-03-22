import Stripe from 'stripe';
import { verifyToken, getSupabaseAdmin } from '../../src/lib/supabase-server';

const CLIENT_URL = process.env.CLIENT_URL || 'https://svensk-laxhjalp.vercel.app';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, email } = await verifyToken(req.headers.authorization);
    if (!email) return res.status(400).json({ error: 'E-post kravs.' });

    const { priceId } = req.body;
    const priceMap: Record<string, string | undefined> = { monthly: process.env.STRIPE_PRICE_ID_MONTHLY, yearly: process.env.STRIPE_PRICE_ID_YEARLY };
    const stripePriceId = priceMap[priceId] || priceId;
    if (!stripePriceId) return res.status(400).json({ error: 'Ogiltigt pris.' });

    const supabase = getSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('stripe_customer_id').eq('id', uid).single();
    let customerId = userData?.stripe_customer_id;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    if (!customerId) {
      const c = await stripe.customers.create({ email, metadata: { uid } });
      customerId = c.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', uid);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: CLIENT_URL + '?subscription=success',
      cancel_url: CLIENT_URL + '?subscription=canceled',
      metadata: { uid },
      subscription_data: { metadata: { uid } },
      locale: 'sv',
    });
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ error: 'Betalning misslyckades.' });
  }
}
