const multer = require('multer')

const storage = multer.memoryStorage() // keeps file in memory as a buffer

// Only accept csv file types
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
        cb(null, true) // accept the file
    } else {
        cb(new Error('Only CSV files allowed'), false) // reject it
    }
}

// Create multer instance
const upload = multer({
    storage, 
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter
})

module.exports = upload.single('file') // accept one file with field name 'file'