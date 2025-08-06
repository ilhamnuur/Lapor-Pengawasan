/**
 * Create PostgreSQL database "lapor" (if not exists) using maintenance DB, then apply schema and run data migration.
 * Usage:
 *   node scripts/create_db_and_apply_schema.js
 *
 * Requirements:
 *   .env must contain DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
 *   DB_NAME is the target database name (defaults to 'lapor')
 */
require('dotenv').config();
const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');

const HOST = process.env.DB_HOST || '10.10.10.195';
const PORT = Number(process.env.DB_PORT || 5432);
const USER = process.env.DB_USER || 'casaos';
const PASSWORD = process.env.DB_PASSWORD || 'casaos';
const DBNAME = process.env.DB_NAME || 'lapor';

// Connect to maintenance DB 'postgres' to create target DB if needed
async function ensureDatabase() {
  const adminPool = new Pool({
    host: HOST,
    port: PORT,
    database: 'postgres',
    user: USER,
    password: PASSWORD,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [DBNAME]);
    if (rows.length === 0) {
      console.log(`[PG] Creating database "${DBNAME}"...`);
      await adminPool.query(`CREATE DATABASE "${DBNAME}"`);
      console.log(`[PG] Database "${DBNAME}" created`);
    } else {
      console.log(`[PG] Database "${DBNAME}" already exists`);
    }
  } finally {
    await adminPool.end().catch(()=>{});
  }
}

function runNode(scriptPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script exited with code ${code}: ${scriptPath}`));
    });
  });
}

(async () => {
  try {
    await ensureDatabase();
    // Apply schema on the target DB
    console.log('[STEP] Applying schema...');
    await runNode(path.join('scripts', 'apply_pg_schema.js'));

    // Migrate data from SQLite
    console.log('[STEP] Migrating data from SQLite -> PostgreSQL...');
    await runNode(path.join('scripts', 'migrate_sqlite_to_pg.js'));

    console.log('[DONE] Database created/applied schema and migration completed.');
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 1;
  }
})();