-- Migration to add activity_types table and update reports table
-- SQLite version

-- Create activity_types table
CREATE TABLE IF NOT EXISTS activity_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add activity_type_id column to reports table
ALTER TABLE reports ADD COLUMN activity_type_id INTEGER REFERENCES activity_types(id);

-- Insert default activity types
INSERT OR IGNORE INTO activity_types (name, description) VALUES 
('Sensus Penduduk', 'Kegiatan sensus penduduk dan demografi'),
('Survei Ekonomi', 'Kegiatan survei ekonomi dan bisnis'),
('Survei Sosial', 'Kegiatan survei sosial dan budaya');
