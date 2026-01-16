// Skill routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  addSkill,
  getUserSkills,
  getAvailableSkills,
  searchSkills,
  removeSkill,
  validateSkill,
} = require('../controllers/skillController');

/**
 * @swagger
 * /api/skills:
 *   post:
 *     summary: Add a skill to the current user's profile
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Cardiology"
 *               category:
 *                 type: string
 *                 example: "Medical Specialty"
 *               proficiency_level:
 *                 type: string
 *                 example: "Expert"
 *               years_of_experience:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Skill added successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateSkill, addSkill);

/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: Get all skills for the current user
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user skills retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getUserSkills);

/**
 * @swagger
 * /api/skills/available:
 *   get:
 *     summary: Get all available skills (for dropdown/selection)
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by skill category
 *     responses:
 *       200:
 *         description: List of available skills retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/available', authenticateToken, getAvailableSkills);

/**
 * @swagger
 * /api/skills/search:
 *   get:
 *     summary: Search for skills
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query term
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       400:
 *         description: Search query is required
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/search', authenticateToken, searchSkills);

/**
 * @swagger
 * /api/skills/{id}:
 *   delete:
 *     summary: Remove a skill from the current user's profile
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Skill ID
 *     responses:
 *       200:
 *         description: Skill removed successfully
 *       404:
 *         description: Skill not found in user profile
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, removeSkill);

module.exports = router;
