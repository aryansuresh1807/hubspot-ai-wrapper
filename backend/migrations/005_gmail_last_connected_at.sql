-- Add last_connected_at to gmail_tokens (set when user completes OAuth connect)
-- Run in Supabase SQL Editor

ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.gmail_tokens.last_connected_at IS 'When the user last completed Gmail OAuth connection (not token refresh).';
