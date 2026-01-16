// Comment controller - Comment management and voting
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');

// Validation rules
const validateComment = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters'),
  body('post_id')
    .notEmpty()
    .withMessage('Post ID is required')
    .isInt({ min: 1 })
    .withMessage('Post ID must be a valid integer'),
  body('parent_comment_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent comment ID must be a valid integer'),
];

// Create comment
const createComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const postId = parseInt(req.body.post_id);
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // If parent_comment_id is provided, validate it
    if (req.body.parent_comment_id) {
      const parentComment = await Comment.findById(parseInt(req.body.parent_comment_id));
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found',
        });
      }
      if (parentComment.post_id !== postId) {
        return res.status(400).json({
          success: false,
          message: 'Parent comment does not belong to this post',
        });
      }
    }

    const commentData = {
      post_id: postId,
      user_id: req.user.id,
      content: req.body.content,
      parent_comment_id: req.body.parent_comment_id ? parseInt(req.body.parent_comment_id) : null,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const comment = await Comment.create(commentData, { client });

      // Increment comment count on post
      if (!commentData.parent_comment_id) {
        await Post.incrementComments(postId, 1, client);
      } else {
        // Increment replies count on parent comment
        await Comment.incrementReplies(commentData.parent_comment_id, 1, client);
      }

      await client.query('COMMIT');

      // Get user info for response
      const commentWithUser = await Comment.findById(comment.id);

      res.status(201).json({
        success: true,
        message: 'Comment created successfully',
        data: {
          ...commentWithUser,
          user_vote: null,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create comment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get comments for a post
const getPostComments = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;
    const sortBy = req.query.sort || 'best'; // best, top, new
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const comments = await Comment.findByPostIdSorted(postId, sortBy, limit, offset);

    // Batch fetch user's reactions for all comments
    const commentIds = comments.map(c => c.id);
    const reactions = await Reaction.findReactionsByCommentIds(userId, commentIds);
    const reactionsByCommentId = {};
    reactions.forEach(reaction => {
      reactionsByCommentId[reaction.comment_id] = reaction;
    });

    // Map comments with user votes
    const commentsWithVotes = comments.map(comment => {
      const reaction = reactionsByCommentId[comment.id];
      return {
        ...comment,
        user_vote: reaction ? reaction.reaction_type : null,
      };
    });

    res.status(200).json({
      success: true,
      data: commentsWithVotes,
      pagination: {
        limit,
        offset,
        hasMore: comments.length === limit,
      },
    });
  } catch (error) {
    console.error('Get post comments error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get single comment with replies
const getCommentById = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const userId = req.user.id;
    const sortBy = req.query.sort || 'best';
    const replyLimit = parseInt(req.query.replyLimit) || 20;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Get user's vote
    const userReaction = await Reaction.findReaction(userId, null, commentId);

    // Get replies
    const replies = await Comment.findRepliesSorted(commentId, sortBy, replyLimit, 0);

    // Batch fetch user's reactions for all replies
    const replyIds = replies.map(r => r.id);
    const reactions = await Reaction.findReactionsByCommentIds(userId, replyIds);
    const reactionsByReplyId = {};
    reactions.forEach(reaction => {
      reactionsByReplyId[reaction.comment_id] = reaction;
    });

    // Map replies with user votes
    const repliesWithVotes = replies.map(reply => {
      const reaction = reactionsByReplyId[reply.id];
      return {
        ...reply,
        user_vote: reaction ? reaction.reaction_type : null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ...comment,
        user_vote: userReaction ? userReaction.reaction_type : null,
        replies: repliesWithVotes,
      },
    });
  } catch (error) {
    console.error('Get comment by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update comment
const updateComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const commentId = parseInt(req.params.id);
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own comments',
      });
    }

    const updatedComment = await Comment.update(commentId, {
      content: req.body.content,
    });

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: updatedComment,
    });
  } catch (error) {
    console.error('Update comment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete comment
const deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments',
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Decrement comment/reply count
      if (!comment.parent_comment_id) {
        await Post.incrementComments(comment.post_id, -1, client);
      } else {
        await Comment.incrementReplies(comment.parent_comment_id, -1, client);
      }

      await Comment.remove(commentId, client);

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete comment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Upvote comment
const upvoteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const reaction = await Reaction.create({
      user_id: userId,
      comment_id: commentId,
      reaction_type: 'upvote',
    });

    const updatedComment = await Comment.findById(commentId);

    res.status(200).json({
      success: true,
      message: 'Comment upvoted',
      data: {
        ...updatedComment,
        user_vote: reaction ? reaction.reaction_type : null,
      },
    });
  } catch (error) {
    console.error('Upvote comment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Downvote comment
const downvoteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const reaction = await Reaction.create({
      user_id: userId,
      comment_id: commentId,
      reaction_type: 'downvote',
    });

    const updatedComment = await Comment.findById(commentId);

    res.status(200).json({
      success: true,
      message: 'Comment downvoted',
      data: {
        ...updatedComment,
        user_vote: reaction ? reaction.reaction_type : null,
      },
    });
  } catch (error) {
    console.error('Downvote comment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Remove vote from comment
const removeVote = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    await Reaction.remove(userId, null, commentId);

    const updatedComment = await Comment.findById(commentId);

    res.status(200).json({
      success: true,
      message: 'Vote removed',
      data: {
        ...updatedComment,
        user_vote: null,
      },
    });
  } catch (error) {
    console.error('Remove vote error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createComment,
  getPostComments,
  getCommentById,
  updateComment,
  deleteComment,
  upvoteComment,
  downvoteComment,
  removeVote,
  validateComment,
};
