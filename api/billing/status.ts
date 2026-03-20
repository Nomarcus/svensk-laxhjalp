
import { verifyAuth } from '../_lib/auth';
import { getDb } from '../_lib/firebase';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req, res);
  if (!user) return;

  try {
    const db = await getDb();
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
      usage: { chatCount: usage.chatCount || 0, imageCount: usage.imageCount || 0 },
    });
  } catch (error: any) {
    console.error('Billing status error:', error.message);
    res.status(500).json({ error: 'Kunde inte hämta abonnemangsstatus.' });
  }
}
