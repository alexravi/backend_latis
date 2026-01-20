// Post routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  upvotePost,
  downvotePost,
  removeVote,
  repostPost,
  unrepostPost,
  getReposts,
  checkReposted,
  validatePost,
} = require('../../controllers/postController');
const { getPostComments } = require('../../controllers/commentController');

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     description: |
 *       Create a new post. Posts can be:
 *       - Regular posts (default)
 *       - Articles (for long-form content)
 *       - Discussions (for community discussions)
 *       
 *       **Visibility options:**
 *       - `public`: Visible to everyone
 *       - `connections`: Visible only to your connections
 *       - `private`: Visible only to you (future feature)
 *       
 *       **Real-time:** Emits `post:created` event via WebSocket to all connected users
 *     tags: [Posts]
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
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *                 example: "This is my post content"
 *                 description: Post content (1-10000 characters)
 *               post_type:
 *                 type: string
 *                 enum: [post, article, discussion]
 *                 default: post
 *                 example: "post"
 *                 description: Type of post
 *               visibility:
 *                 type: string
 *                 enum: [public, connections, private]
 *                 default: public
 *                 example: "public"
 *                 description: Visibility setting for the post
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, validatePost, createPost);

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get posts feed (includes reposts with original post references)
 *     description: |
 *       Get personalized feed of posts and reposts. Includes:
 *       - Original posts from users you follow/connect with
 *       - Reposts from users you follow/connect with (with reference to original post)
 *       
 *       **Sorting options:**
 *       - `new`: Sort by creation time (newest first) - default
 *       - `best`/`top`: Sort by score (upvotes - downvotes)
 *       - `hot`: Hot algorithm - score weighted by time decay
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [best, top, new, hot]
 *           default: new
 *         description: Sort order for posts
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of posts to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Posts retrieved successfully (includes reposts with original_post field)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostsResponse'
 *             examples:
 *               withReposts:
 *                 summary: Feed with reposts
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 5
 *                       content: "Original post"
 *                       is_repost: false
 *                     - id: 10
 *                       content: ""
 *                       is_repost: true
 *                       original_post:
 *                         id: 5
 *                         content: "Original post"
 *                   pagination:
 *                     limit: 20
 *                     offset: 0
 *                     hasMore: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getFeed);

