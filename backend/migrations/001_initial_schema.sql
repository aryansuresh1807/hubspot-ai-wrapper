-- HubSpot AI Wrapper - Initial Supabase schema
-- Run in Supabase SQL Editor or via migration tool

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- AUTHENTICATION SCHEMA
-- =====================================================

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  hubspot_portal_id TEXT,
  hubspot_access_token TEXT,
  hubspot_refresh_token TEXT,
  hubspot_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS on_user_profile_updated ON public.user_profiles;
CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- EXISTING APPLICATION SCHEMA (keep everything below as is)
-- =====================================================

-- -----------------------------------------------------------------------------
-- sessions: app-level session metadata (Supabase Auth handles auth sessions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON public.sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON public.sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON public.sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON public.sessions FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- ai_processing_logs: log of AI processing runs per activity
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL,
    input_notes TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'completed',
    confidence_scores JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_processing_logs_user_id ON public.ai_processing_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_processing_logs_activity_id ON public.ai_processing_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_ai_processing_logs_created_at ON public.ai_processing_logs(created_at);

ALTER TABLE public.ai_processing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_processing_logs"
    ON public.ai_processing_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_processing_logs"
    ON public.ai_processing_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_processing_logs"
    ON public.ai_processing_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai_processing_logs"
    ON public.ai_processing_logs FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- ai_generated_drafts: AI-generated draft content per activity
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_generated_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id TEXT NOT NULL,
    draft_text TEXT NOT NULL,
    tone TEXT,
    confidence NUMERIC(5,4),
    selected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_drafts_activity_id ON public.ai_generated_drafts(activity_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_drafts_created_at ON public.ai_generated_drafts(created_at);

-- RLS: link to user via ai_processing_logs or allow service role; for simplicity allow authenticated read/write
ALTER TABLE public.ai_generated_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage ai_generated_drafts"
    ON public.ai_generated_drafts FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- touch_date_recommendations: AI-recommended start/due dates per activity
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.touch_date_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id TEXT NOT NULL,
    recommended_start TIMESTAMPTZ,
    recommended_due TIMESTAMPTZ,
    confidence NUMERIC(5,4),
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_touch_date_recommendations_activity_id ON public.touch_date_recommendations(activity_id);
CREATE INDEX IF NOT EXISTS idx_touch_date_recommendations_created_at ON public.touch_date_recommendations(created_at);

ALTER TABLE public.touch_date_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage touch_date_recommendations"
    ON public.touch_date_recommendations FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- opportunities: pipeline/opportunity tracking (if not using HubSpot for this)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hubspot_activity_id TEXT,
    probability NUMERIC(5,4),
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON public.opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_hubspot_activity_id ON public.opportunities(hubspot_activity_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own opportunities"
    ON public.opportunities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own opportunities"
    ON public.opportunities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opportunities"
    ON public.opportunities FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own opportunities"
    ON public.opportunities FOR DELETE
    USING (auth.uid() = user_id);

-- Optional: updated_at trigger for opportunities
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opportunities_updated_at ON public.opportunities;
CREATE TRIGGER opportunities_updated_at
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
