-- Minimal migration for subscription + internal credits model
-- Run in Supabase SQL editor (Postgres)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_credits_total INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_credits_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_credits_remaining INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_ai_questions_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_image_analyses_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_illustrations_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_usage_date DATE DEFAULT CURRENT_DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_plan_type_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_plan_type_check CHECK (plan_type IN ('trial', 'plus', 'pro', 'none'));
  END IF;
END $$;

-- Normalize nullable counters for existing users
UPDATE public.users
SET
  monthly_credits_total = COALESCE(monthly_credits_total, 0),
  monthly_credits_used = COALESCE(monthly_credits_used, 0),
  monthly_credits_remaining = COALESCE(monthly_credits_remaining, 0),
  daily_ai_questions_used = COALESCE(daily_ai_questions_used, 0),
  daily_image_analyses_used = COALESCE(daily_image_analyses_used, 0),
  daily_illustrations_used = COALESCE(daily_illustrations_used, 0),
  daily_usage_date = COALESCE(daily_usage_date, CURRENT_DATE);
