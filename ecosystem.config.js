// Konfigurasi PM2 untuk aplikasi Lapor Pengawasan.
// Pemakaian:
//   pm2 start ecosystem.config.js
//   pm2 reload ecosystem.config.js --update-env
//   pm2 logs lapor-pengawasan
//
// Catatan: nilai rahasia (DB_*, JWT_SECRET) TIDAK ditulis di sini.
// Semuanya dibaca oleh aplikasi dari file .env melalui dotenv.
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'lapor-pengawasan',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      time: true,
      out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        // TZ harus di-set di level proses (bukan hanya .env) agar tanggal
        // pelaksanaan konsisten WIB dan tidak bergeser satu hari.
        TZ: 'Asia/Jakarta',
        // PORT sengaja tidak di-hardcode di sini; nilainya diambil dari .env.
      },
    },
  ],
};
