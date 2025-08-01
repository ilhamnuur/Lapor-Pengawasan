const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

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

module.exports = router;
