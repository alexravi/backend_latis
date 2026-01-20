// Swagger configuration for API documentation
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Backend Latis API',
      version: '1.0.0',
      description: 'Production-grade Node.js backend with PostgreSQL and JWT authentication',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Relationship: {
          type: 'object',
          properties: {
            isConnected: { type: 'boolean', example: false },
            connectionStatus: { type: 'string', nullable: true, enum: ['pending', 'connected'], example: 'pending' },
            connectionRequesterId: { type: 'integer', nullable: true, example: 12 },
            connectionPending: { type: 'boolean', example: true },
            iFollowThem: { type: 'boolean', example: false },
            theyFollowMe: { type: 'boolean', example: false },
            iBlocked: { type: 'boolean', example: false },
            blockedMe: { type: 'boolean', example: false },
          },
          description: 'Relationship flags between the authenticated viewer and the target user',
        },
        Connection: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            requester_id: { type: 'integer', example: 10 },
            addressee_id: { type: 'integer', example: 20 },
            status: { type: 'string', enum: ['pending', 'connected'], example: 'pending' },
            requested_at: { type: 'string', format: 'date-time' },
            accepted_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Follow: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            follower_id: { type: 'integer', example: 10 },
            following_id: { type: 'integer', example: 20 },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Block: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            blocker_id: { type: 'integer', example: 10 },
            blocked_id: { type: 'integer', example: 20 },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            first_name: {
              type: 'string',
              description: 'User first name',
            },
            last_name: {
              type: 'string',
              description: 'User last name',
            },
            relationship: {
              $ref: '#/components/schemas/Relationship',
            },
          },
        },
        SignUpRequest: {
          type: 'object',
          required: ['email', 'password', 'first_name', 'last_name'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password (minimum 6 characters)',
              example: 'securePassword123',
            },
            first_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'User first name',
              example: 'John',
            },
            last_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'User last name',
              example: 'Doe',
            },
          },
        },
        SignInRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'securePassword123',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            token: {
              type: 'string',
              description: 'JWT token for authentication',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Validation errors (if any)',
            },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 1 },
            content: { type: 'string', example: 'This is a post content' },
            post_type: { type: 'string', enum: ['post', 'article', 'discussion'], example: 'post' },
            visibility: { type: 'string', enum: ['public', 'connections', 'private'], example: 'public' },
            parent_post_id: { type: 'integer', nullable: true, example: null, description: 'ID of original post if this is a repost' },
            likes_count: { type: 'integer', example: 10 },
            upvotes_count: { type: 'integer', example: 25 },
            downvotes_count: { type: 'integer', example: 5 },
            score: { type: 'integer', example: 20 },
            comments_count: { type: 'integer', example: 15 },
            shares_count: { type: 'integer', example: 8 },
            views_count: { type: 'integer', example: 100 },
            is_edited: { type: 'boolean', example: false },
            is_pinned: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            first_name: { type: 'string', example: 'John' },
            last_name: { type: 'string', example: 'Doe' },
            profile_image_url: { type: 'string', nullable: true },
            headline: { type: 'string', nullable: true },
            user_vote: { type: 'string', enum: ['upvote', 'downvote'], nullable: true },
            is_repost: { type: 'boolean', example: false, description: 'True if this is a repost' },
            original_post: {
              type: 'object',
              nullable: true,
              description: 'Original post data if this is a repost',
              properties: {
                id: { type: 'integer' },
                content: { type: 'string' },
                user_id: { type: 'integer' },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                profile_image_url: { type: 'string', nullable: true },
                headline: { type: 'string', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            post_id: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 1 },
            content: { type: 'string', example: 'This is a comment' },
            parent_comment_id: { type: 'integer', nullable: true, example: null, description: 'ID of parent comment if this is a reply' },
            likes_count: { type: 'integer', example: 5 },
            upvotes_count: { type: 'integer', example: 10 },
            downvotes_count: { type: 'integer', example: 2 },
            score: { type: 'integer', example: 8 },
            replies_count: { type: 'integer', example: 3 },
            is_edited: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            first_name: { type: 'string', example: 'Jane' },
            last_name: { type: 'string', example: 'Smith' },
            profile_image_url: { type: 'string', nullable: true },
            user_vote: { type: 'string', enum: ['upvote', 'downvote'], nullable: true },
            replies: {
              type: 'array',
              items: { $ref: '#/components/schemas/Comment' },
              description: 'Nested replies (unlimited depth)',
            },
          },
        },
        PostResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Post created successfully' },
            data: { $ref: '#/components/schemas/Post' },
          },
        },
        PostsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Post' },
            },
            pagination: {
              type: 'object',
              properties: {
                limit: { type: 'integer', example: 20 },
                offset: { type: 'integer', example: 0 },
                hasMore: { type: 'boolean', example: true },
              },
            },
          },
        },
        CommentResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Comment created successfully' },
            data: { $ref: '#/components/schemas/Comment' },
          },
        },
        CommentsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Comment' },
              description: 'Array of comments. If tree=true, returns nested tree structure with replies',
            },
            pagination: {
              type: 'object',
              nullable: true,
              properties: {
                limit: { type: 'integer', example: 50 },
                offset: { type: 'integer', example: 0 },
                hasMore: { type: 'boolean', example: true },
              },
              description: 'Pagination info (only for flat structure, not tree)',
            },
          },
        },
        RepostResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Post reposted successfully' },
            data: {
              type: 'object',
              allOf: [
                { $ref: '#/components/schemas/Post' },
                {
                  type: 'object',
                  properties: {
                    is_repost: { type: 'boolean', example: true },
                    original_post: {
                      $ref: '#/components/schemas/Post',
                      description: 'Original post that was reposted',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
  swaggerSpec,
  swaggerUi,
};
