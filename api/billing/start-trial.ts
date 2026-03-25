import { getSupabaseAdmin, verifyToken } from '../../src/lib/supabase-server';
import { startGuestTrial } from '../../src/lib/subscription';

const TRIAL_DAYS = 7;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let uid: string | null = null;
    const guestId = req.headers['x-guest-user-id'] as string | undefined;
    try {
      const verified = await verifyToken(req.headers.authorization);
      uid = verified.uid;
    } catch {
      if (!guestId) throw new Error('MISSING_AUTH_OR_GUEST');
    }

    if (!uid && guestId) {
      const guestTrial = startGuestTrial(guestId);
      if (!guestTrial.ok) return res.status(400).json({ error: guestTrial.error });
      return res.json({ ok: true, plan_type: 'trial', trial_ends_at: guestTrial.trial_ends_at, guest: true });
    }

    const supabase = getSupabaseAdmin();

    const { data: user } = await supabase
      .from('users')
      .select('plan_type, trial_started_at')
      .eq('id', uid!)
      .single();

    if (user?.trial_started_at || user?.plan_type === 'trial') {
      return res.status(400).json({ error: 'Gratisperioden har redan använts.' });
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    await supabase.from('users').update({
      plan_type: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      monthly_credits_total: 100,
      monthly_credits_used: 0,
      monthly_credits_remaining: 100,
      daily_ai_questions_used: 0,
      daily_image_analyses_used: 0,
      daily_illustrations_used: 0,
      daily_usage_date: now.toISOString().split('T')[0],
    }).eq('id', uid!);

    return res.json({ ok: true, plan_type: 'trial', trial_ends_at: trialEnd.toISOString() });
  } catch (error: any) {
    console.error('Start trial error:', error.message);
    if (error.message === 'MISSING_AUTH_OR_GUEST') {
      return res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
    }
    return res.status(500).json({ error: 'Kunde inte starta gratisperioden.' });
  }
}
