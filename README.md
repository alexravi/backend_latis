# Backend Latis

Production-grade Node.js backend with PostgreSQL database.

## What’s included

- **Auth**: JWT-based authentication
- **Profiles**: complete profile creation/update + professional data
- **Social graph (1:1)**:
  - **Connections** (LinkedIn-style): requests + accept/decline/cancel/remove + listing
  - **Follows**: one-way follow/unfollow + followers/following lists
  - **Blocks**: hard block (prevents profile access, filters from search, severs connections/follows)
- **Search**: users/posts/jobs + universal search
- **Swagger**: interactive API documentation at `/api-docs`

## Project Structure

```
backend_latis/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection configuration
│   │   └── swagger.js           # Swagger API documentation configuration
│   ├── controllers/             # Request handlers
│   ├── models/                  # Database models
│   ├── routes/                  # API routes
│   ├── middleware/              # Custom middleware
│   ├── utils/                   # Utility functions
│   ├── server.js                # Express app setup and configuration
│   └── index.js                 # Entry point - starts the server
├── .env                         # Environment variables
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies and scripts
└── README.md                    # Project documentation
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env` file:
   - Update PostgreSQL connection details
   - Set server port

3. Run the application:
```bash
# Production
npm start

# Development (with nodemon)
npm run dev
```

4. Access API documentation:
   - Swagger UI: `http://localhost:3000/api-docs`
   - OpenAPI JSON: `http://localhost:3000/api-docs.json`

## Social graph APIs (Connections / Follows / Blocks)

All endpoints below require:

- `Authorization: Bearer <token>`

### Connections

- `POST /api/users/:id/connect` — send connection request
- `POST /api/users/:id/connect/accept` — accept request from `:id` (**auto-follows both ways**)
- `POST /api/users/:id/connect/decline` — decline request from `:id`
- `DELETE /api/users/:id/connect` — cancel outgoing request or remove connection
- `GET /api/users/me/connections?status=connected|pending` — list my connections
- `GET /api/users/me/connection-requests/incoming` — incoming requests
- `GET /api/users/me/connection-requests/outgoing` — outgoing requests

### Follows

- `POST /api/users/:id/follow` — follow user
- `DELETE /api/users/:id/follow` — unfollow user
- `GET /api/users/:id/followers?limit=50&offset=0` — list followers
- `GET /api/users/:id/following?limit=50&offset=0` — list following

### Blocks (hard block)

- `POST /api/users/:id/block` — block user (also removes existing connections/follows both ways)
- `DELETE /api/users/:id/block` — unblock user
- `GET /api/users/me/blocks?limit=50&offset=0` — list blocked users

### Relationship flags for frontend

`GET /api/users/:id` and `GET /api/search/users` include `relationship` flags (for authenticated viewers) to drive button states:

- `isConnected`, `connectionStatus`, `connectionRequesterId`, `connectionPending`
- `iFollowThem`, `theyFollowMe`
- `iBlocked`, `blockedMe`

See: `API_DOCUMENTATION_CONNECTIONS_FOLLOWS_BLOCKS.md`

## Activity feed + Social graph insights + Profile visitors (Frontend Guide)

See: `API_DOCUMENTATION_SOCIAL_GRAPH_ACTIVITY_VISITORS.md`

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode
- `DATABASE_URL` - PostgreSQL connection string (or use individual DB variables below)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret key for JWT token signing (required for authentication)
- `JWT_EXPIRES_IN` - JWT token expiration time (default: "24h", e.g., "7d", "1h")
- `AUTH_RATE_LIMIT_MAX` - Max auth attempts (signin/signup/google) per IP per window (default: 15 in dev, 5 in prod). Only failed attempts count; successful login does not consume the limit.
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in ms (default: 900000 = 15 minutes)
