import { auth } from '../firebase';
import { API_ORIGIN } from '../config';
import type { UserSubscription } from '../types';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${p}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Du måste logga in först.');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'API-anropet misslyckades.');
  return data;
}

export async function fetchSubscriptionStatus(): Promise<UserSubscription> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/billing/status'), { headers });
  return parseJson<UserSubscription>(res);
}

export async function sendChatMessage(input: {
  prompt: string;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  childGrade?: string;
  language?: string;
  simpleSwedish?: boolean;
}): Promise<string> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await parseJson<{ text?: string }>(res);
    return data.text || '';
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'AI-anropet misslyckades.');
  }

  const body = await res.text();
  let fullText = '';
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as { delta?: string; text?: string; done?: boolean; error?: string };
      if (event.error) throw new Error(event.error);
      if (event.delta) fullText += event.delta;
      if (event.done && typeof event.text === 'string') fullText = event.text;
    } catch (error) {
      if (error instanceof Error && eventErrorMessage(error)) throw error;
    }
  }
  return fullText;
}

function eventErrorMessage(error: Error): boolean {
  return error.message.length > 0 && error.message !== 'Unexpected end of JSON input';
}

export async function verifyApplePurchase(input: {
  productId: string;
  transactionId?: string;
  originalTransactionId?: string;
  transactionReceipt?: string;
}): Promise<UserSubscription> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/billing/apple/verify-purchase'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return parseJson<UserSubscription>(res);
}

export async function restoreApplePurchases(input: { originalTransactionId?: string; transactionReceipt?: string }): Promise<UserSubscription> {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/billing/apple/restore'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return parseJson<UserSubscription>(res);
}
