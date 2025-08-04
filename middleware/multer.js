const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database-sqlite');

// Configure multer for file uploads with organized directory structure
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            // Get current date for monthly organization
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            
            // Get activity_type_id from req.body
            const activityTypeId = req.body.activity_type_id;
            let activityTypeName = 'umum';
            
            if (activityTypeId) {
                try {
                    // Fetch activity type name from database
                    const activityType = await db.get('SELECT name FROM activity_types WHERE id = ?', [activityTypeId]);
                    if (activityType) {
                        // Clean the name for use as folder name (remove special characters)
                        activityTypeName = activityType.name.toLowerCase()
                            .replace(/[^a-z0-9\s]/g, '')
                            .replace(/\s+/g, '_')
                            .trim();
                    }
                } catch (dbError) {
                    console.error('Error fetching activity type:', dbError);
                }
            }
            
            // Create directory structure: uploads/[ActivityTypeName]/[YYYY-MM]/
            const uploadPath = path.join('uploads', activityTypeName, `${year}-${month}`);

            // Ensure directory exists
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
        } catch (err) {
            console.error('Error in multer destination:', err);
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});


const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    },
    // Increase per-file limit to 20 MB
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB per file
});

module.exports = upload;