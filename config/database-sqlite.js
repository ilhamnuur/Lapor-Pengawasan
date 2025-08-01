const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '..', 'database', 'bps_tuban.db');
const db = new sqlite3.Database(dbPath);

// Promisify database methods for easier async/await usage
const dbAsync = {
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },
    
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
};

// Initialize database tables
const initDatabase = async () => {
    try {
        // Create users table
        await dbAsync.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'pegawai' CHECK (role IN ('pegawai', 'kepala')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create activity_types table
        await dbAsync.exec(`
            CREATE TABLE IF NOT EXISTS activity_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create reports table
        await dbAsync.exec(`
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                activity_type_id INTEGER,
                kegiatan_pengawasan VARCHAR(255) NOT NULL,
                tanggal_pelaksanaan DATE NOT NULL,
                hari_pelaksanaan VARCHAR(20) NOT NULL,
                aktivitas TEXT NOT NULL,
                permasalahan TEXT,
                surat_tugas_path VARCHAR(255),
                dokumen_visum_path VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (activity_type_id) REFERENCES activity_types(id)
            )
        `);

        // Create report_photos table
        await dbAsync.exec(`
            CREATE TABLE IF NOT EXISTS report_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                photo_path VARCHAR(255) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
            )
        `);

        // Insert default admin user if not exists
        const adminExists = await dbAsync.get('SELECT * FROM users WHERE username = ?', ['admin_kepala']);
        if (!adminExists) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);
            await dbAsync.run(
                'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
                ['admin_kepala', hashedPassword, 'Administrator Kepala', 'kepala']
            );
        }

        // Insert default pegawai user if not exists
        const pegawaiExists = await dbAsync.get('SELECT * FROM users WHERE username = ?', ['pegawai1']);
        if (!pegawaiExists) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);
            await dbAsync.run(
                'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
                ['pegawai1', hashedPassword, 'Pegawai Satu', 'pegawai']
            );
        }

        // Insert default activity types if not exists
        const activityTypesCount = await dbAsync.get('SELECT COUNT(*) as count FROM activity_types');
        if (activityTypesCount.count === 0) {
            const defaultActivityTypes = [
                { name: 'Sensus Penduduk', description: 'Kegiatan pengawasan sensus penduduk' },
                { name: 'Survei Ekonomi', description: 'Kegiatan pengawasan survei ekonomi' },
                { name: 'Survei Sosial', description: 'Kegiatan pengawasan survei sosial' },
                { name: 'Pengumpulan Data Rutin', description: 'Kegiatan pengawasan pengumpulan data rutin' },
                { name: 'Verifikasi Data', description: 'Kegiatan pengawasan verifikasi data' }
            ];

            for (const activityType of defaultActivityTypes) {
                await dbAsync.run(
                    'INSERT INTO activity_types (name, description) VALUES (?, ?)',
                    [activityType.name, activityType.description]
                );
            }
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// Initialize database on startup
initDatabase();

module.exports = dbAsync;
