/**
 * Apply PostgreSQL schema by executing scripts/pg_schema.sql via pg client.
 * Usage: node scripts/apply_pg_schema.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

(async () => {
  const schemaPath = path.join(__dirname, 'pg_schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('Schema file not found:', schemaPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  const pool = new Pool({
    host: process.env.DB_HOST || '10.10.10.195',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'lapor',
    user: process.env.DB_USER || 'casaos',
    password: process.env.DB_PASSWORD || 'casaos',
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    console.log('[PG] Connecting to apply schema...');
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('[PG] Schema applied successfully from scripts/pg_schema.sql');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[PG] Failed applying schema:', err);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();