/*
# Lock authenticated data access and protect subscription tiers

## Overview
Removes the original public/anonymous audit policies now that the product has
sign-in, restricts audit creation to safe user-entered fields, and ensures every
new account receives the free tier from the database rather than from browser input.

## Security changes
1. `seo_audits` is accessible only to the authenticated owner. Anonymous users can
   no longer read, create, update, or delete audit history.
2. Authenticated clients may insert only `url`, `status`, and `audit_type` columns.
   `user_id` remains database-controlled and is filled from `auth.uid()`.
3. `user_subscriptions` is read-only from the browser. Users cannot change their
   tier or create a paid-tier row themselves.
4. A database trigger creates a free subscription automatically when a new auth
   account is created.
5. `credit_usage` remains owner-scoped; clients can record usage for themselves,
   but cannot modify or delete historical usage rows.
*/

-- Remove legacy policies that allowed public access.
DROP POLICY IF EXISTS "anon_select_seo_audits" ON seo_audits;
DROP POLICY IF EXISTS "anon_insert_seo_audits" ON seo_audits;
DROP POLICY IF EXISTS "anon_update_seo_audits" ON seo_audits;
DROP POLICY IF EXISTS "anon_delete_seo_audits" ON seo_audits;

-- Keep authenticated ownership policies explicit and idempotent.
DROP POLICY IF EXISTS "select_own_audits" ON seo_audits;
CREATE POLICY "select_own_audits" ON seo_audits FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audits" ON seo_audits;
CREATE POLICY "insert_own_audits" ON seo_audits FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_audits" ON seo_audits;
CREATE POLICY "update_own_audits" ON seo_audits FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_audits" ON seo_audits;
CREATE POLICY "delete_own_audits" ON seo_audits FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Make ownership database-controlled while keeping the audit form insertable.
REVOKE INSERT ON seo_audits FROM authenticated;
GRANT INSERT (url, status, audit_type) ON seo_audits TO authenticated;

-- Subscription tier is operator-controlled, not user-controlled.
DROP POLICY IF EXISTS "insert_own_subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "update_own_subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "delete_own_subscription" ON user_subscriptions;
REVOKE INSERT, UPDATE, DELETE ON user_subscriptions FROM authenticated;

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

REVOKE EXECUTE ON FUNCTION public.create_free_subscription() FROM anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_free_subscription();

-- Usage history is append-only for the account that owns it.
DROP POLICY IF EXISTS "update_own_usage" ON credit_usage;
DROP POLICY IF EXISTS "delete_own_usage" ON credit_usage;
REVOKE UPDATE, DELETE ON credit_usage FROM authenticated;
