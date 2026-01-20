// Status routes
const express = require('express');
const router = express.Router();
const { getRedisStatus, getHealthStatus } = require('../controllers/statusController');

/**
 * @swagger
 * /api/status/redis:
 *   get:
 *     summary: Get Redis connection status
 *     description: |
 *       Check Redis connection status. Returns connection state and configuration information.
 *       
 *       **Note:** This endpoint does not require authentication.
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Redis status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                       description: Whether Redis is currently connected
 *                     enabled:
 *                       type: boolean
 *                       example: true
 *                       description: Whether Redis is configured (REDIS_HOST is set)
 *                     message:
 *                       type: string
 *                       example: "Redis connected"
 *                       description: Status message
 *                     config:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         host:
 *                           type: string
 *                           example: "localhost"
 *                         port:
 *                           type: integer
 *                           example: 6379
 *                         db:
 *                           type: integer
 *                           example: 0
 *                         password_set:
 *                           type: boolean
 *                           example: false
 *                       description: Redis configuration (only if enabled)
 *             example:
 *               success: true
 *               data:
 *                 connected: true
 *                 enabled: true
 *                 message: "Redis connected"
 *                 config:
 *                   host: "localhost"
 *                   port: 6379
 *                   db: 0
 *                   password_set: false
 *       500:
 *         description: Error checking Redis status
 */
router.get('/redis', getRedisStatus);

/**
 * @swagger
 * /api/status/health:
 *   get:
 *     summary: Get system health status
 *     description: |
 *       Comprehensive health check endpoint that returns the status of:
 *       - Database connection (PostgreSQL)
 *       - Redis connection (if configured)
 *       - WebSocket service (if enabled)
 *       
 *       **Note:** This endpoint does not require authentication.
 *       
 *       **Status codes:**
 *       - `200`: System is healthy (all enabled services are connected)
 *       - `503`: System is degraded (some services are unavailable)
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded]
 *                       example: "healthy"
 *                     database:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: true
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         version:
 *                           type: string
 *                           example: "PostgreSQL 15.0"
 *                     redis:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: true
 *                         enabled:
 *                           type: boolean
 *                           example: true
 *                         message:
 *                           type: string
 *                           example: "Redis connected"
 *                     websocket:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                           example: true
 *                         message:
 *                           type: string
 *                           example: "WebSocket enabled"
 *                     environment:
 *                       type: string
 *                       example: "development"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       503:
 *         description: System is degraded (some services unavailable)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "degraded"
 *                     database:
 *                       type: object
 *                     redis:
 *                       type: object
 *                     websocket:
 *                       type: object
 *       500:
 *         description: Error checking system health
 */
router.get('/health', getHealthStatus);

module.exports = router;
