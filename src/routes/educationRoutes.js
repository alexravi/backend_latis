// Education routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createEducation,
  getEducation,
  getEducationById,
  updateEducation,
  deleteEducation,
  validateEducationCreate,
  validateEducationUpdate,
} = require('../controllers/educationController');

/**
 * @swagger
 * /api/education:
 *   post:
 *     summary: Create a new medical education entry
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - degree_type
 *               - institution_name
 *             properties:
 *               degree_type:
 *                 type: string
 *                 example: "MD"
 *               institution_name:
 *                 type: string
 *                 example: "Harvard Medical School"
 *               field_of_study:
 *                 type: string
 *                 example: "Medicine"
 *               graduation_date:
 *                 type: string
 *                 format: date
 *                 example: "2015-05-15"
 *               gpa:
 *                 type: number
 *                 format: float
 *                 example: 3.8
 *     responses:
 *       201:
 *         description: Education created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateEducationCreate, createEducation);

/**
 * @swagger
 * /api/education:
 *   get:
 *     summary: Get all education entries for the current user
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of education entries retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getEducation);

/**
 * @swagger
 * /api/education/{id}:
 *   get:
 *     summary: Get a specific education entry by ID
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Education ID
 *     responses:
 *       200:
 *         description: Education entry retrieved successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Education not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getEducationById);

/**
 * @swagger
 * /api/education/{id}:
 *   put:
 *     summary: Update an education entry
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Education ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               degree_type:
 *                 type: string
 *               institution_name:
 *                 type: string
 *               graduation_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Education updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Education not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validateEducationUpdate, updateEducation);

/**
 * @swagger
 * /api/education/{id}:
 *   delete:
 *     summary: Delete an education entry
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Education ID
 *     responses:
 *       200:
 *         description: Education deleted successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Education not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deleteEducation);

module.exports = router;
