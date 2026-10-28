const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const pg = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Ukuran maksimum sisi foto yang ditanam ke PDF (px) dan kualitas JPEG.
// Foto asli bisa >10 MB; setelah diperkecil hasilnya cukup tajam untuk cetak
// tetapi jauh lebih cepat dibaca, dirender, dan diunduh.
const PDF_PHOTO_MAX_EDGE = Number(process.env.PDF_PHOTO_MAX_EDGE) || 1400;
const PDF_PHOTO_QUALITY = Number(process.env.PDF_PHOTO_QUALITY) || 78;

// Watermark foto dokumentasi bersifat opsional. Teks diambil dari isian
// laporan dan ditempatkan di footer foto dengan gaya seperti GPS Map Camera.
const PDF_WATERMARK_MAX_VALUE_LINES = 3;

function isWatermarkRequested(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
}

function formatWatermarkDate(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function parseWatermarkCoordinate(value, limit) {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) return null;
    const number = Number(normalized);
    if (!Number.isFinite(number) || Math.abs(number) > limit) return null;
    return number;
}

function formatWatermarkCoordinate(latitude, longitude) {
    const lat = parseWatermarkCoordinate(latitude, 90);
    const lon = parseWatermarkCoordinate(longitude, 180);
    if (lat === null || lon === null) return '';
    const latDirection = lat < 0 ? 'S' : 'N';
    const lonDirection = lon < 0 ? 'W' : 'E';
    return `${Math.abs(lat).toFixed(7)}°${latDirection}, ${Math.abs(lon).toFixed(7)}°${lonDirection}`;
}

