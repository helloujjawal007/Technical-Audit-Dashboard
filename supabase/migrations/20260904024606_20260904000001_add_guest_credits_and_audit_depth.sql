/*
# Add Guest Credits Tracking and Audit Depth Selection

## Overview
1. Creates `guest_credits` table to track daily credit usage for guest (non-logged-in) users by IP address.
   - Guests get 5 audits per day per IP.
2. Adds `audit_depth` column to `seo_audits` to track which audit type was run: 'deep', 'standard', or 'basic'.
3. Adds `audit_depth` column to `credit_usage` for tracking credits by audit depth.

## New Tables
### guest_credits
- `id` (uuid, primary key)
- `ip_address` (text, not null) — the guest user's IP
- `used_date` (date, not null) — the date of usage (for daily reset)
- `count` (integer, default 1) — number of audits used that day
- `created_at` (timestamptz)

## Modified Tables
### seo_audits
- Added `audit_depth` column (text, default 'deep') — 'deep', 'standard', or 'basic'
### credit_usage
- Added `audit_depth` column (text, default 'deep') — 'deep', 'standard', or 'basic'

## Security
- guest_credits: allows anon + authenticated INSERT and SELECT (guest tracking is intentionally public)
- seo_audits: keeps existing owner-scoped policies, adds audit_depth to allowed insert columns
*/

-- Create guest_credits table
CREATE TABLE IF NOT EXISTS guest_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  used_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guest_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_guest_credits" ON guest_credits;
CREATE POLICY "anon_select_guest_credits" ON guest_credits FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_guest_credits" ON guest_credits;
CREATE POLICY "anon_insert_guest_credits" ON guest_credits FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_guest_credits" ON guest_credits;
CREATE POLICY "anon_update_guest_credits" ON guest_credits FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_guest_credits_ip_date ON guest_credits(ip_address, used_date);

-- Add audit_depth to seo_audits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seo_audits' AND column_name = 'audit_depth'
  ) THEN
    ALTER TABLE seo_audits ADD COLUMN audit_depth text DEFAULT 'deep';
  END IF;
END $$;

-- Add audit_depth to credit_usage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_usage' AND column_name = 'audit_depth'
  ) THEN
    ALTER TABLE credit_usage ADD COLUMN audit_depth text DEFAULT 'deep';
  END IF;
END $$;

-- Allow inserting audit_depth on seo_audits
REVOKE INSERT ON seo_audits FROM authenticated;
GRANT INSERT (url, status, audit_type, audit_depth) ON seo_audits TO authenticated;
