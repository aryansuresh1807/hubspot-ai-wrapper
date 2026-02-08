# Data Ownership: Supabase vs HubSpot

This document explains which data lives in **Supabase** (PostgreSQL + Auth) and which is sourced from **HubSpot** in the HubSpot AI Wrapper application.

---

## Overview

| Concern | System | Notes |
|--------|--------|--------|
| **Identity & auth** | Supabase | Users, sessions (auth), app session metadata |
| **CRM source of truth** | HubSpot | Contacts, accounts, activities, tasks |
| **AI outputs & app state** | Supabase | Logs, drafts, recommendations, opportunities (optional) |

The **frontend** talks to the **backend API**, which in turn calls **HubSpot** for CRM data and **Supabase** for auth and app-specific data.

---

## Supabase (PostgreSQL + Auth)

Supabase holds **application-owned data**: auth, session metadata, and everything produced by or for the app (AI logs, drafts, recommendations, and optionally opportunities).

### Users

- **Handled by Supabase Auth** (`auth.users`).
- No custom `users` table; sign-up/sign-in is via Supabase Auth (email, OAuth, magic link, etc.).
- `user_id` in other tables references `auth.users(id)` (UUID).

### Sessions

- **Table:** `public.sessions`
- **Purpose:** App-level session metadata (e.g. preferences, last viewed, filters). Supabase Auth manages the actual auth session/tokens.
- **Fields:** `id`, `user_id`, `created_at`, `expires_at`, `metadata` (JSONB).

### AI processing logs

- **Table:** `public.ai_processing_logs`
- **Purpose:** Record each AI processing run (e.g. “generate drafts for this activity”).
- **Fields:** `id`, `user_id`, `activity_id` (HubSpot ID), `input_notes`, `processed_at`, `status`, `confidence_scores` (JSONB), `created_at`.
- **Note:** `activity_id` points to HubSpot; the **activity record** itself stays in HubSpot.

### AI-generated drafts

- **Table:** `public.ai_generated_drafts`
- **Purpose:** Store AI-generated draft text per activity (e.g. email/note drafts).
- **Fields:** `id`, `activity_id` (HubSpot), `draft_text`, `tone`, `confidence`, `selected`, `created_at`.
- **Note:** Content is app-generated; the underlying task/activity is in HubSpot.

### Touch date recommendations

- **Table:** `public.touch_date_recommendations`
- **Purpose:** AI-recommended start/due dates for activities.
- **Fields:** `id`, `activity_id`, `recommended_start`, `recommended_due`, `confidence`, `applied`, `created_at`.
- **Note:** When the user applies a recommendation, the backend can update the **activity** in HubSpot with the chosen dates.

### Opportunities (optional)

- **Table:** `public.opportunities`
- **Purpose:** Pipeline/opportunity tracking **if you are not** using HubSpot deals/opportunities for this.
- **Fields:** `id`, `user_id`, `hubspot_activity_id`, `probability`, `status`, `created_at`, `updated_at`.
- **When to use:** Use this table only if you need opportunity data outside HubSpot. If you use HubSpot Deals, treat HubSpot as the source of truth and skip or mirror from HubSpot instead.

---

## HubSpot (CRM – source of truth)

HubSpot is the **source of truth** for CRM entities. The app reads and, where appropriate, writes back to HubSpot.

| Data | Description |
|------|-------------|
| **Contacts** | People (leads, customers). CRUD via HubSpot API. |
| **Accounts / Companies** | Organizations. CRUD via HubSpot API. |
| **Activities** | Emails, calls, meetings, notes, tasks. Fetched and updated via HubSpot (e.g. Engagements, CRM activities). |
| **Tasks** | To-dos, follow-ups. Part of HubSpot activities/tasks. |
| **Deals (optional)** | If you use HubSpot Deals, they are the source of truth for pipeline/opportunities; `public.opportunities` is then optional or a cache. |

- **Read:** Backend fetches contacts, accounts, activities, tasks from HubSpot and returns them to the frontend.
- **Write:** When the user applies AI output (e.g. draft text, recommended dates), the backend updates the corresponding **activity/task** in HubSpot; Supabase tables store the AI output and metadata (e.g. `selected`, `applied`).

---

## Flow summary

1. **Auth:** User signs in via Supabase Auth. Frontend/backend use Supabase JWT/session.
2. **CRM data:** Backend calls HubSpot API for contacts, accounts, activities, tasks. No duplication of CRM master data into Supabase (except optional caching if you add it).
3. **AI:** Backend runs LLM (e.g. drafts, date suggestions). Results are stored in Supabase (`ai_processing_logs`, `ai_generated_drafts`, `touch_date_recommendations`).
4. **Apply to HubSpot:** When the user accepts a draft or a date recommendation, the backend updates the relevant **activity/task** in HubSpot and can set flags in Supabase (e.g. `selected`, `applied`).

---

## Migration

Apply the Supabase schema with:

- **File:** `backend/migrations/001_initial_schema.sql`
- **Where:** Supabase Dashboard → SQL Editor (or your migration runner), against the project’s Postgres database.

After running it, ensure RLS policies and `auth.uid()` behavior match your backend’s use of the Supabase client (e.g. service role for server-only flows, anon key + user JWT for user-scoped access).
