import { getServerFirestore } from './serverFirestore';

const DEFAULT_EVENT_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days
const COLLECTION = 'stripeWebhookEvents';

function duplicateError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 6 || code === '6' || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

export async function reserveStripeWebhookEvent(
  eventId: string,
  ttlMs: number = DEFAULT_EVENT_TTL_MS,
): Promise<boolean> {
  const now = Date.now();
  const ref = getServerFirestore().collection(COLLECTION).doc(eventId);
  try {
    await ref.create({
      eventId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    });
    return true;
  } catch (err) {
    if (duplicateError(err)) return false;
    throw err;
  }
}
