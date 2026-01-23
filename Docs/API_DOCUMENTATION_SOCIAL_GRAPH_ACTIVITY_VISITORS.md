# Social Graph + Activity Feed + Profile Visitors (Frontend Guide)

This document explains how the frontend should use:

- **Activity Feed APIs** (`/api/activities/*`)
- **Social Graph APIs** (`/api/social-graph/*`)
- **Profile Visitors** (auto-tracked on `GET /api/users/:id`, viewed via `/api/social-graph/*`)

## Authentication

All endpoints below require JWT auth:

- Header: `Authorization: Bearer <token>`

## Base URL

- Development: `http://localhost:3000`
- Production: `https://backendlatis-g8eyhug8aherhzdy.southindia-01.azurewebsites.net`

## Shared conventions

### Pagination

Most list endpoints accept:

- `limit` (default varies; typically 50)
- `offset` (default: 0)

Response usually includes:

```json
{
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 12
  }
}
```

### Block behavior

If there is a block in either direction between the authenticated user and the target, the backend may return:

- `403 Forbidden`

---

## Activity Feed APIs

Activities are stored as records with:

- `user_id`: actor user id
- `activity_type`: string enum
- `activity_data`: JSON payload (varies by type)
- `related_*` ids: references to users/posts/comments/connections where relevant
- `created_at`

### Activity types

Currently emitted:

- `post_created`
- `comment_created`
- `comment_replied`
- `follow`
- `connection_accepted`
- `profile_updated`

Note: `reaction_added` and `connection_requested` are reserved in query filters but may not be emitted yet depending on the action surface.

### Get feed (connections/following)

`GET /api/activities/feed?limit=50&offset=0&type=post_created&start_date=...&end_date=...`

- Returns activities from:
  - yourself
  - users you follow
  - users you’re connected with
- Backend filters out activities from blocked users.

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "user_id": 7,
      "activity_type": "post_created",
      "activity_data": { "post_id": 99, "title": null },
      "related_user_id": null,
      "related_post_id": 99,
      "related_comment_id": null,
      "related_connection_id": null,
      "created_at": "2026-01-23T12:00:00.000Z",
      "first_name": "Asha",
      "last_name": "Patel",
      "profile_image_url": "https://..."
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 1 }
}
```

### Get my activities

`GET /api/activities/me?limit=50&offset=0&type=profile_updated`

Response:

```json
{
  "success": true,
  "data": [/* activity_feed rows */],
  "pagination": { "limit": 50, "offset": 0, "count": 10 }
}
```

### Get a user’s activities

`GET /api/activities/user/:id?limit=50&offset=0&type=post_created`

- `:id` is numeric user id.
- Returns `403` if blocked either way.

### Generic activities endpoint (feed=true)

`GET /api/activities?feed=true&limit=50&offset=0&type=comment_created`

- If `feed=true` => same as `/feed` but with unified filtering.
- If `feed=false` (default) => same as `/me`.

---

## Social Graph APIs

### Mutual connections

`GET /api/social-graph/mutual-connections/:userId`

Returns:

```json
{
  "success": true,
  "data": [
    { "id": 22, "first_name": "Jane", "last_name": "Smith", "profile_image_url": "https://...", "headline": "..." }
  ],
  "count": 1
}
```

### Network stats (me)

`GET /api/social-graph/network-stats`

Returns:

```json
{
  "success": true,
  "data": {
    "connections": {
      "connection_count": 12,
      "outgoing_requests": 3,
      "incoming_requests": 1
    },
    "follows": {
      "follower_count": 50,
      "following_count": 120,
      "mutual_follows_count": 0
    }
  }
}
```

### Network stats (user)

`GET /api/social-graph/network-stats/:userId`

Returns same structure as above.

### Suggested connections (“people you may know”)

`GET /api/social-graph/suggestions?limit=20`

Returns:

```json
{
  "success": true,
  "data": [
    { "id": 88, "first_name": "Ravi", "last_name": "K", "headline": "...", "profile_image_url": "https://...", "mutual_count": 4 }
  ],
  "count": 1
}
```

### Relationship path (degrees of separation)

`GET /api/social-graph/relationship-path/:userId`

- Degree 0: self
- Degree 1: directly connected
- Degree 2: connected through one mutual connection
- Otherwise `degree: null`

Returns:

```json
{
  "success": true,
  "data": {
    "degree": 2,
    "path": [55, 99],
    "message": "Connected through mutual connection"
  }
}
```

### Second-degree connections

`GET /api/social-graph/second-degree/:userId?limit=50`

Returns:

```json
{
  "success": true,
  "data": [
    { "id": 101, "first_name": "Sam", "last_name": "Lee", "headline": "...", "profile_image_url": "https://...", "mutual_count": 2 }
  ],
  "count": 1
}
```

---

## Profile Visitors (Frontend behavior)

### How visits are recorded

Whenever an authenticated user views a profile via:

- `GET /api/users/:id` (or username form)

the backend records a visit **if**:

- viewer is authenticated, and
- viewer is not viewing their own profile.

### Get who viewed my profile

`GET /api/social-graph/profile-visitors/:userId?limit=50&offset=0`

Important:

- Currently **only allowed for your own userId**. Otherwise returns `403`.

Returns:

```json
{
  "success": true,
  "data": [
    {
      "visitor_id": 7,
      "profile_user_id": 1,
      "visit_count": 3,
      "first_visited_at": "2026-01-20T10:00:00.000Z",
      "last_visited_at": "2026-01-23T12:00:00.000Z",
      "first_name": "Asha",
      "last_name": "Patel",
      "profile_image_url": "https://...",
      "headline": "..."
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 1 }
}
```

### Get profiles I visited

`GET /api/social-graph/visited-profiles?limit=50&offset=0`

Returns:

```json
{
  "success": true,
  "data": [
    {
      "visitor_id": 1,
      "profile_user_id": 22,
      "visit_count": 1,
      "last_visited_at": "2026-01-23T12:00:00.000Z",
      "first_name": "Jane",
      "last_name": "Smith",
      "profile_image_url": "https://...",
      "headline": "..."
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 1 }
}
```

### Get my visit stats

`GET /api/social-graph/visit-stats/:userId`

Important:

- Currently **only allowed for your own userId**. Otherwise returns `403`.

Returns:

```json
{
  "success": true,
  "data": {
    "total_visits": 120,
    "unique_visitors": 45
  }
}
```

---

## UI mapping suggestions

### Activity feed screen

- Use `GET /api/activities/feed` for the home feed stream.
- Use `type` filter to build tabs (Posts, Comments, Connections, Profile).
- Use `created_at` sorting (already DESC).

### “Who viewed my profile”

- Record happens automatically when viewing profiles (`GET /api/users/:id`).
- Use `GET /api/social-graph/profile-visitors/:myId` to show visitor list.
- Use `GET /api/social-graph/visit-stats/:myId` for summary cards.

