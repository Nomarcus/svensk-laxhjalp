import { verifyToken, getSupabaseAdmin } from '../../src/lib/supabase-server';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid } = await verifyToken(req.headers.authorization);
    const supabase = getSupabaseAdmin();

    const { data: userData } = await supabase.from('users').select('tier, subscription_status, current_period_end, cancel_at_period_end').eq('id', uid).single();
    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabase.from('daily_usage').select('chat_count, image_count').eq('user_id', uid).eq('date', today).single();

    res.json({
      tier: userData?.tier || 'free',
      status: userData?.subscription_status || 'none',
      currentPeriodEnd: userData?.current_period_end || null,
      cancelAtPeriodEnd: userData?.cancel_at_period_end || false,
      usage: {
        chatCount: usageData?.chat_count || 0,
        imageCount: usageData?.image_count || 0,
      },
    });
  } catch (error: any) {
    console.error('Status error:', error.message);
    res.status(500).json({ error: 'Status misslyckades.' });
  }
}
