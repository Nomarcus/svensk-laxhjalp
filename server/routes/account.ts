import { Router, Response } from 'express';
import admin from 'firebase-admin';
import Stripe from 'stripe';
import { AuthenticatedRequest } from '../middleware/auth';
import { getServerFirestore } from '../lib/serverFirestore';

const router = Router();

let _stripe: Stripe | null = null;
function getStripeIfConfigured(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** Best-effort: cancel any active Stripe subscription so account deletion doesn't leave a dangling charge behind. */
async function cancelStripeSubscriptions(customerId: string | undefined): Promise<void> {
  if (!customerId) return;
  const stripe = getStripeIfConfigured();
  if (!stripe) return;
  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 25 });
    await Promise.all(
      subs.data
        .filter((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
        .map((s) =>
          stripe.subscriptions.cancel(s.id).catch((err) => console.warn('Failed to cancel subscription', s.id, err)),
        ),
    );
  } catch (err) {
    console.warn('Stripe subscription cleanup failed during account deletion:', err);
  }
}

/** Best-effort: drop this user's e-mail from any other parent's shared-child list. */
async function removeFromSharedChildren(email: string | undefined, ownUid: string): Promise<void> {
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
// POST (not DELETE) to match the CORS method allowlist shared with the rest of the API.
router.post('/account/delete', async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid;
  const email = req.email;
  if (!uid) {
    res.status(401).json({ error: 'Inte autentiserad.' });
    return;
  }

  try {
    const db = getServerFirestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    const customerId = userDoc.data()?.stripeCustomerId as string | undefined;

    await cancelStripeSubscriptions(customerId);
    await removeFromSharedChildren(email, uid);
    // Deletes users/{uid} and every nested subcollection (children, chatSessions, tasks, library, usage, …).
    await db.recursiveDelete(db.doc(`users/${uid}`));
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      // Data is already gone even if this fails; log for manual follow-up rather than failing the request.
      console.error(`Failed to delete Firebase Auth user ${uid} after data deletion:`, err);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Account deletion failed:', error);
    res.status(500).json({ error: 'Kunde inte radera kontot. Försök igen eller kontakta oss.' });
  }
});

export { router as accountRouter };
