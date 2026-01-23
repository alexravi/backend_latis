// Upload routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadSingle, uploadMultiple } = require('../middleware/uploadMiddleware');
const {
  uploadProfileImage,
  uploadCoverImage,
  uploadDocument,
  uploadMultiple: handleUploadMultiple,
  generateUploadTokenHandler,
  completeUploadHandler,
  getMediaStatus,
} = require('../controllers/uploadController');

// All upload routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/upload/profile-image:
 *   post:
 *     summary: Upload profile image
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profile_image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: No file uploaded or invalid file type
 */
router.post('/profile-image', uploadSingle('profile_image'), uploadProfileImage);

/**
 * @swagger
 * /api/upload/cover-image:
 *   post:
 *     summary: Upload cover image
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cover_image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 */
router.post('/cover-image', uploadSingle('cover_image'), uploadCoverImage);

/**
 * @swagger
 * /api/upload/document:
 *   post:
 *     summary: Upload document
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 */
router.post('/document', uploadSingle('document'), uploadDocument);

/**
 * @swagger
 * /api/upload/multiple:
 *   post:
 *     summary: Upload multiple files
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 */
router.post('/multiple', uploadMultiple('files', 10), handleUploadMultiple);

/**
 * @swagger
 * /api/upload/token:
 *   post:
 *     summary: Generate SAS token for direct upload to Azure
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content_type
 *             properties:
 *               content_type:
 *                 type: string
 *                 example: image/jpeg
 *               file_size:
 *                 type: integer
 *                 example: 1048576
 *     responses:
 *       200:
 *         description: SAS token generated successfully
 *       400:
 *         description: Invalid request
 */
router.post('/token', generateUploadTokenHandler);

/**
 * @swagger
 * /api/upload/complete:
 *   post:
 *     summary: Notify upload completion and start processing
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - upload_id
 *               - blob_name
 *               - media_type
 *             properties:
 *               upload_id:
 *                 type: string
 *               blob_name:
 *                 type: string
 *               media_type:
 *                 type: string
 *                 enum: [image, video]
 *               content_type:
 *                 type: string
 *               file_size:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Upload completed, processing started
 */
router.post('/complete', completeUploadHandler);

/**
 * @swagger
 * /api/upload/media/{id}/status:
 *   get:
 *     summary: Get media processing status
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Media status retrieved
 *       404:
 *         description: Media not found
 */
router.get('/media/:id/status', getMediaStatus);

module.exports = router;
