# Chrome di Docker dengan Kasm (port 5678)

Dokumen ini menjelaskan cara menjalankan **Google Chrome berbasis Kasm** di
server. Chrome berjalan di dalam container, lalu diakses dari browser lain
melalui **KasmVNC**:

```
Browser Anda  ──HTTPS──►  server:5678  ──►  container kasm-chrome:6901
                                              └─ Chrome + desktop
```

Ringkasnya:

```bash
# 1. isi password di .env
# 2. jalankan
docker compose -f docker-compose.kasm-chrome.yml up -d
# 3. buka https://IP-SERVER:5678
#    user: kasm_user   password: KASM_VNC_PW
```

> Ini **bukan** Chrome headless untuk Puppeteer. Yang dijalankan adalah
> desktop Chrome yang bisa dilihat dan diklik lewat browser (KasmVNC).
> Bagian [8](#8-opsional-remote-debugging-cdp) menjelaskan cara membuka
> remote debugging bila memang dibutuhkan untuk otomasi.

---

## 1. Prasyarat

| Komponen | Keterangan |
|---|---|
| Docker Engine | 24+ (disarankan) dengan plugin `docker compose` v2 |
| Arsitektur | **amd64 / x86_64**. Image Chrome dari Kasm belum tersedia untuk ARM |
| RAM | minimal 2 GB untuk container ini (Chrome + KasmVNC) |
| Disk | ±1,5 GB untuk image |
| Port | **5678/tcp** bebas dan diizinkan firewall |
| CPU | 2 core sudah cukup untuk 1 sesi |

Tidak perlu Node.js, database, atau paket tambahan di host. Semua dependensi
sudah ada di dalam image `kasmweb/chrome`.

---

## 2. Konfigurasi `.env`

Tambahkan ke `.env` (file ini tidak ikut ter-commit). Cara cepat:

```bash
printf '\nKASM_VNC_PW=%s\n' "$(openssl rand -base64 24)" >> .env
```

Atau isi manual:

```ini
# Password login KasmVNC (user: kasm_user). Jangan biarkan kosong.
KASM_VNC_PW=IsiDenganPasswordAcak

# Port akses di host (HTTPS). Di dalam container tetap 6901.
KASM_CHROME_PORT=5678

# Resolusi desktop. Semakin besar semakin berat.
KASM_VNC_RESOLUTION=1280x800

# Opsional: halaman awal dan argumen Chrome
# KASM_LAUNCH_URL=https://www.google.com
# KASM_APP_ARGS=--start-maximized

# Opsional: batas RAM container (default 2g)
# KASM_CHROME_MEMORY=2g

# Opsional: hanya bisa diakses dari server itu sendiri (untuk reverse proxy)
# KASM_CHROME_BIND=127.0.0.1
```

Jangan pakai contoh `IsiDenganPasswordAcak` apa adanya. Minimal 6 karakter;
disarankan 20+ karakter acak.

Jika `KASM_VNC_PW` kosong atau belum ada, `docker compose` akan menolak
berjalan (bukan memakai password default yang berbahaya).

Contoh: bila Chrome ini dipakai untuk membuka aplikasi internal, arahkan
halaman awalnya ke aplikasi tersebut:

```ini
KASM_LAUNCH_URL=http://10.10.10.195:3100
```

---

## 3. Jalankan

Dari folder repo:

```bash
docker compose -f docker-compose.kasm-chrome.yml up -d
```

Cek status dan log:

```bash
docker compose -f docker-compose.kasm-chrome.yml ps
docker compose -f docker-compose.kasm-chrome.yml logs -f
```

Container akan otomatis hidup lagi setelah server/daemon Docker restart
(`restart: unless-stopped`).

### 3.1 Tanpa Docker Compose

```bash
docker run -d \
  --name kasm-chrome \
  --restart unless-stopped \
  --shm-size=1g \
  -e VNC_PW='GantiDenganPasswordPanjang' \
  -e VNC_RESOLUTION=1280x800 \
  -e TZ=Asia/Jakarta \
  -e LAUNCH_URL=https://www.google.com \
  -p 5678:6901 \
  kasmweb/chrome:1.18.0
```

---

## 4. Verifikasi

Port sudah mendengarkan:

```bash
ss -ltnp | grep 5678
```

KasmVNC merespons (sertifikat masih self-signed, jadi pakai `-k`):

```bash
curl -kI https://127.0.0.1:5678/ | head -n 1
# HTTP/1.1 200 OK
```

Healthcheck container:

```bash
docker inspect --format '{{.State.Health.Status}}' kasm-chrome
# healthy
```

Lalu buka di browser:

```
https://IP-SERVER:5678
```

- **User**: `kasm_user`
- **Password**: nilai `KASM_VNC_PW` di `.env`

Karena sertifikatnya self-signed, browser akan menampilkan peringatan
sertifikat. Untuk pemakaian produksi, gunakan reverse proxy dengan
sertifikat asli (bagian 6) agar tidak ada peringatan.

---

## 5. Keamanan

Siapa pun yang bisa membuka port 5678 dan tahu password dapat mengendalikan
Chrome tersebut. Karena itu:

1. **Ganti password default.** Jangan pernah memakai `password`.
2. **Jangan buka 5678 ke internet tanpa TLS yang valid dan pembatasan akses.**
   Idealnya lewat VPN atau firewall yang hanya mengizinkan IP kantor.
3. Batasi akses dengan firewall, misalnya hanya subnet kantor:

   ```bash
   sudo ufw allow from 10.10.10.0/24 to any port 5678 proto tcp
   sudo ufw deny 5678/tcp
   ```

   Di server CasaOS/iptables, sesuaikan aturannya.
4. Aktifkan reverse proxy HTTPS (bagian 6) dan bind container ke localhost:

   ```ini
   KASM_CHROME_BIND=127.0.0.1
   ```

5. Update image secara berkala (KasmVNC dan Chrome mendapat patch keamanan).
6. Jangan pasang extension/akun sensitif di browser ini. Profil container
   bersifat sementara kecuali volume profil diaktifkan.

> Port 5678 di host hanya meneruskan ke KasmVNC (HTTPS). Ini berbeda dengan
> port remote debugging Chrome (lihat bagian 8) yang **tanpa autentikasi**.

---

## 6. Reverse proxy HTTPS (disarankan)

Matikan publikasi langsung, lalu arahkan domain ke container. Set dulu:

```ini
KASM_CHROME_BIND=127.0.0.1
```

### 6.1 Nginx

```nginx
server {
    listen 443 ssl;
    server_name chrome.example.go.id;

    ssl_certificate     /etc/letsencrypt/live/chrome.example.go.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chrome.example.go.id/privkey.pem;

    location / {
        proxy_pass https://127.0.0.1:5678;
        proxy_http_version 1.1;

        # KasmVNC memakai WebSocket dan koneksi panjang.
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Sertifikat di sisi container self-signed.
        proxy_ssl_verify off;

        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d chrome.example.go.id
```

### 6.2 Caddy (lebih singkat)

```caddyfile
chrome.example.go.id {
    reverse_proxy https://127.0.0.1:5678 {
        transport http {
            tls_insecure_skip_verify
        }
    }
}
```

Caddy menangani WebSocket dan sertifikat otomatis.

---

## 7. Operasional

| Kebutuhan | Perintah |
|---|---|
| Jalankan | `docker compose -f docker-compose.kasm-chrome.yml up -d` |
| Lihat status | `docker compose -f docker-compose.kasm-chrome.yml ps` |
| Log realtime | `docker compose -f docker-compose.kasm-chrome.yml logs -f` |
| Restart | `docker compose -f docker-compose.kasm-chrome.yml restart` |
| Hentikan | `docker compose -f docker-compose.kasm-chrome.yml down` |
| Update image | lihat di bawah |
| Cek kesehatan | `docker inspect --format '{{.State.Health.Status}}' kasm-chrome` |

### 7.1 Update Chrome / Kasm

Ganti tag di `docker-compose.kasm-chrome.yml` (mis. `1.19.0`), lalu:

```bash
docker compose -f docker-compose.kasm-chrome.yml pull
docker compose -f docker-compose.kasm-chrome.yml up -d
```

Sesi yang sedang berjalan akan terputus. Profil Chrome ikut hilang kecuali
volume profil diaktifkan (lihat komentar di file compose).

### 7.2 Profil persisten (opsional)

Secara default container bersifat *ephemeral*: bookmark, login, dan setting
hilang saat container dibuat ulang. Bila ingin disimpan, aktifkan komentar
`volumes` pada file compose:

```yaml
    volumes:
      - kasm-chrome-home:/home/kasm-user
```

dan bagian bawah:

```yaml
volumes:
  kasm-chrome-home:
```

Hapus volume tersebut bila setelah update image profil terasa rusak.

### 7.3 Resource

- `KASM_CHROME_MEMORY` (default `2g`) membatasi RAM container.
- `KASM_VNC_RESOLUTION` memengaruhi beban CPU/bandwidth. `1280x800` cukup
  untuk pemakaian biasa; `1920x1080` lebih berat.
- Bila tab sering crash, naikkan `shm_size` (di compose) menjadi `2gb`.

---

## 8. Opsional: remote debugging (CDP)

Diperlukan hanya bila Chrome ini akan dikendalikan program lain
(Puppeteer/Playwright), bukan untuk dilihat manual. **Port CDP tidak punya
autentikasi.**

Langkahnya:

1. Tambahkan argumen Chrome di `.env`:

   ```ini
   KASM_APP_ARGS=--start-maximized --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --user-data-dir=remote-profile --remote-allow-origins=* --restore-last-session
   ```

   `--user-data-dir` wajib sejak Chrome 136, selain itu flag remote
   debugging diabaikan.

2. Tambahkan pemetaan port di `docker-compose.kasm-chrome.yml`:

   ```yaml
       ports:
         - "${KASM_CHROME_BIND:-0.0.0.0}:${KASM_CHROME_PORT:-5678}:6901"
         # CDP: sebaiknya hanya localhost, akses lewat SSH tunnel.
         - "127.0.0.1:9222:9222"
   ```

3. Jalankan ulang, lalu uji dari server:

   ```bash
   curl -s http://127.0.0.1:9222/json/version
   ```

4. Dari komputer lain, buat SSH tunnel:

   ```bash
   ssh -L 9222:127.0.0.1:9222 user@server
   # lalu buka http://127.0.0.1:9222
   ```

Catatan penting:

- **Jangan** membuka 9222 ke publik. Akses CDP setara kendali penuh atas
  browser (termasuk membuka halaman internal jaringan).
- Chrome menolak `Host` header berupa nama host; gunakan `localhost` atau
  **IP address**. Untuk aplikasi di container lain, arahkan ke
  `http://IP-SERVER:9222` atau lewat proxy yang menulis ulang header `Host`.
- Menjalankan desktop KasmVNC sekaligus CDP menambah pemakaian memori.

---

## 9. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `isi KASM_VNC_PW di .env` saat `up` | variabel belum diisi | tambahkan `KASM_VNC_PW` (min. 6 karakter) ke `.env` |
| Browser menampilkan peringatan sertifikat | sertifikat self-signed KasmVNC | wajar; gunakan reverse proxy HTTPS atau terima pengecualian |
| `http://...:5678` tidak bisa dibuka | KasmVNC hanya HTTPS | pakai `https://...:5678` |
| Halaman putih / WebSocket gagal di belakang proxy | header `Upgrade`/`Connection` tidak diteruskan | pakai konfigurasi Nginx/Caddy di bagian 6 |
| Container restart terus | RAM/`shm` kurang | naikkan `shm_size` ke `2gb`, cek `docker logs kasm-chrome` |
| Chrome/tab sering crash | `/dev/shm` terlalu kecil | `shm_size: "2gb"` |
| Login ditolak | password < 6 karakter atau `VNC_PW` berubah tetapi container belum dibuat ulang | `docker compose ... up -d --force-recreate` |
| Tidak bisa upload/download/audio | fitur tersebut hanya penuh saat dijalankan lewat platform Kasm Workspaces | gunakan fitur browser biasa; untuk transfer file gunakan volume atau aplikasi lain |
| Port 5678 sudah dipakai | konflik dengan layanan lain | ganti `KASM_CHROME_PORT` atau hentikan layanan tersebut (`ss -ltnp \| grep 5678`) |
| `no matching manifest for linux/arm64` | server ARM (mis. Raspberry Pi) | image ini hanya amd64; pakai server x86_64 atau VM emulasi |
| `curl` ke 9222 kosong | `APP_ARGS`/port belum ditambahkan | cek `docker logs`, pastikan `--user-data-dir` ikut |

---

## 10. File terkait

```
docker-compose.kasm-chrome.yml   definisi service Chrome/Kasm
docs/DOCKER-KASM-CHROME.md       dokumen ini
.env                             password & port (tidak di-commit)
```

Untuk aplikasi Lapor Pengawasan sendiri (Node.js + Chromium internal untuk
cetak PDF), lihat `docs/DEPLOY.md`. Container Kasm ini terpisah dan tidak
saling membutuhkan.
