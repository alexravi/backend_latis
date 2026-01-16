// Organization routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createOrganization,
  searchOrganizations,
  getOrganizationById,
  updateOrganization,
  validateOrganization,
  validateOrganizationUpdate,
} = require('../controllers/organizationController');

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create a new medical organization
 *     tags: [Organizations]
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
 *               - organization_type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Mayo Clinic"
 *               organization_type:
 *                 type: string
 *                 example: "Hospital"
 *               description:
 *                 type: string
 *                 example: "A leading medical center"
 *               location:
 *                 type: string
 *                 example: "Rochester, MN"
 *               website:
 *                 type: string
 *                 example: "https://www.mayoclinic.org"
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Cardiology", "Oncology"]
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateOrganization, createOrganization);

/**
 * @swagger
 * /api/organizations/search:
 *   get:
 *     summary: Search for organizations
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query term
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by organization type
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
router.get('/search', authenticateToken, searchOrganizations);

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get a specific organization by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *       404:
 *         description: Organization not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getOrganizationById);

/**
 * @swagger
 * /api/organizations/{id}:
 *   put:
 *     summary: Update an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               website:
 *                 type: string
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Organization not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validateOrganizationUpdate, updateOrganization);

module.exports = router;
