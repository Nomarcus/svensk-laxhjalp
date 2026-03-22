import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../src/lib/supabase-server';

export const config = { api: { bodyParser: false } };

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) return res.status(400).json({ error: 'Missing signature.' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await getRawBody(req), sig, webhookSecret);
  } catch {
    return res.status(400).json({ error: 'Signature failed.' });
  }

  const supabase = getSupabaseAdmin();

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const uid = s.metadata?.uid;
      if (uid && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        await supabase.from('users').update({
          tier: 'pro',
          subscription_status: 'active',
          stripe_subscription_id: sub.id,
          stripe_customer_id: s.customer as string,
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: (sub as any).cancel_at_period_end,
        }).eq('id', uid);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.uid;
      if (uid) {
        await supabase.from('users').update({
          tier: sub.status === 'active' ? 'pro' : 'free',
          subscription_status: sub.status === 'active' ? 'active' : 'past_due',
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: (sub as any).cancel_at_period_end,
        }).eq('id', uid);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.uid;
      if (uid) {
        await supabase.from('users').update({
          tier: 'free',
          subscription_status: 'none',
          stripe_subscription_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
        }).eq('id', uid);
      }
    } else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice;
      const { data: users } = await supabase.from('users').select('id').eq('stripe_customer_id', inv.customer as string).limit(1);
      if (users && users.length > 0) {
        await supabase.from('users').update({ subscription_status: 'past_due' }).eq('id', users[0].id);
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: 'Webhook failed.' });
  }
}
