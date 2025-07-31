const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Middleware: authenticate and authorize only kepala role
router.use(authenticateToken);
router.use(authorizeRole('kepala'));

// GET /api/users - list all users
router.get('/', async (req, res) => {
    try {
        const users = await db.all('SELECT id, username, name, role FROM users ORDER BY id ASC');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/users - create new user
router.post('/', async (req, res) => {
    try {
        const { username, name, password, role } = req.body;
        if (!username || !name || !password || !role) {
            return res.status(400).json({ message: 'Semua field harus diisi' });
        }

        // Check if username already exists
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(409).json({ message: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        await db.run(
            'INSERT INTO users (username, name, password, role) VALUES (?, ?, ?, ?)',
            [username, name, hashedPassword, role]
        );

        res.status(201).json({ message: 'User berhasil ditambahkan' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/users/:id - update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, name, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!existingUser) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }
        
        // If password is provided, hash it
        let updateQuery = 'UPDATE users SET username = ?, name = ?, role = ?';
        const updateParams = [username, name, role];
        
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = 'UPDATE users SET username = ?, name = ?, password = ?, role = ?';
            updateParams.splice(2, 0, hashedPassword);
        }
        
        updateQuery += ' WHERE id = ?';
        updateParams.push(id);
        
        await db.run(updateQuery, updateParams);
        
        res.json({ message: 'User berhasil diupdate' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/users/:id - delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user exists
        const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!existingUser) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }
        
        // Prevent deleting the current user (admin)
        if (req.user.id == id) {
            return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri' });
        }
        
        // Delete user
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        
        res.json({ message: 'User berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
