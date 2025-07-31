const express = require('express');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Get all activity types
router.get('/', authenticateToken, async (req, res) => {
    try {
        const activityTypes = await db.all('SELECT * FROM activity_types ORDER BY name');
        res.json(activityTypes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create activity type (Kepala only)
router.post('/', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check if activity type already exists
        const existing = await db.get('SELECT * FROM activity_types WHERE name = ?', [name]);
        if (existing) {
            return res.status(400).json({ message: 'Jenis kegiatan sudah ada' });
        }

        const result = await db.run(
            'INSERT INTO activity_types (name, description) VALUES (?, ?)',
            [name, description]
        );

        const newActivityType = await db.get('SELECT * FROM activity_types WHERE id = ?', [result.id]);

        res.status(201).json({
            message: 'Jenis kegiatan berhasil ditambahkan',
            activityType: newActivityType
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update activity type (Kepala only)
router.put('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        // Check if activity type exists
        const existing = await db.get('SELECT * FROM activity_types WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ message: 'Jenis kegiatan tidak ditemukan' });
        }

        // Check if another activity type with the same name exists
        const duplicate = await db.get('SELECT * FROM activity_types WHERE name = ? AND id != ?', [name, id]);
        if (duplicate) {
            return res.status(400).json({ message: 'Jenis kegiatan sudah ada' });
        }

        await db.run(
            'UPDATE activity_types SET name = ?, description = ? WHERE id = ?',
            [name, description, id]
        );

        const updatedActivityType = await db.get('SELECT * FROM activity_types WHERE id = ?', [id]);

        res.json({
            message: 'Jenis kegiatan berhasil diupdate',
            activityType: updatedActivityType
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete activity type (Kepala only)
router.delete('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if activity type exists
        const existing = await db.get('SELECT * FROM activity_types WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ message: 'Jenis kegiatan tidak ditemukan' });
        }

        // Check if there are reports using this activity type
        const reports = await db.get('SELECT COUNT(*) as count FROM reports WHERE activity_type_id = ?', [id]);
        if (reports.count > 0) {
            return res.status(400).json({ message: 'Tidak dapat menghapus jenis kegiatan yang masih digunakan dalam laporan' });
        }

        await db.run('DELETE FROM activity_types WHERE id = ?', [id]);

        res.json({ message: 'Jenis kegiatan berhasil dihapus' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
