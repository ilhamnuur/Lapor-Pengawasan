const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database-sqlite');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();


// Generate PDF for single report
router.get('/report/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let query;
        let params;

        if (req.user.role === 'kepala') {
            query = `
                SELECT r.*, u.name as pegawai_name 
                FROM reports r 
                JOIN users u ON r.user_id = u.id 
                WHERE r.id = ?
            `;
            params = [id];
        } else {
            query = `
                SELECT r.*, u.name as pegawai_name 
                FROM reports r 
                JOIN users u ON r.user_id = u.id 
                WHERE r.id = ? AND r.user_id = ?
            `;
            params = [id, req.user.id];
        }

        const report = await db.get(query, params);
        
        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan' });
        }
        
        // Get photos for the report
        const photos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [id]);
        report.foto_dokumentasi = photos.map(photo => photo.photo_path);
        
        // Generate photos HTML for second page
        let photosHTML = '';
        if (report.foto_dokumentasi?.length > 0) {
            const photoElements = report.foto_dokumentasi.map(photoPath => {
                try {
                    // 1. Dapatkan path absolut ke file
                    const absolutePath = path.resolve(photoPath);

                    // 2. Baca data file gambar
                    const imageBuffer = fs.readFileSync(absolutePath);

                    // 3. Konversi data ke string Base64
                    const base64Image = imageBuffer.toString('base64');

                    // 4. Dapatkan tipe file (misal: 'jpeg', 'png') untuk membuat data URI
                    const fileType = path.extname(photoPath).substring(1);

                    // 5. Buat data URI
                    const dataUri = `data:image/${fileType};base64,${base64Image}`;

                    return `
                    <div class="photo-item">
                        <img src="${dataUri}" alt="Foto Dokumentasi">
                    </div>`;

                } catch (error) {
                    console.error(`Gagal memuat gambar: ${photoPath}`, error);
                    // Return string kosong atau placeholder jika gambar gagal dimuat
                    return '';
                }
            }).join('');

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
        // let photosHTML = '';
        // if (report.foto_dokumentasi && report.foto_dokumentasi.length > 0) {
        //     const photoElements = report.foto_dokumentasi.map(photoPath => {
        //         try {
        //             const imageAsBase64 = fs.readFileSync(photoPath, 'base64');
        //             const fileExtension = path.extname(photoPath).slice(1);
        //             const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
        //             const dataUri = `data:${mimeType};base64,${imageAsBase64}`;
        //             return `<div class="photo-item">
        //                 <img src="${dataUri}" alt="Foto Dokumentasi">
        //             </div>`;
        //         } catch (error) {
        //             console.error(`Could not read file ${photoPath}:`, error);
        //             return `<div class="photo-item"><p>Error loading image</p></div>`;
        //         }
        //     }).join('');

        //     photosHTML = `
        //     <div class="page-break"></div>
        //     <div class="documentation-page">
        //         <div class="documentation-header">
        //             <h2>FOTO-FOTO DOKUMENTASI</h2>
        //         </div>
        //         <div class="photos-grid">
        //             ${photoElements}
        //         </div>
        //     </div>`;
        // }

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Laporan Kegiatan Pengawasan</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
                    .header h2 { margin: 5px 0; font-size: 16px; }
                    .content { margin: 20px 0; }
                    /* Grid dua kolom untuk meluruskan label dan nilai */
                    .info-grid {
                        display: grid;
                        grid-template-columns: 220px 1fr; /* lebar label tetap + nilai fleksibel */
                        gap: 8px 12px;
                        align-items: center;
                    }
                    .info-label {
                        font-weight: bold;
                        white-space: nowrap;
                    }
                    .info-value {
                        /* Pastikan sebaris, namun tetap wrap jika panjang */
                        display: block;
                        line-height: 1.4;
                        word-break: break-word;
                    }
                    .signature { margin-top: 50px; text-align: right; }
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
                <div class="header">
                    <h1>BADAN PUSAT STATISTIK</h1>
                    <h2>KABUPATEN TUBAN</h2>
                    <h2>LAPORAN KEGIATAN PENGAWASAN LAPANGAN</h2>
                </div>
                
                <div class="content">
                    <div class="info-grid">
                        <div class="info-label">Nama Pegawai</div>
                        <div class="info-value">${report.pegawai_name}</div>

                        <div class="info-label">Kegiatan Pengawasan</div>
                        <div class="info-value">${report.kegiatan_pengawasan}</div>

                        <div class="info-label">Tanggal Pelaksanaan</div>
                        <div class="info-value">${new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID')}</div>

                        <div class="info-label">Hari Pelaksanaan</div>
                        <div class="info-value">${report.hari_pelaksanaan}</div>

                        <div class="info-label">Aktivitas yang Dilakukan</div>
                        <div class="info-value">${report.aktivitas}</div>

                        <div class="info-label">Permasalahan</div>
                        <div class="info-value">${report.permasalahan || 'Tidak ada permasalahan'}</div>

                        <div class="info-label">Petugas/Responden Ditemui</div>
                        <div class="info-value">${report.petugas_responden || '-'}</div>

                        <div class="info-label">Solusi/Langkah Antisipatif</div>
                        <div class="info-value">${report.solusi_antisipasi || '-'}</div>
                    </div>
                </div>
                
                <div class="signature">
                    <div class="signature-box">
                        <p>Tuban, ${new Date().toLocaleDateString('id-ID')}</p>
                        <p>Pegawai,</p>
                        <br><br><br>
                        <p><u>${report.pegawai_name}</u></p>
                    </div>
                </div>

                ${photosHTML}
            </body>
            </html>
        `;
        
        const browser = await puppeteer.launch({
        headless: "new" // Opt-in to the new Headless mode
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });
        
        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_${report.pegawai_name}_${report.tanggal_pelaksanaan}.pdf"`);
        res.send(pdf);
        
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

        const reports = await db.all(`
            SELECT r.*, u.name as pegawai_name 
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC
        `);

        for (const report of reports) {
            const photos = await db.all('SELECT photo_path FROM report_photos WHERE report_id = ?', [report.id]);
            report.foto_dokumentasi = photos.map(photo => photo.photo_path);
        }

        const htmlContent = generateAllReportsHTML(reports);
        
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });
        
        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_Semua_Kegiatan_Pengawasan.pdf"`);
        res.send(pdf);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

