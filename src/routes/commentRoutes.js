// Comment routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createComment,
  getPostComments,
  getCommentById,
  updateComment,
  deleteComment,
  upvoteComment,
  downvoteComment,
  removeVote,
  validateComment,
} = require('../controllers/commentController');

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - post_id
 *             properties:
 *               content:
 *                 type: string
 *                 example: "This is my comment"
 *               post_id:
 *                 type: integer
 *                 example: 1
 *               parent_comment_id:
 *                 type: integer
 *                 example: null
 *                 description: ID of parent comment if replying to a comment
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post or parent comment not found
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateComment, createComment);


/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get a comment by ID with replies
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [best, top, new]
 *           default: best
 *         description: Sort order for replies
 *       - in: query
 *         name: replyLimit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of replies to return
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *       404:
 *         description: Comment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getCommentById);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Updated comment content"
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not authorized to edit this comment
 *       404:
 *         description: Comment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validateComment, updateComment);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deleteComment);

/**
 * @swagger
 * /api/comments/{id}/upvote:
 *   post:
 *     summary: Upvote a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment upvoted successfully
 *       404:
 *         description: Comment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:id/upvote', authenticateToken, upvoteComment);

/**
 * @swagger
 * /api/comments/{id}/downvote:
 *   post:
 *     summary: Downvote a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment downvoted successfully
 *       404:
 *         description: Comment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:id/downvote', authenticateToken, downvoteComment);

/**
 * @swagger
 * /api/comments/{id}/vote:
 *   delete:
 *     summary: Remove vote from a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Vote removed successfully
 *       404:
 *         description: Comment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/vote', authenticateToken, removeVote);

module.exports = router;
