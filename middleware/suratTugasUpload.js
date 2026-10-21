const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Folder khusus surat tugas per jenis kegiatan.
const uploadDir = path.join(__dirname, '..', 'uploads', 'surat_tugas');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(uploadDir, { recursive: true }, (err) => cb(err, uploadDir));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `surat-tugas-${uniqueSuffix}.pdf`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const isPdf = ext === '.pdf' && (file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream');
        if (isPdf) return cb(null, true);
        cb(new Error('Surat tugas harus berupa file PDF'));
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

module.exports = upload;
