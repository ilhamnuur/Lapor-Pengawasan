# Panduan Instalasi & Menjalankan di Server (PM2)

Dokumen ini menjelaskan cara memasang **Lapor Pengawasan** di server Linux
(Ubuntu/Debian, termasuk mesin CasaOS) dan menjalankannya dengan **PM2**
agar proses tetap hidup, restart otomatis, dan log terpusat.

Ringkasnya:

```
GitHub/repo  →  git pull  →  npm ci  →  .env  →  pm2 start  →  Nginx/HTTPS
```

---

## 1. Prasyarat

| Komponen | Versi yang disarankan | Catatan |
|---|---|---|
| Node.js | **20 LTS** atau **22 LTS** | Sudah diuji di Node.js 22.20 |
| npm | 10+ | Ikut terpasang bersama Node.js |
| PostgreSQL | 15 – 17 | Server produksi saat ini PostgreSQL 17.4 |
| PM2 | 5+ | Dipasang otomatis oleh script |
| Nginx (opsional) | terbaru | Untuk domain + HTTPS |
| git | terbaru | Untuk update via `git pull` |

Aplikasi **tidak** membutuhkan Redis/queue. File upload disimpan di folder
`uploads/`, data di PostgreSQL.

> Penting: `sqlite3` masih tercantum di `package.json` tetapi **tidak dipakai
> saat runtime** (sisa migrasi lama). Kalau modul native itu gagal di-build,
> aplikasi tetap berjalan normal.

---

## 2. Instalasi sekali jalan (script)

Di server, setelah kode tersedia:

```bash
cd /opt/lapor-pengawasan
bash scripts/install-server.sh
```

Script akan:

1. memeriksa Node.js/npm/git, memasang PM2 bila belum ada,
2. membuat folder `logs/` dan `uploads/`,
3. menjalankan `npm ci`,
4. membuat `.env` dari `.env.example` (dengan `JWT_SECRET` acak) bila belum ada,
5. menguji koneksi database dari isi `.env`,
6. `pm2 startOrReload ecosystem.config.js` lalu `pm2 save`.

Jika `.env` baru dibuat, script berhenti di langkah 4 — isi kredensial database
lalu jalankan ulang script. Lanjut ke bagian 3 di bawah untuk detail manualnya.

---

## 3. Instalasi manual (langkah per langkah)

### 3.1 Siapkan user & folder aplikasi

Disarankan **tidak** menjalankan aplikasi sebagai `root`.

```bash
sudo adduser --disabled-password --gecos "" lapor
sudo mkdir -p /opt/lapor-pengawasan
sudo chown -R lapor:lapor /opt/lapor-pengawasan
sudo -iu lapor
```

### 3.2 Ambil kode aplikasi

```bash
cd /opt/lapor-pengawasan
git clone <URL_REPO> .
# atau, jika kode dikirim manual:
# rsync -av --exclude node_modules --exclude .env ./ user@server:/opt/lapor-pengawasan/
```

### 3.3 Pasang dependency

```bash
npm ci --omit=dev
```

Catatan:

- `puppeteer` mengunduh Chromium (dipakai fitur **Cetak PDF**). Jika server
  tanpa internet atau PDF tidak dipakai:
  ```bash
  PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev
  ```
- Jika build `sqlite3` gagal:
  ```bash
  npm ci --omit=dev --ignore-scripts
  node node_modules/puppeteer/install.js   # hanya bila butuh PDF
  ```

### 3.4 Buat file `.env`

```bash
cp .env.example .env
nano .env
```

Isi minimal:

```ini
PORT=3000
NODE_ENV=production
TZ=Asia/Jakarta

DB_HOST=10.10.10.195
DB_PORT=5432
DB_NAME=lapor
DB_USER=casaos
DB_PASSWORD=********

JWT_SECRET=<hasil openssl rand -hex 32>
```

Buat secret:

```bash
openssl rand -hex 32
```

Amankan file:

```bash
chmod 600 .env
```

> `TZ=Asia/Jakarta` penting. Tanpa itu, tanggal pelaksanaan bisa tampil
> bergeser satu hari pada jam-jam tertentu.

