-- Mencegah satu pegawai memiliki lebih dari satu laporan pada tanggal yang sama.
-- Aman dijalankan berulang kali. Index hanya dibuat jika data lama tidak mengandung duplikat.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM reports
        GROUP BY user_id, tanggal_pelaksanaan
        HAVING COUNT(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_user_tanggal
            ON reports(user_id, tanggal_pelaksanaan);
        RAISE NOTICE 'Unique index uq_reports_user_tanggal siap.';
    ELSE
        RAISE NOTICE 'Index tidak dibuat: masih ada duplikat (user_id, tanggal_pelaksanaan). Bersihkan duplikat terlebih dahulu.';
    END IF;
END $$;
