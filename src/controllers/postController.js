// Post controller - Post management and voting
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const Post = require('../models/Post');
const PostMedia = require('../models/PostMedia');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');
const Share = require('../models/Share');
const {
  getPostFeed,
  setPostFeed,
  invalidatePostFeed,
} = require('../services/cacheService');
const {
  emitPostCreated,
  emitPostUpdated,
  emitPostDeleted,
  emitPostReposted,
  emitPostUnreposted,
  emitVoteUpvote,
  emitVoteDownvote,
  emitVoteRemoved,
} = require('../services/eventService');

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

    const { media_ids, ...postBody } = req.body;
    const postData = {
      ...postBody,
      user_id: req.user.id,
    };

    // Create post
    const post = await Post.create(postData);

    // Associate media with post if media_ids provided
    if (media_ids && Array.isArray(media_ids) && media_ids.length > 0) {
      // Update PostMedia records to link them to this post
      for (const mediaId of media_ids) {
        const media = await PostMedia.findById(mediaId);
        // Verify ownership: media must be unlinked (post_id is null) to prevent linking media from other posts
        // Note: Since post_media doesn't have user_id, we verify by ensuring media is unlinked
        // and can only be linked to posts created by the same authenticated user
        if (media && !media.post_id) {
          // Additional check: if media was previously linked, verify it belongs to a post by this user
          // For unlinked media, allow linking (assumes media was uploaded by authenticated user)
          // Update the post_id in the database
          await pool.query(
            'UPDATE post_media SET post_id = $1 WHERE id = $2',
            [post.id, mediaId]
          );
        } else if (media && media.post_id) {
          // Media already linked to another post - check if that post belongs to this user
          const existingPost = await Post.findById(media.post_id);
          if (existingPost && existingPost.user_id !== req.user.id) {
            // Log unauthorized attempt
            console.warn(`User ${req.user.id} attempted to link media ${mediaId} from post ${media.post_id} owned by ${existingPost.user_id}`);
            continue; // Skip this media
          }
        }
      }
    }

    // Fetch post with media
    const postWithMedia = await Post.findById(post.id);
    const media = await PostMedia.findByPostId(post.id);
    const mediaDescriptors = media.map(m => PostMedia.toDescriptor(m));

    // Create activity
    try {
      const ActivityFeed = require('../models/ActivityFeed');
      await ActivityFeed.create({
        user_id: req.user.id,
        activity_type: 'post_created',
        activity_data: { post_id: post.id, title: post.title || null },
        related_post_id: post.id,
      });
    } catch (activityError) {
      // Log but don't fail the request if activity creation fails
      console.error('Error creating activity for post:', activityError.message);
    }

    // Emit event for real-time updates
    emitPostCreated(post);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: {
        ...postWithMedia,
        media: mediaDescriptors,
      },
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

    // Try to get from cache first (only for first page and common sorts)
    let posts;
    let fromCache = false;
    let isStale = false;
    
    if (offset === 0 && (sortBy === 'new' || sortBy === 'hot')) {
      const cachedResult = await getPostFeed(userId, sortBy, limit, offset);
      if (cachedResult) {
        posts = cachedResult.data;
        fromCache = true;
        isStale = cachedResult.isStale;
        
        // If stale, trigger background refresh (stale-while-revalidate pattern)
        if (isStale) {
          // Refresh in background without blocking response
          Post.findFeedSorted(userId, sortBy, limit, offset)
            .then(freshPosts => {
              // Update cache with fresh data
              setPostFeed(userId, sortBy, limit, offset, freshPosts).catch(err => {
                console.error('Failed to refresh stale cache:', err.message);
              });
            })
            .catch(err => {
              console.error('Failed to refresh stale feed:', err.message);
            });
        }
      } else {
        // No cache, fetch from database
        posts = await Post.findFeedSorted(userId, sortBy, limit, offset);
        // Cache the feed (async, don't wait)
        setPostFeed(userId, sortBy, limit, offset, posts).catch(err => {
          // Log but don't fail request if cache fails
          console.error('Failed to cache feed:', err.message);
        });
      }
    } else {
      // For paginated or less common sorts, don't cache
      posts = await Post.findFeedSorted(userId, sortBy, limit, offset);
    }

    // Batch fetch user's reactions for all posts
    const postIds = posts.map(p => p.id);
    const reactions = await Reaction.findReactionsByPostIds(userId, postIds);
    const reactionsByPostId = {};
    reactions.forEach(reaction => {
      reactionsByPostId[reaction.post_id] = reaction;
    });

    // Batch fetch media for all posts (reuse postIds from above)
    const allMedia = postIds.length > 0 
      ? await pool.query(
          'SELECT * FROM post_media WHERE post_id = ANY($1) ORDER BY post_id, display_order ASC',
          [postIds]
        )
      : { rows: [] };
    
    const mediaByPostId = {};
    allMedia.rows.forEach(media => {
      if (!mediaByPostId[media.post_id]) {
        mediaByPostId[media.post_id] = [];
      }
      // Parse variants if present
      if (media.variants) {
        media.variants = typeof media.variants === 'string' 
          ? JSON.parse(media.variants) 
          : media.variants;
      }
      mediaByPostId[media.post_id].push(media);
    });

    // Map posts with user votes, media, and format reposts
    const postsWithVotes = posts.map(post => {
      const reaction = reactionsByPostId[post.id];
      const postMedia = mediaByPostId[post.id] || [];
      const mediaDescriptors = postMedia.map(m => PostMedia.toDescriptor(m));
      
      const postData = {
        ...post,
        user_vote: reaction ? reaction.reaction_type : null,
        media: mediaDescriptors,
      };

      // If this is a repost, include original post data
      if (post.parent_post_id || post.original_post_id) {
        postData.is_repost = true;
        postData.original_post = post.original_post_id ? {
          id: post.original_post_id,
          content: post.original_content,
          user_id: post.original_user_id,
          first_name: post.original_first_name,
          last_name: post.original_last_name,
          profile_image_url: post.original_profile_image_url,
          headline: post.original_headline,
          created_at: post.original_created_at,
        } : null;
      }

      return postData;
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

    // Get media for post
    const media = await PostMedia.findByPostId(postId);
    const mediaDescriptors = media.map(m => PostMedia.toDescriptor(m));

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
        media: mediaDescriptors,
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

    // Emit event for real-time updates
    if (updatedPost) {
      emitPostUpdated(updatedPost);
    }

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

    // Emit event for real-time updates
    emitPostDeleted(postId, req.user.id);

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

    // Validate postId is a valid integer
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check existing reaction to determine behavior
    const existingReaction = await Reaction.findReaction(userId, postId, null);
    
    const reaction = await Reaction.create({
      user_id: userId,
      post_id: postId,
      reaction_type: 'upvote',
    });

    const updatedPost = await Post.findById(postId);

    // Determine what happened based on reaction result
    if (!reaction) {
      // Vote was toggled off (was already upvoted)
      emitVoteRemoved('post', postId, userId);
      res.status(200).json({
        success: true,
        message: 'Vote removed',
        data: {
          ...updatedPost,
          user_vote: null,
        },
      });
    } else if (existingReaction && existingReaction.reaction_type === 'downvote') {
      // Vote was toggled from downvote to upvote
      emitVoteUpvote('post', postId, userId);
      res.status(200).json({
        success: true,
        message: 'Post upvoted',
        data: {
          ...updatedPost,
          user_vote: 'upvote',
        },
      });
    } else {
      // New upvote added
      emitVoteUpvote('post', postId, userId);
      res.status(200).json({
        success: true,
        message: 'Post upvoted',
        data: {
          ...updatedPost,
          user_vote: 'upvote',
        },
      });
    }
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

    // Validate postId is a valid integer
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check existing reaction to determine behavior
    const existingReaction = await Reaction.findReaction(userId, postId, null);
    
    const reaction = await Reaction.create({
      user_id: userId,
      post_id: postId,
      reaction_type: 'downvote',
    });

    const updatedPost = await Post.findById(postId);

    // Determine what happened based on reaction result
    if (!reaction) {
      // Vote was toggled off (was already downvoted)
      emitVoteRemoved('post', postId, userId);
      res.status(200).json({
        success: true,
        message: 'Vote removed',
        data: {
          ...updatedPost,
          user_vote: null,
        },
      });
    } else if (existingReaction && existingReaction.reaction_type === 'upvote') {
      // Vote was toggled from upvote to downvote
      emitVoteDownvote('post', postId, userId);
      res.status(200).json({
        success: true,
        message: 'Post downvoted',
        data: {
          ...updatedPost,
          user_vote: 'downvote',
        },
      });
    } else {
      // New downvote added
      emitVoteDownvote('post', postId, userId);
      res.status(200).json({
        success: true,
        message: 'Post downvoted',
        data: {
          ...updatedPost,
          user_vote: 'downvote',
        },
      });
    }
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

    // Validate postId is a valid integer
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Remove vote (idempotent - returns null if no vote exists)
    const removedReaction = await Reaction.remove(userId, postId, null);

    // Only emit event if vote was actually removed
    if (removedReaction) {
      emitVoteRemoved('post', postId, userId);
    }

    const updatedPost = await Post.findById(postId);

    // Always return success (idempotent operation)
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

// Repost a post
const repostPost = async (req, res) => {
  const client = await pool.connect();
  try {
    const originalPostId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if original post exists
    const originalPost = await Post.findById(originalPostId);
    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'Original post not found',
      });
    }

    // Check if user has already reposted this post
    const existingRepost = await Post.hasReposted(userId, originalPostId);
    if (existingRepost) {
      return res.status(400).json({
        success: false,
        message: 'You have already reposted this post',
      });
    }

    // Prevent reposting your own post
    if (originalPost.user_id === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot repost your own post',
      });
    }

    await client.query('BEGIN');

    // Create repost (new post with parent_post_id)
    const repostData = {
      user_id: userId,
      content: '', // Empty content for reposts (reference-only display)
      post_type: 'post',
      visibility: originalPost.visibility, // Inherit visibility from original
      parent_post_id: originalPostId,
    };

    // Create repost within transaction
    const repost = await Post.create(repostData, client);

    // Increment shares count on original post (using transaction client)
    await Post.incrementShares(originalPostId, 1, client);

    // Create Share entry for analytics tracking (using transaction client)
    await Share.create({
      user_id: userId,
      post_id: originalPostId,
      shared_content: null,
    }, client);

    await client.query('COMMIT');

    // Emit event for real-time updates
    emitPostReposted(repost, originalPostId);

    // Fetch repost with user info and original post reference
    const repostWithUser = await Post.findById(repost.id);
    const originalPostData = await Post.findById(originalPostId);

    res.status(201).json({
      success: true,
      message: 'Post reposted successfully',
      data: {
        ...repostWithUser,
        original_post: {
          id: originalPostData.id,
          content: originalPostData.content,
          user_id: originalPostData.user_id,
          first_name: originalPostData.first_name,
          last_name: originalPostData.last_name,
          profile_image_url: originalPostData.profile_image_url,
          headline: originalPostData.headline,
          created_at: originalPostData.created_at,
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Repost post error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
  }
};

// Remove repost (unrepost)
const unrepostPost = async (req, res) => {
  const client = await pool.connect();
  try {
    const originalPostId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if original post exists
    const originalPost = await Post.findById(originalPostId);
    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'Original post not found',
      });
    }

    // Find the repost
    const repost = await Post.hasReposted(userId, originalPostId);
    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'You have not reposted this post',
      });
    }

    await client.query('BEGIN');

    // Delete the repost (using transaction client)
    await Post.remove(repost.id, client);

    // Decrement shares count on original post (using transaction client)
    await Post.incrementShares(originalPostId, -1, client);

    // Remove Share entry (using transaction client)
    await Share.remove(userId, originalPostId, client);

    await client.query('COMMIT');

    // Emit event for real-time updates
    emitPostUnreposted(originalPostId, userId);

    res.status(200).json({
      success: true,
      message: 'Repost removed successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Unrepost error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
  }
};

// Get reposts for a post
const getReposts = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Validate postId is a valid integer
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const reposts = await Post.findByRepostId(postId, limit, offset);

    res.status(200).json({
      success: true,
      data: reposts,
      pagination: {
        limit,
        offset,
        hasMore: reposts.length === limit,
      },
    });
  } catch (error) {
    console.error('Get reposts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Check if user has reposted a post
const checkReposted = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    // Validate postId is a valid integer
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const repost = await Post.hasReposted(userId, postId);

    res.status(200).json({
      success: true,
      data: {
        has_reposted: !!repost,
        repost_id: repost ? repost.id : null,
      },
    });
  } catch (error) {
    console.error('Check reposted error:', error.message);
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
  repostPost,
  unrepostPost,
  getReposts,
  checkReposted,
  validatePost,
};
