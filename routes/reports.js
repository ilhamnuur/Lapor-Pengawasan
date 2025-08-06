const express = require('express');
const path = require('path');
const pg = require('../config/database');
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

        const normalizeEmpty = (v) => (v === '' || v === undefined) ? null : v;
        const tujuan = normalizeEmpty(tujuan_perjalanan_dinas);
        const aktivitasVal = normalizeEmpty(aktivitas);
        const permasalahanVal = normalizeEmpty(permasalahan);
        const petugasRespondenVal = normalizeEmpty(petugas_responden);
        const solusiAntisipasiVal = normalizeEmpty(solusi_antisipasi);
        const activityTypeIdVal = normalizeEmpty(activity_type_id);
        const nomorSuratVal = normalizeEmpty(nomor_surat_tugas);

        const errors = [];
        if (!tujuan) errors.push('tujuan_perjalanan_dinas wajib diisi');
        if (!tanggal_pelaksanaan) errors.push('tanggal_pelaksanaan wajib diisi');
        if (!aktivitasVal) errors.push('aktivitas wajib diisi');

        const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        let computedHari = null;
        let tanggalISO = null;
        if (tanggal_pelaksanaan) {
            const d = new Date(tanggal_pelaksanaan);
            if (isNaN(d)) {
                errors.push('tanggal_pelaksanaan tidak valid');
            } else {
                computedHari = dayNames[d.getDay()];
                const pad = (n) => String(n).padStart(2, '0');
                tanggalISO = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
            }
        }
        if (!computedHari) errors.push('hari_pelaksanaan tidak dapat ditentukan dari tanggal_pelaksanaan');
        if (errors.length) return res.status(400).json({ message: 'Validasi gagal', errors });

        const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;

        const { rows: inserted } = await pg.query(
            `INSERT INTO reports (user_id, activity_type_id, nomor_surat_tugas, tujuan_perjalanan_dinas, tanggal_pelaksanaan,
             hari_pelaksanaan, aktivitas, permasalahan, petugas_responden, solusi_antisipasi)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING *`,
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
        const newReport = inserted[0];

        if (req.files && req.files['foto_dokumentasi[]'] && req.files['foto_dokumentasi[]'].length) {
            const values = [];
            const params = [];
            let idx = 1;
            for (const photo of req.files['foto_dokumentasi[]']) {
                values.push(`($${idx++}, $${idx++})`);
                params.push(newReport.id, normalizePath(photo.path));
            }
            await pg.query(
                `INSERT INTO report_photos (report_id, photo_path) VALUES ${values.join(',')}`,
                params
            );
        }

        const { rows: photos } = await pg.query('SELECT photo_path FROM report_photos WHERE report_id = $1', [newReport.id]);
        newReport.foto_dokumentasi = photos.map(p => p.photo_path);

        res.status(201).json({
            message: 'Laporan berhasil dibuat',
            report: newReport
        });
    } catch (error) {
        console.error('Error creating report:', {
            body: { ...req.body, foto_dokumentasi_count: (req.files && req.files['foto_dokumentasi[]']) ? req.files['foto_dokumentasi[]'].length : 0 },
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
                WHERE r.user_id = $1
                ORDER BY r.created_at DESC
            `;
            params = [req.user.id];
        }

        const { rows } = await pg.query(query, params);
        res.json(rows);
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
                    NULLIF(r.nomor_surat_tugas, '') AS nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, r.tanggal_pelaksanaan, r.hari_pelaksanaan,
                    r.aktivitas, r.permasalahan, r.petugas_responden, r.solusi_antisipasi,
                    r.created_at, r.updated_at,
                    u.name as pegawai_name,
                    at.name as activity_type_name
                FROM reports r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN activity_types at ON r.activity_type_id = at.id
                WHERE r.id = $1
            `;
            params = [id];
        } else {
            query = `
                SELECT
                    r.id, r.user_id, r.activity_type_id,
                    NULLIF(r.nomor_surat_tugas, '') AS nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, r.tanggal_pelaksanaan, r.hari_pelaksanaan,
                    r.aktivitas, r.permasalahan, r.petugas_responden, r.solusi_antisipasi,
                    r.created_at, r.updated_at,
                    u.name as pegawai_name,
                    at.name as activity_type_name
                FROM reports r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN activity_types at ON r.activity_type_id = at.id
                WHERE r.id = $1 AND r.user_id = $2
            `;
            params = [id, req.user.id];
        }

        const { rows } = await pg.query(query, params);
        const result = rows[0];
        
        if (!result) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        const { rows: photos } = await pg.query('SELECT photo_path FROM report_photos WHERE report_id = $1', [id]);
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

        const { rows: own } = await pg.query('SELECT * FROM reports WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (!own.length) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }
        const existingReport = own[0];

        const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        let computedHari = existingReport.hari_pelaksanaan || null;
        if (tanggal_pelaksanaan) {
            const d = new Date(tanggal_pelaksanaan);
            if (!isNaN(d)) computedHari = dayNames[d.getDay()];
        }

        const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;
        const deleteFile = (filePath) => {
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (err) { console.error(`Failed to delete file: ${filePath}`, err); }
            }
        };

        await pg.query(
            `UPDATE reports SET
             activity_type_id = $1, nomor_surat_tugas = $2, tujuan_perjalanan_dinas = $3, tanggal_pelaksanaan = $4, hari_pelaksanaan = $5,
             aktivitas = $6, permasalahan = $7, petugas_responden = $8, solusi_antisipasi = $9,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $10 AND user_id = $11`,
            [
             activity_type_id || null, nomor_surat_tugas || null, tujuan_perjalanan_dinas, tanggal_pelaksanaan, computedHari,
             aktivitas, permasalahan, petugas_responden, solusi_antisipasi, id, req.user.id
            ]
        );

        if (req.files['foto_dokumentasi[]']) {
            const { rows: oldPhotos } = await pg.query('SELECT photo_path FROM report_photos WHERE report_id = $1', [id]);
            oldPhotos.forEach(photo => deleteFile(photo.photo_path));
            await pg.query('DELETE FROM report_photos WHERE report_id = $1', [id]);

            const values = [];
            const params = [];
            let idx = 1;
            for (const photo of req.files['foto_dokumentasi[]']) {
                values.push(`($${idx++}, $${idx++})`);
                params.push(id, normalizePath(photo.path));
            }
            if (values.length) {
                await pg.query(`INSERT INTO report_photos (report_id, photo_path) VALUES ${values.join(',')}`, params);
            }
        }

        const { rows: updatedRows } = await pg.query('SELECT * FROM reports WHERE id = $1', [id]);
        const updatedReport = updatedRows[0];

        const { rows: photos } = await pg.query('SELECT photo_path FROM report_photos WHERE report_id = $1', [id]);
        updatedReport.foto_dokumentasi = photos.map(p => p.photo_path);

        res.json({
            message: 'Laporan berhasil diupdate',
            report: updatedReport
        });
    } catch (error) {
        console.error(`Error updating report with id ${req.params.id}:`, {
            body: { ...req.body, foto_dokumentasi_count: (req.files && req.files['foto_dokumentasi[]']) ? req.files['foto_dokumentasi[]'].length : 0 },
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

        const { rows: rep } = await pg.query('SELECT id FROM reports WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (!rep.length) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        const { rows: photos } = await pg.query('SELECT photo_path FROM report_photos WHERE report_id = $1', [id]);

        const { rowCount } = await pg.query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        for (const p of photos) {
            const storedPath = p.photo_path;
            if (!storedPath) continue;
            try {
                let candidatePaths = [];
                if (path.isAbsolute(storedPath)) {
                    candidatePaths.push(storedPath);
                } else {
                    candidatePaths.push(path.join(__dirname, '..', storedPath));
                    candidatePaths.push(path.join(process.cwd(), 'Lapor-Pengawasan', storedPath));
                }
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
        console.error('Delete report error -> id:', req.params.id, 'user:', req.user?.id, error);
        return res.status(500).json({ message: 'Server error while deleting report' });
    }
});

module.exports = router;
