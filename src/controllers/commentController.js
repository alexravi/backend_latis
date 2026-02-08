// Comment controller - Comment management and voting
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');
const {
  emitCommentCreated,
  emitCommentUpdated,
  emitCommentDeleted,
  emitVoteUpvote,
  emitVoteDownvote,
  emitVoteRemoved,
} = require('../services/eventService');

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

      // Create activity
      try {
        const ActivityFeed = require('../models/ActivityFeed');
        const activityType = commentData.parent_comment_id ? 'comment_replied' : 'comment_created';
        await ActivityFeed.create({
          user_id: req.user.id,
          activity_type: activityType,
          activity_data: {
            post_id: postId,
            comment_id: comment.id,
            parent_comment_id: commentData.parent_comment_id || null,
          },
          related_post_id: postId,
          related_comment_id: comment.id,
        });
      } catch (activityError) {
        // Log but don't fail the request if activity creation fails
        console.error('Error creating activity for comment:', activityError.message);
      }

      // Emit event for real-time updates
      const commentForEvent = await Comment.findById(comment.id);
      emitCommentCreated(commentForEvent);

      // Get user info for response
      const commentWithUser = commentForEvent;

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

// Helper function to collect all comment IDs from tree recursively
const collectCommentIds = (comments) => {
  const ids = [];
  const traverse = (comments) => {
    comments.forEach(comment => {
      ids.push(comment.id);
      if (comment.replies && comment.replies.length > 0) {
        traverse(comment.replies);
      }
    });
  };
  traverse(comments);
  return ids;
};

// Helper function to add user votes to comment tree recursively
const addVotesToTree = (comments, reactionsByCommentId) => {
  return comments.map(comment => {
    const reaction = reactionsByCommentId[comment.id];
    const commentWithVote = {
      ...comment,
      user_vote: reaction ? reaction.reaction_type : null,
    };

    // Recursively add votes to replies
    if (comment.replies && comment.replies.length > 0) {
      commentWithVote.replies = addVotesToTree(comment.replies, reactionsByCommentId);
    }

    return commentWithVote;
  });
};

