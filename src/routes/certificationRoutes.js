// Certification routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createCertification,
  getCertifications,
  getCertificationById,
  getExpiringCertifications,
  updateCertification,
  deleteCertification,
  validateCertification,
} = require('../controllers/certificationController');

/**
 * @swagger
 * /api/certifications:
 *   post:
 *     summary: Create a new certification or license
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - certification_type
 *               - name
 *               - issuing_organization
 *             properties:
 *               certification_type:
 *                 type: string
 *                 example: "State Medical License"
 *               name:
 *                 type: string
 *                 example: "Medical License - California"
 *               issuing_organization:
 *                 type: string
 *                 example: "California Medical Board"
 *               license_number:
 *                 type: string
 *                 example: "A12345"
 *               issue_date:
 *                 type: string
 *                 format: date
 *                 example: "2020-01-01"
 *               expiration_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *               status:
 *                 type: string
 *                 example: "Active"
 *     responses:
 *       201:
 *         description: Certification created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateCertification, createCertification);

/**
 * @swagger
 * /api/certifications:
 *   get:
 *     summary: Get all certifications for the current user
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of certifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getCertifications);

/**
 * @swagger
 * /api/certifications/expiring:
 *   get:
 *     summary: Get certifications that are expiring soon
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: Number of days ahead to check for expiring certifications
 *     responses:
 *       200:
 *         description: List of expiring certifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/expiring', authenticateToken, getExpiringCertifications);

/**
 * @swagger
 * /api/certifications/{id}:
 *   get:
 *     summary: Get a specific certification by ID
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Certification ID
 *     responses:
 *       200:
 *         description: Certification retrieved successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Certification not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getCertificationById);

/**
 * @swagger
 * /api/certifications/{id}:
 *   put:
 *     summary: Update a certification
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Certification ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               expiration_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Certification updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Certification not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validateCertification, updateCertification);

/**
 * @swagger
 * /api/certifications/{id}:
 *   delete:
 *     summary: Delete a certification
 *     tags: [Certifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Certification ID
 *     responses:
 *       200:
 *         description: Certification deleted successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Certification not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deleteCertification);

module.exports = router;
