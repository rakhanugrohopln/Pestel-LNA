-- PLN CORPU Integrated Strategic PESTEL & Learning Needs Analytics
-- Reference PostgreSQL Relational Schema & Row-Level Security Specification

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS business_segments (
  id TEXT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id) ON DELETE RESTRICT,
  parent_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  level VARCHAR(32) NOT NULL CHECK (level IN ('directorate', 'department', 'unit')),
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  province VARCHAR(80) NOT NULL DEFAULT 'Nasional',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'MANAGEMENT', 'USER')),
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_uat_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_code VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(240) NOT NULL,
  year INTEGER NOT NULL,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  background TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  objectives TEXT NOT NULL,
  strategic_issue_source TEXT NOT NULL DEFAULT '',
  supporting_evidence TEXT NOT NULL DEFAULT '',
  current_condition_analysis TEXT NOT NULL DEFAULT '',
  org_needs_analysis TEXT NOT NULL DEFAULT '',
  competency_needs TEXT NOT NULL DEFAULT '',
  lna_result TEXT NOT NULL DEFAULT '',
  development_recommendation TEXT NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL CHECK (status IN ('Draft', 'Dalam Analisis', 'Menunggu Masukan', 'Revisi', 'Disetujui', 'Dipublikasikan')),
  priority VARCHAR(16) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  lead_name VARCHAR(160) NOT NULL,
  owner_user_uid UUID NOT NULL REFERENCES users(uid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pestel_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(240) NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  source_title VARCHAR(300),
  publisher VARCHAR(160),
  risk_or_opportunity VARCHAR(20) NOT NULL CHECK (risk_or_opportunity IN ('risk', 'opportunity', 'both')),
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  impact_analysis TEXT NOT NULL DEFAULT '',
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  is_ai_draft BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(24) NOT NULL CHECK (status IN ('Draft AI', 'Tervalidasi', 'Dipublikasikan', 'Arsip')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_pestel_links (
  research_study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  pestel_issue_id UUID NOT NULL REFERENCES pestel_issues(id) ON DELETE CASCADE,
  PRIMARY KEY (research_study_id, pestel_issue_id)
);

CREATE TABLE IF NOT EXISTS professions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  grand_design_summary TEXT NOT NULL DEFAULT '',
  config_status VARCHAR(24) NOT NULL DEFAULT 'unconfigured'
);

CREATE TABLE IF NOT EXISTS competency_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('core', 'technical', 'behavioral')),
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  profession_id UUID REFERENCES professions(id) ON DELETE SET NULL,
  job_standard_ref VARCHAR(120) NOT NULL DEFAULT 'Belum Dikonfigurasi',
  target_level INTEGER NOT NULL DEFAULT 3,
  config_status VARCHAR(24) NOT NULL DEFAULT 'unconfigured'
);

CREATE TABLE IF NOT EXISTS cca_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES competency_directory(id) ON DELETE SET NULL,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  competency_type VARCHAR(16) NOT NULL CHECK (competency_type IN ('core', 'technical')),
  competency_name VARCHAR(200) NOT NULL,
  current_level INTEGER NOT NULL,
  required_level INTEGER NOT NULL,
  gap_note TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL CHECK (status IN ('Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dna_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  future_capability_need TEXT NOT NULL,
  current_condition TEXT NOT NULL CHECK (length(trim(current_condition)) >= 10),
  target_condition TEXT NOT NULL,
  development_gap TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL,
  supporting_evidence TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tna_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tna_classification VARCHAR(20) NOT NULL CHECK (tna_classification IN ('TNA_KORPORAT', 'TNA_UNIT')),
  research_study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  dna_id UUID REFERENCES dna_assessments(id) ON DELETE SET NULL,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  profession_name VARCHAR(180) NOT NULL,
  required_competency VARCHAR(200) NOT NULL,
  actual_level INTEGER NOT NULL,
  target_level INTEGER NOT NULL,
  competency_gap INTEGER NOT NULL,
  priority VARCHAR(16) NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 0,
  proposed_training VARCHAR(240) NOT NULL,
  has_valid_gap_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status VARCHAR(24) NOT NULL CHECK (verification_status IN ('Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(220) NOT NULL,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  profession_name VARCHAR(180) NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('Draft', 'Terverifikasi', 'Disetujui', 'Dipublikasikan'))
);

CREATE TABLE IF NOT EXISTS learning_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_title VARCHAR(240) NOT NULL,
  need_source VARCHAR(16) NOT NULL CHECK (need_source IN ('LNA', 'CCA', 'DNA', 'TNA', 'PESTEL')),
  research_study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  tna_id UUID REFERENCES tna_assessments(id) ON DELETE SET NULL,
  learning_path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  business_segment_id TEXT NOT NULL REFERENCES business_segments(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  target_audience VARCHAR(200) NOT NULL,
  priority VARCHAR(16) NOT NULL,
  is_non_training_intervention BOOLEAN NOT NULL DEFAULT FALSE,
  is_ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status VARCHAR(32) NOT NULL CHECK (approval_status IN ('Usulan AI', 'Menunggu Persetujuan', 'Disetujui', 'Dipublikasikan', 'Ditolak')),
  follow_up_plan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_study_id UUID NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  comment TEXT NOT NULL,
  improvement_suggestion TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL,
  submitted_by_uid UUID NOT NULL REFERENCES users(uid),
  status VARCHAR(24) NOT NULL CHECK (status IN ('Baru', 'Ditinjau', 'Ditindaklanjuti', 'Selesai')),
  admin_response TEXT,
  decision_reason TEXT,
  responded_by_uid UUID REFERENCES users(uid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid TEXT NOT NULL,
  actor_email VARCHAR(255) NOT NULL,
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(60) NOT NULL,
  resource_id TEXT NOT NULL,
  department_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_dept_status ON research_studies(department_id, status);
CREATE INDEX IF NOT EXISTS idx_pestel_dept_status ON pestel_issues(department_id, status);
CREATE INDEX IF NOT EXISTS idx_tna_class_dept ON tna_assessments(tna_classification, department_id);
CREATE INDEX IF NOT EXISTS idx_feedback_study_status ON management_feedback(research_study_id, status);

-- Example PostgreSQL Row-Level Security Policies
ALTER TABLE research_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_role_isolation ON research_studies
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      current_setting('app.current_role', true) = 'MANAGEMENT'
      AND status <> 'Draft'
      AND department_id = current_setting('app.current_dept', true)
    )
    OR (
      current_setting('app.current_role', true) = 'USER'
      AND status = 'Dipublikasikan'
      AND department_id = current_setting('app.current_dept', true)
    )
  );
