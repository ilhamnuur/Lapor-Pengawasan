const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
// Hard-disable SQLite auto-init to avoid dual-writes (kept file for reference only)
// If any module still requires ../config/database-sqlite by mistake, it should be removed in code.

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const pdfRoutes = require('./routes/pdf');
const userRoutes = require('./routes/users');
const excelRoutes = require('./routes/excel');
const activityTypeRoutes = require('./routes/activityTypes');
// Ensure .env is loaded and Postgres is reachable early
try {
  const pg = require('./config/database');
  pg.query('SELECT 1').catch(err => console.error('[Startup] PostgreSQL ping failed:', err?.message || err));
} catch (e) {
  console.error('[Startup] Failed to initialize PostgreSQL client:', e?.message || e);
}

const app = express();
const PORT = process.env.PORT || 3000;
console.log(`Application is trying to use port: ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Serve static files
app.use('/uploads', express.static(uploadsDir));
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/users', userRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/activity-types', activityTypeRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
