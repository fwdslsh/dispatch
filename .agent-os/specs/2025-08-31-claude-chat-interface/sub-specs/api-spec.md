# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-31-claude-chat-interface/spec.md

## Endpoints

### GET /auth/claude/status
**Purpose:** Check if user is logged in to Claude.ai through Claude CLI
**Parameters:** None
**Response:** 
```json
{
  "isAuthenticated": true,
  "user": {
    "email": "user@example.com",
    "accountType": "claude.ai"
  }
}
```
**Errors:** 
- 401: User not logged in to Claude CLI
- 500: Authentication check failed

### POST /auth/claude/login
**Purpose:** Initiate Claude.ai login process through terminal
**Parameters:** None
**Response:**
```json
{
  "message": "Please use the /login command in your terminal to authenticate with Claude.ai",
  "loginCommand": "/login"
}
```
**Errors:**
- 500: Unable to initiate login process

### POST /api/sessions/[id]/chat/query
**Purpose:** Send a query to Claude Code through the SDK
**Parameters:**
- `sessionId` (path): Terminal session identifier
- Request body:
  ```json
  {
    "message": "string",
    "attachments": ["array of image URLs"],
    "settings": {
      "allowedTools": ["array of tool names"],
      "permissionMode": "auto|confirm|deny",
      "systemPrompt": "string"
    }
  }
  ```
**Response:**
  ```json
  {
    "id": "message-id",
    "response": "Claude's response text",
    "metadata": {
      "model": "model-name",
      "tokensUsed": 1234,
      "timestamp": "ISO-8601"
    }
  }
  ```
**Errors:**
- 401: Unauthorized (missing/invalid auth)
- 429: Rate limit exceeded
- 500: SDK query failure

### GET /api/sessions/[id]/chat/history
**Purpose:** Retrieve chat history for a session
**Parameters:**
- `sessionId` (path): Terminal session identifier
- `limit` (query): Number of messages to retrieve (default: 50)
- `offset` (query): Pagination offset (default: 0)
**Response:**
  ```json
  {
    "messages": [
      {
        "id": "msg-id",
        "role": "user|assistant",
        "content": "message content",
        "timestamp": "ISO-8601"
      }
    ],
    "total": 100,
    "hasMore": true
  }
  ```
**Errors:**
- 401: Unauthorized
- 404: Session not found

### GET /api/chat/commands
**Purpose:** Retrieve available Claude Code commands
**Parameters:** None
**Response:**
  ```json
  {
    "commands": [
      {
        "name": "/help",
        "description": "Show help information",
        "category": "system",
        "shortcut": "cmd+h"
      }
    ]
  }
  ```
**Errors:**
- 500: Failed to retrieve commands

### PUT /api/sessions/[id]/chat/settings
**Purpose:** Update chat settings for a session
**Parameters:**
- `sessionId` (path): Terminal session identifier
- Request body:
  ```json
  {
    "allowedTools": ["array of tool names"],
    "permissionMode": "auto|confirm|deny",
    "systemPrompt": "string",
    "model": "model-identifier",
    "mcpServers": {}
  }
  ```
**Response:**
  ```json
  {
    "success": true,
    "settings": { /* updated settings object */ }
  }
  ```
**Errors:**
- 400: Invalid settings format
- 401: Unauthorized
- 404: Session not found


## Socket.IO Events

### Client to Server

#### claude:query
**Purpose:** Send a query to Claude Code via WebSocket
**Payload:**
```javascript
{
  sessionId: "string",
  message: "string",
  settings: { /* optional settings override */ }
}
```

#### claude:cancel
**Purpose:** Cancel an in-progress Claude Code query
**Payload:**
```javascript
{
  sessionId: "string",
  queryId: "string"
}
```

### Server to Client

#### claude:typing
**Purpose:** Indicate Claude is processing a request
**Payload:**
```javascript
{
  sessionId: "string",
  isTyping: true
}
```

#### claude:response
**Purpose:** Deliver Claude's response to the client
**Payload:**
```javascript
{
  sessionId: "string",
  message: "string",
  metadata: { /* response metadata */ }
}
```

#### claude:error
**Purpose:** Report errors during Claude Code interaction
**Payload:**
```javascript
{
  sessionId: "string",
  error: "error message",
  code: "ERROR_CODE"
}
```