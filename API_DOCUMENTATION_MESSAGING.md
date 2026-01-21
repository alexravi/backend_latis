# Messaging API Documentation (Frontend Guide)

This document explains how the frontend should use the messaging APIs to build a complete messaging system.

## Authentication

All endpoints require JWT authentication:
- Header: `Authorization: Bearer <token>`

## Base URL

```
Development: http://localhost:3000
Production: https://api.latis.in
```

## API Endpoints

### Conversations

#### List All Conversations
```
GET /api/messages/conversations
```

Get all conversations for the current user, sorted by last message time.

**Query Parameters:**
- `limit` (optional, default: 50) - Number of conversations to return
- `offset` (optional, default: 0) - Number of conversations to skip

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "participant1_id": 1,
      "participant2_id": 2,
      "other_user_id": 2,
      "other_user_first_name": "Jane",
      "other_user_last_name": "Smith",
      "other_user_profile_image": "https://...",
      "unread_count": 3,
      "last_message_at": "2024-01-20T10:30:00Z",
      "last_message_content": "Hello there!",
      "last_message_sender_id": 2,
      "other_user": {
        "id": 2,
        "first_name": "Jane",
        "last_name": "Smith",
        "profile_image_url": "https://...",
        "headline": "Software Engineer",
        "is_online": true,
        "last_seen_at": "2024-01-20T10:35:00Z"
      },
      "created_at": "2024-01-15T08:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

**Frontend Usage:**
- Display conversations list with unread badges
- Show last message preview
- Show online status indicator
- Sort by `last_message_at` DESC (already sorted by backend)

---

#### Get Conversation Details
```
GET /api/messages/conversations/:id
```

