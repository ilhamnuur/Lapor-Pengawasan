const jwt = require('jsonwebtoken');
const db = require('../config/database-sqlite');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const secretKey = process.env.JWT_SECRET;
        if (!secretKey) {
            console.error("JWT_SECRET is not defined in environment variables.");
            return res.status(500).json({ message: "Server configuration error" });
        }

        const decoded = jwt.verify(token, secretKey);
        
        // Get user from database
        const user = await db.get('SELECT id, username, name, role FROM users WHERE id = ?', [decoded.id]);
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        next();
    };
};

module.exports = { authenticateToken, authorizeRole };
