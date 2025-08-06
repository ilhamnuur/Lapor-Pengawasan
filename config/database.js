const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || '10.10.10.195',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'lapor',
    user: process.env.DB_USER || 'casaos',
    password: process.env.DB_PASSWORD || 'casaos',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Simple health check on startup
pool.on('error', (err) => {
  console.error('[PG POOL ERROR]', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
