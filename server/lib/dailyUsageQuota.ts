import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export type DailyUsageField = 'chatCount' | 'imageCount' | 'aiTtsCount';

export type QuotaReservation =
  | { allowed: true; previousCount: number }
  | { allowed: false; previousCount: number };

/**
 * Atomically checks and reserves one unit of daily usage.
 *
 * Reserving before the external provider call deliberately counts failed provider
 * calls. This fail-closed behavior prevents parallel requests from exceeding the
 * paid quota and unexpectedly increasing the operator's bill.
 */
export async function reserveDailyUsage(
  db: Firestore,
  usageRef: DocumentReference,
  field: DailyUsageField,
  limit: number | null,
): Promise<QuotaReservation> {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const raw = snapshot.data()?.[field];
    const previousCount = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : 0;

    if (limit !== null && previousCount >= limit) {
      return { allowed: false as const, previousCount };
    }

    transaction.set(
      usageRef,
      {
        [field]: FieldValue.increment(1),
        lastUpdated: new Date().toISOString(),
      },
      { merge: true },
    );
    return { allowed: true as const, previousCount };
  });
}
