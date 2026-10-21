#!/usr/bin/env bash
# Instalasi / update Lapor Pengawasan di server Linux + PM2.
#
# Pakai:
#   bash scripts/install-server.sh
#
# Script ini TIDAK menyentuh skema maupun data PostgreSQL.
# Script ini aman dijalankan ulang (idempotent).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="lapor-pengawasan"
cd "$APP_DIR"

say() { printf '\n==> %s\n' "$1"; }
fail() { printf '\n[GAGAL] %s\n' "$1" >&2; exit 1; }

say "Memeriksa prasyarat"
for cmd in node npm git; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd tidak ditemukan. Install dulu (Node.js 20/22 LTS, git)."
done
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js terlalu lama ($(node -v)). Gunakan Node.js 20 atau 22 LTS."
echo "node $(node -v) | npm $(npm -v) | $(git --version)"

if ! command -v pm2 >/dev/null 2>&1; then
  say "PM2 belum ada, memasang secara global"
  npm install -g pm2
fi

say "Menyiapkan folder runtime"
mkdir -p logs uploads

say "Memasang dependency (npm ci)"
if ! npm ci --omit=dev --no-audit --no-fund; then
  echo "[PERINGATAN] npm ci gagal (biasanya modul native sqlite3/puppeteer)."
  echo "             Mencoba ulang tanpa build script; aplikasi tetap bisa jalan"
  echo "             karena sqlite3 sudah tidak dipakai saat runtime."
  npm install --omit=dev --ignore-scripts --no-audit --no-fund
  echo "[CATATAN] Jika fitur Cetak PDF dipakai, jalankan: node node_modules/puppeteer/install.js"
fi

if [ ! -f .env ]; then
  say "Membuat .env dari .env.example"
  cp .env.example .env
  SECRET="$(openssl rand -hex 32 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env
  echo "[PENTING] Lengkapi DB_HOST/DB_USER/DB_PASSWORD di $APP_DIR/.env lalu jalankan ulang script ini."
  exit 0
else
  echo ".env sudah ada, dilewati"
fi

say "Menguji koneksi database dari .env"
node -e '
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, connectionTimeoutMillis: 8000,
});
pool.query("SELECT COUNT(*) AS n FROM reports")
  .then(r => { console.log("OK, reports =", r.rows[0].n); return pool.end(); })
  .catch(e => { console.error("DB ERROR:", e.message); process.exit(1); });
'

say "Menjalankan aplikasi dengan PM2"
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

say "Status"
pm2 status "$APP_NAME"
PORT_VALUE="$(grep -E '^PORT=' .env | cut -d= -f2 | tr -d '[:space:]')"
echo
echo "Cek lokal: curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:${PORT_VALUE:-3000}/"
echo "Log     : pm2 logs ${APP_NAME}"
echo
echo "Agar otomatis hidup setelah server reboot, jalankan sekali:"
echo "  pm2 startup systemd -u $(whoami) --hp $HOME"
echo "  (jalankan perintah sudo yang dicetak, lalu: pm2 save)"
