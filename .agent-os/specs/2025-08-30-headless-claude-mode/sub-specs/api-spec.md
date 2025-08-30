# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-30-headless-claude-mode/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Endpoints

### POST /api/headless/sessions
Creates a new headless Claude session.

**Headers:**
- `Authorization: Bearer {TERMINAL_KEY}` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "cols": 80,
  "rows": 24,
  "meta": {
    "name": "Claude Analysis Session",
    "description": "Headless session for automated analysis"
  }
}
```

**Response (201 Created):**
```json
{
  "sessionId": "uuid-v4-string",
  "status": "active",
  "mode": "claude",
  "createdAt": "2025-08-30T16:45:00.000Z",
  "meta": {
    "name": "Claude Analysis Session",
    "description": "Headless session for automated analysis"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Session creation failed

### POST /api/headless/sessions/:sessionId/input
Sends input to a headless Claude session.

**Headers:**
- `Authorization: Bearer {TERMINAL_KEY}` (required)
- `Content-Type: application/json`

**Parameters:**
- `sessionId` (path): UUID of the session

**Request Body:**
```json
{
  "input": "analyze this codebase\n",
  "timeout": 30000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "inputId": "uuid-v4-string",
  "timestamp": "2025-08-30T16:45:30.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Session not found
- `400 Bad Request`: Invalid input or session not in Claude mode
- `409 Conflict`: Session is not ready for input
- `500 Internal Server Error`: Failed to send input

### GET /api/headless/sessions/:sessionId/output
Retrieves output from a headless Claude session since last poll.

**Headers:**
- `Authorization: Bearer {TERMINAL_KEY}` (required)

**Parameters:**
- `sessionId` (path): UUID of the session

**Query Parameters:**
- `since` (optional): Timestamp to get output since (ISO 8601 format)
- `includeMetadata` (optional): Include output metadata (default: false)

**Response (200 OK):**
```json
{
  "output": [
    {
      "data": "I'll analyze your codebase...\n",
      "timestamp": "2025-08-30T16:45:31.000Z",
      "type": "stdout"
    },
    {
      "data": "Based on the files I can see...\n",
      "timestamp": "2025-08-30T16:45:35.000Z",
      "type": "stdout"
    }
  ],
  "hasMore": false,
  "lastTimestamp": "2025-08-30T16:45:35.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Session not found
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Failed to retrieve output

### GET /api/headless/sessions/:sessionId/status
Gets the current status of a headless Claude session.

**Headers:**
- `Authorization: Bearer {TERMINAL_KEY}` (required)

**Parameters:**
- `sessionId` (path): UUID of the session

**Response (200 OK):**
```json
{
  "sessionId": "uuid-v4-string",
  "status": "active",
  "mode": "claude",
  "createdAt": "2025-08-30T16:45:00.000Z",
  "lastActivity": "2025-08-30T16:45:35.000Z",
  "isProcessing": false,
  "meta": {
    "name": "Claude Analysis Session",
    "description": "Headless session for automated analysis"
  },
  "stats": {
    "inputsSent": 1,
    "outputLines": 15,
    "uptime": 35000
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Failed to get session status

### DELETE /api/headless/sessions/:sessionId
Terminates a headless Claude session.

**Headers:**
- `Authorization: Bearer {TERMINAL_KEY}` (required)

**Parameters:**
- `sessionId` (path): UUID of the session

**Response (200 OK):**
```json
{
  "success": true,
  "sessionId": "uuid-v4-string",
  "terminatedAt": "2025-08-30T16:50:00.000Z"
}
```

**Response (204 No Content):**
Session was already terminated or didn't exist.

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `500 Internal Server Error`: Failed to terminate session

### GET /api/headless/sessions
Lists all headless Claude sessions.

**Headers:**
- `Authorization: Bearer {TERMINAL_KEY}` (required)

**Query Parameters:**
- `mode` (optional): Filter by session mode (`claude`, `bash`)
- `status` (optional): Filter by status (`active`, `ended`)

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "sessionId": "uuid-v4-string",
      "status": "active",
      "mode": "claude",
      "createdAt": "2025-08-30T16:45:00.000Z",
      "lastActivity": "2025-08-30T16:45:35.000Z",
      "meta": {
        "name": "Claude Analysis Session"
      }
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `500 Internal Server Error`: Failed to list sessions

## Controllers

### HeadlessController
Main controller for handling headless API requests.

**Location:** `src/lib/server/headless-controller.js`

**Methods:**
- `createSession(req, res)` - Handle session creation
- `sendInput(req, res)` - Handle input submission
- `getOutput(req, res)` - Handle output retrieval
- `getStatus(req, res)` - Handle status requests
- `terminateSession(req, res)` - Handle session termination
- `listSessions(req, res)` - Handle session listing

**Dependencies:**
- `TerminalManager` - For PTY session management
- `SessionStore` - For session metadata persistence
- `OutputBuffer` - For buffering and retrieving session output

### OutputBuffer Service
Manages output buffering for headless sessions.

**Location:** `src/lib/server/output-buffer.js`

**Methods:**
- `addOutput(sessionId, data, type)` - Buffer output data
- `getOutputSince(sessionId, timestamp)` - Retrieve output since timestamp
- `clearBuffer(sessionId)` - Clear session output buffer
- `getLastTimestamp(sessionId)` - Get latest output timestamp

### Authentication Middleware
Handles API authentication for headless endpoints.

**Location:** `src/lib/server/auth-middleware.js`

**Methods:**
- `authenticateRequest(req, res, next)` - Validate TERMINAL_KEY
- `extractBearerToken(req)` - Extract token from Authorization header

## Integration with Existing System

### Socket.IO Compatibility
The REST API integrates with the existing Socket.IO system by:
- Using the same `TerminalManager` for session lifecycle
- Sharing session metadata through `SessionStore`
- Broadcasting session updates to Socket.IO clients
- Maintaining session isolation and security model

### Session Management
- REST API sessions use same UUID format as Socket.IO sessions
- Sessions created via REST API appear in Socket.IO session lists
- Both interfaces can terminate sessions created by the other
- Session metadata is shared between both interfaces

### Output Handling
- REST API uses buffered output collection
- Socket.IO continues to stream output in real-time
- Output buffer maintains chronological order with timestamps
- Buffer automatically clears on session termination

### Error Handling Patterns
- Consistent error response format across all endpoints
- HTTP status codes follow REST conventions
- Error messages include actionable details when possible
- Authentication errors are handled uniformly

### Rate Limiting Considerations
- Input endpoint should implement rate limiting to prevent abuse
- Output polling should have reasonable frequency limits
- Session creation should be throttled per client
- Consider implementing request queuing for high-frequency polling