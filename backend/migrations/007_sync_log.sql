-- Sync log: audit trail of integration sync runs (HubSpot, email, etc.)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'hubspot',
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  details TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON public.sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON public.sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON public.sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_source ON public.sync_log(source);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sync logs (read-only for UI; inserts done by backend with service role)
CREATE POLICY "Users can view own sync_log"
  ON public.sync_log FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates are done by backend (service role bypasses RLS)
COMMENT ON TABLE public.sync_log IS 'Audit log of integration sync runs (HubSpot activities, etc.) for the Integrations sync log UI.';
