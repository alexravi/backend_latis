# Username/Handle Feature - Frontend Integration Guide

## Overview

The username feature allows users to have a unique identifier (e.g., `@johndoe`) for profile URLs and mentions. Usernames are **optional** and will be **auto-generated** if not provided during signup or profile creation.

## Features

- ✅ Unique username per user
- ✅ Auto-generated if not provided (during signup or profile creation/update)
- ✅ Username availability checking (helper endpoint)
- ✅ Profile lookup by username or ID
- ✅ Username management via Complete Profile API
- ✅ Format validation (3-30 chars, alphanumeric + underscores/hyphens)

## Primary Integration: Complete Profile API

**Username is integrated into the Complete Profile API** - no separate endpoints needed for most use cases. Use the existing profile endpoints:

- **Set username during profile creation**: `POST /api/users/me/profile/complete`
- **Update username**: `PUT /api/users/me/profile/complete` or `PUT /api/users/me`

Username will be **auto-generated** if not provided, ensuring all users have one.

---

## Primary Endpoints (Complete Profile API)

### 1. Create Profile with Username

**Endpoint:** `POST /api/users/me/profile/complete`

**Description:** Create complete profile including username. Username is optional - will be auto-generated if not provided.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "user": {
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe"  // Optional - auto-generated if missing
  },
  // ... other profile data
}
```

**Response:**
```json
{
  "success": true,
  "profile_id": 1,
  "user_id": 1,
  "completion_percentage": 85
}
```

**Note:** If `username` is not provided in the `user` object, one will be automatically generated based on the user's name.

---

### 2. Update Username via Profile

**Endpoint:** `PUT /api/users/me/profile/complete`

**Description:** Update your profile including username.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "user": {
    "username": "newusername"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

**Note:** If you don't have a username yet and don't provide one, it will be auto-generated.

---

## Helper Endpoints

### 3. Check Username Availability

**Endpoint:** `GET /api/users/username/:username/available`

**Description:** Check if a username is available before signup or update.

**Authentication:** Optional (if authenticated, excludes current user from check)

**Parameters:**
- `username` (path parameter): The username to check

**Response:**
```json
{
  "success": true,
  "available": true,
  "username": "johndoe",
  "message": "Username is available"
}
```

**Error Responses:**
```json
{
  "success": false,
  "available": false,
  "message": "Invalid username format"
}
```

**Example:**
```javascript
// Check if username is available
const checkUsername = async (username) => {
  try {
    const response = await fetch(`/api/users/username/${username}/available`);
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
};
```

---

### 4. Sign Up with Username (Optional)

**Endpoint:** `POST /api/auth/signup`

**Description:** Register a new user. Username is optional - will be auto-generated if not provided.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe"  // Optional - will be auto-generated if not provided
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",  // Auto-generated if not provided
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Note:** Username can be set later via the Complete Profile API if not provided during signup.

---

### 5. Get User Profile by Username or ID

**Endpoint:** `GET /api/users/:id`

**Description:** Get user profile by numeric ID or username.

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (path parameter): Can be numeric ID (e.g., `123`) or username (e.g., `johndoe`)

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "headline": "Software Developer",
    "profile_image_url": "https://...",
    // ... other profile fields
  }
}
```

**Example:**
```javascript
// Get profile by username
const getUserProfile = async (identifier) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/users/${identifier}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  return data;
};

// Usage:
const profile = await getUserProfile('johndoe'); // By username
const profile2 = await getUserProfile('123');    // By ID
```

---

### 6. Update Username (Alternative Method)

**Endpoint:** `PUT /api/users/me`

**Description:** Update your basic profile including username. Alternative to Complete Profile API for simple updates.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "username": "newusername",
  "headline": "Updated headline",
  // ... other profile fields
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "username": "newusername",
    // ... updated user fields
  }
}
```

**Note:** For comprehensive profile updates, use `PUT /api/users/me/profile/complete` instead.

---

## Frontend Implementation Guide

### 1. Create Profile with Username (Recommended)

```jsx
import React, { useState } from 'react';

const CreateProfileForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',  // Optional
    headline: '',
    // ... other fields
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    const response = await fetch('/api/users/me/profile/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        user: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          username: formData.username || null,  // Optional - auto-generated if null
          headline: formData.headline,
        },
        // ... other profile sections
      }),
    });

    const data = await response.json();
    if (data.success) {
      // Profile created with username
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <input
        type="text"
        placeholder="Username (optional - will be auto-generated)"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
      />
      <button type="submit">Create Profile</button>
    </form>
  );
};
```

---

### 2. Signup Form with Username (Optional)

```jsx
import React, { useState } from 'react';

const SignupForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    username: '',
  });
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(`/api/users/username/${username}/available`);
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(false);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounced username check
  const handleUsernameChange = (e) => {
    const username = e.target.value;
    setFormData({ ...formData, username });
    
    // Debounce the API call
    clearTimeout(window.usernameCheckTimeout);
    window.usernameCheckTimeout = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Don't submit if username is invalid
    if (formData.username && usernameAvailable === false) {
      alert('Username is not available');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          username: formData.username || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        // Redirect to dashboard
      }
    } catch (error) {
      console.error('Signup error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      
      <input
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
      />
      
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
        required
      />
      
      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
        required
      />
      
      <div>
        <input
          type="text"
          placeholder="Username (optional)"
          value={formData.username}
          onChange={handleUsernameChange}
          pattern="^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$"
          minLength={3}
          maxLength={30}
        />
        {checkingUsername && <span>Checking...</span>}
        {usernameAvailable === true && <span style={{color: 'green'}}>✓ Available</span>}
        {usernameAvailable === false && <span style={{color: 'red'}}>✗ Not available</span>}
        {formData.username && formData.username.length < 3 && (
          <span style={{color: 'orange'}}>Minimum 3 characters</span>
        )}
      </div>
      
      <button type="submit">Sign Up</button>
    </form>
  );
};

export default SignupForm;
```

---

### 2. Profile Page by Username

```jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const UserProfile = () => {
  const { usernameOrId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${usernameOrId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const data = await response.json();
        if (data.success) {
          setProfile(data.user);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [usernameOrId]);

  if (loading) return <div>Loading...</div>;
  if (!profile) return <div>User not found</div>;

  return (
    <div>
      <h1>@{profile.username}</h1>
      <h2>{profile.first_name} {profile.last_name}</h2>
      <p>{profile.headline}</p>
      {/* Rest of profile */}
    </div>
  );
};

export default UserProfile;
```


---

## Username Validation Rules

When implementing the frontend, validate usernames according to these rules:

1. **Length:** 3-30 characters
2. **Format:** Alphanumeric characters, underscores, and hyphens only
3. **Start/End:** Must start and end with a letter or number
4. **Case:** Usernames are case-insensitive (stored in lowercase)
5. **Reserved:** Cannot use reserved words (admin, api, www, etc.)

**Regex Pattern:**
```javascript
const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
```

**Validation Function:**
```javascript
const validateUsername = (username) => {
  if (!username) return { valid: false, error: 'Username is required' };
  if (username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (username.length > 30) return { valid: false, error: 'Username must be at most 30 characters' };
  
  const pattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (!pattern.test(username)) {
    return { 
      valid: false, 
      error: 'Username can only contain letters, numbers, underscores, and hyphens' 
    };
  }
  
  return { valid: true };
};
```

---

## Routing Examples

### React Router

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/users/:usernameOrId" element={<UserProfile />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Next.js

```jsx
// pages/users/[usernameOrId].js
import { useRouter } from 'next/router';

export default function UserProfile() {
  const router = useRouter();
  const { usernameOrId } = router.query;
  
  // Fetch profile using usernameOrId
  // ...
}
```

---

## Best Practices

1. **Debounce username checks** - Don't check on every keystroke, wait 300-500ms
2. **Show real-time feedback** - Display availability status as user types
3. **Handle errors gracefully** - Network errors shouldn't block signup
4. **Store username in state** - Display username in user profile/header
5. **URL-friendly** - Use usernames in profile URLs: `/users/@johndoe` or `/users/johndoe`
6. **Auto-generate hint** - Let users know username is optional and will be auto-generated

---

## Example User Flow

1. **Signup:**
   - User enters email, password, name
   - Optionally enters username
   - Frontend checks availability in real-time
   - If username not provided, backend auto-generates one

2. **Profile Creation:**
   - User completes profile via `POST /api/users/me/profile/complete`
   - Can include username in `user` object (optional)
   - If username not provided, backend auto-generates one automatically
   - Username is always available after profile creation

3. **Profile Access:**
   - User can access profile via `/users/johndoe` or `/users/123`
   - Backend handles both formats automatically

4. **Update Username:**
   - User updates profile via `PUT /api/users/me/profile/complete` or `PUT /api/users/me`
   - Include `username` in the `user` object
   - Backend validates and updates
   - If no username exists and none provided, auto-generates one

---

## Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response?.status === 409) {
    return 'Username is already taken';
  }
  if (error.response?.status === 400) {
    return error.response.data.message || 'Invalid username format';
  }
  return 'An error occurred. Please try again.';
};
```

---

## Testing Checklist

- [ ] Signup with username works
- [ ] Signup without username auto-generates one
- [ ] Username availability check works
- [ ] Profile accessible by username
- [ ] Profile accessible by ID
- [ ] Username update works
- [ ] Duplicate username is rejected
- [ ] Invalid format is rejected
- [ ] Reserved words are rejected

---

## Notes

- Usernames are stored in lowercase in the database
- Usernames are case-insensitive for lookups
- Auto-generated usernames follow pattern: `firstname_lastname_id` or variations
- Username is **always auto-generated** if missing during profile creation or update
- Use Complete Profile API (`POST/PUT /api/users/me/profile/complete`) to manage username
- Username availability check endpoint is optional helper for frontend validation
