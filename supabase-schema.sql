-- ==========================================
-- Supabase Schema for Svensk Läxhjälp
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- TABLES
-- ==========================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  photo_url TEXT,
  last_login TIMESTAMPTZ DEFAULT now(),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'plus', 'pro')),
  subscription_status TEXT NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'none')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  grade TEXT CHECK (grade IS NULL OR char_length(grade) <= 20),
  shared_with TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_children_owner ON public.children(owner_id);
CREATE INDEX idx_children_shared_with ON public.children USING GIN(shared_with);

CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_sessions_child ON public.chat_sessions(child_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content TEXT NOT NULL CHECK (char_length(content) < 50000),
  attachments TEXT[] DEFAULT '{}',
  generated_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_session ON public.messages(session_id);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  completed BOOLEAN DEFAULT false,
  week_number INT NOT NULL,
  year INT NOT NULL,
  date_type TEXT CHECK (date_type IS NULL OR date_type IN ('due', 'work')),
  work_days TEXT[] DEFAULT '{}',
  due_day TEXT,
  minutes_per_day INT,
  image_url TEXT,
  linked_chat_session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  ai_notes TEXT[] DEFAULT '{}',
  completed_days TEXT[] DEFAULT '{}',
  task_type TEXT DEFAULT 'homework' CHECK (task_type IN ('homework', 'exam')),
  exam_prep_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_child_week ON public.tasks(child_id, week_number, year);

CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content TEXT,
  type TEXT NOT NULL CHECK (type IN ('text', 'image')),
  image_url TEXT,
  subject TEXT CHECK (subject IS NULL OR char_length(subject) <= 100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_library_items_child ON public.library_items(child_id);

CREATE TABLE public.daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  chat_count INT DEFAULT 0,
  image_count INT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_usage_user_date ON public.daily_usage(user_id, date);

-- ==========================================
-- RLS POLICIES
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Helper function: can current user access this child?
CREATE OR REPLACE FUNCTION public.can_access_child(p_child_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id
      AND (
        owner_id = auth.uid()
        OR (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(shared_with)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- USERS policies
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- Trigger to protect subscription fields from client-side tampering
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    NEW.tier := OLD.tier;
    NEW.subscription_status := OLD.subscription_status;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.current_period_end := OLD.current_period_end;
    NEW.cancel_at_period_end := OLD.cancel_at_period_end;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_subscription_fields_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscription_fields();

-- CHILDREN policies
CREATE POLICY "children_select" ON public.children
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(shared_with)
  );

CREATE POLICY "children_insert" ON public.children
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "children_update" ON public.children
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "children_delete" ON public.children
  FOR DELETE USING (owner_id = auth.uid());

-- CHAT_SESSIONS policies
CREATE POLICY "chat_sessions_select" ON public.chat_sessions
  FOR SELECT USING (public.can_access_child(child_id));

CREATE POLICY "chat_sessions_insert" ON public.chat_sessions
  FOR INSERT WITH CHECK (public.can_access_child(child_id));

CREATE POLICY "chat_sessions_update" ON public.chat_sessions
  FOR UPDATE USING (public.can_access_child(child_id));

CREATE POLICY "chat_sessions_delete" ON public.chat_sessions
  FOR DELETE USING (public.can_access_child(child_id));

-- MESSAGES policies
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    public.can_access_child((SELECT child_id FROM public.chat_sessions WHERE id = session_id))
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    public.can_access_child((SELECT child_id FROM public.chat_sessions WHERE id = session_id))
  );

CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (
    public.can_access_child((SELECT child_id FROM public.chat_sessions WHERE id = session_id))
  );

-- TASKS policies
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (public.can_access_child(child_id));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (public.can_access_child(child_id));

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (public.can_access_child(child_id));

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (public.can_access_child(child_id));

-- LIBRARY_ITEMS policies
CREATE POLICY "library_select" ON public.library_items
  FOR SELECT USING (public.can_access_child(child_id));

CREATE POLICY "library_insert" ON public.library_items
  FOR INSERT WITH CHECK (public.can_access_child(child_id));

CREATE POLICY "library_delete" ON public.library_items
  FOR DELETE USING (public.can_access_child(child_id));

-- DAILY_USAGE policies (read-only for clients, server writes via service role)
CREATE POLICY "usage_select_own" ON public.daily_usage
  FOR SELECT USING (user_id = auth.uid());

-- ==========================================
-- RPC FUNCTIONS
-- ==========================================

-- Increment daily usage (used by server-side middleware)
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_field TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, date, chat_count, image_count)
  VALUES (p_user_id, CURRENT_DATE,
    CASE WHEN p_field = 'chat' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'image' THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    chat_count = CASE WHEN p_field = 'chat' THEN daily_usage.chat_count + 1 ELSE daily_usage.chat_count END,
    image_count = CASE WHEN p_field = 'image' THEN daily_usage.image_count + 1 ELSE daily_usage.image_count END,
    last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle completed day on a task
CREATE OR REPLACE FUNCTION public.toggle_completed_day(p_task_id UUID, p_day TEXT, p_add BOOLEAN)
RETURNS VOID AS $$
BEGIN
  IF p_add THEN
    UPDATE public.tasks
    SET completed_days = array_append(completed_days, p_day)
    WHERE id = p_task_id AND NOT (p_day = ANY(completed_days));
  ELSE
    UPDATE public.tasks
    SET completed_days = array_remove(completed_days, p_day),
        completed = false
    WHERE id = p_task_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Append AI note to a task
CREATE OR REPLACE FUNCTION public.append_ai_note(p_task_id UUID, p_note TEXT, p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.tasks
  SET ai_notes = array_append(ai_notes, p_note),
      linked_chat_session_id = p_session_id
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ENABLE REALTIME
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.children;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.library_items;
