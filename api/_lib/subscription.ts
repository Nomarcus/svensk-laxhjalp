import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, fieldValue } from './firebase';
import type { AuthUser } from './auth';

const FREE_CHAT_LIMIT = 3;
const FREE_IMAGE_LIMIT = 1;

export async function checkSubscription(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  route: 'chat' | 'image' | 'billing' | 'other'
): Promise<{ tier: string; allowed: boolean } | null> {
  if (route === 'billing' || route === 'other') {
    return { tier: 'free', allowed: true };
  }

  try {
    const userDoc = await db.doc(`users/${user.uid}`).get();
    const userData = userDoc.data() || {};
    const tier = userData.tier || 'free';
    const subscriptionStatus = userData.subscriptionStatus || 'none';

    // Pro users pass through
    if (tier === 'pro' && (subscriptionStatus === 'active' || subscriptionStatus === 'canceled')) {
      return { tier: 'pro', allowed: true };
    }

    // Free tier enforcement
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.doc(`users/${user.uid}/usage/${today}`);
    const usageDoc = await usageRef.get();
    const usage = usageDoc.data() || { chatCount: 0, imageCount: 0 };
    const chatCount = usage.chatCount || 0;
    const imageCount = usage.imageCount || 0;

    // Image generation - Pro only
    if (route === 'image') {
      res.status(403).json({
        error: 'Bildgenerering kräver Pro-abonnemang. Uppgradera för att skapa illustrationer.',
        upgradeRequired: true,
      });
      return null;
    }

    // Chat with image (image analysis)
    if (route === 'chat' && req.body?.imageBase64) {
      if (imageCount >= FREE_IMAGE_LIMIT) {
        res.status(403).json({
          error: `Du har använt din gratis bildanalys idag (${FREE_IMAGE_LIMIT}/dag). Uppgradera till Pro för obegränsade bildanalyser.`,
          upgradeRequired: true,
          limit: FREE_IMAGE_LIMIT,
          used: imageCount,
        });
        return null;
      }
      await usageRef.set(
        { imageCount: fieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true }
      );
      return { tier: 'free', allowed: true };
    }

    // Text chat
    if (route === 'chat') {
      if (chatCount >= FREE_CHAT_LIMIT) {
        res.status(429).json({
          error: `Du har använt dina ${FREE_CHAT_LIMIT} gratis frågor idag. Uppgradera till Pro för obegränsade frågor.`,
          upgradeRequired: true,
          limit: FREE_CHAT_LIMIT,
          used: chatCount,
        });
        return null;
      }
      await usageRef.set(
        { chatCount: fieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true }
      );
      return { tier: 'free', allowed: true };
    }

    return { tier, allowed: true };
  } catch (error: any) {
    console.error('Subscription check error:', error.message);
    return { tier: 'free', allowed: true }; // Don't block on errors
  }
}
