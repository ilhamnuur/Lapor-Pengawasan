const express = require('express');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');

const upload = multer({ storage: multer.memoryStorage() });

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

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Nama jenis kegiatan wajib diisi' });
        }

        // Check if activity type already exists (case-insensitive)
        const existing = await db.get('SELECT * FROM activity_types WHERE LOWER(name) = LOWER(?)', [name.trim()]);
        if (existing) {
            return res.status(400).json({ message: 'Jenis kegiatan sudah ada' });
        }

        const result = await db.run(
            'INSERT INTO activity_types (name, description) VALUES (?, ?)',
            [name.trim(), description || null]
        );

        const newActivityType = await db.get('SELECT * FROM activity_types WHERE id = ?', [result.id]);

        res.status(201).json({
            message: 'Jenis kegiatan berhasil ditambahkan',
            activityType: newActivityType
        });
    } catch (error) {
        console.error('Create activity type error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update activity type (Kepala only)
router.put('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Nama jenis kegiatan wajib diisi' });
        }

        // Check if activity type exists
        const existing = await db.get('SELECT * FROM activity_types WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ message: 'Jenis kegiatan tidak ditemukan' });
        }

        // Check duplicate by name on other rows (case-insensitive)
        const duplicate = await db.get('SELECT * FROM activity_types WHERE LOWER(name) = LOWER(?) AND id != ?', [name.trim(), id]);
        if (duplicate) {
            return res.status(400).json({ message: 'Jenis kegiatan sudah ada' });
        }

        await db.run(
            'UPDATE activity_types SET name = ?, description = ? WHERE id = ?',
            [name.trim(), description || null, id]
        );

        const updatedActivityType = await db.get('SELECT * FROM activity_types WHERE id = ?', [id]);

        res.json({
            message: 'Jenis kegiatan berhasil diupdate',
            activityType: updatedActivityType
        });
    } catch (error) {
        console.error('Update activity type error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete activity type (Kepala only) with usage validation
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
            return res.status(400).json({ message: `Tidak dapat menghapus. Jenis kegiatan sedang dipakai oleh ${reports.count} laporan.` });
        }

        await db.run('DELETE FROM activity_types WHERE id = ?', [id]);

        res.json({ message: 'Jenis kegiatan berhasil dihapus' });
    } catch (error) {
        console.error('Delete activity type error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Download Excel template for activity types (Kepala only)
router.get('/template', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template Jenis Kegiatan');

        // Header
        const headers = ['name', 'description'];
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        // Example row
        sheet.addRow(['Pengumpulan Data Rutin', 'Kegiatan pengumpulan data bulanan']);

        // Column widths
        sheet.columns = [
            { width: 35 },
            { width: 50 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_jenis_kegiatan.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating activity types template:', error);
        res.status(500).json({ message: 'Gagal membuat template' });
    }
});

// Upload activity types from Excel (Kepala only)
router.post('/upload', authenticateToken, authorizeRole(['kepala']), upload.single('activityTypesFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ message: 'Sheet tidak ditemukan' });

        // Expect headers in first row: name, description
        const headerRow = sheet.getRow(1);
        const colName = (headerRow.getCell(1).value || '').toString().toLowerCase();
        const colDesc = (headerRow.getCell(2).value || '').toString().toLowerCase();
        if (colName !== 'name' || colDesc !== 'description') {
            return res.status(400).json({ message: 'Header tidak valid. Gunakan kolom: name, description' });
        }

        let created = 0;
        let updated = 0;
        const errors = [];

        for (let r = 2; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const name = (row.getCell(1).value || '').toString().trim();
            const description = row.getCell(2).value ? row.getCell(2).value.toString().trim() : null;

            if (!name) {
                errors.push(`Baris ${r}: name kosong`);
                continue;
            }

            // Upsert: if name exists (case-insensitive), update description; else create new
            const existing = await db.get('SELECT id FROM activity_types WHERE LOWER(name) = LOWER(?)', [name]);
            if (existing) {
                await db.run('UPDATE activity_types SET description = ? WHERE id = ?', [description, existing.id]);
                updated++;
            } else {
                await db.run('INSERT INTO activity_types (name, description) VALUES (?, ?)', [name, description]);
                created++;
            }
        }

        res.status(201).json({
            message: `Upload selesai. Dibuat: ${created}, Diupdate: ${updated}, Error: ${errors.length}`,
            errors
        });
    } catch (error) {
        console.error('Upload activity types error:', error);
        res.status(500).json({ message: 'Server error saat upload jenis kegiatan' });
    }
});

module.exports = router;
