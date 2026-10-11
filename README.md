# Technical Audit Dashboard

A production-grade SEO Audit and Content Intelligence Dashboard built with React, TypeScript, Tailwind CSS, and Supabase.

---

## Why Was the Backend Not Working? (Root Cause Analysis)

1. **Edge Functions Not Deployed to Supabase**:
   - The frontend was sending requests directly to `${VITE_SUPABASE_URL}/functions/v1/seo-audit`, `get-ip`, `plagiarism-check`, `content-generate`, `contact-submit`, and `password-reset`.
   - On the remote Supabase project (`vwcxxdqtjieotmhtifgz`), none of the edge functions had been deployed, so the Supabase Edge Runtime returned **HTTP 404** (`"Requested function was not found"`).
2. **Database Tables Not Created**:
   - The PostgreSQL database was empty (`seo_audits`, `user_subscriptions`, `credit_usage`, `guest_credits`, `contact_messages` did not exist), causing PostgREST error **PGRST205** (`"Could not find the table 'public.seo_audits' in the schema cache"`).
3. **Missing Local Development Backend**:
   - When running `npm run dev`, there was no local server handling the `/functions/v1/*` routes, making offline/local testing impossible without cloud deployment.

---

## How It Was Fixed

1. **Integrated Local Dev Backend in Vite**:
   - Added a built-in development backend plugin (`server/devBackend.ts` + `server/auditRunner.ts`) into `vite.config.ts`.
   - When running `npm run dev`, all 6 backend endpoints (`/functions/v1/seo-audit`, `/functions/v1/get-ip`, `/functions/v1/plagiarism-check`, `/functions/v1/content-generate`, `/functions/v1/contact-submit`, `/functions/v1/password-reset`) are **handled locally with zero configuration**!
2. **Smart API Invoker with Fallback**:
   - Created `src/lib/api.ts` with `invokeEdgeFunction()`.
   - If the remote Supabase edge function returns 404 (not deployed), it automatically falls back to the local dev backend so audits and checks work immediately.
3. **Consolidated Database Setup Script**:
   - Created `supabase/schema_setup.sql` containing all tables, indexes, RLS policies, and triggers in one idempotent file.
4. **Resilient Edge Functions**:
   - Fixed `supabase/functions/seo-audit/index.ts` and other functions to safely handle unconfigured service role keys and avoid crashing when database writes encounter issues.
   - Renamed `20260904031914_20260904120000_create_contact_messages.sql.sql` to remove the redundant `.sql.sql` extension.

---

## Getting Started

### 1. Local Development (Ready Now)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173`. Audits, crawls, content generation, and plagiarism checks work immediately via the local development backend.

---

### 2. Setting Up Your Supabase Database

To persist audits and enable multi-user authentication in Supabase:

1. Open your Supabase project SQL Editor:
   [https://supabase.com/dashboard/project/vwcxxdqtjieotmhtifgz/sql/new](https://supabase.com/dashboard/project/vwcxxdqtjieotmhtifgz/sql/new)
2. Copy the contents of [`supabase/schema_setup.sql`](supabase/schema_setup.sql).
3. Paste into the SQL editor and click **Run**.

This creates:
- `seo_audits`: audit history and full analysis results
- `user_subscriptions`: user subscription tier management
- `credit_usage`: credit limits and tracking
- `guest_credits`: IP-based daily limits for guest users
- `contact_messages`: contact form submissions
- Row Level Security (RLS) policies and user signup triggers

---

### 3. Deploying Edge Functions to Supabase (Optional for Cloud Hosting)

If you wish to deploy the Edge Functions directly to your Supabase project instead of using the local dev backend:

```bash
# 1. Login to Supabase CLI
npm run supabase:login

# 2. Link your project
npm run supabase:link

# 3. Deploy all edge functions
npm run supabase:deploy
```
