import type { Timestamp } from 'firebase/firestore';

export interface Child {
  id: string;
  name: string;
  grade?: string;
  ownerId: string;
  sharedWith?: string[];
  workspaceKind?: 'general' | 'teacher';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Timestamp | null;
  attachments?: string[];
  generatedImage?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Timestamp | null;
}

export type SubscriptionTier = 'free' | 'plus' | 'pro';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'none';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd?: Timestamp | string | null;
  cancelAtPeriodEnd?: boolean;
}
