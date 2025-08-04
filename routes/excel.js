const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../config/database-sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Export all reports to Excel (Kepala only)
router.get('/reports', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        // Get all reports with user and activity type information
        const reports = await db.all(`
            SELECT 
                r.*,
                u.name as pegawai_name,
                at.name as activity_type_name
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            LEFT JOIN activity_types at ON r.activity_type_id = at.id
            ORDER BY r.created_at DESC
        `);

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Pengawasan');

        // Set worksheet properties
        worksheet.properties.defaultRowHeight = 20;

        // Add title
        worksheet.mergeCells('A1:K1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LAPORAN KEGIATAN PENGAWASAN LAPANGAN BPS KABUPATEN TUBAN';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Add date generated
        worksheet.mergeCells('A2:K2');
        const dateCell = worksheet.getCell('A2');
        dateCell.value = `Digenerate pada: ${new Date().toLocaleDateString('id-ID', {
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        dateCell.font = { italic: true, size: 10 };
        dateCell.alignment = { horizontal: 'center' };

        // Add empty row
        worksheet.addRow([]);

        // Define headers
        const headers = [
            'No',
            'Nama Pegawai',
            'Nomor Surat Tugas',
            'Jenis Kegiatan',
            'Kegiatan Pengawasan',
            'Tanggal Pelaksanaan',
            'Hari Pelaksanaan',
            'Aktivitas yang Dilakukan',
            'Permasalahan',
            'Petugas/Responden Ditemui',
            'Solusi/Langkah Antisipatif',
            'Tanggal Dibuat'
        ];

        // Add headers
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Set column widths
        worksheet.columns = [
            { width: 5 },   // No
            { width: 20 },  // Nama Pegawai
            { width: 22 },  // Nomor Surat Tugas
            { width: 20 },  // Jenis Kegiatan
            { width: 30 },  // Kegiatan Pengawasan
            { width: 15 },  // Tanggal Pelaksanaan
            { width: 15 },  // Hari Pelaksanaan
            { width: 40 },  // Aktivitas
            { width: 30 },  // Permasalahan
            { width: 30 },  // Petugas/Responden
            { width: 40 },  // Solusi/Antisipasi
            { width: 15 }   // Tanggal Dibuat
        ];

        // Add data rows
        reports.forEach((report, index) => {
            const row = worksheet.addRow([
                index + 1,
                report.pegawai_name,
                report.nomor_surat_tugas || '-',
                report.activity_type_name || '-',
                report.kegiatan_pengawasan,
                new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID'),
                report.hari_pelaksanaan,
                report.aktivitas,
                report.permasalahan || 'Tidak ada permasalahan',
                report.petugas_responden || '-',
                report.solusi_antisipasi || '-',
                new Date(report.created_at).toLocaleDateString('id-ID')
            ]);

            // Alternate row colors
            if (index % 2 === 1) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8F8F8' }
                };
            }

            // Wrap text for long content
            row.getCell(7).alignment = { wrapText: true, vertical: 'top' }; // Aktivitas
            row.getCell(8).alignment = { wrapText: true, vertical: 'top' }; // Permasalahan
            row.getCell(9).alignment = { wrapText: true, vertical: 'top' }; // Petugas/Responden
            row.getCell(10).alignment = { wrapText: true, vertical: 'top' }; // Solusi/Antisipasi
        });

        // Add borders to all cells
        const lastRow = worksheet.lastRow.number;
        const lastCol = headers.length;
        
        for (let row = 4; row <= lastRow; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cell = worksheet.getCell(row, col);
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
        }

        // Add summary at the bottom
        worksheet.addRow([]);
        const summaryRow = worksheet.addRow(['', 'Total Laporan:', reports.length]);
        summaryRow.getCell(2).font = { bold: true };
        summaryRow.getCell(3).font = { bold: true };

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_Pengawasan_BPS_Tuban_${new Date().toISOString().split('T')[0]}.xlsx"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ message: 'Gagal membuat file Excel' });
    }
});

// Export reports by date range (Kepala only)
router.get('/reports-by-date', authenticateToken, authorizeRole(['kepala']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Tanggal mulai dan tanggal akhir harus diisi' });
        }

        const reports = await db.all(`
            SELECT 
                r.*,
                u.name as pegawai_name,
                at.name as activity_type_name
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            LEFT JOIN activity_types at ON r.activity_type_id = at.id
            WHERE r.tanggal_pelaksanaan BETWEEN ? AND ?
            ORDER BY r.tanggal_pelaksanaan DESC
        `, [startDate, endDate]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Pengawasan');

        // Similar structure as above but with date range in title
        worksheet.mergeCells('A1:K1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `LAPORAN KEGIATAN PENGAWASAN LAPANGAN BPS KABUPATEN TUBAN`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells('A2:K2');
        const periodCell = worksheet.getCell('A2');
        periodCell.value = `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}`;
        periodCell.font = { bold: true, size: 12 };
        periodCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:K3');
        const dateCell = worksheet.getCell('A3');
        dateCell.value = `Digenerate pada: ${new Date().toLocaleDateString('id-ID', {
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        dateCell.font = { italic: true, size: 10 };
        dateCell.alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        const headers = [
            'No', 'Nama Pegawai', 'Nomor Surat Tugas', 'Jenis Kegiatan', 'Kegiatan Pengawasan',
            'Tanggal Pelaksanaan', 'Hari Pelaksanaan', 'Aktivitas yang Dilakukan',
            'Permasalahan', 'Petugas/Responden Ditemui', 'Solusi/Langkah Antisipatif', 'Tanggal Dibuat'
        ];

        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        worksheet.columns = [
            { width: 5 }, { width: 20 }, { width: 22 }, { width: 20 }, { width: 30 },
            { width: 15 }, { width: 15 }, { width: 40 }, { width: 30 }, { width: 30 }, { width: 40 }, { width: 15 }
        ];

        reports.forEach((report, index) => {
            const row = worksheet.addRow([
                index + 1,
                report.pegawai_name,
                report.nomor_surat_tugas || '-',
                report.activity_type_name || '-',
                report.kegiatan_pengawasan,
                new Date(report.tanggal_pelaksanaan).toLocaleDateString('id-ID'),
                report.hari_pelaksanaan,
                report.aktivitas,
                report.permasalahan || 'Tidak ada permasalahan',
                report.petugas_responden || '-',
                report.solusi_antisipasi || '-',
                new Date(report.created_at).toLocaleDateString('id-ID')
            ]);

            if (index % 2 === 1) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8F8F8' }
                };
            }

            row.getCell(7).alignment = { wrapText: true, vertical: 'top' };
            row.getCell(8).alignment = { wrapText: true, vertical: 'top' };
            row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
            row.getCell(10).alignment = { wrapText: true, vertical: 'top' };
        });

        // Add borders
        const lastRow = worksheet.lastRow.number;
        const lastCol = headers.length;
        
        for (let row = 5; row <= lastRow; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cell = worksheet.getCell(row, col);
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
        }

        worksheet.addRow([]);
        const summaryRow = worksheet.addRow(['', 'Total Laporan:', reports.length]);
        summaryRow.getCell(2).font = { bold: true };
        summaryRow.getCell(3).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Laporan_Pengawasan_${startDate}_${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ message: 'Gagal membuat file Excel' });
    }
});

module.exports = router;
