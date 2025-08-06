const express = require('express');
const path = require('path');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const upload = require('../middleware/multer');
const router = express.Router();

const fs = require('fs');

// Create report (Pegawai only)
router.post('/', authenticateToken, authorizeRole(['pegawai']), upload.fields([
    { name: 'foto_dokumentasi[]', maxCount: 6 }
]), async (req, res) => {
    try {
        const {
            nomor_surat_tugas,
            tujuan_perjalanan_dinas,
            tanggal_pelaksanaan,
            aktivitas,
            permasalahan,
            activity_type_id,
            petugas_responden,
            solusi_antisipasi
        } = req.body;

        // Normalize empty strings to null for optional fields
        const normalizeEmpty = (v) => (v === '' || v === undefined) ? null : v;
        const tujuan = normalizeEmpty(tujuan_perjalanan_dinas);
        const aktivitasVal = normalizeEmpty(aktivitas);
        const permasalahanVal = normalizeEmpty(permasalahan);
        const petugasRespondenVal = normalizeEmpty(petugas_responden);
        const solusiAntisipasiVal = normalizeEmpty(solusi_antisipasi);
        const activityTypeIdVal = normalizeEmpty(activity_type_id);
        const nomorSuratVal = normalizeEmpty(nomor_surat_tugas);

        // Validate required fields (match NOT NULL constraints in DB)
        const errors = [];
        if (!tujuan) errors.push('tujuan_perjalanan_dinas wajib diisi');
        if (!tanggal_pelaksanaan) errors.push('tanggal_pelaksanaan wajib diisi');
        if (!aktivitasVal) errors.push('aktivitas wajib diisi');

        // Validate and compute hari_pelaksanaan
        const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        let computedHari = null;
        let tanggalISO = null;
        if (tanggal_pelaksanaan) {
            const d = new Date(tanggal_pelaksanaan);
            if (isNaN(d)) {
                errors.push('tanggal_pelaksanaan tidak valid');
            } else {
                computedHari = dayNames[d.getDay()];
                // format to YYYY-MM-DD for SQLite DATE compatibility
                const pad = (n) => String(n).padStart(2, '0');
                tanggalISO = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
            }
        }

        if (!computedHari) {
            errors.push('hari_pelaksanaan tidak dapat ditentukan dari tanggal_pelaksanaan');
        }

        if (errors.length) {
            return res.status(400).json({ message: 'Validasi gagal', errors });
        }

        const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;

        // Perform INSERT
        const result = await db.run(
            `INSERT INTO reports (user_id, activity_type_id, nomor_surat_tugas, tujuan_perjalanan_dinas, tanggal_pelaksanaan,
             hari_pelaksanaan, aktivitas, permasalahan, petugas_responden, solusi_antisipasi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                activityTypeIdVal,
                nomorSuratVal,
                tujuan,
                tanggalISO,
                computedHari,
                aktivitasVal,
                permasalahanVal,
                petugasRespondenVal,
                solusiAntisipasiVal
            ]
        );

        if (!result || !result.id) {
            console.error('INSERT reports returned unexpected result:', result);
            return res.status(500).json({ message: 'Gagal menyimpan laporan' });
        }

        const newReport = await db.get('SELECT * FROM reports WHERE id = ?', [result.id]);

        // Insert photo dokumentasi paths
        if (req.files && req.files['foto_dokumentasi[]'] && req.files['foto_dokumentasi[]'].length) {
            const photoInsertPromises = req.files['foto_dokumentasi[]'].map(photo => {
                return db.run(
                    `INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)`,
                    [newReport.id, normalizePath(photo.path)]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        // Attach photos to response
        const photos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [newReport.id]);
        newReport.foto_dokumentasi = photos.map(p => p.photo_path);

        res.status(201).json({
            message: 'Laporan berhasil dibuat',
            report: newReport
        });
    } catch (error) {
        // Provide more context to logs to diagnose persistence issues
        console.error('Error creating report:', {
            body: {
                ...req.body,
                // avoid logging potentially large files
                foto_dokumentasi_count: (req.files && req.files['foto_dokumentasi[]']) ? req.files['foto_dokumentasi[]'].length : 0
            },
            user: req.user?.id,
            error
        });
        res.status(500).json({ message: 'Server error while creating report' });
    }
});

// Get reports
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query;
        let params;

        if (req.user.role === 'kepala') {
            // Kepala can see all reports
            query = `
                SELECT
                    r.id, r.user_id, r.activity_type_id,
                    r.nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, r.tanggal_pelaksanaan, r.hari_pelaksanaan,
                    r.aktivitas, r.permasalahan, r.petugas_responden, r.solusi_antisipasi,
                    r.created_at, r.updated_at,
                    u.name as pegawai_name
                FROM reports r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC
            `;
            params = [];
        } else {
            // Pegawai can only see their own reports
            query = `
                SELECT
                    r.id, r.user_id, r.activity_type_id,
                    r.nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, r.tanggal_pelaksanaan, r.hari_pelaksanaan,
                    r.aktivitas, r.permasalahan, r.petugas_responden, r.solusi_antisipasi,
                    r.created_at, r.updated_at,
                    u.name as pegawai_name
                FROM reports r
                JOIN users u ON r.user_id = u.id
                WHERE r.user_id = ?
                ORDER BY r.created_at DESC
            `;
            params = [req.user.id];
        }

        const result = await db.all(query, params);
        res.json(result);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Server error while fetching reports' });
    }
});

// Get single report
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let query;
        let params;

        if (req.user.role === 'kepala') {
            query = `
                SELECT
                    r.id, r.user_id, r.activity_type_id,
                    COALESCE(NULLIF(r.nomor_surat_tugas, ''), NULL) AS nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, r.tanggal_pelaksanaan, r.hari_pelaksanaan,
                    r.aktivitas, r.permasalahan, r.petugas_responden, r.solusi_antisipasi,
                    r.created_at, r.updated_at,
                    u.name as pegawai_name,
                    at.name as activity_type_name
                FROM reports r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN activity_types at ON r.activity_type_id = at.id
                WHERE r.id = ?
            `;
            params = [id];
        } else {
            query = `
                SELECT
                    r.id, r.user_id, r.activity_type_id,
                    COALESCE(NULLIF(r.nomor_surat_tugas, ''), NULL) AS nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, r.tanggal_pelaksanaan, r.hari_pelaksanaan,
                    r.aktivitas, r.permasalahan, r.petugas_responden, r.solusi_antisipasi,
                    r.created_at, r.updated_at,
                    u.name as pegawai_name,
                    at.name as activity_type_name
                FROM reports r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN activity_types at ON r.activity_type_id = at.id
                WHERE r.id = ? AND r.user_id = ?
            `;
            params = [id, req.user.id];
        }

        const result = await db.get(query, params);
        
        if (!result) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        // Get foto dokumentasi for this report
        const photos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [id]);
        result.foto_dokumentasi = photos.map(photo => photo.photo_path);

        res.json(result);
    } catch (error) {
        console.error(`Error fetching report with id ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while fetching report' });
    }
});


