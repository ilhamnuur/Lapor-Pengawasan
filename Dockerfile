# syntax=docker/dockerfile:1

# Node 18 disamakan dengan versi yang dipakai di server (PM2).
FROM node:18-bookworm-slim

ENV NODE_ENV=production \
    TZ=Asia/Jakarta \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium dipakai puppeteer untuk membuat PDF laporan.
# Font ikut dipasang agar hasil PDF tidak berubah bentuk.
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-liberation \
        fonts-dejavu-core \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependency lebih dulu supaya layer cache tidak rusak
# setiap kali kode berubah. Chromium tidak diunduh ulang oleh puppeteer
# karena PUPPETEER_SKIP_DOWNLOAD=true (memakai chromium sistem).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY . .

# Folder uploads dipakai untuk foto laporan & surat tugas PDF.
# Saat container jalan, folder ini biasanya di-mount sebagai volume.
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3100) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