Get detailed information about a specific conversation.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "participant1_id": 1,
    "participant2_id": 2,
    "unread_count": 3,
    "other_participant": {
      "id": 2,
      "first_name": "Jane",
      "last_name": "Smith",
      "profile_image_url": "https://...",
      "headline": "Software Engineer",
      "is_online": true,
      "last_seen_at": "2024-01-20T10:35:00Z"
    },
    "created_at": "2024-01-15T08:00:00Z"
  }
}
```

**Frontend Usage:**
- Display conversation header with participant info
- Show online status in header
- Update unread count badge

---

#### Create/Start Conversation
```
POST /api/messages/conversations
```

Create a new conversation or return existing one with the specified user.

**Request Body:**
```json
{
  "recipient_id": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "participant1_id": 1,
    "participant2_id": 2,
    "created_at": "2024-01-15T08:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Cannot message this user (blocked or connection required)
- `400` - Invalid recipient ID

**Frontend Usage:**
- Use when user clicks "Message" button on a profile
- Navigate to conversation after creation
- Handle blocked user errors gracefully

---

#### Delete Conversation
```
DELETE /api/messages/conversations/:id
```

Soft delete a conversation (conversation persists for other user).

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

**Frontend Usage:**
- Remove from conversations list after delete
- Optionally show undo option
- Keep conversation in backend (soft delete)

---

### Messages

#### Get Messages in Conversation
```
GET /api/messages/conversations/:id/messages
```

Get messages from a conversation with pagination.

**Query Parameters:**
- `limit` (optional, default: 50) - Number of messages to return
- `offset` (optional, default: 0) - Number of messages to skip

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "conversation_id": 5,
      "sender_id": 2,
      "content": "Hello! How are you?",
      "is_read": true,
      "read_at": "2024-01-20T10:31:00Z",
      "delivered_at": "2024-01-20T10:30:05Z",
      "delivery_status": "read",
      "created_at": "2024-01-20T10:30:00Z",
      "first_name": "Jane",
      "last_name": "Smith",
      "profile_image_url": "https://..."
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

**Frontend Usage:**
- Load messages in chat view
- Implement infinite scroll with offset pagination
- Show sender info (avatar, name) for each message
- Display delivery status indicators (sent ✓, delivered ✓✓, read ✓✓)
- Handle deleted messages (check `deleted_at` field)

---

#### Send Message
```
POST /api/messages/conversations/:id/messages
```

Send a new message in a conversation. Real-time event emitted to participants.

**Request Body:**
```json
{
  "content": "Hello, how are you?",
  "attachment_url": "https://...",  // Optional
  "attachment_type": "image",        // Optional: image, document, video, audio
  "attachment_name": "photo.jpg"     // Optional
}
```

**Alternative: Send Message (Create conversation if needed)**
```
POST /api/messages
```

**Request Body:**
```json
{
  "recipient_id": 2,  // Required if no conversation_id
  "conversation_id": 5,  // Optional
  "content": "Hello!",
  "attachment_url": "https://...",  // Optional
  "attachment_type": "image",
  "attachment_name": "photo.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": 11,
    "conversation_id": 5,
    "sender_id": 1,
    "content": "Hello, how are you?",
    "delivery_status": "sent",
    "created_at": "2024-01-20T10:35:00Z",
    "first_name": "John",
    "last_name": "Doe",
    "profile_image_url": "https://..."
  }
}
```

**Frontend Usage:**
- Send text messages and attachments
- Show message immediately in UI (optimistic update)
- Listen for real-time events via WebSocket
- Update delivery status when events received
- Handle errors (blocked, connection required, etc.)

---

#### Forward Message
```
POST /api/messages/:id/forward
```

Forward a message from one conversation to another.

**Request Body:**
```json
{
  "recipient_id": 3,  // Required if no conversation_id
  "conversation_id": 7,  // Optional
  "content": "Check this out!"  // Optional custom message
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message forwarded successfully",
  "data": {
    "id": 12,
    "conversation_id": 7,
    "sender_id": 1,
    "content": "Check this out!",
    "forwarded_from_message_id": 10,
    "original_sender": {
      "id": 2,
      "first_name": "Jane",
      "last_name": "Smith"
    },
    "created_at": "2024-01-20T10:40:00Z"
  }
}
```

**Frontend Usage:**
- Allow forwarding messages to other conversations
- Show "Forwarded from [Original Sender]" indicator
- Include optional message when forwarding

---

#### Edit Message
```
PUT /api/messages/:id
```

Edit a message (only within 15 minutes of sending).

**Request Body:**
```json
{
  "content": "Updated message content"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message updated successfully",
  "data": {
    "id": 11,
    "content": "Updated message content",
    "edited_at": "2024-01-20T10:36:00Z",
    ...
  }
}
```

**Error Responses:**
- `400` - Edit time limit exceeded (15 minutes)
- `403` - Not the sender of this message

**Frontend Usage:**
- Show edit button only for own messages within 15 minutes
- Display "edited" indicator next to edited messages
- Update message in UI after edit

---

#### Delete Message
```
DELETE /api/messages/:id
```

Soft delete a message (only sender can delete).

**Response:**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Frontend Usage:**
- Remove message from UI (show "Message deleted" placeholder)
- Allow undo for short period
- Real-time event updates for other participant

---

#### Mark Conversation as Read
```
PUT /api/messages/conversations/:id/read
```

Mark all messages in a conversation as read.

**Response:**
```json
{
  "success": true,
  "message": "Conversation marked as read"
}
```

**Frontend Usage:**
- Call when user opens conversation
- Clear unread badge
- Emit read receipt to sender

---

#### Search Messages
```
GET /api/messages/search
```

Search messages across all user's conversations.

**Query Parameters:**
- `q` (required) - Search query
- `conversation_id` (optional) - Filter by conversation ID
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "conversation_id": 5,
      "content": "Hello, how are you?",
      "created_at": "2024-01-20T10:30:00Z",
      "first_name": "Jane",
      "last_name": "Smith",
      ...
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

**Frontend Usage:**
- Implement search bar in messages view
- Highlight search terms in results
- Show conversation context for each result

---

#### Get Unread Count
```
GET /api/messages/unread-count
```

Get total number of unread messages across all conversations.

**Response:**
```json
{
  "success": true,
  "data": {
    "unread_count": 5
  }
}
```

**Frontend Usage:**
- Display total unread count in app badge
- Update real-time via WebSocket events

---

### Message Reactions

#### Add Reaction
```
POST /api/messages/:id/reactions
```

Add an emoji reaction to a message.

**Request Body:**
```json
{
  "reaction_type": "👍"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reaction added successfully",
  "data": {
    "message_id": 10,
    "reaction_type": "👍",
    "reactions": [
      {
        "reaction_type": "👍",
        "count": 3,
        "users": [...]
      }
    ]
  }
}
```

**Frontend Usage:**
- Show reaction picker on message long-press/hover
- Display reactions below messages
- Update reaction counts in real-time

---

#### Remove Reaction
```
DELETE /api/messages/:id/reactions/:type
```

Remove an emoji reaction from a message.

**Response:**
```json
{
  "success": true,
  "message": "Reaction removed successfully",
  "data": {
    "message_id": 10,
    "reaction_type": "👍",
    "reactions": [...]
  }
}
```

**Frontend Usage:**
- Allow removing own reactions
- Update UI when reaction removed

---

#### Get Message Reactions
```
GET /api/messages/:id/reactions
```

Get all reactions for a message.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "reaction_type": "👍",
      "count": 3,
      "users": [
        {
          "user_id": 1,
          "first_name": "John",
          "last_name": "Doe",
          "profile_image_url": "https://..."
        }
      ]
    }
  ]
}
```

---

### User Status

#### Get User Online Status
```
GET /api/users/:id/status
```

Get online status and last seen timestamp for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 2,
    "is_online": true,
    "last_seen_at": "2024-01-20T10:35:00Z",
    "updated_at": "2024-01-20T10:35:00Z"
  }
}
```