> Jika `JWT_SECRET` diganti, semua pengguna harus login ulang (token lama
> otomatis tidak valid).

### 3.5 Siapkan database

**Database baru (kosong):**

```bash
psql -h 10.10.10.195 -U casaos -d lapor -f scripts/pg_schema.sql
```

> ⚠️ `scripts/pg_schema.sql` melakukan `DROP TABLE` lalu membuat ulang tabel.
> **Jangan** dijalankan pada database produksi yang sudah berisi data.

**Database yang sudah berjalan (produksi):** tidak perlu menjalankan apa pun.
Rilis ini tidak mengubah struktur tabel. Hanya disarankan menambah satu index
non-unique (aman, tidak mengunci lama dan tidak mengubah data):

```bash
psql -h 10.10.10.195 -U casaos -d lapor -c \
  "CREATE INDEX IF NOT EXISTS idx_reports_user_tanggal ON reports(user_id, tanggal_pelaksanaan);"
```

Opsional (hanya jika data historis sudah bersih dari tanggal ganda per user):

```bash
psql -h 10.10.10.195 -U casaos -d lapor -f database/migration_unique_report_date.sql
```

### 3.6 Uji manual sebelum PM2

```bash
node server.js
```

Cek di terminal lain:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/         # harus 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/reports  # harus 401
```

Buka di browser, login, pastikan kalender dan laporan tampil. Hentikan dengan
`Ctrl+C`.

### 3.7 Jalankan dengan PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 status
pm2 logs lapor-pengawasan --lines 100
```

Agar otomatis hidup setelah server reboot (systemd):

```bash
pm2 startup systemd -u lapor --hp /home/lapor
# jalankan perintah sudo yang dicetak PM2, lalu:
pm2 save
```

Perintah PM2 sehari-hari:

| Kebutuhan | Perintah |
|---|---|
| Lihat status | `pm2 status` |
| Log realtime | `pm2 logs lapor-pengawasan` |
| Restart | `pm2 restart lapor-pengawasan` |
| Reload tanpa downtime | `pm2 reload lapor-pengawasan` |
| Stop / hapus | `pm2 stop lapor-pengawasan` / `pm2 delete lapor-pengawasan` |
| Monitoring | `pm2 monit` |
| Simpan proses aktif | `pm2 save` |

Log file ada di `logs/pm2-out.log` dan `logs/pm2-error.log`.

---

## 4. Nginx + HTTPS (opsional, disarankan)

`/etc/nginx/sites-available/lapor-pengawasan`:

```nginx
server {
    listen 80;
    server_name lapor.example.go.id;

    client_max_body_size 25M;   # upload foto sampai 6 x 20MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # pembuatan PDF memakai Chromium, bisa lebih dari 60 detik
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lapor-pengawasan /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lapor.example.go.id
```

Setelah Nginx aktif, port 3000 **jangan** dibuka ke publik:

```bash
sudo ufw allow 80,443/tcp
sudo ufw deny 3000/tcp
```

---

## 5. Update aplikasi

```bash
cd /opt/lapor-pengawasan
git pull

# backup singkat sebelum update (opsional tapi disarankan)
pg_dump -h 10.10.10.195 -U casaos -Fc lapor > /var/backups/lapor/pre-update-$(date +%F).dump

npm ci --omit=dev
pm2 reload ecosystem.config.js --update-env
pm2 logs lapor-pengawasan --lines 50
```

Atau cukup:

```bash
bash scripts/install-server.sh
```

Jangan lupa `pm2 save` setelah perubahan konfigurasi.

---

## 6. Backup rutin

Database:

```bash
mkdir -p /var/backups/lapor
pg_dump -h 10.10.10.195 -U casaos -Fc lapor \
  > /var/backups/lapor/lapor-$(date +%F).dump
```

File upload:

```bash
tar czf /var/backups/lapor/uploads-$(date +%F).tar.gz -C /opt/lapor-pengawasan uploads
```

Contoh cron harian (03:00):

```cron
0 3 * * * pg_dump -h 10.10.10.195 -U casaos -Fc lapor > /var/backups/lapor/lapor-$(date +\%F).dump
15 3 * * * tar czf /var/backups/lapor/uploads-$(date +\%F).tar.gz -C /opt/lapor-pengawasan uploads
```

