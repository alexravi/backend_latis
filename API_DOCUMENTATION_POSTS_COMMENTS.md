# Posts, Comments, Likes & Reposts API Documentation
## Frontend Integration Guide

### Base URLs
```
Posts: /api/posts
Comments: /api/comments
```

### Authentication
**Required:** Bearer Token (JWT) for all endpoints
```
Authorization: Bearer <your_jwt_token>
```

### Content-Type
```
Content-Type: application/json
```

---

## Table of Contents

1. [Posts API](#posts-api)
   - [Create Post](#1-create-post)
   - [Get Feed](#2-get-feed)
   - [Get Post by ID](#3-get-post-by-id)
   - [Update Post](#4-update-post)
   - [Delete Post](#5-delete-post)
   - [Upvote Post](#6-upvote-post)
   - [Downvote Post](#7-downvote-post)
   - [Remove Vote](#8-remove-vote)
   - [Repost Post](#9-repost-post)
   - [Unrepost Post](#10-unrepost-post)
   - [Get Reposts](#11-get-reposts)
   - [Check if Reposted](#12-check-if-reposted)

2. [Comments API](#comments-api)
   - [Create Comment](#1-create-comment)
   - [Get Post Comments](#2-get-post-comments)
   - [Get Comment by ID](#3-get-comment-by-id)
   - [Update Comment](#4-update-comment)
   - [Delete Comment](#5-delete-comment)
   - [Upvote Comment](#6-upvote-comment)
   - [Downvote Comment](#7-downvote-comment)
   - [Remove Vote](#8-remove-vote-1)

3. [Frontend Integration Tips](#frontend-integration-tips)

---

## Posts API

### 1. Create Post

**Endpoint:** `POST /api/posts`

**Description:** Create a new post. Supports regular posts, articles, and discussions with different visibility settings.

**Request Body:**
```json
{
  "content": "This is my post content",
  "post_type": "post",
  "visibility": "public"
}
```

**Request Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `content` | string | **Yes** | Post content (1-10000 characters) | "This is my post content" |
| `post_type` | string | No | Type of post: `post`, `article`, `discussion` (default: `post`) | "post" |
| `visibility` | string | No | Visibility: `public`, `connections`, `private` (default: `public`) | "public" |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Post created successfully",
  "data": {
    "id": 1,
    "user_id": 123,
    "content": "This is my post content",
    "post_type": "post",
    "visibility": "public",
    "upvotes_count": 0,
    "downvotes_count": 0,
    "comments_count": 0,
    "shares_count": 0,
    "is_pinned": false,
    "is_edited": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "first_name": "John",
    "last_name": "Doe",
    "profile_image_url": "https://example.com/profile.jpg",
    "headline": "Cardiologist",
    "user_vote": null
  }
}
```

**Error Responses:**
- `400`: Validation error (content too long/short, invalid post_type or visibility)
- `401`: Unauthorized (missing or invalid token)
- `500`: Internal server error

**Frontend Example:**
```javascript
const createPost = async (content, postType = 'post', visibility = 'public') => {
  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        post_type: postType,
        visibility
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create post');
    }

    return data.data;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};
```

---

### 2. Get Feed

**Endpoint:** `GET /api/posts`

**Description:** Get personalized feed of posts and reposts. Includes original posts and reposts from users you follow/connect with.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | string | No | `new` | Sort order: `new`, `best`, `top`, `hot` |
| `limit` | integer | No | 20 | Number of posts to return (1-100) |
| `offset` | integer | No | 0 | Offset for pagination |

**Sort Options:**
- `new`: Sort by creation time (newest first) - default
- `best`/`top`: Sort by score (upvotes - downvotes)
- `hot`: Hot algorithm - score weighted by time decay

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 123,
      "content": "Original post",
      "post_type": "post",
      "visibility": "public",
      "upvotes_count": 10,
      "downvotes_count": 2,
      "comments_count": 5,
      "shares_count": 3,
      "is_repost": false,
      "user_vote": "upvote",
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 10,
      "user_id": 456,
      "content": "",
      "is_repost": true,
      "original_post": {
        "id": 1,
        "content": "Original post",
        "user_id": 123,
        "first_name": "John",
        "last_name": "Doe",
        "profile_image_url": "https://example.com/profile.jpg",
        "headline": "Cardiologist",
        "created_at": "2024-01-15T10:30:00.000Z"
      },
      "created_at": "2024-01-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Note:** Reposts have `is_repost: true` and include `original_post` object with the original post data.

**Frontend Example:**
```javascript
const getFeed = async (sort = 'new', limit = 20, offset = 0) => {
  try {
    const response = await fetch(
      `/api/posts?sort=${sort}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get feed');
    }

    return data;
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw error;
  }
};
```

---

### 3. Get Post by ID

**Endpoint:** `GET /api/posts/:id`

**Description:** Get detailed view of a single post including comments and user vote status.

**Path Parameters:**
- `id` (integer, required): Post ID

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | string | No | `best` | Sort order for comments: `best`, `top`, `new` |
| `commentLimit` | integer | No | 50 | Number of top-level comments to return (1-100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 123,
    "content": "This is my post",
    "upvotes_count": 10,
    "downvotes_count": 2,
    "comments_count": 5,
    "user_vote": "upvote",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2024-01-15T10:30:00.000Z",
    "comments": [
      {
        "id": 1,
        "content": "Great post!",
        "user_id": 456,
        "upvotes_count": 3,
        "downvotes_count": 0,
        "replies_count": 1,
        "user_vote": null,
        "created_at": "2024-01-15T10:35:00.000Z"
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
const getPost = async (postId, sort = 'best', commentLimit = 50) => {
  try {
    const response = await fetch(
      `/api/posts/${postId}?sort=${sort}&commentLimit=${commentLimit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get post');
    }

    return data.data;
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};
```

---

### 4. Update Post

**Endpoint:** `PUT /api/posts/:id`

**Description:** Update an existing post. Only the post owner can update their posts.

**Path Parameters:**
- `id` (integer, required): Post ID

**Request Body:**
```json
{
  "content": "Updated post content",
  "post_type": "article",
  "visibility": "connections",
  "is_pinned": false
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | No | Updated post content (1-10000 characters) |
| `post_type` | string | No | Post type: `post`, `article`, `discussion` |
| `visibility` | string | No | Visibility: `public`, `connections`, `private` |
| `is_pinned` | boolean | No | Pin the post to top of user's profile |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Post updated successfully",
  "data": {
    "id": 1,
    "content": "Updated post content",
    "is_edited": true,
    "edited_at": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `403`: Not authorized to edit this post (only owner can edit)
- `404`: Post not found

**Frontend Example:**
```javascript
const updatePost = async (postId, updates) => {
  try {
    const response = await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update post');
    }

    return data.data;
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};
```

---

### 5. Delete Post

**Endpoint:** `DELETE /api/posts/:id`

**Description:** Delete a post. Only the post owner can delete their posts. Cascades to delete all comments and reactions.

**Path Parameters:**
- `id` (integer, required): Post ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

**Error Responses:**
- `403`: Not authorized to delete this post
- `404`: Post not found

**Frontend Example:**
```javascript
const deletePost = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete post');
    }

    return data;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};
```

---

### 6. Upvote Post

**Endpoint:** `POST /api/posts/:id/upvote`

**Description:** Upvote a post with Reddit-style toggle behavior:
- If not voted: Adds upvote
- If already upvoted: Removes vote (toggles off)
- If downvoted: Changes to upvote (toggles)

**Path Parameters:**
- `id` (integer, required): Post ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Post upvoted",
  "data": {
    "id": 1,
    "upvotes_count": 11,
    "downvotes_count": 2,
    "user_vote": "upvote"
  }
}
```

**Possible Messages:**
- `"Post upvoted"` - New upvote added or changed from downvote
- `"Vote removed"` - Vote was toggled off (was already upvoted)

**Frontend Example:**
```javascript
const upvotePost = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}/upvote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to upvote post');
    }

    return data.data;
  } catch (error) {
    console.error('Error upvoting post:', error);
    throw error;
  }
};
```

---

### 7. Downvote Post

**Endpoint:** `POST /api/posts/:id/downvote`

**Description:** Downvote a post with Reddit-style toggle behavior:
- If not voted: Adds downvote
- If already downvoted: Removes vote (toggles off)
- If upvoted: Changes to downvote (toggles)

**Path Parameters:**
- `id` (integer, required): Post ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Post downvoted",
  "data": {
    "id": 1,
    "upvotes_count": 9,
    "downvotes_count": 6,
    "user_vote": "downvote"
  }
}
```

**Possible Messages:**
- `"Post downvoted"` - New downvote added or changed from upvote
- `"Vote removed"` - Vote was toggled off (was already downvoted)

**Frontend Example:**
```javascript
const downvotePost = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}/downvote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to downvote post');
    }

    return data.data;
  } catch (error) {
    console.error('Error downvoting post:', error);
    throw error;
  }
};
```

---

### 8. Remove Vote

**Endpoint:** `DELETE /api/posts/:id/vote`

**Description:** Explicitly remove a vote from a post. This is idempotent - calling it when no vote exists will return success.

**Path Parameters:**
- `id` (integer, required): Post ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vote removed",
  "data": {
    "id": 1,
    "upvotes_count": 10,
    "downvotes_count": 5,
    "user_vote": null
  }
}
```

**Frontend Example:**
```javascript
const removeVote = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}/vote`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to remove vote');
    }

    return data.data;
  } catch (error) {
    console.error('Error removing vote:', error);
    throw error;
  }
};
```

---

### 9. Repost Post

**Endpoint:** `POST /api/posts/:id/repost`

**Description:** Create a repost of an existing post (Twitter/X style). Creates a new post with `parent_post_id` pointing to the original post.

**Path Parameters:**
- `id` (integer, required): Original post ID to repost

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Post reposted successfully",
  "data": {
    "id": 10,
    "user_id": 456,
    "content": "",
    "parent_post_id": 5,
    "is_repost": true,
    "original_post": {
      "id": 5,
      "content": "Original post content",
      "user_id": 123,
      "first_name": "John",
      "last_name": "Doe",
      "profile_image_url": "https://example.com/profile.jpg",
      "headline": "Cardiologist",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    "created_at": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Already reposted or attempting to repost own post
- `404`: Original post not found

**Frontend Example:**
```javascript
const repostPost = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}/repost`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to repost');
    }

    return data.data;
  } catch (error) {
    console.error('Error reposting:', error);
    throw error;
  }
};
```

---

### 10. Unrepost Post

**Endpoint:** `DELETE /api/posts/:id/repost`

**Description:** Remove a repost (unrepost). Deletes the repost and decrements shares count on the original post.

**Path Parameters:**
- `id` (integer, required): Original post ID to unrepost

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Repost removed successfully"
}
```

**Error Responses:**
- `404`: Post or repost not found

**Frontend Example:**
```javascript
const unrepostPost = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}/repost`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to unrepost');
    }

    return data;
  } catch (error) {
    console.error('Error unreposting:', error);
    throw error;
  }
};
```

---

### 11. Get Reposts

**Endpoint:** `GET /api/posts/:id/reposts`

**Description:** Get list of all reposts for a specific post. Returns a paginated list of users who have reposted the post.

**Path Parameters:**
- `id` (integer, required): Original post ID

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 50 | Number of reposts to return (1-100) |
| `offset` | integer | No | 0 | Offset for pagination |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "user_id": 456,
      "content": "",
      "is_repost": true,
      "first_name": "Jane",
      "last_name": "Smith",
      "created_at": "2024-01-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Frontend Example:**
```javascript
const getReposts = async (postId, limit = 50, offset = 0) => {
  try {
    const response = await fetch(
      `/api/posts/${postId}/reposts?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get reposts');
    }

    return data;
  } catch (error) {
    console.error('Error fetching reposts:', error);
    throw error;
  }
};
```

---

### 12. Check if Reposted

**Endpoint:** `GET /api/posts/:id/reposted`

**Description:** Check if the current user has reposted a specific post. Returns a boolean flag.

**Path Parameters:**
- `id` (integer, required): Original post ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "has_reposted": true,
    "repost_id": 10
  }
}
```

**Frontend Example:**
```javascript
const checkReposted = async (postId) => {
  try {
    const response = await fetch(`/api/posts/${postId}/reposted`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to check repost status');
    }

    return data.data;
  } catch (error) {
    console.error('Error checking repost status:', error);
    throw error;
  }
};
```

---

## Comments API

### 1. Create Comment

**Endpoint:** `POST /api/comments`

**Description:** Create a comment on a post or reply to an existing comment. Supports unlimited nesting depth.

**Request Body:**
```json
{
  "content": "This is my comment",
  "post_id": 1,
  "parent_comment_id": null
}
```

**Request Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `content` | string | **Yes** | Comment content (1-5000 characters) | "This is my comment" |
| `post_id` | integer | **Yes** | ID of the post to comment on | 1 |
| `parent_comment_id` | integer | No | ID of parent comment if replying (null for top-level) | null or 5 |

**Comment vs Reply:**
- **Top-level comment:** Omit `parent_comment_id` or set to `null`
- **Reply:** Set `parent_comment_id` to the comment ID you're replying to
- **Nesting:** Supports unlimited nesting depth (replies to replies to replies...)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Comment created successfully",
  "data": {
    "id": 1,
    "post_id": 1,
    "user_id": 123,
    "content": "This is my comment",
    "parent_comment_id": null,
    "upvotes_count": 0,
    "downvotes_count": 0,
    "replies_count": 0,
    "user_vote": null,
    "created_at": "2024-01-15T10:35:00.000Z",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Frontend Example:**
```javascript
const createComment = async (postId, content, parentCommentId = null) => {
  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        post_id: postId,
        parent_comment_id: parentCommentId
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create comment');
    }

    return data.data;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};
```

---

### 2. Get Post Comments

**Endpoint:** `GET /api/posts/:postId/comments`

**Description:** Get all comments for a post. Supports two modes:
- **Flat structure** (default): Returns top-level comments only with pagination
- **Tree structure**: Returns complete nested comment tree with unlimited depth (use `?tree=true`)

**Path Parameters:**
- `postId` (integer, required): Post ID

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | string | No | `best` | Sort order: `best`, `top`, `new` |
| `tree` | boolean | No | `false` | If `true`, returns complete nested tree. If `false`, returns flat structure with pagination |
| `limit` | integer | No | 50 | Number of comments to return (only used when `tree=false`) |
| `offset` | integer | No | 0 | Offset for pagination (only used when `tree=false`) |

**Response - Tree Structure (`?tree=true`):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "content": "Parent comment",
      "upvotes_count": 5,
      "downvotes_count": 0,
      "replies_count": 2,
      "user_vote": "upvote",
      "replies": [
        {
          "id": 2,
          "content": "Reply 1",
          "parent_comment_id": 1,
          "replies": [
            {
              "id": 3,
              "content": "Nested reply",
              "parent_comment_id": 2,
              "replies": []
            }
          ]
        }
      ]
    }
  ]
}
```

**Response - Flat Structure (`?tree=false`):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "content": "Parent comment",
      "upvotes_count": 5,
      "user_vote": "upvote"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Frontend Example:**
```javascript
const getPostComments = async (postId, sort = 'best', useTree = true) => {
  try {
    const url = useTree
      ? `/api/posts/${postId}/comments?sort=${sort}&tree=true`
      : `/api/posts/${postId}/comments?sort=${sort}&tree=false&limit=50&offset=0`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get comments');
    }

    return data;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};
```

---

### 3. Get Comment by ID

**Endpoint:** `GET /api/comments/:id`

**Description:** Get a comment with its replies. Supports two modes:
- **Flat structure** (default): Returns comment with direct replies only (paginated)
- **Tree structure**: Returns comment with complete nested reply tree (use `?tree=true`)

**Path Parameters:**
- `id` (integer, required): Comment ID

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | string | No | `best` | Sort order for replies |
| `tree` | boolean | No | `false` | If `true`, returns complete nested tree |
| `replyLimit` | integer | No | 20 | Number of replies to return (only used when `tree=false`) |

**Response - Tree Structure:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "content": "Parent comment",
    "user_vote": "upvote",
    "replies": [
      {
        "id": 2,
        "content": "Reply 1",
        "replies": [
          {
            "id": 3,
            "content": "Nested reply",
            "replies": []
          }
        ]
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
const getComment = async (commentId, sort = 'best', useTree = true) => {
  try {
    const url = useTree
      ? `/api/comments/${commentId}?sort=${sort}&tree=true`
      : `/api/comments/${commentId}?sort=${sort}&tree=false&replyLimit=20`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get comment');
    }

    return data.data;
  } catch (error) {
    console.error('Error fetching comment:', error);
    throw error;
  }
};
```

---

### 4. Update Comment

**Endpoint:** `PUT /api/comments/:id`

**Description:** Update an existing comment. Only the comment owner can update their comments.

**Path Parameters:**
- `id` (integer, required): Comment ID

**Request Body:**
```json
{
  "content": "Updated comment content"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | **Yes** | Updated comment content (1-5000 characters) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Comment updated successfully",
  "data": {
    "id": 1,
    "content": "Updated comment content",
    "is_edited": true,
    "edited_at": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `403`: Not authorized to edit this comment
- `404`: Comment not found

**Frontend Example:**
```javascript
const updateComment = async (commentId, content) => {
  try {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update comment');
    }

    return data.data;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};
```

---

### 5. Delete Comment

**Endpoint:** `DELETE /api/comments/:id`

**Description:** Delete a comment. Only the comment owner can delete their comments. Decrements comment/reply count appropriately.

**Path Parameters:**
- `id` (integer, required): Comment ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

**Error Responses:**
- `403`: Not authorized to delete this comment
- `404`: Comment not found

**Frontend Example:**
```javascript
const deleteComment = async (commentId) => {
  try {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete comment');
    }

    return data;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};
```

---

### 6. Upvote Comment

**Endpoint:** `POST /api/comments/:id/upvote`

**Description:** Upvote a comment with Reddit-style toggle behavior:
- If not voted: Adds upvote
- If already upvoted: Removes vote (toggles off)
- If downvoted: Changes to upvote (toggles)

**Path Parameters:**
- `id` (integer, required): Comment ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Comment upvoted",
  "data": {
    "id": 1,
    "upvotes_count": 6,
    "downvotes_count": 0,
    "user_vote": "upvote"
  }
}
```

**Frontend Example:**
```javascript
const upvoteComment = async (commentId) => {
  try {
    const response = await fetch(`/api/comments/${commentId}/upvote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to upvote comment');
    }

    return data.data;
  } catch (error) {
    console.error('Error upvoting comment:', error);
    throw error;
  }
};
```

---

### 7. Downvote Comment

**Endpoint:** `POST /api/comments/:id/downvote`

**Description:** Downvote a comment with Reddit-style toggle behavior:
- If not voted: Adds downvote
- If already downvoted: Removes vote (toggles off)
- If upvoted: Changes to downvote (toggles)

**Path Parameters:**
- `id` (integer, required): Comment ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Comment downvoted",
  "data": {
    "id": 1,
    "upvotes_count": 4,
    "downvotes_count": 1,
    "user_vote": "downvote"
  }
}
```

**Frontend Example:**
```javascript
const downvoteComment = async (commentId) => {
  try {
    const response = await fetch(`/api/comments/${commentId}/downvote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to downvote comment');
    }

    return data.data;
  } catch (error) {
    console.error('Error downvoting comment:', error);
    throw error;
  }
};
```

---

### 8. Remove Vote

**Endpoint:** `DELETE /api/comments/:id/vote`

**Description:** Explicitly remove a vote from a comment. This is idempotent - calling it when no vote exists will return success.

**Path Parameters:**
- `id` (integer, required): Comment ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vote removed",
  "data": {
    "id": 1,
    "upvotes_count": 5,
    "downvotes_count": 0,
    "user_vote": null
  }
}
```

**Frontend Example:**
```javascript
const removeCommentVote = async (commentId) => {
  try {
    const response = await fetch(`/api/comments/${commentId}/vote`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to remove vote');
    }

    return data.data;
  } catch (error) {
    console.error('Error removing vote:', error);
    throw error;
  }
};
```

---

## Frontend Integration Tips

### 1. Vote Toggle Behavior

The voting system uses Reddit-style toggle behavior. When a user clicks the same vote button again, it removes the vote:

```javascript
const handleVote = async (postId, currentVote) => {
  if (currentVote === 'upvote') {
    // User already upvoted, clicking again removes vote
    await upvotePost(postId); // This will toggle off
  } else if (currentVote === 'downvote') {
    // User already downvoted, clicking again removes vote
    await downvotePost(postId); // This will toggle off
  } else {
    // No vote, add upvote
    await upvotePost(postId);
  }
};
```

### 2. Handling Reposts in UI

When displaying reposts in the feed, check the `is_repost` flag:

```javascript
const PostCard = ({ post }) => {
  if (post.is_repost) {
    return (
      <div className="repost">
        <div className="repost-header">
          {post.first_name} {post.last_name} reposted
        </div>
        <OriginalPost post={post.original_post} />
      </div>
    );
  }
  
  return <RegularPost post={post} />;
};
```

### 3. Comment Tree Rendering

When using tree structure for comments, render recursively:

```javascript
const CommentTree = ({ comments, onReply }) => {
  return (
    <div className="comment-tree">
      {comments.map(comment => (
        <div key={comment.id} className="comment">
          <CommentContent comment={comment} />
          {comment.replies && comment.replies.length > 0 && (
            <div className="replies">
              <CommentTree comments={comment.replies} onReply={onReply} />
            </div>
          )}
          <ReplyButton onClick={() => onReply(comment.id)} />
        </div>
      ))}
    </div>
  );
};
```

### 4. Real-time Updates with WebSocket

The API emits WebSocket events for real-time updates. Listen for these events:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000', {
  auth: { token: userToken }
});

// Listen for post updates
socket.on('post:created', (post) => {
  // Add new post to feed
  addPostToFeed(post);
});

socket.on('vote:upvote', ({ type, id, userId }) => {
  if (type === 'post') {
    // Update post vote count
    updatePostVote(id, 'upvote');
  }
});

socket.on('comment:created', (comment) => {
  // Add new comment to thread
  addCommentToThread(comment);
});
```

### 5. Error Handling

Always handle errors gracefully:

```javascript
const handleApiCall = async (apiFunction, errorMessage) => {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      redirectToLogin();
    } else if (error.response?.status === 403) {
      // Not authorized
      showError('You do not have permission to perform this action');
    } else if (error.response?.status === 404) {
      // Not found
      showError('Item not found');
    } else {
      // Other errors
      showError(errorMessage || 'An error occurred');
    }
    throw error;
  }
};
```

### 6. Optimistic Updates

Update UI immediately before API call completes:

```javascript
const handleUpvote = async (postId) => {
  // Optimistic update
  const previousVote = posts[postId].user_vote;
  const previousCount = posts[postId].upvotes_count;
  
  if (previousVote === 'upvote') {
    // Will remove vote
    updatePostUI(postId, { user_vote: null, upvotes_count: previousCount - 1 });
  } else {
    // Will add/change vote
    const increment = previousVote === 'downvote' ? 2 : 1;
    updatePostUI(postId, { user_vote: 'upvote', upvotes_count: previousCount + increment });
  }
  
  try {
    const updated = await upvotePost(postId);
    // Update with actual response
    updatePostUI(postId, updated);
  } catch (error) {
    // Revert on error
    updatePostUI(postId, { user_vote: previousVote, upvotes_count: previousCount });
    showError('Failed to update vote');
  }
};
```

### 7. Pagination

Implement infinite scroll or "Load More" for feeds:

```javascript
const [posts, setPosts] = useState([]);
const [offset, setOffset] = useState(0);
const [hasMore, setHasMore] = useState(true);
const [loading, setLoading] = useState(false);

const loadMorePosts = async () => {
  if (loading || !hasMore) return;
  
  setLoading(true);
  try {
    const response = await getFeed('new', 20, offset);
    setPosts(prev => [...prev, ...response.data]);
    setOffset(prev => prev + 20);
    setHasMore(response.pagination.hasMore);
  } catch (error) {
    showError('Failed to load more posts');
  } finally {
    setLoading(false);
  }
};
```

### 8. Comment Sorting

Allow users to change comment sort order:

```javascript
const [sortBy, setSortBy] = useState('best');

const handleSortChange = async (newSort) => {
  setSortBy(newSort);
  setLoading(true);
  try {
    const response = await getPostComments(postId, newSort, true);
    setComments(response.data);
  } catch (error) {
    showError('Failed to reload comments');
  } finally {
    setLoading(false);
  }
};
```

### 9. Loading States

Show loading indicators during API calls:

```javascript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (data) => {
  setIsSubmitting(true);
  try {
    await createPost(data);
    showSuccess('Post created successfully');
  } catch (error) {
    showError('Failed to create post');
  } finally {
    setIsSubmitting(false);
  }
};

// In JSX
<button disabled={isSubmitting}>
  {isSubmitting ? 'Posting...' : 'Post'}
</button>
```

### 10. Content Validation

Validate content before submission:

```javascript
const validatePost = (content) => {
  if (!content || content.trim().length === 0) {
    return 'Post content cannot be empty';
  }
  if (content.length > 10000) {
    return 'Post content cannot exceed 10000 characters';
  }
  return null;
};

const handlePost = async () => {
  const error = validatePost(content);
  if (error) {
    showError(error);
    return;
  }
  
  await createPost(content);
};
```

---

## Common Response Fields

### Post Object
```typescript
{
  id: number;
  user_id: number;
  content: string;
  post_type: 'post' | 'article' | 'discussion';
  visibility: 'public' | 'connections' | 'private';
  upvotes_count: number;
  downvotes_count: number;
  comments_count: number;
  shares_count: number;
  is_pinned: boolean;
  is_edited: boolean;
  is_repost?: boolean;
  parent_post_id?: number;
  original_post?: PostObject;
  user_vote: 'upvote' | 'downvote' | null;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  headline: string | null;
  created_at: string;
  edited_at?: string;
}
```

### Comment Object
```typescript
{
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  parent_comment_id: number | null;
  upvotes_count: number;
  downvotes_count: number;
  replies_count: number;
  user_vote: 'upvote' | 'downvote' | null;
  is_edited: boolean;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  created_at: string;
  edited_at?: string;
  replies?: CommentObject[];
}
```

---

## Notes

1. **Authentication:** All endpoints require a valid JWT token in the `Authorization` header
2. **Vote Toggle:** Voting uses Reddit-style toggle - clicking the same vote button again removes the vote
3. **Reposts:** Reposts have empty `content` and include `original_post` object
4. **Comment Nesting:** Comments support unlimited nesting depth
5. **Tree vs Flat:** Use `?tree=true` for complete nested structures, `?tree=false` for paginated flat lists
6. **Real-time:** WebSocket events are emitted for all create/update/delete/vote operations
7. **Pagination:** Use `limit` and `offset` for paginated endpoints
8. **Error Handling:** Always check `response.ok` and handle errors appropriately
9. **Content Limits:** Posts max 10000 chars, Comments max 5000 chars
10. **Ownership:** Only post/comment owners can edit/delete their content

---

## Support

For questions or issues, refer to the API documentation or contact the backend team.