**Frontend Usage:**
- Show online/offline indicator in chat header
- Display "Last seen" timestamp when offline

---

#### Update Own Status
```
PUT /api/users/me/status
```

Manually update your online status (usually handled automatically).

**Request Body:**
```json
{
  "is_online": true
}
```

---

## WebSocket Events

### Connection Setup

Connect to WebSocket server and authenticate:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Join Conversation Room

```javascript
socket.emit('conversation:join', conversationId);
```

### Leave Conversation Room

```javascript
socket.emit('conversation:leave', conversationId);
```

### Client → Server Events

#### Send Message (Alternative to REST API)
```javascript
socket.emit('message:send', {
  conversation_id: 5,
  content: "Hello!",
  attachment_url: "https://..."  // Optional
});
```

#### Typing Indicator - Start
```javascript
socket.emit('message:typing:start', {
  conversation_id: 5
});
```

#### Typing Indicator - Stop
```javascript
socket.emit('message:typing:stop', {
  conversation_id: 5
});
```

#### Message Delivery Confirmation
```javascript
socket.emit('message:delivered', {
  message_id: 10
});
```

**Frontend Usage:**
- Emit delivery confirmation when message is displayed on recipient's device
- Update message delivery status in UI

---

### Server → Client Events

#### New Message
```javascript
socket.on('message:new', (data) => {
  // data.message - Message object
  // data.conversation_id - Conversation ID
  // data.forwarded - Boolean (if forwarded)
  // data.original_sender - Object (if forwarded)
  
  // Add message to conversation
  // Update last message in conversations list
  // Show notification if conversation not open
});
```

#### Message Updated
```javascript
socket.on('message:updated', (data) => {
  // data.message - Updated message object
  // Update message in UI
  // Show "edited" indicator
});
```

#### Message Deleted
```javascript
socket.on('message:deleted', (data) => {
  // data.message_id
  // data.conversation_id
  // Remove or mark as deleted in UI
});
```

#### Message Delivered
```javascript
socket.on('message:delivered', (data) => {
  // data.message_id
  // data.conversation_id
  // data.delivered_at
  // Update delivery status to "delivered" (✓✓)
});
```

#### Message Read Receipt
```javascript
socket.on('conversation:read', (data) => {
  // data.conversation_id
  // data.read_by - User ID who read
  // Update delivery status to "read" (✓✓)
});
```

#### Typing Status
```javascript
socket.on('typing:status', (data) => {
  // data.conversation_id
  // data.user_id
  // data.typing - Boolean
  // Show/hide typing indicator
});
```

#### Message Reaction Added/Removed
```javascript
socket.on('message:reaction:added', (data) => {
  // data.message_id
  // data.user_id
  // data.reaction_type
  // data.reactions - All reactions
  // Update reaction UI
});

socket.on('message:reaction:removed', (data) => {
  // Similar structure
});
```

#### User Online/Offline
```javascript
socket.on('user:online', (data) => {
  // data.user_id
  // data.timestamp
  // Update online indicator in conversations
});

socket.on('user:offline', (data) => {
  // data.user_id
  // data.timestamp
  // Update offline status, show last seen
});
```

#### New Notification
```javascript
socket.on('notification:new', (data) => {
  // Show push notification
  // Update notification badge
});
```

---

## Frontend Implementation Guide

### 1. Conversations List

**Features:**
- Display all conversations sorted by last message
- Show unread count badge
- Show last message preview
- Show online status indicator
- Real-time updates when new messages arrive

**Implementation:**
```javascript
// Fetch conversations
const conversations = await fetch('/api/messages/conversations', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Listen for new messages
socket.on('message:new', (data) => {
  // Update conversation in list
  // Move to top
  // Update unread count
});
```

### 2. Chat View

