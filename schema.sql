-- ============================================================================
-- SEO Meeting Notes Integration - Supabase Schema
-- Database: mwrhsviivkcwwhmqlmev.supabase.co
-- ============================================================================

-- ============================================================================
-- Table 1: sc_data
-- Stores Search Console data pulled from BigQuery
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_sc_data_created ON sc_data(created_at DESC);

-- ============================================================================
-- Table 2: sc_selections
-- Stores Sarah's checkbox selections for SC data
-- ============================================================================
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

-- ============================================================================
-- Table 3: meeting_notes
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_meeting_notes_updated ON meeting_notes(updated_at DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE sc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_data_sarah_all" ON sc_data FOR ALL USING (auth.email() = 'sarah@livetech.co.uk');
CREATE POLICY "sc_data_others_read" ON sc_data FOR SELECT USING (auth.email() IN ('charlie@livetech.co.uk', 'megan@livetech.co.uk', 'sabrina@livetech.co.uk', 'holly@livetech.co.uk'));
CREATE POLICY "sc_selections_sarah" ON sc_selections FOR ALL USING (auth.email() = 'sarah@livetech.co.uk');
CREATE POLICY "meeting_notes_manage_own" ON meeting_notes FOR ALL USING (assigned_to = auth.email());
CREATE POLICY "meeting_notes_view_all" ON meeting_notes FOR SELECT USING (auth.email() IN ('sarah@livetech.co.uk', 'charlie@livetech.co.uk', 'megan@livetech.co.uk', 'sabrina@livetech.co.uk', 'holly@livetech.co.uk'));

-- ============================================================================
-- Auto-update triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_notes_updated_at BEFORE UPDATE ON meeting_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sc_selections_updated_at BEFORE UPDATE ON sc_selections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