// Get comments for a post (with nested tree structure)
const getPostComments = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;
    const sortBy = req.query.sort || 'best'; // best, top, new
    const useTree = req.query.tree === 'true' || req.query.tree === '1'; // Default to tree structure

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    let comments;
    if (useTree) {
      // Use tree structure (unlimited depth)
      comments = await Comment.findByPostIdTree(postId, sortBy);
    } else {
      // Use flat structure (backward compatibility)
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      comments = await Comment.findByPostIdSorted(postId, sortBy, limit, offset);

      // Add votes for flat structure
      const commentIds = comments.map(c => c.id);
      const reactions = await Reaction.findReactionsByCommentIds(userId, commentIds);
      const reactionsByCommentId = {};
      reactions.forEach(reaction => {
        reactionsByCommentId[reaction.comment_id] = reaction;
      });

      comments = comments.map(comment => {
        const reaction = reactionsByCommentId[comment.id];
        return {
          ...comment,
          user_vote: reaction ? reaction.reaction_type : null,
        };
      });

      return res.status(200).json({
        success: true,
        data: comments,
        pagination: {
          limit,
          offset,
          hasMore: comments.length === limit,
        },
      });
    }

    // Collect all comment IDs from tree (all nesting levels)
    const allCommentIds = collectCommentIds(comments);

    // Batch fetch user's reactions for all comments
    const reactions = await Reaction.findReactionsByCommentIds(userId, allCommentIds);
    const reactionsByCommentId = {};
    reactions.forEach(reaction => {
      reactionsByCommentId[reaction.comment_id] = reaction;
    });

    // Add votes to tree recursively
    const commentsWithVotes = addVotesToTree(comments, reactionsByCommentId);

    res.status(200).json({
      success: true,
      data: commentsWithVotes,
    });
  } catch (error) {
    console.error('Get post comments error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get single comment with replies (full tree structure)
const getCommentById = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const userId = req.user.id;
    const sortBy = req.query.sort || 'best';
    const useTree = req.query.tree === 'true' || req.query.tree === '1'; // Default to tree structure

    let comment;
    if (useTree) {
      // Get full comment tree starting from this comment
      comment = await Comment.findCommentTree(commentId, sortBy);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }
    } else {
      // Backward compatibility: flat structure
      comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      const replyLimit = parseInt(req.query.replyLimit) || 20;
      const replies = await Comment.findRepliesSorted(commentId, sortBy, replyLimit, 0);

      // Batch fetch user's reactions for all replies
      const replyIds = replies.map(r => r.id);
      const reactions = await Reaction.findReactionsByCommentIds(userId, replyIds);
      const reactionsByReplyId = {};
      reactions.forEach(reaction => {
        reactionsByReplyId[reaction.comment_id] = reaction;
      });

      // Map replies with user votes
      comment.replies = replies.map(reply => {
        const reaction = reactionsByReplyId[reply.id];
        return {
          ...reply,
          user_vote: reaction ? reaction.reaction_type : null,
        };
      });

      // Get user's vote for the comment itself
      const userReaction = await Reaction.findReaction(userId, null, commentId);
      comment.user_vote = userReaction ? userReaction.reaction_type : null;

      return res.status(200).json({
        success: true,
        data: comment,
      });
    }

    // For tree structure: collect all comment IDs and add votes
    const allCommentIds = collectCommentIds([comment]);

    // Batch fetch user's reactions for all comments in tree
    const reactions = await Reaction.findReactionsByCommentIds(userId, allCommentIds);
    const reactionsByCommentId = {};
    reactions.forEach(reaction => {
      reactionsByCommentId[reaction.comment_id] = reaction;
    });

    // Add votes recursively
    const commentWithVote = {
      ...comment,
      user_vote: reactionsByCommentId[comment.id] ? reactionsByCommentId[comment.id].reaction_type : null,
    };

    if (comment.replies && comment.replies.length > 0) {
      commentWithVote.replies = addVotesToTree(comment.replies, reactionsByCommentId);
    }

    res.status(200).json({
      success: true,
      data: commentWithVote,
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

    // Emit event for real-time updates
    if (updatedComment) {
      emitCommentUpdated(updatedComment);
    }

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

      // Emit event for real-time updates
      emitCommentDeleted(comment);

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

    // Validate commentId is a valid integer
    if (isNaN(commentId) || commentId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid comment ID',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check existing reaction to determine behavior
    const existingReaction = await Reaction.findReaction(userId, null, commentId);

    const reaction = await Reaction.create({
      user_id: userId,
      comment_id: commentId,
      reaction_type: 'upvote',
    });

    const updatedComment = await Comment.findById(commentId);

    // Determine what happened based on reaction result
    if (!reaction) {
      // Vote was toggled off (was already upvoted)
      emitVoteRemoved('comment', commentId, userId);
      res.status(200).json({
        success: true,
        message: 'Vote removed',
        data: {
          ...updatedComment,
          user_vote: null,
        },
      });
    } else if (existingReaction && existingReaction.reaction_type === 'downvote') {
      // Vote was toggled from downvote to upvote
      emitVoteUpvote('comment', commentId, userId);
      res.status(200).json({
        success: true,
        message: 'Comment upvoted',
        data: {
          ...updatedComment,
          user_vote: 'upvote',
        },
      });
    } else {
      // New upvote added
      emitVoteUpvote('comment', commentId, userId);
      res.status(200).json({
        success: true,
        message: 'Comment upvoted',
        data: {
          ...updatedComment,
          user_vote: 'upvote',
        },
      });

      // Create activity for upvote
      try {
        const ActivityFeed = require('../models/ActivityFeed');
        await ActivityFeed.create({
          user_id: userId,
          activity_type: 'reaction_added',
          activity_data: {
            comment_id: commentId,
            reaction_type: 'upvote'
          },
          related_comment_id: commentId,
        });
      } catch (activityError) {
        console.error('Error creating activity for comment upvote:', activityError.message);
      }
    }
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

    // Validate commentId is a valid integer
    if (isNaN(commentId) || commentId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid comment ID',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check existing reaction to determine behavior
    const existingReaction = await Reaction.findReaction(userId, null, commentId);

    const reaction = await Reaction.create({
      user_id: userId,
      comment_id: commentId,
      reaction_type: 'downvote',
    });

    const updatedComment = await Comment.findById(commentId);

    // Determine what happened based on reaction result
    if (!reaction) {
      // Vote was toggled off (was already downvoted)
      emitVoteRemoved('comment', commentId, userId);
      res.status(200).json({
        success: true,
        message: 'Vote removed',
        data: {
          ...updatedComment,
          user_vote: null,
        },
      });
    } else if (existingReaction && existingReaction.reaction_type === 'upvote') {
      // Vote was toggled from upvote to downvote
      emitVoteDownvote('comment', commentId, userId);
      res.status(200).json({
        success: true,
        message: 'Comment downvoted',
        data: {
          ...updatedComment,
          user_vote: 'downvote',
        },
      });
    } else {
      // New downvote added
      emitVoteDownvote('comment', commentId, userId);
      res.status(200).json({
        success: true,
        message: 'Comment downvoted',
        data: {
          ...updatedComment,
          user_vote: 'downvote',
        },
      });

      // Create activity for downvote
      try {
        const ActivityFeed = require('../models/ActivityFeed');
        await ActivityFeed.create({
          user_id: userId,
          activity_type: 'reaction_added',
          activity_data: {
            comment_id: commentId,
            reaction_type: 'downvote'
          },
          related_comment_id: commentId,
        });
      } catch (activityError) {
        console.error('Error creating activity for comment downvote:', activityError.message);
      }
    }
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

    // Validate commentId is a valid integer
    if (isNaN(commentId) || commentId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid comment ID',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Remove vote (idempotent - returns null if no vote exists)
    const removedReaction = await Reaction.remove(userId, null, commentId);

    // Only emit event if vote was actually removed
    if (removedReaction) {
      emitVoteRemoved('comment', commentId, userId);
    }

    const updatedComment = await Comment.findById(commentId);

    // Always return success (idempotent operation)
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
