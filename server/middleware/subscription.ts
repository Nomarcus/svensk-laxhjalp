import { Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AuthenticatedRequest } from './auth';

export interface SubscriptionRequest extends AuthenticatedRequest {
  tier?: 'free' | 'pro';
  dailyChatCount?: number;
  dailyImageCount?: number;
}

const FREE_CHAT_LIMIT = 3;
const FREE_IMAGE_LIMIT = 1;

export async function subscriptionMiddleware(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip billing, admin analytics, and health check
  if (
    req.path.startsWith('/billing')
    || req.path.startsWith('/admin')
    || req.path === '/health'
  ) {
    next();
    return;
  }

  if (!req.uid) {
    res.status(401).json({ error: 'Inte autentiserad.' });
    return;
  }

  try {
    // Read user subscription tier
    const userDoc = await admin.firestore().doc(`users/${req.uid}`).get();
    const userData = userDoc.data() || {};
    const tier = userData.tier || 'free';
    const subscriptionStatus = userData.subscriptionStatus || 'none';

    req.tier = tier;

    // Pro users with active subscription pass through
    if (tier === 'pro' && (subscriptionStatus === 'active' || subscriptionStatus === 'canceled')) {
      // canceled but still in period = still pro
      next();
      return;
    }

    // Free tier enforcement
    const today = new Date().toISOString().split('T')[0];
    const usageRef = admin.firestore().doc(`users/${req.uid}/usage/${today}`);
    const usageDoc = await usageRef.get();
    const usage = usageDoc.data() || { chatCount: 0, imageCount: 0 };

    const chatCount = usage.chatCount || 0;
    const imageCount = usage.imageCount || 0;

    req.dailyChatCount = chatCount;
    req.dailyImageCount = imageCount;

    // Image generation (not analysis) - Pro only
    if (req.path === '/image') {
      res.status(403).json({
        error: 'Bildgenerering kräver Pro-abonnemang. Uppgradera för att skapa illustrationer.',
        upgradeRequired: true,
      });
      return;
    }

    // Chat with image (image analysis)
    if (req.path === '/chat' && req.body?.imageBase64) {
      if (imageCount >= FREE_IMAGE_LIMIT) {
        res.status(403).json({
          error: `Du har använt din gratis bildanalys idag (${FREE_IMAGE_LIMIT}/dag). Uppgradera till Pro för obegränsade bildanalyser.`,
          upgradeRequired: true,
          limit: FREE_IMAGE_LIMIT,
          used: imageCount,
        });
        return;
      }
      // Increment image count
      await usageRef.set(
        { imageCount: admin.firestore.FieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true }
      );
      next();
      return;
    }

    // Text chat
    if (req.path === '/chat') {
      if (chatCount >= FREE_CHAT_LIMIT) {
        res.status(429).json({
          error: `Du har använt dina ${FREE_CHAT_LIMIT} gratis frågor idag. Uppgradera till Pro för obegränsade frågor.`,
          upgradeRequired: true,
          limit: FREE_CHAT_LIMIT,
          used: chatCount,
        });
        return;
      }
      // Increment chat count
      await usageRef.set(
        { chatCount: admin.firestore.FieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true }
      );
      next();
      return;
    }

    // All other routes pass through
    next();
  } catch (error: any) {
    console.error('Subscription middleware error:', error.message);
    // On error, allow request through (don't block users due to internal errors)
    next();
  }
}
