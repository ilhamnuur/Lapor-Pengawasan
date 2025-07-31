const fs = require('fs');
const path = require('path');
const db = require('./config/database-sqlite');

async function runMigration() {
    try {
        const migrationSQL = fs.readFileSync(path.join(__dirname, 'database', 'migration_add_report_photos.sql'), 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await db.run(statement.trim());
                console.log('Executed:', statement.trim().substring(0, 50) + '...');
            }
        }
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
