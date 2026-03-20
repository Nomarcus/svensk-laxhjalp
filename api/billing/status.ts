import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_lib/auth';
import { db } from '../_lib/firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = await verifyAuth(req, res);
  if (!user) return;

  try {
    const userDoc = await db.doc(`users/${user.uid}`).get();
    const data = userDoc.data() || {};

    const today = new Date().toISOString().split('T')[0];
    const usageDoc = await db.doc(`users/${user.uid}/usage/${today}`).get();
    const usage = usageDoc.data() || { chatCount: 0, imageCount: 0 };

    res.json({
      tier: data.tier || 'free',
      status: data.subscriptionStatus || 'none',
      currentPeriodEnd: data.currentPeriodEnd || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      usage: {
        chatCount: usage.chatCount || 0,
        imageCount: usage.imageCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Billing status error:', error.message);
    res.status(500).json({ error: 'Kunde inte hämta abonnemangsstatus.' });
  }
}