// Update report (Pegawai only, own reports)
router.put('/:id', authenticateToken, authorizeRole(['pegawai']), upload.fields([
    { name: 'foto_dokumentasi[]', maxCount: 6 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nomor_surat_tugas,
            tujuan_perjalanan_dinas,
            tanggal_pelaksanaan,
            aktivitas,
            permasalahan,
            activity_type_id,
            petugas_responden,
            solusi_antisipasi
        } = req.body;

        // Check if report belongs to user
        const existingReport = await db.get(
            'SELECT * FROM reports WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (!existingReport) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        let computedHari = existingReport.hari_pelaksanaan || null;
        if (tanggal_pelaksanaan) {
            const d = new Date(tanggal_pelaksanaan);
            if (!isNaN(d)) computedHari = dayNames[d.getDay()];
        }

        const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;
        const deleteFile = (filePath) => {
            if (filePath && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error(`Failed to delete file: ${filePath}`, err);
                }
            }
        };

        await db.run(
            `UPDATE reports SET
             activity_type_id = ?, nomor_surat_tugas = ?, tujuan_perjalanan_dinas = ?, tanggal_pelaksanaan = ?, hari_pelaksanaan = ?,
             aktivitas = ?, permasalahan = ?, petugas_responden = ?, solusi_antisipasi = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
            [activity_type_id, nomor_surat_tugas || null, tujuan_perjalanan_dinas, tanggal_pelaksanaan, computedHari, aktivitas,
             permasalahan, petugas_responden, solusi_antisipasi, id, req.user.id]
        );

        // Handle photo updates
        if (req.files['foto_dokumentasi[]']) {
            // Delete old photos from filesystem and DB
            const oldPhotos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [id]);
            oldPhotos.forEach(photo => deleteFile(photo.photo_path));
            await db.run('DELETE FROM report_photos WHERE report_id = ?', [id]);

            // Insert new photo paths
            const photoInsertPromises = req.files['foto_dokumentasi[]'].map(photo => {
                return db.run(
                    `INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)`,
                    [id, normalizePath(photo.path)]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        const updatedReport = await db.get('SELECT * FROM reports WHERE id = ?', [id]);

        // attach fresh photos list
        const photos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [id]);
        updatedReport.foto_dokumentasi = photos.map(p => p.photo_path);

        res.json({
            message: 'Laporan berhasil diupdate',
            report: updatedReport
        });
    } catch (error) {
        console.error(`Error updating report with id ${req.params.id}:`, {
            body: {
                ...req.body,
                foto_dokumentasi_count: (req.files && req.files['foto_dokumentasi[]']) ? req.files['foto_dokumentasi[]'].length : 0
            },
            user: req.user?.id,
            error
        });
        res.status(500).json({ message: 'Server error while updating report' });
    }
});

// Delete report (Pegawai only, own reports)
router.delete('/:id', authenticateToken, authorizeRole(['pegawai']), async (req, res) => {
    try {
        const { id } = req.params;

        // Pastikan laporan milik user yang login
        const report = await db.get('SELECT id FROM reports WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        // Ambil daftar foto (sebelum menghapus DB) agar kita punya path untuk hapus file
        const photos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [id]);

        // Hapus laporan terlebih dahulu (ON DELETE CASCADE akan menghapus report_photos)
        const result = await db.run('DELETE FROM reports WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        // Best-effort hapus file fisik setelah data terhapus
        for (const p of photos) {
            const storedPath = p.photo_path;
            if (!storedPath) continue;
            try {
                // Jika path relatif "uploads/..." buat absolut berdasarkan struktur server
                let candidatePaths = [];
                if (path.isAbsolute(storedPath)) {
                    candidatePaths.push(storedPath);
                } else {
                    candidatePaths.push(path.join(__dirname, '..', storedPath));             // d:\Apps\Lapor-Pengawasan\uploads\...
                    candidatePaths.push(path.join(process.cwd(), 'Lapor-Pengawasan', storedPath)); // fallback
                }
                // Coba hapus file pada kandidat path
                for (const cand of candidatePaths) {
                    if (fs.existsSync(cand)) {
                        try { fs.unlinkSync(cand); } catch (e) { console.error('unlink failed:', cand, e); }
                    }
                }
            } catch (err) {
                console.error('Error removing photo file:', storedPath, err);
            }
        }

        return res.json({ message: 'Laporan berhasil dihapus' });
    } catch (error) {
        // Tambahkan logging detail untuk diagnosa
        console.error('Delete report error -> id:', req.params.id, 'user:', req.user?.id, error);
        return res.status(500).json({ message: 'Server error while deleting report' });
    }
});

module.exports = router;
