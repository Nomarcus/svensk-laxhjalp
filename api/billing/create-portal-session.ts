import Stripe from 'stripe';
import { verifyToken, getSupabaseAdmin } from '../../src/lib/supabase-server';

const CLIENT_URL = process.env.CLIENT_URL || 'https://svensk-laxhjalp.vercel.app';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid } = await verifyToken(req.headers.authorization);
    const supabase = getSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('stripe_customer_id').eq('id', uid).single();
    const customerId = userData?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'Inget abonnemang.' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: CLIENT_URL });
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Portal error:', error.message);
    res.status(500).json({ error: 'Portalen misslyckades.' });
  }
}
