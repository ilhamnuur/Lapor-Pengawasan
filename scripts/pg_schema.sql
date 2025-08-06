-- PostgreSQL schema for "lapor"
-- This will DROP and CREATE tables (idempotent via DROP IF EXISTS + CASCADE as approved)

BEGIN;

-- Drop in FK order (report_photos depends on reports, reports depends on users/activity_types)
DROP TABLE IF EXISTS report_photos CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS activity_types CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('pegawai','kepala')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Types
CREATE TABLE activity_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE SET NULL,
  nomor_surat_tugas VARCHAR(100),
  tujuan_perjalanan_dinas VARCHAR(255) NOT NULL,
  tanggal_pelaksanaan DATE NOT NULL,
  hari_pelaksanaan VARCHAR(20) NOT NULL,
  aktivitas TEXT NOT NULL,
  permasalahan TEXT,
  petugas_responden TEXT,
  solusi_antisipasi TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Report Photos
CREATE TABLE report_photos (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  photo_path VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_activity_type_id ON reports(activity_type_id);
CREATE INDEX IF NOT EXISTS idx_reports_tanggal ON reports(tanggal_pelaksanaan);
CREATE INDEX IF NOT EXISTS idx_photos_report_id ON report_photos(report_id);

-- Seed minimal data if empty
INSERT INTO users (username,password,name,role)
SELECT 'admin_kepala', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator Kepala', 'kepala'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='admin_kepala');

INSERT INTO users (username,password,name,role)
SELECT 'pegawai1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Pegawai Satu', 'pegawai'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='pegawai1');

COMMIT;