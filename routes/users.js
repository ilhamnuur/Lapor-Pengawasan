const express = require('express');
const bcrypt = require('bcryptjs');
const pg = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Get all users (Kepala only)
router.get('/', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { rows } = await pg.query('SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('[USERS] list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create user (Kepala only)
router.post('/', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        if (!username || !password || !name || !role) {
            return res.status(400).json({ message: 'Semua field harus diisi' });
        }
        if (!['pegawai', 'kepala'].includes(role)) {
            return res.status(400).json({ message: 'Role tidak valid' });
        }

        const { rows: exist } = await pg.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (exist.length) {
            return res.status(400).json({ message: 'Username sudah digunakan' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const { rows } = await pg.query(
            'INSERT INTO users (username, password, name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, name, role, created_at',
            [username, hashedPassword, name, role]
        );

        res.status(201).json({
            message: 'User berhasil ditambahkan',
            user: rows[0]
        });
    } catch (error) {
        console.error('[USERS] create error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user (Kepala only)
router.put('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, name, role } = req.body;

        if (!username || !name || !role) {
            return res.status(400).json({ message: 'Username, nama, dan role harus diisi' });
        }
        if (!['pegawai', 'kepala'].includes(role)) {
            return res.status(400).json({ message: 'Role tidak valid' });
        }

        const { rows: exists } = await pg.query('SELECT id FROM users WHERE id = $1', [id]);
        if (!exists.length) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        const { rows: dup } = await pg.query('SELECT 1 FROM users WHERE username = $1 AND id != $2', [username, id]);
        if (dup.length) {
            return res.status(400).json({ message: 'Username sudah digunakan' });
        }

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pg.query(
                'UPDATE users SET username = $1, password = $2, name = $3, role = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
                [username, hashedPassword, name, role, id]
            );
        } else {
            await pg.query(
                'UPDATE users SET username = $1, name = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
                [username, name, role, id]
            );
        }

        const { rows } = await pg.query('SELECT id, username, name, role, created_at FROM users WHERE id = $1', [id]);

        res.json({
            message: 'User berhasil diupdate',
            user: rows[0]
        });
    } catch (error) {
        console.error('[USERS] update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (Kepala only)
router.delete('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;

        const { rows: exists } = await pg.query('SELECT id FROM users WHERE id = $1', [id]);
        if (!exists.length) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        if (parseInt(id, 10) === req.user.id) {
            return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri' });
        }

        const { rows: cnt } = await pg.query('SELECT COUNT(*)::int as count FROM reports WHERE user_id = $1', [id]);
        if (cnt[0].count > 0) {
            return res.status(400).json({ message: 'Tidak dapat menghapus user yang memiliki laporan. Hapus laporan terlebih dahulu.' });
        }

        await pg.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ message: 'User berhasil dihapus' });
    } catch (error) {
        console.error('[USERS] delete error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload users from Excel (.xlsx) (Kepala only)
router.post('/upload', authenticateToken, authorizeRole(['kepala']), upload.single('usersFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ message: 'Invalid Excel file' });
        }

        const headerMap = {};
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell, col) => {
            const key = String(cell.value).trim().toLowerCase();
            if (['username', 'password', 'name', 'role'].includes(key)) {
                headerMap[key] = col;
            }
        });
        const requiredHeaders = ['username', 'password', 'name', 'role'];
        const missing = requiredHeaders.filter(h => !headerMap[h]);
        if (missing.length) {
            return res.status(400).json({ message: `Missing headers: ${missing.join(', ')}` });
        }

        let createdCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let r = 2; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            if (row.actualCellCount === 0) continue;

            const username = (row.getCell(headerMap['username']).value || '').toString().trim();
            const password = (row.getCell(headerMap['password']).value || '').toString().trim();
            const name = (row.getCell(headerMap['name']).value || '').toString().trim();
            const role = (row.getCell(headerMap['role']).value || '').toString().trim().toLowerCase();

            try {
                if (!username || !password || !name || !role) {
                    errorCount++;
                    errors.push(`Row ${r}: Missing data`);
                    continue;
                }
                if (!['pegawai', 'kepala'].includes(role)) {
                    errorCount++;
                    errors.push(`Row ${r}: Invalid role "${role}"`);
                    continue;
                }
                const { rows: exist } = await pg.query('SELECT 1 FROM users WHERE username = $1', [username]);
                if (exist.length) {
                    errorCount++;
                    errors.push(`Row ${r}: Username already exists "${username}"`);
                    continue;
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                await pg.query(
                    'INSERT INTO users (username, password, name, role) VALUES ($1,$2,$3,$4)',
                    [username, hashedPassword, name, role]
                );
                createdCount++;
            } catch (e) {
                errorCount++;
                errors.push(`Row ${r}: ${e.message}`);
            }
        }

        return res.status(201).json({
            message: `Upload complete. ${createdCount} users created, ${errorCount} errors.`,
            errors
        });
    } catch (err) {
        console.error('[USERS] upload error:', err);
        return res.status(500).json({ message: 'Server error while processing Excel' });
    }
});
 
// Download template Excel upload users (Kepala only)
router.get('/template', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template Users');

        const headers = ['username', 'password', 'name', 'role'];
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        sheet.addRow(['userbaru1', 'Passw0rd!', 'User Baru 1', 'pegawai']);

        sheet.columns = [
            { width: 20 },
            { width: 18 },
            { width: 25 },
            { width: 12 },
        ];

        sheet.addRow([]);
        sheet.addRow(['Keterangan: Kolom role hanya boleh bernilai "pegawai" atau "kepala"']);
        sheet.mergeCells('A3:D3');
        sheet.getCell('A3').font = { italic: true, color: { argb: 'FF666666' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_upload_users.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('[USERS] template error:', error);
        res.status(500).json({ message: 'Gagal membuat template' });
    }
});
 
module.exports = router;
