const express = require('express');
const path = require('path');
const pg = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const upload = require('../middleware/multer');
const router = express.Router();

const fs = require('fs');

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Normalisasi tanggal ke format YYYY-MM-DD tanpa terpengaruh timezone.
// Menerima input date (YYYY-MM-DD), ISO datetime, atau objek Date dari driver.
function normalizeDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        const pad = (n) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }

    const str = String(value).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function dayNameFromDateOnly(dateOnly) {
    if (!dateOnly) return null;
    const [year, month, day] = dateOnly.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return null;
    return dayNames[d.getDay()];
}

function formatDateIndo(dateOnly) {
    if (!dateOnly) return '-';
    const [year, month, day] = dateOnly.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return dateOnly;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Pastikan :id berupa angka agar kesalahan input tidak menjadi error 500 dari PostgreSQL.
function parseReportId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Cek bentrok jadwal. Satu pegawai hanya boleh punya satu laporan per tanggal.
async function findDateConflict(userId, dateOnly, excludeReportId = null) {
    const params = [userId, dateOnly];
    let query = `SELECT id, tujuan_perjalanan_dinas, tanggal_pelaksanaan
                 FROM reports
                 WHERE user_id = $1 AND tanggal_pelaksanaan = $2::date`;
    if (excludeReportId != null) {
        params.push(excludeReportId);
        query += ` AND id <> $3`;
    }
    query += ' LIMIT 1';
    const { rows } = await pg.query(query, params);
    return rows[0] || null;
}

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

        let computedHari = null;
        let tanggalISO = null;
        if (tanggal_pelaksanaan) {
            tanggalISO = normalizeDateOnly(tanggal_pelaksanaan);
            if (!tanggalISO) {
                errors.push('tanggal_pelaksanaan tidak valid');
            } else {
                computedHari = dayNameFromDateOnly(tanggalISO);
            }
        }
        if (!computedHari) errors.push('hari_pelaksanaan tidak dapat ditentukan dari tanggal_pelaksanaan');
        if (errors.length) return res.status(400).json({ message: 'Validasi gagal', errors });

        // Validasi: tanggal yang sudah dipakai untuk pengawasan tidak bisa diinput lagi.
        const conflict = await findDateConflict(req.user.id, tanggalISO);
        if (conflict) {
            return res.status(409).json({
                message: `Tanggal ${formatDateIndo(tanggalISO)} sudah dipakai untuk laporan pengawasan. Silakan pilih tanggal lain.`,
                code: 'DATE_ALREADY_USED',
                conflictingReportId: conflict.id
            });
        }

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

        // Driver pg mengembalikan kolom DATE sebagai objek Date (tengah malam waktu lokal).
        // Tanpa normalisasi, JSON.stringify menghasilkan ISO UTC yang bisa mundur satu hari (WIB = UTC+7).
        newReport.tanggal_pelaksanaan = normalizeDateOnly(newReport.tanggal_pelaksanaan);

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
        if (error?.code === '23505') {
            return res.status(409).json({
                message: 'Tanggal tersebut sudah dipakai untuk laporan pengawasan. Silakan pilih tanggal lain.',
                code: 'DATE_ALREADY_USED'
            });
        }
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
                    r.tujuan_perjalanan_dinas, TO_CHAR(r.tanggal_pelaksanaan, 'YYYY-MM-DD') AS tanggal_pelaksanaan, r.hari_pelaksanaan,
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
                    r.tujuan_perjalanan_dinas, TO_CHAR(r.tanggal_pelaksanaan, 'YYYY-MM-DD') AS tanggal_pelaksanaan, r.hari_pelaksanaan,
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

// Get dates that already have reports (used by calendar & client-side validation)
router.get('/used-dates', authenticateToken, async (req, res) => {
    try {
        const params = [];
        const conditions = [];

        if (req.user.role !== 'kepala') {
            params.push(req.user.id);
            conditions.push(`r.user_id = $${params.length}`);
        }
        if (req.query.from) {
            params.push(req.query.from);
            conditions.push(`r.tanggal_pelaksanaan >= $${params.length}::date`);
        }
        if (req.query.to) {
            params.push(req.query.to);
            conditions.push(`r.tanggal_pelaksanaan <= $${params.length}::date`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await pg.query(
            `SELECT TO_CHAR(r.tanggal_pelaksanaan, 'YYYY-MM-DD') AS tanggal,
                    r.id, r.user_id, r.tujuan_perjalanan_dinas, r.hari_pelaksanaan,
                    u.name AS pegawai_name
             FROM reports r
             JOIN users u ON r.user_id = u.id
             ${where}
             ORDER BY r.tanggal_pelaksanaan ASC, r.id ASC`,
            params
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching used dates:', error);
        res.status(500).json({ message: 'Server error while fetching used dates' });
    }
});

// Get single report
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseReportId(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: 'ID laporan tidak valid' });
        }
        let query;
        let params;

        if (req.user.role === 'kepala') {
            query = `
                SELECT
                    r.id, r.user_id, r.activity_type_id,
                    NULLIF(r.nomor_surat_tugas, '') AS nomor_surat_tugas,
                    r.tujuan_perjalanan_dinas, TO_CHAR(r.tanggal_pelaksanaan, 'YYYY-MM-DD') AS tanggal_pelaksanaan, r.hari_pelaksanaan,
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
                    r.tujuan_perjalanan_dinas, TO_CHAR(r.tanggal_pelaksanaan, 'YYYY-MM-DD') AS tanggal_pelaksanaan, r.hari_pelaksanaan,
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
        const id = parseReportId(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: 'ID laporan tidak valid' });
        }
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

        // Tanggal: gunakan tanggal baru bila dikirim, jika tidak pertahankan tanggal tersimpan.
        // Normalisasi wajib agar nilai dari <input type="date"> / ISO datetime selalu YYYY-MM-DD.
        const originalDate = normalizeDateOnly(existingReport.tanggal_pelaksanaan);
        const tanggalISO = normalizeDateOnly(tanggal_pelaksanaan || existingReport.tanggal_pelaksanaan);
        if (!tanggalISO) {
            return res.status(400).json({ message: 'Tanggal pelaksanaan tidak valid' });
        }
        const computedHari = dayNameFromDateOnly(tanggalISO);

        // Validasi bentrok hanya saat tanggal diubah. Mengedit laporan lama pada tanggal
        // yang sama harus tetap diperbolehkan, termasuk jika ada data duplikat historis.
        if (tanggalISO !== originalDate) {
            const conflict = await findDateConflict(req.user.id, tanggalISO, Number(id));
            if (conflict) {
                return res.status(409).json({
                    message: `Tanggal ${formatDateIndo(tanggalISO)} sudah dipakai untuk laporan pengawasan. Silakan pilih tanggal lain.`,
                    code: 'DATE_ALREADY_USED',
                    conflictingReportId: conflict.id
                });
            }
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
             activity_type_id || null, nomor_surat_tugas || null, tujuan_perjalanan_dinas, tanggalISO, computedHari,
             aktivitas, permasalahan, petugas_responden, solusi_antisipasi, id, req.user.id
            ]
        );

        if (req.files && req.files['foto_dokumentasi[]']) {
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
        updatedReport.tanggal_pelaksanaan = normalizeDateOnly(updatedReport.tanggal_pelaksanaan);

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
        if (error?.code === '23505') {
            return res.status(409).json({
                message: 'Tanggal tersebut sudah dipakai untuk laporan pengawasan. Silakan pilih tanggal lain.',
                code: 'DATE_ALREADY_USED'
            });
        }
        res.status(500).json({ message: 'Server error while updating report' });
    }
});

// Delete report (Pegawai only, own reports)
router.delete('/:id', authenticateToken, authorizeRole(['pegawai']), async (req, res) => {
    try {
        const id = parseReportId(req.params.id);
        if (id === null) {
            return res.status(400).json({ message: 'ID laporan tidak valid' });
        }

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
