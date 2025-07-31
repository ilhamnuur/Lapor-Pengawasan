-- Database initialization script
CREATE DATABASE bps_tuban_monitoring;

\c bps_tuban_monitoring;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('pegawai', 'kepala')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    kegiatan_pengawasan TEXT NOT NULL,
    tanggal_pelaksanaan DATE NOT NULL,
    hari_pelaksanaan VARCHAR(20) NOT NULL,
    aktivitas TEXT NOT NULL,
    permasalahan TEXT,
    surat_tugas_path VARCHAR(255),
    dokumen_visum_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default users
INSERT INTO users (username, password, name, role) VALUES 
('admin_kepala', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Kepala BPS Tuban', 'kepala'),
('pegawai1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ahmad Susanto', 'pegawai'),
('pegawai2', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Siti Nurhaliza', 'pegawai');
-- Default password for all users: 'password123'