**Features:**
- Display messages with sender info
- Show delivery status (sent/delivered/read)
- Show typing indicators
- Show online status in header
- Load more messages (infinite scroll)
- Send messages (text + attachments)
- Edit/delete own messages
- React to messages
- Forward messages

**Implementation:**
```javascript
// Join conversation room
socket.emit('conversation:join', conversationId);

// Load messages
const messages = await fetch(
  `/api/messages/conversations/${conversationId}/messages?limit=50`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

// Send message
const response = await fetch(
  `/api/messages/conversations/${conversationId}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: 'Hello!' })
  }
);

// Mark as read
await fetch(
  `/api/messages/conversations/${conversationId}/read`,
  {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

### 3. Typing Indicators

**Implementation:**
```javascript
let typingTimeout;

input.addEventListener('input', () => {
  // Clear existing timeout
  clearTimeout(typingTimeout);
  
  // Emit typing start
  socket.emit('message:typing:start', { conversation_id });
  
  // Stop typing after 3 seconds of inactivity
  typingTimeout = setTimeout(() => {
    socket.emit('message:typing:stop', { conversation_id });
  }, 3000);
});

// Listen for typing status
socket.on('typing:status', (data) => {
  if (data.typing) {
    showTypingIndicator(data.user_id);
  } else {
    hideTypingIndicator(data.user_id);
  }
});
```

### 4. Delivery Status Tracking

**Implementation:**
```javascript
// When message is displayed on recipient's device
socket.emit('message:delivered', { message_id: message.id });

// Listen for delivery confirmations (as sender)
socket.on('message:delivered', (data) => {
  updateMessageStatus(data.message_id, 'delivered');
});

// Listen for read receipts
socket.on('conversation:read', (data) => {
  if (data.conversation_id === currentConversationId) {
    updateAllMessageStatuses('read');
  }
});
```

### 5. Online Status Display

**Implementation:**
```javascript
// Get user status
const status = await fetch(
  `/api/users/${userId}/status`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

// Listen for status changes
socket.on('user:online', (data) => {
  if (data.user_id === conversationPartnerId) {
    updateOnlineStatus(true);
  }
});

socket.on('user:offline', (data) => {
  if (data.user_id === conversationPartnerId) {
    updateOnlineStatus(false);
  }
});
```

### 6. Message Reactions

**Implementation:**
```javascript
// Add reaction
await fetch(
  `/api/messages/${messageId}/reactions`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reaction_type: '👍' })
  }
);

// Listen for reaction updates
socket.on('message:reaction:added', (data) => {
  updateMessageReactions(data.message_id, data.reactions);
});
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```
- Solution: Re-authenticate user

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Cannot send message to this user"
}
```
- User is blocked
- Connection required but not connected

**404 Not Found:**
```json
{
  "success": false,
  "message": "Conversation not found"
}
```
- Conversation doesn't exist or user doesn't have access

**400 Bad Request:**
```json
{
  "success": false,
  "errors": [
    {
      "msg": "Content is required",
      "param": "content"
    }
  ]
}
```
- Validation errors

---

## Best Practices

1. **Real-time Updates**: Always use WebSocket events for instant updates
2. **Optimistic Updates**: Show sent messages immediately, update on confirmation
3. **Error Handling**: Handle all error cases gracefully
4. **Pagination**: Use limit/offset for messages list (infinite scroll)
5. **Delivery Confirmations**: Emit delivery confirmation when message displayed
6. **Typing Indicators**: Use debouncing (3s timeout) to avoid excessive events
7. **Connection Management**: Join conversation room when chat opens, leave when closed
8. **Status Updates**: Update online status when user goes offline/online
9. **Read Receipts**: Mark conversation as read when user opens chat
10. **Caching**: Cache conversations list, update via WebSocket events

---

## Rate Limiting

- Message sending is rate-limited (check rate limit headers)
- Typing indicators should be debounced client-side
- Status updates are handled server-side with throttling

---

## Environment Variables

**Backend Configuration:**
- `REQUIRE_CONNECTION_FOR_MESSAGING` - Set to `true` to require connections before messaging (default: `false`)
- `WS_ENABLED` - Set to `false` to disable WebSocket (default: `true`)

---

## Testing

Use the Swagger UI at `/api-docs` to test endpoints interactively.

For WebSocket testing, use a WebSocket client or browser console:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('conversation:join', 5);
});
```

---

## Support

For issues or questions, contact the backend team or refer to the Swagger documentation at `/api-docs`.
