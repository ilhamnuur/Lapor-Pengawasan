const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'database', 'bps_tuban.db');

// Read migration SQL
const migrationSQL = fs.readFileSync(path.join(__dirname, 'database', 'migration_activity_types.sql'), 'utf8');

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to SQLite database.');
});

// Run migration
db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('Migration failed:', err.message);
    } else {
        console.log('Migration completed successfully!');
        console.log('- Created activity_types table');
        console.log('- Added activity_type_id column to reports table');
        console.log('- Inserted default activity types');
    }
    
    // Close database connection
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
});
