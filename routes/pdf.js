const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
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
        if (report.foto_dokumentasi && report.foto_dokumentasi.length > 0) {
            const photoElements = report.foto_dokumentasi.map(photoPath => {
                // Assuming photoPath is now a full path like 'uploads/activity/2025-08/filename.jpg'
                const fullPath = path.resolve(photoPath);
                return `<div class="photo-item">
                    <img src="file://${fullPath}" alt="Foto Dokumentasi">
                </div>`;
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
                    .field { margin-bottom: 15px; }
                    .field label { font-weight: bold; display: inline-block; width: 200px; }
                    .field span { margin-left: 10px; }
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
                        gap: 20px; 
                        margin-top: 20px; 
                    }
                    .photo-item { 
                        text-align: center; 
                        page-break-inside: avoid; 
                    }
                    .photo-item img { 
                        max-width: 100%; 
                        max-height: 300px; 
                        border: 1px solid #ddd; 
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
                    <div class="field">
                        <label>Nama Pegawai:</label>
                        <span>${report.pegawai_name}</span>
                    </div>
                    <div class="field">
                        <label>Kegiatan Pengawasan:</label>
                        <span>${report.kegiatan_pengawasan}</span>
                    </div>
                    <div class="field">
                        <label>Tanggal Pelaksanaan:</label>
                        <span>${new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID')}</span>
                    </div>
                    <div class="field">
                        <label>Hari Pelaksanaan:</label>
                        <span>${report.hari_pelaksanaan}</span>
                    </div>
                    <div class="field">
                        <label>Aktivitas yang Dilakukan:</label>
                        <span>${report.aktivitas}</span>
                    </div>
                    <div class="field">
                        <label>Permasalahan:</label>
                        <span>${report.permasalahan || 'Tidak ada permasalahan'}</span>
                    </div>
                    <div class="field">
                        <label>Petugas/Responden Ditemui:</label>
                        <span>${report.petugas_responden || '-'}</span>
                    </div>
                    <div class="field">
                        <label>Solusi/Langkah Antisipatif:</label>
                        <span>${report.solusi_antisipasi || '-'}</span>
                    </div>
                </div>
                
                <div class="signature">
                    <div class="signature-box">
                        <p>Tuban, ${new Date().toLocaleDateString('id-ID')}</p>
                        <p>Pelapor,</p>
                        <br><br><br>
                        <p><u>${report.pegawai_name}</u></p>
                    </div>
                </div>

                ${photosHTML}
            </body>
            </html>
        `;
        
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
    const reportRows = reports.map(report => `
        <tr>
            <td>${report.pegawai_name}</td>
            <td>${report.kegiatan_pengawasan}</td>
            <td>${new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID')}</td>
            <td>${report.hari_pelaksanaan}</td>
            <td>${report.aktivitas.substring(0, 100)}${report.aktivitas.length > 100 ? '...' : ''}</td>
            <td>${report.permasalahan ? report.permasalahan.substring(0, 100) + (report.permasalahan.length > 100 ? '...' : '') : 'Tidak ada'}</td>
        </tr>
    `).join('');

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
