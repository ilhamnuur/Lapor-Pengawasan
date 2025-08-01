const express = require('express');
const path = require('path');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const upload = require('../middleware/multer');
const router = express.Router();

const fs = require('fs');

// Create report (Pegawai only)
router.post('/', authenticateToken, authorizeRole(['pegawai']), upload.fields([
    { name: 'foto_dokumentasi', maxCount: 10 }
]), async (req, res) => {
    try {
        const {
            kegiatan_pengawasan,
            tanggal_pelaksanaan,
            hari_pelaksanaan,
            aktivitas,
            permasalahan,
            activity_type_id,
            petugas_responden,
            solusi_antisipasi
        } = req.body;

        const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;

        const result = await db.run(
            `INSERT INTO reports (user_id, activity_type_id, kegiatan_pengawasan, tanggal_pelaksanaan,
             hari_pelaksanaan, aktivitas, permasalahan, petugas_responden, solusi_antisipasi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, activity_type_id, kegiatan_pengawasan, tanggal_pelaksanaan, hari_pelaksanaan,
             aktivitas, permasalahan, petugas_responden, solusi_antisipasi]
        );

        const newReport = await db.get('SELECT * FROM reports WHERE id = ?', [result.id]);

        // Insert photo dokumentasi paths
        if (req.files['foto_dokumentasi']) {
            const photoInsertPromises = req.files['foto_dokumentasi'].map(photo => {
                return db.run(
                    `INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)`,
                    [newReport.id, normalizePath(photo.path)]
                );
            });
            await Promise.all(photoInsertPromises);
        }

        res.status(201).json({
            message: 'Laporan berhasil dibuat',
            report: newReport
        });
    } catch (error) {
        console.error('Error creating report:', error);
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
                SELECT r.*, u.name as pegawai_name, at.name as activity_type_name
                FROM reports r 
                JOIN users u ON r.user_id = u.id 
                LEFT JOIN activity_types at ON r.activity_type_id = at.id
                WHERE r.id = ?
            `;
            params = [id];
        } else {
            query = `
                SELECT r.*, u.name as pegawai_name, at.name as activity_type_name
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
    { name: 'foto_dokumentasi', maxCount: 10 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            kegiatan_pengawasan,
            tanggal_pelaksanaan,
            hari_pelaksanaan,
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
             activity_type_id = ?, kegiatan_pengawasan = ?, tanggal_pelaksanaan = ?, hari_pelaksanaan = ?,
             aktivitas = ?, permasalahan = ?, petugas_responden = ?, solusi_antisipasi = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
            [activity_type_id, kegiatan_pengawasan, tanggal_pelaksanaan, hari_pelaksanaan, aktivitas,
             permasalahan, petugas_responden, solusi_antisipasi, id, req.user.id]
        );

        // Handle photo updates
        if (req.files['foto_dokumentasi']) {
            // Delete old photos from filesystem and DB
            const oldPhotos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [id]);
            oldPhotos.forEach(photo => deleteFile(photo.photo_path));
            await db.run('DELETE FROM report_photos WHERE report_id = ?', [id]);

            // Insert new photo paths
            const photoInsertPromises = req.files['foto_dokumentasi'].map(photo => {
                return db.run(
                    `INSERT INTO report_photos (report_id, photo_path) VALUES (?, ?)`,
                    [id, normalizePath(photo.path)]
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
        console.error(`Error updating report with id ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while updating report' });
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
        console.error(`Error deleting report with id ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while deleting report' });
    }
});

module.exports = router;
