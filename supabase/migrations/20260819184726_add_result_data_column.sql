/*
# Add result_data column to seo_audits

## Overview
Adds a `result_data` JSONB column to the `seo_audits` table so the full audit
result (keywords, schema types, page speed, recommendations, link analysis, etc.)
can be stored and reconstructed when viewing past audits.

## Changes
### `seo_audits`
- New column: `result_data` (jsonb, nullable) — full structured audit output

## Security
- No policy changes needed; existing CRUD policies already cover the new column.
*/

ALTER TABLE seo_audits
ADD COLUMN IF NOT EXISTS result_data jsonb;
