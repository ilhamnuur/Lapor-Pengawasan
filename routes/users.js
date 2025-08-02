const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Get all users (Kepala only)
router.get('/', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const users = await db.all('SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create user (Kepala only)
router.post('/', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        // Validate input
        if (!username || !password || !name || !role) {
            return res.status(400).json({ message: 'Semua field harus diisi' });
        }

        if (!['pegawai', 'kepala'].includes(role)) {
            return res.status(400).json({ message: 'Role tidak valid' });
        }

        // Check if username already exists
        const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(400).json({ message: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await db.run(
            'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, name, role]
        );

        const newUser = await db.get('SELECT id, username, name, role, created_at FROM users WHERE id = ?', [result.id]);

        res.status(201).json({
            message: 'User berhasil ditambahkan',
            user: newUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user (Kepala only)
router.put('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, name, role } = req.body;

        // Validate input
        if (!username || !name || !role) {
            return res.status(400).json({ message: 'Username, nama, dan role harus diisi' });
        }

        if (!['pegawai', 'kepala'].includes(role)) {
            return res.status(400).json({ message: 'Role tidak valid' });
        }

        // Check if user exists
        const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [id]);
        if (!existingUser) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        // Check if username is taken by another user
        const duplicateUser = await db.get('SELECT * FROM users WHERE username = ? AND id != ?', [username, id]);
        if (duplicateUser) {
            return res.status(400).json({ message: 'Username sudah digunakan' });
        }

        // Prepare update query
        let updateQuery = 'UPDATE users SET username = ?, name = ?, role = ? WHERE id = ?';
        let params = [username, name, role, id];

        // If password is provided, hash it and include in update
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = 'UPDATE users SET username = ?, password = ?, name = ?, role = ? WHERE id = ?';
            params = [username, hashedPassword, name, role, id];
        }

        await db.run(updateQuery, params);

        const updatedUser = await db.get('SELECT id, username, name, role, created_at FROM users WHERE id = ?', [id]);

        res.json({
            message: 'User berhasil diupdate',
            user: updatedUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (Kepala only)
router.delete('/:id', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [id]);
        if (!existingUser) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        // Prevent deleting self
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri' });
        }

        // Check if user has reports
        const userReports = await db.get('SELECT COUNT(*) as count FROM reports WHERE user_id = ?', [id]);
        if (userReports.count > 0) {
            return res.status(400).json({ message: 'Tidak dapat menghapus user yang memiliki laporan. Hapus laporan terlebih dahulu.' });
        }

        await db.run('DELETE FROM users WHERE id = ?', [id]);

        res.json({ message: 'User berhasil dihapus' });
    } catch (error) {
        console.error(error);
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

        // Expect header: username | password | name | role
        // Find header row (assume row 1)
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
            // Skip empty rows
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
                const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
                if (existingUser) {
                    errorCount++;
                    errors.push(`Row ${r}: Username already exists "${username}"`);
                    continue;
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.run(
                    'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
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
        console.error('Error processing Excel upload:', err);
        return res.status(500).json({ message: 'Server error while processing Excel' });
    }
});
 
// Download template Excel upload users (Kepala only)
router.get('/template', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template Users');

        // Header
        const headers = ['username', 'password', 'name', 'role'];
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        // Example row
        sheet.addRow(['userbaru1', 'Passw0rd!', 'User Baru 1', 'pegawai']);

        // Column widths
        sheet.columns = [
            { width: 20 },
            { width: 18 },
            { width: 25 },
            { width: 12 },
        ];

        // Notes
        sheet.addRow([]);
        sheet.addRow(['Keterangan: Kolom role hanya boleh bernilai "pegawai" atau "kepala"']);
        sheet.mergeCells('A3:D3');
        sheet.getCell('A3').font = { italic: true, color: { argb: 'FF666666' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_upload_users.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating users template:', error);
        res.status(500).json({ message: 'Gagal membuat template' });
    }
});
 
module.exports = router;
