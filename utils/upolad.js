const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = "uploads"; // Define directory

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Get file extension
        const ext = path.extname(file.originalname);
        // Generate a unique filename
        const sanitized_name = path.basename(file.originalname, ext).replace(/\s+/g, "_");
        const unique_name = `${sanitized_name}_${Date.now()}${ext}`;
        cb(null, unique_name);
    }
});

// Multer instance
const upload = multer({ storage: storage });

module.exports = upload;
