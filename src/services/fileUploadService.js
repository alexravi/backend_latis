// File upload service
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const ensureUploadsDir = async () => {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
    logger.info('Created uploads directory');
  }
};

// Initialize uploads directory
ensureUploadsDir();

// Configure storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadsDir();
    // Organize by file type
    const subDir = file.fieldname === 'profile_image' || file.fieldname === 'cover_image' 
      ? 'images' 
      : file.fieldname === 'document' 
        ? 'documents' 
        : 'misc';
    const dest = path.join(uploadsDir, subDir);
    await fs.mkdir(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter with mimetype validation
// Note: Multer's fileFilter is synchronous, so we validate extension and mimetype here
// For stronger security with buffer inspection, consider post-processing validation
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|doc|docx|txt/;
  
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype || '';
  
  // Validate images
  if (file.fieldname === 'profile_image' || file.fieldname === 'cover_image') {
    const isValidExt = allowedImageTypes.test(ext);
    const isValidMime = mimetype.startsWith('image/');
    
    if (!isValidExt || !isValidMime) {
      return cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed for images'), false);
    }
    
    cb(null, true);
  } else if (file.fieldname === 'document') {
    const isValidExt = allowedDocTypes.test(ext);
    const validDocMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const isValidMime = validDocMimes.includes(mimetype);
    
    if (!isValidExt || !isValidMime) {
      return cb(new Error('Only document files (pdf, doc, docx, txt) are allowed'), false);
    }
    
    cb(null, true);
  } else {
    // Allow other file types by default (can be restricted further)
    cb(null, true);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
});

/**
 * Get file URL (for serving files)
 */
const getFileUrl = (filePath) => {
  if (!filePath) return null;
  // If file path is already a URL, return as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  // Otherwise, construct URL from relative path
  const relativePath = filePath.replace(process.cwd(), '').replace(/\\/g, '/');
  return `/uploads${relativePath}`;
};

/**
 * Delete file
 */
const deleteFile = async (filePath) => {
  try {
    if (!filePath) return;
    // Don't delete if it's a URL (external file)
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return;
    }
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    await fs.unlink(fullPath);
    logger.debug('File deleted', { path: fullPath });
  } catch (error) {
    // File might not exist, log but don't throw
    logger.warn('Failed to delete file', { path: filePath, error: error.message });
  }
};

module.exports = {
  upload,
  getFileUrl,
  deleteFile,
  ensureUploadsDir,
};
