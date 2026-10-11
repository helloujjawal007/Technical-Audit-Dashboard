/*
# Add Authentication, Credit System, and Audit Type Tracking

## Overview
This migration adds multi-user authentication support, a credit/usage tracking system,
and audit type classification to the existing SEO audit platform. It converts the
single-tenant app to a multi-tenant app where each user sees only their own audits.

## Changes to existing tables

### seo_audits (modified)
- Added `user_id` column (uuid, nullable, defaults to auth.uid()) — links each audit
  to the authenticated user who created it. Existing rows remain NULL (legacy data).
  New rows always get auth.uid() from the DEFAULT.
- Added `audit_type` column (text) — classifies the audit as 'single', 'multiple',
  'crawl', or 'staging' so history can be grouped by type.
- Added index on `user_id` for faster per-user queries.
- Added index on `audit_type` for faster filtering.
- Updated RLS policies to be owner-scoped (authenticated users see only their own audits).

## New Tables

### user_subscriptions
Stores each user's subscription tier and credit allocation.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, unique) — one row per user
- `tier` (text, default 'free') — subscription tier ('free', 'pro', etc.)
- `created_at` (timestamptz)

### credit_usage
Tracks each audit action against the user's credit limits, with rolling window support.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users) — who used the credit
- `audit_type` (text) — 'single', 'multiple', 'crawl', or 'staging'
- `url_count` (integer, default 1) — number of URLs in the audit (1 for single page)
- `created_at` (timestamptz) — when the credit was used (for rolling window calculation)
- Index on `user_id` + `created_at` for fast rolling-window queries.
- Index on `user_id` + `audit_type` for fast per-type queries.

## Security (RLS)
- seo_audits: owner-scoped CRUD (authenticated users can only access their own rows)
- user_subscriptions: owner-scoped SELECT (users can read their own subscription)
- credit_usage: owner-scoped SELECT and INSERT (users can read their own usage and
  insert new usage rows; the DEFAULT auth.uid() on user_id makes inserts work)

## Credit Limits (Free Tier)
- Single Page: 20 per day
- Multiple Pages: 50 per 28 days
- Full Domain Crawl: 100 per 28 days
- Staging: 50 URL-lists per 28 days

## Notes
1. The user_id columns default to auth.uid() so frontend inserts that omit user_id
   still satisfy RLS WITH CHECK constraints.
2. Existing seo_audits rows keep NULL user_id (legacy data from before auth).
   New rows always get auth.uid() from the DEFAULT.
3. Credit limit enforcement happens in the frontend before starting an audit.
*/

-- Add user_id and audit_type to seo_audits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seo_audits' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE seo_audits ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seo_audits' AND column_name = 'audit_type'
  ) THEN
    ALTER TABLE seo_audits ADD COLUMN audit_type text DEFAULT 'single';
  END IF;
END $$;

-- Add foreign key constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_audits_user_id_fkey'
  ) THEN
    ALTER TABLE seo_audits
    ADD CONSTRAINT seo_audits_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_seo_audits_user_id ON seo_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_audits_audit_type ON seo_audits(audit_type);
CREATE INDEX IF NOT EXISTS idx_seo_audits_user_created ON seo_audits(user_id, created_at DESC);

-- Update RLS policies on seo_audits to be owner-scoped
ALTER TABLE seo_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audits" ON seo_audits;
CREATE POLICY "select_own_audits"
ON seo_audits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audits" ON seo_audits;
CREATE POLICY "insert_own_audits"
ON seo_audits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_audits" ON seo_audits;
CREATE POLICY "update_own_audits"
ON seo_audits FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_audits" ON seo_audits;
CREATE POLICY "delete_own_audits"
ON seo_audits FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscription" ON user_subscriptions;
CREATE POLICY "select_own_subscription"
ON user_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subscription" ON user_subscriptions;
CREATE POLICY "insert_own_subscription"
ON user_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subscription" ON user_subscriptions;
CREATE POLICY "update_own_subscription"
ON user_subscriptions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create credit_usage table
CREATE TABLE IF NOT EXISTS credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_type text NOT NULL,
  url_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage" ON credit_usage;
CREATE POLICY "select_own_usage"
ON credit_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_usage" ON credit_usage;
CREATE POLICY "insert_own_usage"
ON credit_usage FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Indexes for credit_usage
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_date ON credit_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_type ON credit_usage(user_id, audit_type, created_at DESC);
