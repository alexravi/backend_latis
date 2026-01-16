// Publication routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createPublication,
  getPublications,
  getPublicationById,
  updatePublication,
  deletePublication,
  validatePublication,
} = require('../controllers/publicationController');

/**
 * @swagger
 * /api/publications:
 *   post:
 *     summary: Create a new publication
 *     tags: [Publications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publication_type
 *               - title
 *               - authors
 *             properties:
 *               publication_type:
 *                 type: string
 *                 example: "Research Paper"
 *               title:
 *                 type: string
 *                 example: "Advances in Cardiac Surgery"
 *               authors:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["John Doe", "Jane Smith"]
 *               journal_name:
 *                 type: string
 *                 example: "Journal of Cardiology"
 *               publication_date:
 *                 type: string
 *                 format: date
 *                 example: "2023-06-15"
 *               doi:
 *                 type: string
 *                 example: "10.1234/example"
 *     responses:
 *       201:
 *         description: Publication created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validatePublication, createPublication);

/**
 * @swagger
 * /api/publications:
 *   get:
 *     summary: Get all publications for the current user
 *     tags: [Publications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of publications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getPublications);

/**
 * @swagger
 * /api/publications/{id}:
 *   get:
 *     summary: Get a specific publication by ID
 *     tags: [Publications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Publication ID
 *     responses:
 *       200:
 *         description: Publication retrieved successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Publication not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getPublicationById);

/**
 * @swagger
 * /api/publications/{id}:
 *   put:
 *     summary: Update a publication
 *     tags: [Publications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Publication ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               authors:
 *                 type: array
 *                 items:
 *                   type: string
 *               journal_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Publication updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Publication not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validatePublication, updatePublication);

/**
 * @swagger
 * /api/publications/{id}:
 *   delete:
 *     summary: Delete a publication
 *     tags: [Publications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Publication ID
 *     responses:
 *       200:
 *         description: Publication deleted successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Publication not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deletePublication);

module.exports = router;
