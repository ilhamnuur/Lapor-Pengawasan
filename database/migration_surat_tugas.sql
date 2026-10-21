-- Migrasi aditif: surat tugas PDF per jenis kegiatan.
-- Aman dijalankan pada database yang sudah berisi data:
-- tidak menghapus/mengubah baris lama, hanya menambah kolom nullable.
ALTER TABLE activity_types
    ADD COLUMN IF NOT EXISTS surat_tugas_path TEXT;

COMMENT ON COLUMN activity_types.surat_tugas_path IS 'Path relatif file PDF surat tugas (uploads/surat_tugas/...); NULL jika belum ada';
