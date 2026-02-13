-- HubSpot AI Wrapper - HubSpot cache and dashboard state
-- Run after 001_initial_schema.sql (requires uuid-ossp and auth.users)

-- Ensure UUID extension exists (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- HUBSPOT CONTACTS CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hubspot_contacts_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hubspot_contact_id TEXT NOT NULL,
  data JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, hubspot_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_contacts_cache_user_id ON public.hubspot_contacts_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contacts_cache_last_synced_at ON public.hubspot_contacts_cache(last_synced_at);

ALTER TABLE public.hubspot_contacts_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hubspot_contacts_cache"
  ON public.hubspot_contacts_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hubspot_contacts_cache"
  ON public.hubspot_contacts_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hubspot_contacts_cache"
  ON public.hubspot_contacts_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hubspot_contacts_cache"
  ON public.hubspot_contacts_cache FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- HUBSPOT COMPANIES CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hubspot_companies_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hubspot_company_id TEXT NOT NULL,
  data JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, hubspot_company_id)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_companies_cache_user_id ON public.hubspot_companies_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_companies_cache_last_synced_at ON public.hubspot_companies_cache(last_synced_at);

ALTER TABLE public.hubspot_companies_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hubspot_companies_cache"
  ON public.hubspot_companies_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hubspot_companies_cache"
  ON public.hubspot_companies_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hubspot_companies_cache"
  ON public.hubspot_companies_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hubspot_companies_cache"
  ON public.hubspot_companies_cache FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- HUBSPOT TASKS CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hubspot_tasks_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hubspot_task_id TEXT NOT NULL,
  data JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, hubspot_task_id)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_tasks_cache_user_id ON public.hubspot_tasks_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_tasks_cache_last_synced_at ON public.hubspot_tasks_cache(last_synced_at);

ALTER TABLE public.hubspot_tasks_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hubspot_tasks_cache"
  ON public.hubspot_tasks_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hubspot_tasks_cache"
  ON public.hubspot_tasks_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hubspot_tasks_cache"
  ON public.hubspot_tasks_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hubspot_tasks_cache"
  ON public.hubspot_tasks_cache FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- USER DASHBOARD STATE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_dashboard_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_activity_id TEXT,
  sort_option TEXT DEFAULT 'date_newest',
  filter_state JSONB DEFAULT '{}',
  date_picker_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_state_user_id ON public.user_dashboard_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_state_updated_at ON public.user_dashboard_state(updated_at);

ALTER TABLE public.user_dashboard_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_dashboard_state"
  ON public.user_dashboard_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_dashboard_state"
  ON public.user_dashboard_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_dashboard_state"
  ON public.user_dashboard_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_dashboard_state"
  ON public.user_dashboard_state FOR DELETE
  USING (auth.uid() = user_id);

-- Keep updated_at in sync on UPDATE
DROP TRIGGER IF EXISTS user_dashboard_state_updated_at ON public.user_dashboard_state;
CREATE TRIGGER user_dashboard_state_updated_at
  BEFORE UPDATE ON public.user_dashboard_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
