-- ==============================================================================
-- Technical Audit Dashboard — Full Database Schema Setup
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql/new
-- 2. Paste this entire script into the SQL Editor.
-- 3. Click "Run".
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: seo_audits
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  audit_type text NOT NULL DEFAULT 'single',
  audit_depth text NOT NULL DEFAULT 'deep',
  score integer,
  title text,
  description text,
  checks jsonb,
  result_data jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was partially created
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seo_audits' AND column_name = 'user_id') THEN
    ALTER TABLE public.seo_audits ADD COLUMN user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seo_audits' AND column_name = 'audit_type') THEN
    ALTER TABLE public.seo_audits ADD COLUMN audit_type text NOT NULL DEFAULT 'single';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seo_audits' AND column_name = 'audit_depth') THEN
    ALTER TABLE public.seo_audits ADD COLUMN audit_depth text NOT NULL DEFAULT 'deep';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seo_audits' AND column_name = 'result_data') THEN
    ALTER TABLE public.seo_audits ADD COLUMN result_data jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seo_audits_user_id ON public.seo_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_audits_audit_type ON public.seo_audits(audit_type);
CREATE INDEX IF NOT EXISTS idx_seo_audits_created_at ON public.seo_audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_audits_user_created ON public.seo_audits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_audits_url ON public.seo_audits(url);

ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audits" ON public.seo_audits;
CREATE POLICY "select_own_audits" ON public.seo_audits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audits" ON public.seo_audits;
CREATE POLICY "insert_own_audits" ON public.seo_audits FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_audits" ON public.seo_audits;
CREATE POLICY "update_own_audits" ON public.seo_audits FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_audits" ON public.seo_audits;
CREATE POLICY "delete_own_audits" ON public.seo_audits FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON public.seo_audits TO authenticated;
GRANT SELECT ON public.seo_audits TO anon;

-- ------------------------------------------------------------------------------
-- 2. Table: user_subscriptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscription" ON public.user_subscriptions;
CREATE POLICY "select_own_subscription" ON public.user_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.user_subscriptions TO authenticated;

-- Trigger to create free subscription on user signup
CREATE OR REPLACE FUNCTION public.create_free_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_free_subscription();

-- Backfill any existing users without a subscription row
INSERT INTO public.user_subscriptions (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Table: credit_usage
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_type text NOT NULL,
  audit_depth text NOT NULL DEFAULT 'deep',
  url_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_usage' AND column_name = 'audit_depth') THEN
    ALTER TABLE public.credit_usage ADD COLUMN audit_depth text NOT NULL DEFAULT 'deep';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_date ON public.credit_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_type ON public.credit_usage(user_id, audit_type, created_at DESC);

ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage" ON public.credit_usage;
CREATE POLICY "select_own_usage" ON public.credit_usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_usage" ON public.credit_usage;
CREATE POLICY "insert_own_usage" ON public.credit_usage FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.credit_usage TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Table: guest_credits (tracks anonymous audits by IP, 5 per day)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  used_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_credits_ip_date ON public.guest_credits(ip_address, used_date);

ALTER TABLE public.guest_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_guest_credits" ON public.guest_credits;
CREATE POLICY "anon_select_guest_credits" ON public.guest_credits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_guest_credits" ON public.guest_credits;
CREATE POLICY "anon_insert_guest_credits" ON public.guest_credits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_guest_credits" ON public.guest_credits;
CREATE POLICY "anon_update_guest_credits" ON public.guest_credits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.guest_credits TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. Table: contact_messages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT 'General Inquiry',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_contact_messages_authenticated" ON public.contact_messages;
CREATE POLICY "read_contact_messages_authenticated" ON public.contact_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_contact_messages_anyone" ON public.contact_messages;
CREATE POLICY "insert_contact_messages_anyone" ON public.contact_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT ON public.contact_messages TO authenticated;

-- Setup Complete
