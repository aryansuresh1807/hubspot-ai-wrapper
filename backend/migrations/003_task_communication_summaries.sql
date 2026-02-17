-- Task communication summaries: AI-generated summary per task (from client notes).
-- Used to avoid re-running the communication summary agent when notes haven't changed.

CREATE TABLE IF NOT EXISTS public.task_communication_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hubspot_task_id TEXT NOT NULL,
  summary TEXT,
  times_contacted TEXT,
  relationship_status TEXT,
  notes_hash TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, hubspot_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_communication_summaries_user_id ON public.task_communication_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_task_communication_summaries_hubspot_task_id ON public.task_communication_summaries(hubspot_task_id);

ALTER TABLE public.task_communication_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task_communication_summaries"
  ON public.task_communication_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task_communication_summaries"
  ON public.task_communication_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task_communication_summaries"
  ON public.task_communication_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task_communication_summaries"
  ON public.task_communication_summaries FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS task_communication_summaries_updated_at ON public.task_communication_summaries;
CREATE TRIGGER task_communication_summaries_updated_at
  BEFORE UPDATE ON public.task_communication_summaries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
