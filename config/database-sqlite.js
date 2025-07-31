const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '..', 'database', 'bps_tuban.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('pegawai', 'kepala')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Reports table
    db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        kegiatan_pengawasan TEXT NOT NULL,
        tanggal_pelaksanaan DATE NOT NULL,
        hari_pelaksanaan TEXT NOT NULL,
        aktivitas TEXT NOT NULL,
        permasalahan TEXT,
        surat_tugas_path TEXT,
        dokumen_visum_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Insert default users with bcrypt hashed passwords
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync(process.env.DEFAULT_PASSWORD || 'password123', 10);
    
    db.run(`INSERT OR IGNORE INTO users (username, password, name, role) VALUES 
        ('admin_kepala', ?, 'Kepala BPS Tuban', 'kepala')`, [defaultPassword]);
    
    db.run(`INSERT OR IGNORE INTO users (username, password, name, role) VALUES 
        ('pegawai1', ?, 'Ahmad Susanto', 'pegawai')`, [defaultPassword]);

    
    db.run(`INSERT OR IGNORE INTO users (username, password, name, role) VALUES 
        ('pegawai2', ?, 'Siti Nurhaliza', 'pegawai')`, [defaultPassword]);
});

// Promisify database methods for easier async/await usage
const dbAsync = {
    get: (sql, params) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: (sql, params) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    run: (sql, params) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }
};

module.exports = dbAsync;
