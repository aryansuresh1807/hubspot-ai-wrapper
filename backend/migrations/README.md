# Database migrations

Supabase schema changes live here as SQL files.

## Applying migrations

1. Open your [Supabase](https://supabase.com) project.
2. Go to **SQL Editor**.
3. Paste the contents of `001_initial_schema.sql` and run it.

Or use the Supabase CLI with `supabase db push` if you use local migrations.

## Files

- **001_initial_schema.sql** – Initial tables: `sessions`, `ai_processing_logs`, `ai_generated_drafts`, `touch_date_recommendations`, `opportunities`, plus RLS policies. Users are in Supabase Auth (`auth.users`).

See [docs/DATA_OWNERSHIP.md](../docs/DATA_OWNERSHIP.md) for what data lives in Supabase vs HubSpot.
