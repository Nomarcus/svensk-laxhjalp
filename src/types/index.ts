export interface Child {
  id: string;
  name: string;
  grade?: string;
  owner_id: string;
  shared_with?: string[];
  created_at?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  created_at: string | null;
  attachments?: string[];
  generated_image?: string;
  session_id?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string | null;
  child_id?: string;
}

export interface Task {
  id: string;
  day: string;
  subject: string;
  description: string;
  completed: boolean;
  week_number?: number;
  year?: number;
  date_type?: 'due' | 'work';
  work_days?: string[];
  due_day?: string;
  minutes_per_day?: number;
  image_url?: string;
  linked_chat_session_id?: string;
  ai_notes?: string[];
  completed_days?: string[];
  task_type?: 'homework' | 'exam';
  exam_prep_content?: string;
  child_id?: string;
  created_at?: string;
}

export type SubscriptionTier = 'free' | 'plus' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'none';
export type PlanType = 'trial' | 'plus' | 'pro' | 'none';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  plan_type?: PlanType;
  trial_ends_at?: string | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  content?: string;
  type: 'text' | 'image';
  image_url?: string;
  created_at: string | null;
  subject?: string;
  child_id?: string;
}
