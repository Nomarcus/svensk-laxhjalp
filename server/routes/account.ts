import { Router, Response } from 'express';
import admin from 'firebase-admin';
import { AuthenticatedRequest } from '../middleware/auth';
import { getServerFirestore } from '../lib/serverFirestore';

const router = Router();

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

// POST /api/account/delete — permanently deletes the caller's own account and all Firestore data.
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
