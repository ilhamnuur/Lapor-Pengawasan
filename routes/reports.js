const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Create report (Pegawai only)
router.post('/', authenticateToken, authorizeRole(['pegawai']), upload.fields([
    { name: 'surat_tugas', maxCount: 1 },
    { name: 'dokumen_visum', maxCount: 1 },
    { name: 'foto_dokumentasi', maxCount: 10 }
]), async (req, res) => {
    try {
        const {
            kegiatan_pengawasan,
            tanggal_pelaksanaan,
            hari_pelaksanaan,
            aktivitas,
            permasalahan
        } = req.body;

        const surat_tugas_path = req.files['surat_tugas'] ? req.files['surat_tugas'][0].filename : null;
        const dokumen_visum_path = req.files['dokumen_visum'] ? req.files['dokumen_visum'][0].filename : null;

        const result = await db.run(
            `INSERT INTO reports (user_id, kegiatan_pengawasan, tanggal_pelaksanaan, 
             hari_pelaksanaan, aktivitas, permasalahan, surat_tugas_path, dokumen_visum_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, kegiatan_pengawasan, tanggal_pelaksanaan, hari_pelaksanaan,
             aktivitas, permasalahan, surat_tugas_path, dokumen_visum_path]
        );

        const newReport = await db.get('SELECT * FROM reports WHERE id = ?', [result.id]);

        // Insert photo dokumentasi paths
        if (req.files['foto_dokumentasi']) {
            const photoInsertPromises = req.files['foto_dokumentasi'].map(photo => {
                return db.run(
                    `INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)`,
                    [newReport.id, photo.filename]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        res.status(201).json({
            message: 'Laporan berhasil dibuat',
            report: newReport
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
                SELECT r.*, u.name as pegawai_name 
                FROM reports r 
                JOIN users u ON r.user_id = u.id 
                ORDER BY r.created_at DESC
            `;
            params = [];
        } else {
            // Pegawai can only see their own reports
            query = `
                SELECT r.*, u.name as pegawai_name 
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
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
                SELECT r.*, u.name as pegawai_name 
                FROM reports r 
                JOIN users u ON r.user_id = u.id 
                WHERE r.id = ?
            `;
            params = [id];
        } else {
            query = `
                SELECT r.*, u.name as pegawai_name 
                FROM reports r 
                JOIN users u ON r.user_id = u.id 
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
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update report (Pegawai only, own reports)
router.put('/:id', authenticateToken, authorizeRole(['pegawai']), upload.fields([
    { name: 'surat_tugas', maxCount: 1 },
    { name: 'dokumen_visum', maxCount: 1 },
    { name: 'foto_dokumentasi', maxCount: 10 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            kegiatan_pengawasan,
            tanggal_pelaksanaan,
            hari_pelaksanaan,
            aktivitas,
            permasalahan
        } = req.body;

        // Check if report belongs to user
        const existingReport = await db.get(
            'SELECT * FROM reports WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (!existingReport) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        const surat_tugas_path = req.files['surat_tugas'] ? req.files['surat_tugas'][0].filename : existingReport.surat_tugas_path;
        const dokumen_visum_path = req.files['dokumen_visum'] ? req.files['dokumen_visum'][0].filename : existingReport.dokumen_visum_path;

        await db.run(
            `UPDATE reports SET 
             kegiatan_pengawasan = ?, tanggal_pelaksanaan = ?, hari_pelaksanaan = ?,
             aktivitas = ?, permasalahan = ?, surat_tugas_path = ?, dokumen_visum_path = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
            [kegiatan_pengawasan, tanggal_pelaksanaan, hari_pelaksanaan, aktivitas,
             permasalahan, surat_tugas_path, dokumen_visum_path, id, req.user.id]
        );

        // Delete existing photos for this report
        await db.run('DELETE FROM report_photos WHERE report_id = ?', [id]);

        // Insert new photo dokumentasi paths
        if (req.files['foto_dokumentasi']) {
            const photoInsertPromises = req.files['foto_dokumentasi'].map(photo => {
                return db.run(
                    `INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)`,
                    [id, photo.filename]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        const updatedReport = await db.get('SELECT * FROM reports WHERE id = ?', [id]);

        res.json({
            message: 'Laporan berhasil diupdate',
            report: updatedReport
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete report (Pegawai only, own reports)
router.delete('/:id', authenticateToken, authorizeRole(['pegawai']), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.run(
            'DELETE FROM reports WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }

        res.json({ message: 'Laporan berhasil dihapus' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
