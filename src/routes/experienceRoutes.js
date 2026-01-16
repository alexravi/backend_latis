// Experience routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperience,
  deleteExperience,
  validateExperience,
} = require('../controllers/experienceController');

/**
 * @swagger
 * /api/experiences:
 *   post:
 *     summary: Create a new medical experience
 *     tags: [Experiences]
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
 *               - position_type
 *               - institution_name
 *               - start_date
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Attending Physician"
 *               position_type:
 *                 type: string
 *                 example: "Residency"
 *               institution_name:
 *                 type: string
 *                 example: "Mayo Clinic"
 *               department:
 *                 type: string
 *                 example: "Cardiology"
 *               specialty:
 *                 type: string
 *                 example: "Cardiology"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2020-01-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2023-12-31"
 *               is_current:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Experience created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateExperience, createExperience);

/**
 * @swagger
 * /api/experiences:
 *   get:
 *     summary: Get all experiences for the current user
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of experiences retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getExperiences);

/**
 * @swagger
 * /api/experiences/{id}:
 *   get:
 *     summary: Get a specific experience by ID
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Experience ID
 *     responses:
 *       200:
 *         description: Experience retrieved successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Experience not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getExperienceById);

/**
 * @swagger
 * /api/experiences/{id}:
 *   put:
 *     summary: Update an experience
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Experience ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               position_type:
 *                 type: string
 *               institution_name:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Experience updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Experience not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validateExperience, updateExperience);

/**
 * @swagger
 * /api/experiences/{id}:
 *   delete:
 *     summary: Delete an experience
 *     tags: [Experiences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Experience ID
 *     responses:
 *       200:
 *         description: Experience deleted successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Experience not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deleteExperience);

module.exports = router;
