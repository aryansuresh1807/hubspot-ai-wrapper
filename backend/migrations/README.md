# Database migrations

Supabase schema changes live here as SQL files. Run them in order.

## Applying migrations

1. Open your [Supabase](https://supabase.com) project.
2. Go to **SQL Editor**.
3. Run in order:
   - **First:** paste and run `001_initial_schema.sql` (user_profiles, sessions, etc.).
   - **Second:** paste and run `002_hubspot_cache.sql` (HubSpot caches and dashboard state).

After creating new tables, Supabase/PostgREST picks them up automatically (or reload the schema in Project Settings → API if needed).

Or use the Supabase CLI with `supabase db push` if you use local migrations.

## Files

- **001_initial_schema.sql** – Initial tables: `user_profiles`, `sessions`, `ai_processing_logs`, `ai_generated_drafts`, `touch_date_recommendations`, `opportunities`, plus RLS. Run this first.
- **002_hubspot_cache.sql** – `hubspot_contacts_cache`, `hubspot_companies_cache`, `hubspot_tasks_cache`, `user_dashboard_state`. Required for dashboard and activities. Run after 001.

See [docs/DATA_OWNERSHIP.md](../docs/DATA_OWNERSHIP.md) for what data lives in Supabase vs HubSpot.
