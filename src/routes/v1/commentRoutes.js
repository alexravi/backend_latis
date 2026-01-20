// Comment routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
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
} = require('../../controllers/commentController');

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment or reply
 *     description: |
 *       Create a comment on a post or reply to an existing comment.
 *       
 *       **Comment vs Reply:**
 *       - Top-level comment: Omit `parent_comment_id` or set to `null`
 *       - Reply: Set `parent_comment_id` to the comment ID you're replying to
 *       
 *       **Nesting:** Supports unlimited nesting depth (replies to replies to replies...)
 *       
 *       **Real-time:** Emits `comment:created` or `comment:replied` event via WebSocket
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
 *                 minLength: 1
 *                 maxLength: 5000
 *                 example: "This is my comment"
 *                 description: Comment content (1-5000 characters)
 *               post_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID of the post to comment on
 *               parent_comment_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *                 description: |
 *                   ID of parent comment if replying to a comment.
 *                   Leave null or omit for top-level comment.
 *                   Supports unlimited nesting depth.
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentResponse'
 *             example:
 *               success: true
 *               message: "Comment created successfully"
 *               data:
 *                 id: 1
 *                 post_id: 1
 *                 user_id: 2
 *                 content: "This is my comment"
 *                 parent_comment_id: null
 *                 user_vote: null
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post or parent comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validateComment, createComment);


/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get a comment by ID with replies (supports nested tree structure)
 *     description: |
 *       Get a comment with its replies. Supports two modes:
 *       - **Flat structure** (default): Returns comment with direct replies only (paginated)
 *       - **Tree structure**: Returns comment with complete nested reply tree with unlimited depth (use ?tree=true)
 *       
 *       **Sorting:** Applies to replies at each nesting level when using tree structure
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
 *         example: 1
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [best, top, new]
 *           default: best
 *         description: Sort order for replies (applies to each level in tree)
 *       - in: query
 *         name: tree
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, returns complete nested reply tree with unlimited depth. If false, returns flat structure with pagination.
 *         example: true
 *       - in: query
 *         name: replyLimit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of replies to return (only used when tree=false)
 *     responses:
 *       200:
 *         description: Comment retrieved successfully with replies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Comment'
 *             examples:
 *               treeStructure:
 *                 summary: Tree structure (tree=true)
 *                 value:
 *                   success: true
 *                   data:
 *                     id: 1
 *                     content: "Parent comment"
 *                     replies:
 *                       - id: 2
 *                         content: "Reply 1"
 *                         replies:
 *                           - id: 3
 *                             content: "Nested reply"
 *                             replies: []
 *               flatStructure:
 *                 summary: Flat structure (tree=false)
 *                 value:
 *                   success: true
 *                   data:
 *                     id: 1
 *                     content: "Parent comment"
 *                     replies:
 *                       - id: 2
 *                         content: "Reply 1"
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     summary: Upvote a comment (Reddit-style toggle behavior)
 *     description: |
 *       Upvote a comment. Uses Reddit-style toggle behavior:
 *       
 *       **Toggle Behavior:**
 *       - If comment is not voted: Adds upvote
 *       - If comment is already upvoted: Removes vote (toggles off)
 *       - If comment is downvoted: Changes to upvote (toggles)
 *       
 *       **Real-time:** Emits `vote:upvote` or `vote:removed` event via WebSocket
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Comment ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Vote operation completed (upvoted, toggled, or removed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   enum: ["Comment upvoted", "Vote removed", "Vote changed to upvote"]
 *                   example: "Comment upvoted"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Comment'
 *                     - type: object
 *                       properties:
 *                         user_vote:
 *                           type: string
 *                           enum: ['upvote', null]
 *                           description: Current user vote status (null if removed)
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     summary: Downvote a comment (Reddit-style toggle behavior)
 *     description: |
 *       Downvote a comment. Uses Reddit-style toggle behavior:
 *       
 *       **Toggle Behavior:**
 *       - If comment is not voted: Adds downvote
 *       - If comment is already downvoted: Removes vote (toggles off)
 *       - If comment is upvoted: Changes to downvote (toggles)
 *       
 *       **Real-time:** Emits `vote:downvote` or `vote:removed` event via WebSocket
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Comment ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Vote operation completed (downvoted, toggled, or removed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   enum: ["Comment downvoted", "Vote removed", "Vote changed to downvote"]
 *                   example: "Comment downvoted"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Comment'
 *                     - type: object
 *                       properties:
 *                         user_vote:
 *                           type: string
 *                           enum: ['downvote', null]
 *                           description: Current user vote status (null if removed)
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     summary: Remove vote from a comment (explicit removal)
 *     description: |
 *       Explicitly remove a vote from a comment. This is idempotent - calling it when no vote exists will return success.
 *       
 *       **Note:** You can also remove a vote by clicking the same vote button again (Reddit-style toggle).
 *       
 *       **Real-time:** Emits `vote:removed` event via WebSocket
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Comment ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Vote removed successfully (idempotent - returns success even if no vote existed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Vote removed"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Comment'
 *                     - type: object
 *                       properties:
 *                         user_vote:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                           description: Always null after removal
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/vote', authenticateToken, removeVote);

module.exports = router;