function wrapWatermarkText(value, maxChars, maxLines = PDF_WATERMARK_MAX_VALUE_LINES) {
    const chars = Math.max(8, Number(maxChars) || 40);
    const lineLimit = Math.max(1, Number(maxLines) || PDF_WATERMARK_MAX_VALUE_LINES);
    const text = String(value || '-').replace(/\s+/g, ' ').trim() || '-';
    const words = [];

    text.split(' ').forEach((word) => {
        // Kata yang sangat panjang (mis. URL) dipotong agar tidak melebar.
        for (let index = 0; index < word.length; index += chars) {
            words.push(word.slice(index, index + chars));
        }
    });

    const lines = [];
    let current = '';
    words.forEach((word) => {
        if (!current) {
            current = word;
            return;
        }
        if (current.length + 1 + word.length <= chars) {
            current += ` ${word}`;
        } else {
            lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);

    if (lines.length > lineLimit) {
        const visible = lines.slice(0, lineLimit);
        const rest = lines.slice(lineLimit).join(' ');
        let lastLine = `${visible[visible.length - 1]} ${rest}`;
        if (lastLine.length > chars) {
            lastLine = `${lastLine.slice(0, Math.max(1, chars - 3)).trimEnd()}...`;
        }
        visible[visible.length - 1] = lastLine;
        return visible;
    }

    return lines;
}

function buildWatermarkSvg(width, height, { tujuan, tanggal, lokasi }) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    // Teks dibuat lebih ringkas agar foto tetap menjadi fokus utama.
    const fontSize = Math.max(10, Math.min(24, Math.round(safeWidth * 0.019)));
    const labelFontSize = Math.max(7, Math.round(fontSize * 0.42));
    const dateFontSize = Math.max(9, Math.round(fontSize * 0.72));
    const locationFontSize = Math.max(9, Math.round(fontSize * 0.74));
    const locationLabelFontSize = Math.max(7, Math.round(fontSize * 0.38));
    const lineHeight = Math.round(fontSize * 1.18);
    const paddingX = Math.max(12, Math.round(safeWidth * 0.038));
    const paddingBottom = Math.max(10, Math.round(safeHeight * 0.038));
    const gap = Math.max(4, Math.round(fontSize * 0.3));
    const contentWidth = Math.max(40, safeWidth - paddingX * 2);
    const maxChars = Math.max(8, Math.floor(contentWidth / Math.max(1, fontSize * 0.54)));
    const valueLines = wrapWatermarkText(tujuan, maxChars);
    const dateText = formatWatermarkDate(tanggal);
    const locationText = String(lokasi || '').replace(/\s+/g, ' ').trim();
    const locationMaxChars = Math.max(8, Math.floor(contentWidth / Math.max(1, locationFontSize * 0.54)) - 8);
    const locationLine = locationText ? wrapWatermarkText(locationText, locationMaxChars, 1)[0] : '';

    const dateBaseline = safeHeight - paddingBottom;
    const valueLastBaseline = dateBaseline - dateFontSize - gap * 1.5;
    const valueFirstBaseline = valueLastBaseline - (valueLines.length - 1) * lineHeight;
    const labelBaseline = valueFirstBaseline - lineHeight * 0.88;
    const locationBaseline = locationLine
        ? labelBaseline - labelFontSize - gap * 1.4
        : null;
    const gradientTop = Math.max(0, Math.round(
        locationLine
            ? locationBaseline - locationFontSize * 2.2
            : labelBaseline - labelFontSize * 2.5
    ));
    const gradientHeight = Math.max(1, safeHeight - gradientTop);

    const valueTspans = valueLines
        .map((line, index) => `<tspan x="${paddingX}"${index > 0 ? ` dy="${lineHeight}"` : ''}>${escapeXml(line)}</tspan>`)
        .join('');

    const locationSvg = locationLine
        ? `<text x="${paddingX}" y="${locationBaseline}" fill="#ffffff" font-size="${locationFontSize}" font-weight="700" letter-spacing="0.2"><tspan fill="#fbbf24" font-size="${locationLabelFontSize}" letter-spacing="${Math.max(0.6, locationLabelFontSize * 0.12).toFixed(1)}">LOKASI · </tspan>${escapeXml(locationLine)}</text>`
        : '';

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">
            <defs>
                <linearGradient id="wmFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#000000" stop-opacity="0"/>
                    <stop offset="0.45" stop-color="#000000" stop-opacity="0.58"/>
                    <stop offset="1" stop-color="#000000" stop-opacity="0.88"/>
                </linearGradient>
            </defs>
            <rect x="0" y="${gradientTop}" width="${safeWidth}" height="${gradientHeight}" fill="url(#wmFade)"/>
            <g font-family="Arial, Helvetica, sans-serif">
                ${locationSvg}
                <text x="${paddingX}" y="${labelBaseline}" fill="#ffffff" fill-opacity="0.74" font-size="${labelFontSize}" font-weight="700" letter-spacing="${Math.max(0.8, labelFontSize * 0.12).toFixed(1)}">TUJUAN PERJALANAN DINAS</text>
                <text x="${paddingX}" y="${valueFirstBaseline}" fill="#ffffff" font-size="${fontSize}" font-weight="700">${valueTspans}</text>
                <text x="${paddingX}" y="${dateBaseline}" fill="#fbbf24" font-size="${dateFontSize}" font-weight="700" letter-spacing="0.3">
                    <tspan fill="#ffffff" fill-opacity="0.72" font-size="${Math.max(9, Math.round(dateFontSize * 0.72))}" letter-spacing="1">TANGGAL PELAKSANAAN · </tspan>${escapeXml(dateText)}
                </text>
            </g>
        </svg>
    `;
}

let browserPromise = null;

function browserOptions() {
    // Bisa diarahkan ke browser lokal lewat env PUPPETEER_EXECUTABLE_PATH
    // (mis. saat testing di Windows).
    const options = { headless: 'new', timeout: 60000 };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    // Di dalam container Chromium perlu dijalankan tanpa sandbox.
    if (process.env.PUPPETEER_NO_SANDBOX === '1') {
        options.args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    }
    return options;
}

// Satu browser dipakai ulang untuk semua request. Membuka browser baru
// per cetak memakan ±2 detik (launch + close) dan bisa puluhan detik
// saat cache disk dingin.
function getBrowser() {
    if (!browserPromise) {
        const promise = puppeteer.launch(browserOptions())
            .then((browser) => {
                browser.on('disconnected', () => {
                    // Hanya lepaskan referensi jika ini memang browser yang
                    // sedang dipakai (jangan hapus browser pengganti).
                    if (browserPromise === promise) {
                        browserPromise = null;
                    }
                });
                return browser;
            })
            .catch((error) => {
                if (browserPromise === promise) {
                    browserPromise = null;
                }
                throw error;
            });
        browserPromise = promise;
    }
    return browserPromise;
}

async function newPage() {
    const browser = await getBrowser();
    try {
        return await browser.newPage();
    } catch (error) {
        // Browser mungkin sudah mati; buat ulang sekali lalu coba lagi.
        if (browser.isConnected()) {
            throw error;
        }
        if (browserPromise) {
            browserPromise = null;
        }
        const freshBrowser = await getBrowser();
        return freshBrowser.newPage();
    }
}

async function renderPdf(htmlContent, pdfOptions) {
    const page = await newPage();
    try {
        await page.setContent(htmlContent);
        return await page.pdf(pdfOptions);
    } finally {
        await page.close().catch(() => {});
    }
}

// Foto diperkecil dan dikompres sebelum diubah menjadi data URI. Ini menjaga
// ukuran HTML/PDF tetap kecil tanpa mengubah isi laporan.
async function photoToDataUri(photoPath, watermark = null) {
    const absolutePath = path.resolve(photoPath);
    let imageBuffer;
    try {
        imageBuffer = await fs.promises.readFile(absolutePath);
    } catch (error) {
        console.error(`Gagal memuat gambar: ${photoPath}`, error);
        return '';
    }

    try {
        // Saat watermark diminta, normalisasi foto dulu (rotasi, resize,
        // flatten) ke PNG agar ukuran akhirnya diketahui sebelum overlay SVG
        // dibuat. PNG dipakai sebagai buffer antara supaya foto tidak
        // dikompresi dua kali.
        if (watermark) {
            try {
                const normalized = await sharp(imageBuffer)
                    .rotate()
                    .resize({
                        width: PDF_PHOTO_MAX_EDGE,
                        height: PDF_PHOTO_MAX_EDGE,
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .flatten({ background: '#ffffff' })
                    .png()
                    .toBuffer({ resolveWithObject: true });

                const overlay = buildWatermarkSvg(
                    normalized.info.width,
                    normalized.info.height,
                    watermark
                );

                const watermarked = await sharp(normalized.data)
                    .composite([{ input: Buffer.from(overlay) }])
                    .jpeg({ quality: PDF_PHOTO_QUALITY, mozjpeg: true })
                    .toBuffer();

                return `data:image/jpeg;base64,${watermarked.toString('base64')}`;
            } catch (watermarkError) {
                // PDF tetap harus bisa dicetak walau overlay gagal dibuat.
                console.error(`Gagal menambahkan watermark: ${photoPath}`, watermarkError);
            }
        }

        const optimized = await sharp(imageBuffer)
            .rotate()
            .resize({
                width: PDF_PHOTO_MAX_EDGE,
                height: PDF_PHOTO_MAX_EDGE,
                fit: 'inside',
                withoutEnlargement: true
            })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: PDF_PHOTO_QUALITY, mozjpeg: true })
            .toBuffer();
        return `data:image/jpeg;base64,${optimized.toString('base64')}`;
    } catch (error) {
        // Jika format tidak didukung sharp, kembalikan perilaku lama.
        console.error(`Gagal mengoptimasi gambar: ${photoPath}`, error);
        const fileType = path.extname(photoPath).substring(1) || 'jpeg';
        return `data:image/${fileType};base64,${imageBuffer.toString('base64')}`;
    }
}

// Menyalakan browser lebih awal agar cetak pertama tidak menunggu cold start.
async function warmUpPdfBrowser() {
    const page = await newPage();
    await page.close();
    return true;
}


// Generate PDF for single report
router.get('/report/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let query;
        let params;

        if (req.user.role === 'kepala') {
            query = `
                SELECT r.*, u.name as pegawai_name, ac.description as description_name, ac.surat_tugas_path
                FROM reports r
                JOIN users u ON r.user_id = u.id
                JOIN activity_types ac ON r.activity_type_id = ac.id
                WHERE r.id = $1
            `;
            params = [id];
        } else {
            query = `
                SELECT r.*, u.name as pegawai_name, ac.description as description_name, ac.surat_tugas_path
                FROM reports r
                JOIN users u ON r.user_id = u.id
                JOIN activity_types ac ON r.activity_type_id = ac.id
                WHERE r.id = $1 AND r.user_id = $2
            `;
            params = [id, req.user.id];
        }

        const { rows } = await pg.query(query, params);
        const report = rows[0];
        
        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }
        
        const { rows: photosRows } = await pg.query('SELECT photo_path FROM report_photos WHERE report_id = $1', [id]);
        report.foto_dokumentasi = photosRows.map(photo => photo.photo_path);
        
        const requestedLocation = Array.isArray(req.query.lokasi)
            ? req.query.lokasi[0]
            : req.query.lokasi;
        const requestedLatitude = Array.isArray(req.query.latitude)
            ? req.query.latitude[0]
            : req.query.latitude;
        const requestedLongitude = Array.isArray(req.query.longitude)
            ? req.query.longitude[0]
            : req.query.longitude;
        const coordinateLocation = formatWatermarkCoordinate(requestedLatitude, requestedLongitude);
        const fallbackLocation = String(requestedLocation || '').replace(/\s+/g, ' ').trim().slice(0, 255);
        const watermark = isWatermarkRequested(req.query.watermark)
            ? {
                tujuan: report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan || '-',
                tanggal: report.tanggal_pelaksanaan,
                lokasi: coordinateLocation || fallbackLocation
            }
            : null;

        // Generate photos HTML for second page
        let photosHTML = '';
        if (report.foto_dokumentasi?.length > 0) {
            const photoDataUris = await Promise.all(
                report.foto_dokumentasi.map(photoPath => photoToDataUri(photoPath, watermark))
            );

            const photoElements = photoDataUris
                .filter(Boolean)
                .map(dataUri => `
                    <div class="photo-item">
                        <img src="${dataUri}" alt="Foto Dokumentasi">
                    </div>`)
                .join('');

            photosHTML = `
            <div class="page-break"></div>
            <div class="documentation-page">
                <div class="documentation-header">
                    <h2>FOTO-FOTO DOKUMENTASI</h2>
                </div>
                <div class="photos-grid">
                    ${photoElements}
                </div>
            </div>`;
        }

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Laporan Kegiatan Pengawasan</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
                    .header h2 { margin: 5px 0; font-size: 16px; }
                    .content { margin: 20px 0; }
                    /* Grid dua kolom untuk meluruskan label dan nilai */
                    .info-grid {
                        display: grid;
                        grid-template-columns: 220px 1fr; /* lebar label tetap + nilai fleksibel */
                        column-gap: 12px;
                        row-gap: 8px;
                        align-items: start; /* pastikan label dan nilai mulai di garis atas yang sama */
                    }
                    .info-label {
                        font-weight: bold;
                        white-space: nowrap;
                        align-self: start; /* sejajarkan ke atas baris */
                        padding-top: 0;  /* nolkan agar benar2 sejajar baseline atas */
                        line-height: 1.5;
                    }
                    .info-value {
                        /* Pastikan nilai sejajar atas dan konsisten untuk konten multi-baris */
                        display: block;
                        line-height: 1.5;
                        word-break: break-word;
                        white-space: pre-wrap; /* jaga line break manual */
                        margin: 0; /* hilangkan margin default yang mungkin menggeser vertikal */
                        text-align: left; /* cegah rata kanan yang bikin terlihat turun */
                    }
                    /* Pastikan kolom nilai tanggal tidak terdorong oleh gaya lain (misal pewarisan align/spacing) */
                    .info-value.tanggal {
                        margin: 0 !important;
                        padding-top: 0 !important;
                        text-align: left !important;
                    }
                    .info-value.permasalahan {
                        margin: 0 !important;
                        padding-top: 0 !important;
                    }
                    .signature { margin-top: 50px; text-align: right; }
                    /* Spacing helpers */
                    /* Gunakan jarak antar baris yang konsisten seperti antar "Nomor Surat Tugas" -> "Kegiatan" */
                    .row-gap { height: 8px; }        /* jarak kecil standar antar pasangan label-nilai */
                    .pegawai-to-title-spacer { height: 8px; } /* set sama seperti row-gap agar konsisten */
                    .block-gap-30 { height: 30px; }  /* jarak khusus 50px (tanggal -> aktivitas) */
                    .signature-box { display: inline-block; text-align: center; }
                    .page-break { page-break-before: always; }
                    .documentation-page { margin-top: 40px; }
                    .documentation-header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 15px;
                    }
                    .documentation-header h2 {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 0;
                    }
                    .photos-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 16px;
                        margin-top: 16px;
                    }
                    .photo-item {
                        text-align: center;
                        page-break-inside: avoid;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #fafafa;
                        border: 1px solid #e5e7eb;
                        border-radius: 6px;
                        padding: 8px;
                        height: 360px; /* container tinggi agar gambar bisa lebih besar dan proporsional */
                        overflow: hidden;
                    }
                    .photo-item img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain; /* menjaga rasio, memenuhi container */
                        image-rendering: auto;
                        border-radius: 4px;
                    }
                    .photo-caption {
                        font-size: 12px;
                        color: #666;
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="header"><h1>LAPORAN PERJALANAN DINAS</h1></div>
                <div class="block-gap-30"></div>
                <div class="content">
                    <div class="info-grid">
                        <div class="info-label">Deskripsi Kegiatan</div>
                        <div class="info-value">${report.description_name}</div>
                        <div class="info-label">Nama Pegawai</div>
                        <div class="info-value">${report.pegawai_name}</div>
                        <div class="info-label">Nomor Surat Tugas</div>
                        <div class="info-value">${report.nomor_surat_tugas || '-'}</div>
                        <div class="info-label">Tujuan Perjalanan Dinas</div>
                        <div class="info-value">${report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan}</div>
                        <div class="info-label">Tanggal/Hari Pelaksanaan</div>
                        <div class="info-value">${new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        <div></div><div class="block-gap-30"></div>


                        <div class="info-label">Aktivitas yang Dilakukan</div>
                        <div class="info-value">${report.aktivitas}</div>

                        <div class="info-label">Permasalahan yang ditemui</div>
                        <div class="info-value permasalahan">${(report.permasalahan || 'Tidak ada permasalahan').toString().trim()}</div>

                        <div class="info-label">Petugas/Responden Ditemui</div>
                        <div class="info-value">${report.petugas_responden || '-'}</div>

                        <div class="info-label">Solusi/Langkah Antisipatif</div>
                        <div class="info-value">${report.solusi_antisipasi || '-'}</div>
                    </div>
                </div>
                
                <div class="signature">
                    <div class="signature-box">
                        <p>Tuban, ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p>Pegawai,</p>
                        <br><br><br>
                        <p>${report.pegawai_name}</p>
                    </div>
                </div>

                ${photosHTML}
            </body>
            </html>
        `;
        
        const pdf = await renderPdf(htmlContent, {
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '15mm',
                bottom: '15mm',
                left: '15mm'
            }
        });

        // Surat tugas jenis kegiatan (jika ada) menjadi halaman pertama.
        const finalPdf = await prependSuratTugas(report.surat_tugas_path, pdf);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_${report.pegawai_name}_${report.tanggal_pelaksanaan}.pdf"`);
        res.send(finalPdf);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Generate PDF for all reports (Kepala only)
router.get('/all-reports', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'kepala') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { rows: reports } = await pg.query(`
            SELECT r.*, u.name as pegawai_name
            FROM reports r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        `);

        // Generate simplified HTML (no photos) for all reports
        const htmlContent = generateAllReportsHTML(reports);
        
        const pdf = await renderPdf(htmlContent, {
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '10mm',
                bottom: '15mm',
                left: '10mm'
            }
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_Semua_Kegiatan_Pengawasan.pdf"`);
        res.send(pdf);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

function generateAllReportsHTML(reports) {
    const reportRows = reports.map(report => `
        <tr>
            <td>${report.pegawai_name}</td>
            <td>${report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan}</td>
            <td>${new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID')}</td>
            <td>${report.hari_pelaksanaan || '-'}</td>
            <td>${(report.aktivitas || '').replace(/\s+/g, ' ').trim()}</td>
            <td>${report.permasalahan ? report.permasalahan.replace(/\s+/g, ' ').trim() : 'Tidak ada'}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Laporan Semua Kegiatan Pengawasan</title>
            <style>
                @page { size: A4; margin: 15mm 10mm; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; color: #111; }
                .header { text-align: center; margin-bottom: 16px; }
                .header h1 { margin: 0; font-size: 16px; font-weight: bold; letter-spacing: .3px; }
                .header h2 { margin: 4px 0; font-size: 13px; font-weight: 600; color: #333; }
                .meta { font-size: 10px; color: #555; text-align: center; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; table-layout: fixed; }
                th, td { border: 1px solid #444; padding: 6px 8px; vertical-align: top; word-wrap: break-word; }
                th { background-color: #f4f4f4; font-weight: 700; font-size: 11px; }
                tbody tr:nth-child(even) { background: #fafafa; }
                .signature { margin-top: 28px; display: flex; justify-content: flex-end; }
                .signature .box { width: 260px; text-align: center; }
                .small { font-size: 10px; color: #444; }
                .nowrap { white-space: nowrap; }
                .w-pegawai { width: 18%; }
                .w-kegiatan { width: 22%; }
                .w-tanggal { width: 10%; }
                .w-hari { width: 10%; }
                .w-aktivitas { width: 25%; }
                .w-permasalahan { width: 15%; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>BADAN PUSAT STATISTIK</h1>
                <h2>KABUPATEN TUBAN</h2>
                <h2>LAPORAN SEMUA KEGIATAN PENGAWASAN LAPANGAN</h2>
                <div class="meta">Digenerate: ${new Date().toLocaleDateString('id-ID')} • Total Laporan: ${reports.length}</div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th class="w-pegawai">Nama Pegawai</th>
                        <th class="w-kegiatan">Kegiatan Pengawasan</th>
                        <th class="w-tanggal nowrap">Tanggal</th>
                        <th class="w-hari nowrap">Hari</th>
                        <th class="w-aktivitas">Aktivitas</th>
                        <th class="w-permasalahan">Permasalahan</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportRows}
                </tbody>
            </table>
            
            <div class="signature">
                <div class="box">
                    <p>Tuban, ${new Date().toLocaleDateString('id-ID')}</p>
                    <p class="small">Kepala BPS Kabupaten Tuban,</p>
                    <br><br><br>
                    <p><u>_________________</u></p>
                </div>
            </div>
        </body>
        </html>
    `;
}

// Gabungkan surat tugas (PDF) di depan PDF laporan.
// Jika file tidak ada / gagal dibaca, PDF laporan tetap dikembalikan apa adanya.
async function prependSuratTugas(suratTugasPath, reportPdfBuffer) {
    if (!suratTugasPath) return reportPdfBuffer;

    try {
        const absolutePath = path.resolve(suratTugasPath);
        if (!fs.existsSync(absolutePath)) {
            console.warn('[PDF] Surat tugas tidak ditemukan:', absolutePath);
            return reportPdfBuffer;
        }

        const [suratBytes, reportBytes] = await Promise.all([
            fs.promises.readFile(absolutePath),
            Promise.resolve(reportPdfBuffer)
        ]);

        const suratDoc = await PDFDocument.load(suratBytes);
        const reportDoc = await PDFDocument.load(reportBytes);
        const mergedDoc = await PDFDocument.create();

        const suratPages = await mergedDoc.copyPages(suratDoc, suratDoc.getPageIndices());
        suratPages.forEach(page => mergedDoc.addPage(page));

        const reportPages = await mergedDoc.copyPages(reportDoc, reportDoc.getPageIndices());
        reportPages.forEach(page => mergedDoc.addPage(page));

        return Buffer.from(await mergedDoc.save());
    } catch (error) {
        console.error('[PDF] Gagal menggabungkan surat tugas:', error.message);
        return reportPdfBuffer;
    }
}

module.exports = router;
module.exports.warmUp = warmUpPdfBrowser;
module.exports.closeBrowser = async () => {
    const pending = browserPromise;
    browserPromise = null;
    if (pending) {
        const browser = await pending.catch(() => null);
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
};
