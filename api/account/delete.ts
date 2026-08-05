import Stripe from 'stripe';
import { getServerFirestore } from '../../server/lib/serverFirestore';
import { applyApiSecurity } from '../_lib/httpSecurity';

async function getFirebaseAdmin() {
  const mod = await import('firebase-admin');
  const admin = mod.default;
  if (!admin.apps?.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    else admin.initializeApp();
  }
  return admin;
}

async function cancelStripeSubscriptions(customerId: string | undefined): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!customerId || !key) return;
  try {
    const stripe = new Stripe(key);
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 25 });
    await Promise.all(
      subs.data
        .filter((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
        .map((s) => stripe.subscriptions.cancel(s.id).catch((err) => console.warn('Failed to cancel subscription', s.id, err))),
    );
  } catch (err) {
    console.warn('Stripe subscription cleanup failed during account deletion:', err);
  }
}

async function removeFromSharedChildren(admin: Awaited<ReturnType<typeof getFirebaseAdmin>>, email: string | undefined, ownUid: string): Promise<void> {
  if (!email) return;
  try {
    const db = getServerFirestore();
    const snapshot = await db.collectionGroup('children').where('sharedWith', 'array-contains', email).get();
    await Promise.all(
      snapshot.docs
        .filter((doc) => !doc.ref.path.startsWith(`users/${ownUid}/`))
        .map((doc) =>
          doc.ref
            .update({ sharedWith: admin.firestore.FieldValue.arrayRemove(email) })
            .catch((err) => console.warn('Failed to unshare child', doc.ref.path, err)),
        ),
    );
  } catch (err) {
    console.warn('Shared-child cleanup failed during account deletion:', err);
  }
}

// POST /api/account/delete — permanently deletes the caller's own account, subscription and all Firestore data.
export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });

  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const uid = decoded.uid;
    const email = decoded.email as string | undefined;

    const db = getServerFirestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    const customerId = userDoc.data()?.stripeCustomerId as string | undefined;

    await cancelStripeSubscriptions(customerId);
    await removeFromSharedChildren(admin, email, uid);
    await db.recursiveDelete(db.doc(`users/${uid}`));
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      console.error(`Failed to delete Firebase Auth user ${uid} after data deletion:`, err);
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Account deletion failed:', error.message || error);
    res.status(500).json({ error: 'Kunde inte radera kontot. Försök igen eller kontakta oss.' });
  }
}
