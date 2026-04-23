-- ============================================================================
-- SEO Meeting Notes Integration - Supabase Schema
-- Database: fqrkjfrzekrmhmxfdjpq.supabase.co (tasks.livetech.co.uk)
-- Run this in the Supabase SQL Editor for the TASKS project
-- ============================================================================

-- sc_data: Raw Search Console data pulled from BigQuery
CREATE TABLE IF NOT EXISTS sc_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  client_id TEXT NOT NULL,
  url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  avg_position DECIMAL(5,2) DEFAULT 0,
  source TEXT DEFAULT 'search-console',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, client_id, url)
);
CREATE INDEX IF NOT EXISTS idx_sc_data_month_client ON sc_data(month, client_id);

-- sc_selections: Sarah's checkbox selections per month/client
CREATE TABLE IF NOT EXISTS sc_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  client_id TEXT NOT NULL,
  selected_urls JSONB DEFAULT '[]'::jsonb,
  selected_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, client_id)
);
CREATE INDEX IF NOT EXISTS idx_sc_selections_month_client ON sc_selections(month, client_id);

-- meeting_notes: Team monthly meeting notes
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT,
  assigned_to TEXT NOT NULL,
  sc_tasks TEXT DEFAULT '',
  client_activity TEXT DEFAULT '',
  tasks_carried_out TEXT DEFAULT '',
  checklist_status TEXT DEFAULT 'pending',
  focus_keywords TEXT DEFAULT '',
  website_audit TEXT DEFAULT '',
  screenshots TEXT DEFAULT '',
  upselling TEXT DEFAULT '',
  competitors TEXT DEFAULT '',
  comments TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, client_id, assigned_to)
);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_month_client ON meeting_notes(month, client_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_assigned ON meeting_notes(assigned_to);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meeting_notes_updated_at ON meeting_notes;
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON meeting_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sc_selections_updated_at ON sc_selections;
CREATE TRIGGER update_sc_selections_updated_at
  BEFORE UPDATE ON sc_selections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('sc_data', 'sc_selections', 'meeting_notes')
ORDER BY table_name;
