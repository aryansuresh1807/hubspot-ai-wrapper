-- Store connected Gmail address in gmail_tokens (set when user completes OAuth)
-- Run in Supabase SQL Editor

ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.gmail_tokens.email IS 'Gmail address of the connected account (set at OAuth connect).';
