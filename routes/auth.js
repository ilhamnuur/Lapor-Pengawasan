const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pg = require('../config/database');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const { rows } = await pg.query(
            'SELECT * FROM users WHERE username = $1 LIMIT 1',
            [username]
        );
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login berhasil',
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('[AUTH] login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
