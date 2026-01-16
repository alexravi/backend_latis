// Post controller - Post management and voting
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');

// Validation rules
const validatePost = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('post_type')
    .optional()
    .trim()
    .isIn(['post', 'article', 'discussion'])
    .withMessage('Post type must be one of: post, article, discussion'),
  body('visibility')
    .optional()
    .trim()
    .isIn(['public', 'connections', 'private'])
    .withMessage('Visibility must be one of: public, connections, private'),
];

// Create post
const createPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const postData = {
      ...req.body,
      user_id: req.user.id,
    };

    const post = await Post.create(postData);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: post,
    });
  } catch (error) {
    console.error('Create post error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get posts feed
const getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const sortBy = req.query.sort || 'new'; // best, top, new, hot
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const posts = await Post.findFeedSorted(userId, sortBy, limit, offset);

    // Batch fetch user's reactions for all posts
    const postIds = posts.map(p => p.id);
    const reactions = await Reaction.findReactionsByPostIds(userId, postIds);
    const reactionsByPostId = {};
    reactions.forEach(reaction => {
      reactionsByPostId[reaction.post_id] = reaction;
    });

    // Map posts with user votes
    const postsWithVotes = posts.map(post => {
      const reaction = reactionsByPostId[post.id];
      return {
        ...post,
        user_vote: reaction ? reaction.reaction_type : null,
      };
    });

    res.status(200).json({
      success: true,
      data: postsWithVotes,
      pagination: {
        limit,
        offset,
        hasMore: posts.length === limit,
      },
    });
  } catch (error) {
    console.error('Get feed error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get single post with comments
const getPostById = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    const sortBy = req.query.sort || 'best';
    const commentLimit = parseInt(req.query.commentLimit) || 50;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Get user's vote
    const userReaction = await Reaction.findReaction(userId, postId, null);

    // Get top-level comments
    const comments = await Comment.findByPostIdSorted(postId, sortBy, commentLimit, 0);

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
      data: {
        ...post,
        user_vote: userReaction ? userReaction.reaction_type : null,
        comments: commentsWithVotes,
      },
    });
  } catch (error) {
    console.error('Get post by ID error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update post
const updatePost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const postId = parseInt(req.params.id);
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own posts',
      });
    }

    const updatedPost = await Post.update(postId, req.body);

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: updatedPost,
    });
  } catch (error) {
    console.error('Update post error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own posts',
      });
    }

    await Post.remove(postId);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Upvote post
const upvotePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const reaction = await Reaction.create({
      user_id: userId,
      post_id: postId,
      reaction_type: 'upvote',
    });

    const updatedPost = await Post.findById(postId);

    res.status(200).json({
      success: true,
      message: 'Post upvoted',
      data: {
        ...updatedPost,
        user_vote: reaction ? reaction.reaction_type : null,
      },
    });
  } catch (error) {
    console.error('Upvote post error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Downvote post
const downvotePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const reaction = await Reaction.create({
      user_id: userId,
      post_id: postId,
      reaction_type: 'downvote',
    });

    const updatedPost = await Post.findById(postId);

    res.status(200).json({
      success: true,
      message: 'Post downvoted',
      data: {
        ...updatedPost,
        user_vote: reaction ? reaction.reaction_type : null,
      },
    });
  } catch (error) {
    console.error('Downvote post error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Remove vote from post
const removeVote = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    await Reaction.remove(userId, postId, null);

    const updatedPost = await Post.findById(postId);

    res.status(200).json({
      success: true,
      message: 'Vote removed',
      data: {
        ...updatedPost,
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
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  upvotePost,
  downvotePost,
  removeVote,
  validatePost,
};
