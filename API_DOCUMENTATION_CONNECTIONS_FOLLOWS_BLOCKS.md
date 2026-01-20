# Connections, Follows, and Blocks (Frontend Guide)

This document explains **how the frontend should use the 1:1 relationship APIs** (LinkedIn-style connections + one-way follows + hard blocks).

## Authentication

All endpoints below require JWT auth:

- Header: `Authorization: Bearer <token>`

## Relationship flags (returned on profiles and search)

When you fetch a user profile via `GET /api/users/:id` (and on `/api/search/users` results), the backend includes:

- `user.relationship.isConnected` (boolean)
- `user.relationship.connectionStatus` (`pending` | `connected` | null)
- `user.relationship.connectionRequesterId` (number | null)
- `user.relationship.connectionPending` (boolean)
- `user.relationship.iFollowThem` (boolean)
- `user.relationship.theyFollowMe` (boolean)
- `user.relationship.iBlocked` (boolean)
- `user.relationship.blockedMe` (boolean)

### UI mapping: which buttons to show

Assume `meId` is the authenticated user ID and `target` is the profile user.

- If `relationship.iBlocked === true`:
  - Show **Unblock**.
  - Hide connect/follow actions.
- Else if `relationship.blockedMe === true`:
  - Treat as **hard blocked** (backend will also deny actions).
  - Hide connect/follow actions and show a “Not available” state.
- Else if `relationship.isConnected === true`:
  - Show **Message** (if/when messaging is enabled) and **Remove connection**.
  - Show **Follow/Unfollow** independently (your choice UX; backend supports it).
- Else if `relationship.connectionPending === true`:
  - If `relationship.connectionRequesterId === meId`:
    - Show **Pending** + **Cancel request**.
  - Else:
    - Show **Accept** / **Decline**.
- Else:
  - Show **Connect**.
  - Show **Follow** (optional).

## Connections API

### Send connection request

- `POST /api/users/:id/connect`

Returns `connection` (status `pending`).

### Accept connection request

- `POST /api/users/:id/connect/accept`

Notes:
- This accepts a *pending* request where `:id` is the requester.
- On accept, backend **auto-follows both ways**.

### Decline connection request

- `POST /api/users/:id/connect/decline`

### Cancel outgoing request OR remove a connection

- `DELETE /api/users/:id/connect`

Behavior:
- If there is a pending request and you are the requester → cancels it.
- If connected → removes the connection.

### List my connections

- `GET /api/users/me/connections?status=connected`
- `GET /api/users/me/connections?status=pending`

### List incoming / outgoing requests

- `GET /api/users/me/connection-requests/incoming`
- `GET /api/users/me/connection-requests/outgoing`

## Follows API

### Follow / Unfollow

- `POST /api/users/:id/follow`
- `DELETE /api/users/:id/follow`

### Lists

- `GET /api/users/:id/followers?limit=50&offset=0`
- `GET /api/users/:id/following?limit=50&offset=0`

## Blocks API (hard block)

### Block / Unblock

- `POST /api/users/:id/block`
- `DELETE /api/users/:id/block`

On block, backend will:
- Create the block (idempotent)
- Remove any existing connection between the two users
- Remove follow relations in both directions

### List my blocked users

- `GET /api/users/me/blocks?limit=50&offset=0`

## Error handling expectations

Common responses:

- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: blocked relationship prevents viewing/action
- `404 Not Found`: target user doesn’t exist or no pending request found
- `400 Bad Request`: invalid state (already connected, request already sent, etc.)

