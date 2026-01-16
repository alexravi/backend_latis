// Award routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createAward,
  getAwards,
  getAwardById,
  updateAward,
  deleteAward,
  validateAward,
} = require('../controllers/awardController');

/**
 * @swagger
 * /api/awards:
 *   post:
 *     summary: Create a new award or recognition
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - award_type
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Outstanding Physician of the Year"
 *               award_type:
 *                 type: string
 *                 example: "Professional Recognition"
 *               issuing_organization:
 *                 type: string
 *                 example: "American Medical Association"
 *               date_received:
 *                 type: string
 *                 format: date
 *                 example: "2023-12-01"
 *               year:
 *                 type: integer
 *                 example: 2023
 *               description:
 *                 type: string
 *                 example: "Recognized for excellence in patient care"
 *     responses:
 *       201:
 *         description: Award created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateAward, createAward);

/**
 * @swagger
 * /api/awards:
 *   get:
 *     summary: Get all awards for the current user
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of awards retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getAwards);

/**
 * @swagger
 * /api/awards/{id}:
 *   get:
 *     summary: Get a specific award by ID
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Award ID
 *     responses:
 *       200:
 *         description: Award retrieved successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Award not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getAwardById);

/**
 * @swagger
 * /api/awards/{id}:
 *   put:
 *     summary: Update an award
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Award ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               date_received:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Award updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Award not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validateAward, updateAward);

/**
 * @swagger
 * /api/awards/{id}:
 *   delete:
 *     summary: Delete an award
 *     tags: [Awards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Award ID
 *     responses:
 *       200:
 *         description: Award deleted successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Award not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deleteAward);

module.exports = router;
