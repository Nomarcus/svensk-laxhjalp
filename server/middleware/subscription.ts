import { Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../src/lib/supabase-server';
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
  // Skip billing routes and health check
  if (req.path.startsWith('/billing') || req.path === '/health') {
    next();
    return;
  }

  if (!req.uid) {
    res.status(401).json({ error: 'Inte autentiserad.' });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    // Read user subscription tier
    const { data: userData } = await supabase.from('users').select('tier, subscription_status').eq('id', req.uid).single();
    const tier = userData?.tier || 'free';
    const subscriptionStatus = userData?.subscription_status || 'none';

    req.tier = tier;

    // Pro users with active subscription pass through
    if (tier === 'pro' && (subscriptionStatus === 'active' || subscriptionStatus === 'canceled')) {
      next();
      return;
    }

    // Free tier enforcement
    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabase.from('daily_usage').select('chat_count, image_count').eq('user_id', req.uid).eq('date', today).single();

    const chatCount = usageData?.chat_count || 0;
    const imageCount = usageData?.image_count || 0;

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
      await supabase.rpc('increment_usage', { p_user_id: req.uid, p_field: 'image' });
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
      await supabase.rpc('increment_usage', { p_user_id: req.uid, p_field: 'chat' });
      next();
      return;
    }

    // All other routes pass through
    next();
  } catch (error: any) {
    console.error('Subscription middleware error:', error.message);
    next();
  }
}
