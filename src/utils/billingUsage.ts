import { auth } from '../firebase';
import { apiUrl } from './apiBase';

export type BillingStatusResponse = {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: { chatCount: number; imageCount: number; aiTtsCount: number };
  metered: boolean;
  /** När true: visa gratis-kvot i UI (oberoende av ENFORCE_SUBSCRIPTION_LIMITS). */
  showFreeQuota?: boolean;
  limits: { chatDaily: number; imageInChatDaily: number; aiTtsDaily: number } | null;
  remaining: { chat: number; imageInChat: number; aiTts: number } | null;
};

export async function fetchBillingStatus(): Promise<BillingStatusResponse | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  const res = await fetch(apiUrl('/api/billing/status'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as BillingStatusResponse;
}
