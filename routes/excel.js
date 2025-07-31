const express = require('express');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();
const XLSX = require('xlsx');

// Generate Excel for all reports (Kepala only)
router.get('/all-reports', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const reports = await db.all(`
            SELECT r.*, u.name as pegawai_name 
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC
        `);

        // Get photos for all reports
        const reportIds = reports.map(report => report.id);
        const photos = await db.all(`
            SELECT report_id, photo_path 
            FROM report_photos 
            WHERE report_id IN (${reportIds.length > 0 ? reportIds.map(() => '?').join(',') : 'NULL'})
        `, reportIds);

        // Group photos by report_id
        const photosByReport = {};
        photos.forEach(photo => {
            if (!photosByReport[photo.report_id]) {
                photosByReport[photo.report_id] = [];
            }
            photosByReport[photo.report_id].push(photo.photo_path);
        });

        // Add foto_dokumentasi to each report
        reports.forEach(report => {
            report.foto_dokumentasi = photosByReport[report.id] || [];
        });

        // Prepare data for Excel
        const excelData = reports.map(report => ({
            'ID Laporan': report.id,
            'Nama Pegawai': report.pegawai_name,
            'Kegiatan Pengawasan': report.kegiatan_pengawasan,
            'Tanggal Pelaksanaan': new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID'),
            'Hari Pelaksanaan': report.hari_pelaksanaan,
            'Aktivitas yang Dilakukan': report.aktivitas,
            'Permasalahan': report.permasalahan || 'Tidak ada',
            'Surat Tugas': report.surat_tugas_path ? 'Tersedia' : 'Tidak ada',
            'Dokumen Visum': report.dokumen_visum_path ? 'Tersedia' : 'Tidak ada',
            'Foto Dokumentasi': report.foto_dokumentasi.length > 0 ? report.foto_dokumentasi.join(', ') : 'Tidak ada',
            'Tanggal Dibuat': new Date(report.created_at).toLocaleDateString('id-ID'),
            'Tanggal Diupdate': new Date(report.updated_at).toLocaleDateString('id-ID')
        }));

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pengawasan');

        // Set column widths
        const colWidths = [
            { wch: 10 },  // ID Laporan
            { wch: 20 },  // Nama Pegawai
            { wch: 30 },  // Kegiatan Pengawasan
            { wch: 15 },  // Tanggal Pelaksanaan
            { wch: 15 },  // Hari Pelaksanaan
            { wch: 40 },  // Aktivitas yang Dilakukan
            { wch: 30 },  // Permasalahan
            { wch: 15 },  // Surat Tugas
            { wch: 15 },  // Dokumen Visum
            { wch: 30 },  // Foto Dokumentasi
            { wch: 15 },  // Tanggal Dibuat
            { wch: 15 }   // Tanggal Diupdate
        ];
        
        ws['!cols'] = colWidths;

        // Generate buffer
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Send response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_Semua_Kegiatan_Pengawasan.xlsx"`);
        res.send(buf);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
