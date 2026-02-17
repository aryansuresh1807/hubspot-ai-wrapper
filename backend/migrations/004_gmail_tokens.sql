-- Gmail OAuth tokens per user (one row per user)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON public.gmail_tokens(user_id);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only backend (service_role) can access gmail_tokens.
-- Service role bypasses RLS.

COMMENT ON TABLE public.gmail_tokens IS 'Stores Google OAuth access/refresh tokens for Gmail API per user.';