Restore:

```bash
pg_restore -h 10.10.10.195 -U casaos -d lapor --clean --if-exists /var/backups/lapor/lapor-2026-10-21.dump
```

---

## 7. Verifikasi setelah deploy

1. `pm2 status` → status `online`, restart count tidak naik terus.
2. `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/` → `200`.
3. Login sebagai pegawai:
   - kalender menampilkan titik laporan pada tanggal yang ada laporannya,
   - pilih tanggal terpakai di form **Buat Laporan** → muncul peringatan
     "Tanggal … sudah dipakai" dan tombol simpan nonaktif,
   - **Edit** laporan → tanggal terisi sesuai data tersimpan (tidak kosong),
   - simpan tanpa mengubah tanggal → berhasil (200),
   - isi tanggal yang sudah dipakai laporan lain → ditolak (409).
4. Login sebagai kepala → kalender menampilkan laporan seluruh pegawai.
5. Coba **Cetak PDF** satu laporan (memastikan Chromium berjalan).

---

## 8. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `EADDRINUSE` | port 3000 dipakai proses lain | `pm2 delete lapor-pengawasan`, cek `ss -ltnp \| grep 3000` |
| Semua request `401/403` setelah deploy | `JWT_SECRET` berbeda dengan token user | login ulang; pastikan `.env` konsisten |
| `ECONNREFUSED` / DB error | kredensial `.env` salah atau PostgreSQL mati | `psql -h … -U … -d … -c 'select 1'`, cek `pm2 logs` |
| Tanggal mundur 1 hari | zona waktu server bukan WIB | set `TZ=Asia/Jakarta`, `pm2 restart --update-env` |
| Login gagal padahal password benar | tabel `users` kosong / hash lama | cek `SELECT username, role FROM users;` |
| Cetak PDF error `Failed to launch the browser process` | Chromium belum terpasang / server tanpa sandbox | `node node_modules/puppeteer/install.js`; di container tambahkan `--no-sandbox` pada opsi launch |
| PDF error pustaka hilang (Linux) | dependensi Chromium belum ada | `sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2t64` |
| `npm ci` gagal di `sqlite3` | tidak ada prebuild untuk versi Node | pakai Node 20/22 LTS, atau `npm ci --ignore-scripts` (sqlite3 tidak dipakai runtime) |
| Upload foto masuk folder `umum/` | versi lama memakai SQLite untuk nama jenis kegiatan | sudah diperbaiki; upload baru mengikuti nama jenis kegiatan |
| `413 Request Entity Too Large` | batas Nginx | `client_max_body_size 25M;` |
| `pm2 startup` tidak jalan | PM2 dijalankan sebagai user berbeda | ulangi `pm2 startup systemd -u <user> --hp <home>` sesuai user aplikasi |

---

## 9. Catatan Windows Server

PM2 bisa dipakai di Windows, tetapi `pm2 startup` (systemd) tidak tersedia.
Pilih salah satu:

1. **Task Scheduler**: buat task "At startup" yang menjalankan
   `pm2 resurrect` (setelah `pm2 save`), atau
2. **NSSM / pm2-installer**: daftarkan PM2 sebagai Windows Service.

Perintah hariannya sama: `pm2 start ecosystem.config.js`, `pm2 logs`,
`pm2 restart`. Pastikan variabel `TZ` di `.env` tetap diisi (`Asia/Jakarta`)
karena Windows memakai zona waktu sistem.

---

## 10. Struktur file penting

```
server.js                 entry point Express
ecosystem.config.js       konfigurasi PM2
.env.example              template konfigurasi
scripts/install-server.sh instalasi/update otomatis
scripts/pg_schema.sql     skema DB untuk instalasi BARU (drop & create)
database/migration_*.sql  migrasi opsional
routes/reports.js         CRUD laporan + validasi tanggal
public/index.html         UI (login, kalender, tabel, form)
public/app.js             logika UI + validasi tanggal sisi klien
uploads/                  file foto (backup terpisah dari DB)
logs/                     log PM2
```
