const express = require('express');
const pg = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');

const upload = multer({ storage: multer.memoryStorage() });

// Get all activity types
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pg.query('SELECT * FROM activity_types ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('[ACTIVITY_TYPES] list error:', error);
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

        const { rows: exist } = await pg.query('SELECT 1 FROM activity_types WHERE LOWER(name) = LOWER($1)', [name.trim()]);
        if (exist.length) {
            return res.status(400).json({ message: 'Jenis kegiatan sudah ada' });
        }

        const { rows } = await pg.query(
            'INSERT INTO activity_types (name, description) VALUES ($1,$2) RETURNING *',
            [name.trim(), description || null]
        );

        res.status(201).json({
            message: 'Jenis kegiatan berhasil ditambahkan',
            activityType: rows[0]
        });
    } catch (error) {
        console.error('[ACTIVITY_TYPES] create error:', error);
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

        const { rows: exist } = await pg.query('SELECT id FROM activity_types WHERE id = $1', [id]);
        if (!exist.length) {
            return res.status(404).json({ message: 'Jenis kegiatan tidak ditemukan' });
        }

        const { rows: dup } = await pg.query(
            'SELECT 1 FROM activity_types WHERE LOWER(name) = LOWER($1) AND id != $2',
            [name.trim(), id]
        );
        if (dup.length) {
            return res.status(400).json({ message: 'Jenis kegiatan sudah ada' });
        }

        await pg.query('UPDATE activity_types SET name = $1, description = $2 WHERE id = $3', [name.trim(), description || null, id]);

        const { rows } = await pg.query('SELECT * FROM activity_types WHERE id = $1', [id]);

        res.json({
            message: 'Jenis kegiatan berhasil diupdate',
            activityType: rows[0]
        });
    } catch (error) {
        console.error('[ACTIVITY_TYPES] update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete activity type (Kepala only) with usage validation
router.delete('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;

        const { rows: exist } = await pg.query('SELECT id FROM activity_types WHERE id = $1', [id]);
        if (!exist.length) {
            return res.status(404).json({ message: 'Jenis kegiatan tidak ditemukan' });
        }

        const { rows: cnt } = await pg.query('SELECT COUNT(*)::int AS count FROM reports WHERE activity_type_id = $1', [id]);
        if (cnt[0].count > 0) {
            return res.status(400).json({ message: `Tidak dapat menghapus. Jenis kegiatan sedang dipakai oleh ${cnt[0].count} laporan.` });
        }

        await pg.query('DELETE FROM activity_types WHERE id = $1', [id]);

        res.json({ message: 'Jenis kegiatan berhasil dihapus' });
    } catch (error) {
        console.error('[ACTIVITY_TYPES] delete error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Download Excel template for activity types (Kepala only)
router.get('/template', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template Jenis Kegiatan');

        const headers = ['name', 'description'];
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        sheet.addRow(['Pengumpulan Data Rutin', 'Kegiatan pengumpulan data bulanan']);

        sheet.columns = [
            { width: 35 },
            { width: 50 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_jenis_kegiatan.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('[ACTIVITY_TYPES] template error:', error);
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

            const { rows: existing } = await pg.query('SELECT id FROM activity_types WHERE LOWER(name) = LOWER($1)', [name]);
            if (existing.length) {
                await pg.query('UPDATE activity_types SET description = $1 WHERE id = $2', [description, existing[0].id]);
                updated++;
            } else {
                await pg.query('INSERT INTO activity_types (name, description) VALUES ($1, $2)', [name, description]);
                created++;
            }
        }

        res.status(201).json({
            message: `Upload selesai. Dibuat: ${created}, Diupdate: ${updated}, Error: ${errors.length}`,
            errors
        });
    } catch (error) {
        console.error('[ACTIVITY_TYPES] upload error:', error);
        res.status(500).json({ message: 'Server error saat upload jenis kegiatan' });
    }
});

module.exports = router;
