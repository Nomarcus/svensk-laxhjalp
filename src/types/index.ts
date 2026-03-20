import { Timestamp } from 'firebase/firestore';

export interface Child {
  id: string;
  name: string;
  grade?: string;
  ownerId: string;
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

export interface Task {
  id: string;
  day: string;
  subject: string;
  description: string;
  completed: boolean;
  weekNumber?: number;
  year?: number;
  /** 'due' = inlämningsdag, 'work' = arbetsdag */
  dateType?: 'due' | 'work';
  /** Om dateType='due': vilka dagar ska barnet jobba med läxan */
  workDays?: string[];
  /** Om dateType='work': vilken dag lämnas läxan in */
  dueDay?: string;
  /** Minuter per dag att lägga på läxan */
  minutesPerDay?: number;
  /** Foto av läxan (base64 data URI) */
  imageUrl?: string;
  /** Kopplad AI-chattsession */
  linkedChatSessionId?: string;
  /** AI-svar sparade till uppgiften */
  aiNotes?: string[];
}

export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'none';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Timestamp | null;
  cancelAtPeriodEnd?: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  content?: string;
  type: 'text' | 'image';
  imageUrl?: string;
  createdAt: Timestamp | null;
  subject?: string;
}
