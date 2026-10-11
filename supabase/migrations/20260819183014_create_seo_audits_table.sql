/*
# SEO Audit Dashboard — Database Schema

## Overview
Creates the tables needed for an SEO audit dashboard that fetches staging site URLs
and runs on-page, off-page, and technical SEO checks. Each audit stores the URL
analyzed, the overall score, the full per-check results as JSON, and timestamps.

This is a single-tenant app (no sign-in), so policies allow anon + authenticated CRUD.

## Tables

### `seo_audits`
- `id` (uuid, primary key)
- `url` (text, not null) — the staging URL that was audited
- `status` (text, not null, default 'pending') — pending | running | completed | failed
- `score` (integer, nullable) — overall SEO score 0-100, set when audit completes
- `title` (text, nullable) — page <title> content
- `description` (text, nullable) — meta description content
- `checks` (jsonb, nullable) — full structured results of every check
- `error` (text, nullable) — error message if the audit failed
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Indexes
- `seo_audits_created_at_idx` on `created_at DESC` — history list ordering
- `seo_audits_url_idx` on `url` — filtering by URL

## Security
- RLS enabled on `seo_audits`.
- Four CRUD policies (select/insert/update/delete) scoped to `anon, authenticated`
  because the app has no sign-in screen and the data is intentionally shared.
*/

CREATE TABLE IF NOT EXISTS seo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  score integer,
  title text,
  description text,
  checks jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_audits_created_at_idx ON seo_audits (created_at DESC);
CREATE INDEX IF NOT EXISTS seo_audits_url_idx ON seo_audits (url);

ALTER TABLE seo_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_seo_audits" ON seo_audits;
CREATE POLICY "anon_select_seo_audits" ON seo_audits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_seo_audits" ON seo_audits;
CREATE POLICY "anon_insert_seo_audits" ON seo_audits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_seo_audits" ON seo_audits;
CREATE POLICY "anon_update_seo_audits" ON seo_audits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_seo_audits" ON seo_audits;
CREATE POLICY "anon_delete_seo_audits" ON seo_audits FOR DELETE
  TO anon, authenticated USING (true);