/**
 * @swagger
 * /api/posts/{postId}/comments:
 *   get:
 *     summary: Get comments for a post (supports nested tree structure)
 *     description: |
 *       Get all comments for a post. Supports two modes:
 *       - **Flat structure** (default): Returns top-level comments only with pagination
 *       - **Tree structure**: Returns complete nested comment tree with unlimited depth (use ?tree=true)
 *       
 *       **Sorting options:**
 *       - `best`: Reddit-style Wilson score algorithm (default)
 *       - `top`: Sort by score (upvotes - downvotes)
 *       - `new`: Sort by creation time (newest first)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Post ID
 *         example: 1
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [best, top, new]
 *           default: best
 *         description: Sort order for comments (applies to each level in tree)
 *       - in: query
 *         name: tree
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, returns complete nested comment tree with unlimited depth. If false, returns flat structure with pagination.
 *         example: true
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of comments to return (only used when tree=false)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Offset for pagination (only used when tree=false)
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentsResponse'
 *             examples:
 *               treeStructure:
 *                 summary: Tree structure response (tree=true)
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 1
 *                       content: "Great post!"
 *                       replies:
 *                         - id: 2
 *                           content: "I agree"
 *                           replies: []
 *               flatStructure:
 *                 summary: Flat structure response (tree=false)
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 1
 *                       content: "Great post!"
 *                   pagination:
 *                     limit: 50
 *                     offset: 0
 *                     hasMore: false
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:postId/comments', authenticateToken, getPostComments);

/**
 * @swagger
 * /api/posts/{id}/reposts:
 *   get:
 *     summary: Get list of reposts for a post
 *     description: |
 *       Get all reposts of a specific post. Returns a paginated list of users who have reposted the post.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Original post ID
 *         example: 5
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of reposts to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Reposts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                   description: Array of repost posts
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 50
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id/reposts', authenticateToken, getReposts);

/**
 * @swagger
 * /api/posts/{id}/reposted:
 *   get:
 *     summary: Check if current user has reposted a post
 *     description: |
 *       Check if the authenticated user has reposted the specified post. Returns a boolean flag.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Original post ID
 *         example: 5
 *     responses:
 *       200:
 *         description: Check completed successfully
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
 *                     has_reposted:
 *                       type: boolean
 *                       example: true
 *                       description: True if user has reposted this post
 *                     repost_id:
 *                       type: integer
 *                       nullable: true
 *                       example: 10
 *                       description: ID of the repost if user has reposted, null otherwise
 *             example:
 *               success: true
 *               data:
 *                 has_reposted: true
 *                 repost_id: 10
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id/reposted', authenticateToken, checkReposted);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a post by ID with comments
 *     description: |
 *       Get detailed view of a single post including:
 *       - Full post data with user information
 *       - User's vote status (upvote/downvote/null)
 *       - Top-level comments (sorted by best/top/new)
 *       - Each comment includes user vote status
 *       
 *       If the post is a repost, the response includes the original post data in the `original_post` field.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Post ID
 *         example: 1
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [best, top, new]
 *           default: best
 *         description: Sort order for comments
 *       - in: query
 *         name: commentLimit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of top-level comments to return
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Post'
 *                     - type: object
 *                       properties:
 *                         comments:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Comment'
 *                           description: Top-level comments (not nested in this endpoint)
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getPostById);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update a post
 *     description: |
 *       Update an existing post. Only the post owner can update their posts.
 *       
 *       **Editable fields:**
 *       - `content`: Update post content
 *       - `post_type`: Change post type (post/article/discussion)
 *       - `visibility`: Change visibility (public/connections/private)
 *       - `is_pinned`: Pin/unpin the post
 *       
 *       **Note:** Updates are marked with `is_edited: true` and `edited_at` timestamp
 *       
 *       **Real-time:** Emits `post:updated` event via WebSocket to post room
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Post ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *                 example: "Updated post content"
 *                 description: New post content
 *               post_type:
 *                 type: string
 *                 enum: [post, article, discussion]
 *                 example: "post"
 *                 description: Post type
 *               visibility:
 *                 type: string
 *                 enum: [public, connections, private]
 *                 example: "public"
 *                 description: Visibility setting
 *               is_pinned:
 *                 type: boolean
 *                 example: false
 *                 description: Pin the post to top of user's profile
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not authorized to edit this post (only owner can edit)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authenticateToken, validatePost, updatePost);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     description: |
 *       Delete a post. Only the post owner can delete their posts.
 *       
 *       **Cascading behavior:**
 *       - If the post is a repost, deleting it removes the repost (original post remains)
 *       - All comments on the post are deleted (CASCADE)
 *       - All reactions/votes on the post are deleted (CASCADE)
 *       
 *       **Real-time:** Emits `post:deleted` event via WebSocket to post room and feed
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Post ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Post deleted successfully
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
 *                   example: "Post deleted successfully"
 *       403:
 *         description: Not authorized to delete this post (only owner can delete)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deletePost);

/**
 * @swagger
 * /api/posts/{id}/repost:
 *   post:
 *     summary: Repost a post (Twitter/X style)
 *     description: |
 *       Creates a repost of an existing post. A repost is a new post with `parent_post_id` pointing to the original post.
 *       
 *       **Behavior:**
 *       - Creates a new post entry with `parent_post_id` set to the original post ID
 *       - Increments `shares_count` on the original post
 *       - Creates a Share entry for analytics tracking
 *       - Prevents users from reposting their own posts
 *       - Prevents duplicate reposts (one repost per user per post)
 *       
 *       **Real-time:** Emits `post:repost` event via WebSocket to post room
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Original post ID to repost
 *         example: 5
 *     responses:
 *       201:
 *         description: Post reposted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RepostResponse'
 *             example:
 *               success: true
 *               message: "Post reposted successfully"
 *               data:
 *                 id: 10
 *                 user_id: 2
 *                 content: ""
 *                 parent_post_id: 5
 *                 is_repost: true
 *                 original_post:
 *                   id: 5
 *                   content: "Original post content"
 *                   user_id: 1
 *                   first_name: "John"
 *                   last_name: "Doe"
 *       400:
 *         description: Bad request (already reposted or attempting to repost own post)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alreadyReposted:
 *                 summary: Already reposted
 *                 value:
 *                   success: false
 *                   message: "You have already reposted this post"
 *               ownPost:
 *                 summary: Cannot repost own post
 *                 value:
 *                   success: false
 *                   message: "You cannot repost your own post"
 *       404:
 *         description: Original post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:id/repost', authenticateToken, repostPost);

/**
 * @swagger
 * /api/posts/{id}/repost:
 *   delete:
 *     summary: Remove a repost (unrepost)
 *     description: |
 *       Removes a repost. This:
 *       - Deletes the repost post entry
 *       - Decrements `shares_count` on the original post
 *       - Removes the Share entry
 *       
 *       **Real-time:** Emits `post:unrepost` event via WebSocket to post room
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Original post ID to unrepost
 *         example: 5
 *     responses:
 *       200:
 *         description: Repost removed successfully
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
 *                   example: "Repost removed successfully"
 *       404:
 *         description: Post or repost not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notReposted:
 *                 summary: User hasn't reposted this post
 *                 value:
 *                   success: false
 *                   message: "You have not reposted this post"
 *               postNotFound:
 *                 summary: Original post not found
 *                 value:
 *                   success: false
 *                   message: "Original post not found"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/repost', authenticateToken, unrepostPost);

/**
 * @swagger
 * /api/posts/{id}/upvote:
 *   post:
 *     summary: Upvote a post (Reddit-style toggle behavior)
 *     description: |
 *       Upvote a post. Uses Reddit-style toggle behavior:
 *       
 *       **Toggle Behavior:**
 *       - If post is not voted: Adds upvote
 *       - If post is already upvoted: Removes vote (toggles off)
 *       - If post is downvoted: Changes to upvote (toggles)
 *       
 *       **Real-time:** Emits `vote:upvote` or `vote:removed` event via WebSocket
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Post ID
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
 *                   enum: ["Post upvoted", "Vote removed", "Vote changed to upvote"]
 *                   example: "Post upvoted"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Post'
 *                     - type: object
 *                       properties:
 *                         user_vote:
 *                           type: string
 *                           enum: ['upvote', null]
 *                           description: Current user vote status (null if removed)
 *             examples:
 *               upvoted:
 *                 summary: Successfully upvoted
 *                 value:
 *                   success: true
 *                   message: "Post upvoted"
 *                   data:
 *                     id: 1
 *                     upvotes_count: 11
 *                     user_vote: "upvote"
 *               toggledOff:
 *                 summary: Vote removed (was already upvoted)
 *                 value:
 *                   success: true
 *                   message: "Vote removed"
 *                   data:
 *                     id: 1
 *                     upvotes_count: 10
 *                     user_vote: null
 *               changedFromDownvote:
 *                 summary: Changed from downvote to upvote
 *                 value:
 *                   success: true
 *                   message: "Post upvoted"
 *                   data:
 *                     id: 1
 *                     upvotes_count: 11
 *                     downvotes_count: 4
 *                     user_vote: "upvote"
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:id/upvote', authenticateToken, upvotePost);

/**
 * @swagger
 * /api/posts/{id}/downvote:
 *   post:
 *     summary: Downvote a post (Reddit-style toggle behavior)
 *     description: |
 *       Downvote a post. Uses Reddit-style toggle behavior:
 *       
 *       **Toggle Behavior:**
 *       - If post is not voted: Adds downvote
 *       - If post is already downvoted: Removes vote (toggles off)
 *       - If post is upvoted: Changes to downvote (toggles)
 *       
 *       **Real-time:** Emits `vote:downvote` or `vote:removed` event via WebSocket
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Post ID
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
 *                   enum: ["Post downvoted", "Vote removed", "Vote changed to downvote"]
 *                   example: "Post downvoted"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Post'
 *                     - type: object
 *                       properties:
 *                         user_vote:
 *                           type: string
 *                           enum: ['downvote', null]
 *                           description: Current user vote status (null if removed)
 *             examples:
 *               downvoted:
 *                 summary: Successfully downvoted
 *                 value:
 *                   success: true
 *                   message: "Post downvoted"
 *                   data:
 *                     id: 1
 *                     downvotes_count: 6
 *                     user_vote: "downvote"
 *               toggledOff:
 *                 summary: Vote removed (was already downvoted)
 *                 value:
 *                   success: true
 *                   message: "Vote removed"
 *                   data:
 *                     id: 1
 *                     downvotes_count: 5
 *                     user_vote: null
 *               changedFromUpvote:
 *                 summary: Changed from upvote to downvote
 *                 value:
 *                   success: true
 *                   message: "Post downvoted"
 *                   data:
 *                     id: 1
 *                     upvotes_count: 9
 *                     downvotes_count: 6
 *                     user_vote: "downvote"
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:id/downvote', authenticateToken, downvotePost);

/**
 * @swagger
 * /api/posts/{id}/vote:
 *   delete:
 *     summary: Remove vote from a post (explicit removal)
 *     description: |
 *       Explicitly remove a vote from a post. This is idempotent - calling it when no vote exists will return success.
 *       
 *       **Note:** You can also remove a vote by clicking the same vote button again (Reddit-style toggle).
 *       
 *       **Real-time:** Emits `vote:removed` event via WebSocket
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Post ID
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
 *                     - $ref: '#/components/schemas/Post'
 *                     - type: object
 *                       properties:
 *                         user_vote:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                           description: Always null after removal
 *             example:
 *               success: true
 *               message: "Vote removed"
 *               data:
 *                 id: 1
 *                 upvotes_count: 10
 *                 downvotes_count: 5
 *                 user_vote: null
 *       404:
 *         description: Post not found
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
