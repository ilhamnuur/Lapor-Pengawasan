/**
 * Migration script: Copy data from SQLite to PostgreSQL
 * Source: ./database/bps_tuban.db (SQLite)
 * Target: PostgreSQL from env (.env): DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *
 * Steps:
 * 1) Ensure PostgreSQL schema exists by executing scripts/pg_schema.sql beforehand.
 * 2) Read all rows from SQLite tables in dependency order.
 * 3) Insert into PostgreSQL with proper ID preservation where safe (users, activity_types, reports, report_photos).
 *
 * Run:
 *   node scripts/migrate_sqlite_to_pg.js
 *
 * Notes:
 * - This script truncates destination tables before inserting (idempotent).
 * - It preserves IDs by using explicit ID insert and resetting sequences.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const sqlitePath = path.join(__dirname, '..', 'database', 'bps_tuban.db');
const pgPool = new Pool({
  host: process.env.DB_HOST || '10.10.10.195',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'lapor',
  user: process.env.DB_USER || 'casaos',
  password: process.env.DB_PASSWORD || 'casaos',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

function openSQLite(dbFile) {
  if (!fs.existsSync(dbFile)) {
    throw new Error(`SQLite file not found: ${dbFile}`);
  }
  return new sqlite3.Database(dbFile);
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function pgExec(text, params) {
  return pgPool.query(text, params);
}

async function withTx(fn) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function ensurePgSchema() {
  const schemaPath = path.join(__dirname, 'pg_schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn('pg_schema.sql not found, skipping schema creation');
    return;
  }
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pgExec(sql);
  console.log('[PG] Schema ensured via scripts/pg_schema.sql');
}

async function truncateDestTables() {
  // Order matters due to FKs
  await pgExec('TRUNCATE TABLE report_photos RESTART IDENTITY CASCADE;');
  await pgExec('TRUNCATE TABLE reports RESTART IDENTITY CASCADE;');
  await pgExec('TRUNCATE TABLE activity_types RESTART IDENTITY CASCADE;');
  await pgExec('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
  console.log('[PG] Truncated destination tables');
}

async function resetSequences() {
  // Align sequences with max(id)
  await pgExec(`SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);`);
  await pgExec(`SELECT setval(pg_get_serial_sequence('activity_types','id'), COALESCE((SELECT MAX(id) FROM activity_types), 0) + 1, false);`);
  await pgExec(`SELECT setval(pg_get_serial_sequence('reports','id'), COALESCE((SELECT MAX(id) FROM reports), 0) + 1, false);`);
  await pgExec(`SELECT setval(pg_get_serial_sequence('report_photos','id'), COALESCE((SELECT MAX(id) FROM report_photos), 0) + 1, false);`);
  console.log('[PG] Sequences reset');
}

async function migrate() {
  const sdb = openSQLite(sqlitePath);
  try {
    // Load data from SQLite in dependency-safe order
    const users = await sqliteAll(sdb, `SELECT id, username, password, name, role, created_at, updated_at FROM users ORDER BY id;`).catch(async (e) => {
      // fallback if updated_at missing
      if (String(e.message || '').includes('no such column: updated_at')) {
        return sqliteAll(sdb, `SELECT id, username, password, name, role, created_at FROM users ORDER BY id;`).then(rows =>
          rows.map(r => ({ ...r, updated_at: r.created_at || null }))
        );
      }
      throw e;
    });

    const activityTypes = await sqliteAll(sdb, `SELECT id, name, description, created_at FROM activity_types ORDER BY id;`);

    // Read reports with backward compatible column handling.
    // Try selecting tujuan_perjalanan_dinas; if column doesn't exist, fall back to kegiatan_pengawasan.
    let reports = [];
    try {
      reports = await sqliteAll(sdb, `
        SELECT
          id, user_id, activity_type_id, nomor_surat_tugas,
          tujuan_perjalanan_dinas AS tujuan_perjalanan_dinas,
          tanggal_pelaksanaan, hari_pelaksanaan, aktivitas, permasalahan, petugas_responden,
          solusi_antisipasi, created_at, updated_at
        FROM reports
        ORDER BY id;
      `);
    } catch (e1) {
      // fallback path: legacy DBs using kegiatan_pengawasan
      reports = await sqliteAll(sdb, `
        SELECT
          id, user_id, activity_type_id, nomor_surat_tugas,
          kegiatan_pengawasan AS tujuan_perjalanan_dinas,
          tanggal_pelaksanaan, hari_pelaksanaan, aktivitas, permasalahan, petugas_responden,
          solusi_antisipasi, created_at, updated_at
        FROM reports
        ORDER BY id;
      `);
    }

    let reportPhotos = [];
    try {
      reportPhotos = await sqliteAll(sdb, `
        SELECT id, report_id, photo_path, description, created_at
        FROM report_photos
        ORDER BY id;
      `);
    } catch {
      // table may not exist in some older DBs
      reportPhotos = [];
    }

    console.log(`[SRC] users=${users.length}, activity_types=${activityTypes.length}, reports=${reports.length}, report_photos=${reportPhotos.length}`);

    // Ensure destination schema and truncate
    await ensurePgSchema();
    await truncateDestTables();

    // Insert to PG preserving IDs
    await withTx(async (client) => {
      // Load existing IDs to avoid FK violations due to gaps
      const existingUserIds = new Set(users.map(u => Number(u.id)));
      const existingAtIds = new Set(activityTypes.map(a => Number(a.id)));
      const existingReportIds = new Set();

      // Users
      for (const u of users) {
        await client.query(
          `INSERT INTO users (id, username, password, name, role, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_TIMESTAMP), COALESCE($7, CURRENT_TIMESTAMP))
           ON CONFLICT (id) DO NOTHING`,
          [u.id, u.username, u.password, u.name, u.role, u.created_at || null, u.updated_at || u.created_at || null]
        );
      }
      console.log('[PG] users migrated');

      // Activity types
      for (const at of activityTypes) {
        await client.query(
          `INSERT INTO activity_types (id, name, description, created_at)
           VALUES ($1,$2,$3,COALESCE($4, CURRENT_TIMESTAMP))
           ON CONFLICT (id) DO NOTHING`,
          [at.id, at.name, at.description || null, at.created_at || null]
        );
      }
      console.log('[PG] activity_types migrated');

      const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const toISO = (dstr) => {
        if (!dstr) return null;
        const d = new Date(dstr);
        if (isNaN(d)) return null;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      };

      // Reports: only insert rows whose FK targets exist
      for (const r of reports) {
        const uid = Number(r.user_id);
        const atid = r.activity_type_id != null ? Number(r.activity_type_id) : null;
        if (!existingUserIds.has(uid)) {
          console.warn(`[SKIP] report id=${r.id} skipped: missing user_id=${uid}`);
          continue;
        }
        if (atid != null && !existingAtIds.has(atid)) {
          console.warn(`[SKIP] report id=${r.id} skipped: missing activity_type_id=${atid}`);
          continue;
        }

        const tanggalISO = toISO(r.tanggal_pelaksanaan);
        // compute hari_pelaksanaan if missing
        let hari = r.hari_pelaksanaan;
        if ((!hari || hari === '') && tanggalISO) {
          const d = new Date(tanggalISO);
          if (!isNaN(d)) hari = dayNames[d.getDay()];
        }
        await client.query(
          `INSERT INTO reports (
              id, user_id, activity_type_id, nomor_surat_tugas, tujuan_perjalanan_dinas,
              tanggal_pelaksanaan, hari_pelaksanaan, aktivitas, permasalahan, petugas_responden,
              solusi_antisipasi, created_at, updated_at
           ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              COALESCE($12, CURRENT_TIMESTAMP),
              COALESCE($13, CURRENT_TIMESTAMP)
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            uid,
            atid,
            r.nomor_surat_tugas || null,
            r.tujuan_perjalanan_dinas || null,
            tanggalISO,
            hari || 'Senin',
            r.aktivitas || '',
            r.permasalahan || null,
            r.petugas_responden || null,
            r.solusi_antisipasi || null,
            r.created_at || null,
            r.updated_at || r.created_at || null
          ]
        );
        existingReportIds.add(Number(r.id));
      }
      console.log('[PG] reports migrated');

      // Report photos: only insert when report_id exists
      let skippedPhotos = 0;
      for (const p of reportPhotos) {
        const rid = Number(p.report_id);
        if (!existingReportIds.has(rid)) {
          skippedPhotos++;
          continue;
        }
        await client.query(
          `INSERT INTO report_photos (id, report_id, photo_path, description, created_at)
           VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_TIMESTAMP))
           ON CONFLICT (id) DO NOTHING`,
          [p.id, rid, p.photo_path, p.description || null, p.created_at || null]
        );
      }
      console.log(`[PG] report_photos migrated${skippedPhotos ? ` (skipped ${skippedPhotos} due to missing report)` : ''}`);
    });

    await resetSequences();
    console.log('[DONE] Migration completed successfully');
  } finally {
    sdb.close();
    await pgPool.end().catch(()=>{});
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});