function generateAllReportsHTML(reports) {
    const reportRows = reports.map(report => {
        let photosHTML = '';
        if (report.foto_dokumentasi && report.foto_dokumentasi.length > 0) {
            const photoElements = report.foto_dokumentasi.map(photoPath => {
                try {
                    const imageAsBase64 = fs.readFileSync(photoPath, 'base64');
                    const fileExtension = path.extname(photoPath).slice(1);
                    const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
                    const dataUri = `data:${mimeType};base64,${imageAsBase64}`;
                    return `<div class="photo-item"><img src="${dataUri}" alt="Foto Dokumentasi"></div>`;
                } catch (error) {
                    console.error(`Could not read file ${photoPath}:`, error);
                    return `<div class="photo-item"><span style="font-size:12px;color:#999">Gagal memuat gambar</span></div>`;
                }
            }).join('');
            photosHTML = `<div class="photos-grid">${photoElements}</div>`;
        }

        return `
            <tr>
                <td>${report.pegawai_name}</td>
                <td>${report.kegiatan_pengawasan}</td>
                <td>${new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID')}</td>
                <td>${report.hari_pelaksanaan}</td>
                <td>${report.aktivitas}</td>
                <td>${report.permasalahan || 'Tidak ada'}</td>
                <td>${photosHTML}</td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Laporan Semua Kegiatan Pengawasan</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 16px; font-weight: bold; }
                .header h2 { margin: 5px 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                th { background-color: #f0f0f0; font-weight: bold; }
                .signature { margin-top: 50px; text-align: right; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>BADAN PUSAT STATISTIK</h1>
                <h2>KABUPATEN TUBAN</h2>
                <h2>LAPORAN SEMUA KEGIATAN PENGAWASAN LAPANGAN</h2>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Nama Pegawai</th>
                        <th>Kegiatan Pengawasan</th>
                        <th>Tanggal</th>
                        <th>Hari</th>
                        <th>Aktivitas</th>
                        <th>Permasalahan</th>
                        <th>Dokumentasi</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportRows}
                </tbody>
            </table>
            
            <div class="signature">
                <div class="signature-box">
                    <p>Tuban, ${new Date().toLocaleDateString('id-ID')}</p>
                    <p>Kepala BPS Kabupaten Tuban,</p>
                    <br><br><br>
                    <p><u>_________________</u></p>
                </div>
            </div>
        </body>
        </html>
    `;
}

module.exports = router;
