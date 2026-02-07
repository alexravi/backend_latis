# Auth API – Mobile App Integration Guide

This document describes how to integrate the Latis backend **auth APIs** (sign up, sign in, sign out) from a **mobile app** (React Native, Flutter, iOS, Android, etc.).

---

## Base URL & Headers

- **Base URL:** Use your backend base URL (e.g. `https://your-api.latis.in` or `http://localhost:3000`).
- **Content-Type:** `application/json` for all auth requests.
- **Auth (protected routes):** Send the JWT in the `Authorization` header:
  - Format: `Authorization: Bearer <token>`
  - Example: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 1. Sign Up (Register)

**Endpoint:** `POST /api/auth/signup`  
**Auth required:** No  
**Rate limit:** Auth limiter applies (see server config).

### Request body (JSON)

| Field        | Type   | Required | Constraints                          | Description                    |
|-------------|--------|----------|--------------------------------------|--------------------------------|
| `email`     | string | Yes      | Valid email                          | User email                     |
| `password`  | string | Yes      | Min 6 characters                     | User password                  |
| `first_name`| string | Yes      | 1–100 characters                     | First name                     |
| `last_name` | string | Yes      | 1–100 characters                     | Last name                      |
| `username`  | string | No       | 3–30 chars, `[a-zA-Z0-9_-]`, optional | Unique username; auto-generated if omitted |

### Example request

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe"
}
```

### Success response (201 Created)

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Error responses

| Status | Body (typical) | When |
|--------|----------------|------|
| **400** | `{ "success": false, "errors": [ { "msg": "...", "param": "..." } ] }` | Validation failed (invalid email, short password, etc.) |
| **409** | `{ "success": false, "message": "User with this email already exists" }` | Email already registered |
| **409** | `{ "success": false, "message": "Username is already taken" }` | Username taken (if provided) |
| **500** | `{ "success": false, "message": "Internal server error" }` | Server error |

### Mobile integration notes (Sign Up)

- Store `token` and `user` (e.g. in secure storage) after a 201 response.
- Use `token` for all subsequent authenticated requests (see “Using the token” below).
- Optional: call a “complete profile” or onboarding API after sign up if your app uses it.

---

## 2. Sign In (Login)

**Endpoint:** `POST /api/auth/signin`  
**Auth required:** No  
**Rate limit:** Auth limiter applies.

### Request body (JSON)

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `email`    | string | Yes      | Valid email |
| `password`| string | Yes      | User password |

### Example request

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Success response (200 OK)

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

Note: Sign-in response may not include `username`; use a profile API if you need it.

### Error responses

| Status | Body (typical) | When |
|--------|----------------|------|
| **400** | `{ "success": false, "errors": [ ... ] }` | Validation failed |
| **401** | `{ "success": false, "message": "Invalid email or password" }` | Wrong credentials (same message for wrong email or password) |
| **500** | `{ "success": false, "message": "Internal server error" }` | Server error |

### Mobile integration notes (Sign In)

- On 200, store `token` and `user` in secure storage and switch app state to “logged in”.
- On 401, show a generic “Invalid email or password” message; do not reveal whether the email exists.

---

## 3. Sign Out (Logout)

**Endpoint:** `POST /api/auth/logout`  
**Auth required:** Yes (Bearer token)  
**Rate limit:** Same as other authenticated routes.

### Request headers

- `Authorization: Bearer <token>`
- `Content-Type: application/json` (body can be empty or `{}`).

### Request body

Empty object or no body: `{}` or omit.

### Success response (200 OK)

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Error responses

| Status | Body (typical) | When |
|--------|----------------|------|
| **401** | `{ "success": false, "message": "Access token is required" }` | Missing `Authorization` header |
| **401** | `{ "success": false, "message": "Token has expired" }` | JWT expired |
| **401** | `{ "success": false, "message": "Invalid token" }` | Malformed or invalid JWT |
| **401** | `{ "success": false, "message": "User not found" }` | Token valid but user no longer exists |
| **500** | `{ "success": false, "message": "Internal server error" }` | Server error |

### Mobile integration notes (Sign Out)

- **Always** clear the stored token and user on the device when the user taps “Sign out”, regardless of API response.
- Optionally call `POST /api/auth/logout` first for analytics or future server-side invalidation; if the request fails (e.g. network), still clear local token and treat the user as logged out.

---

## Using the token on protected routes

For any endpoint that requires authentication (e.g. profile, posts, logout):

1. Read the stored JWT from secure storage.
2. Add header: `Authorization: Bearer <token>`.
3. If the API returns **401** with “Token has expired” or “Invalid token”, clear the token and redirect to sign-in.

---

## Token details (for reference)

- **Type:** JWT.
- **Expiry:** Configured server-side (e.g. `JWT_EXPIRES_IN`, often `24h`). No refresh token is described in these auth endpoints; when the token expires, the user must sign in again unless your backend adds refresh flow later.

---

## CORS and mobile apps

- Mobile apps typically do not send an `Origin` header; the backend allows requests with no origin, so CORS is not an issue for native clients.
- Ensure the app uses the correct base URL (HTTPS in production).

---

## Quick reference

| Action   | Method | Endpoint             | Auth   | Body (required fields)                    |
|----------|--------|----------------------|--------|-------------------------------------------|
| Sign up  | POST   | `/api/auth/signup`   | No     | `email`, `password`, `first_name`, `last_name`; optional `username` |
| Sign in  | POST   | `/api/auth/signin`   | No     | `email`, `password`                       |
| Sign out | POST   | `/api/auth/logout`   | Bearer | (none)                                    |

---

## Optional: Google sign-in

The backend also supports **Google OAuth** via a Firebase ID token:

- **Endpoint:** `POST /api/auth/google`
- **Body:** `{ "token": "<firebase_id_token>" }`
- **Responses:** Same shape as sign in/sign up (200 or 201 with `success`, `token`, `user`).

Use this if your mobile app uses Firebase Auth (or similar) for Google sign-in and you want to sync with this backend. Integration details depend on your Firebase/Google SDK setup.

---

*Generated from the Latis backend auth routes and controllers. For full API docs (including Swagger), see `/api-docs` on your backend.*
