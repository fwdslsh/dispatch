# Socket.IO Authentication Protocol

**Feature**: 009-cookie-auth-refactor
**Date**: 2025-10-09

## Overview

This document defines the Socket.IO authentication protocol for Dispatch, supporting dual authentication via session cookies (browser clients) and API keys (programmatic clients).

## Connection Authentication

Socket.IO connections MUST authenticate via ONE of two methods:

1. **Session Cookie** (Browser Clients)
2. **API Key** (Programmatic Clients)

Connections without valid authentication are rejected with an error.

---

### Method 1: Session Cookie (Browser Clients)

**Use Case**: Web browser connections from authenticated users

**Client Configuration**:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3030', {
	transports: ['websocket', 'polling'],
	withCredentials: true // ← REQUIRED: Send cookies automatically
});
```

**Authentication Flow**:

1. **Client**: Establishes Socket.IO connection with `withCredentials: true`
2. **Client**: Browser automatically sends `dispatch_session` cookie in handshake headers
3. **Server**: Parses cookie from `socket.handshake.headers.cookie`
4. **Server**: Validates session ID against database
5. **Server**: On success:
   - Attaches `socket.data.user` (user object)
   - Attaches `socket.data.session` (session object)
   - Attaches `socket.data.authMethod = 'session_cookie'`
   - Calls `next()` to accept connection
6. **Server**: On failure:
   - Calls `next(new Error('Authentication required'))`
   - Connection rejected

**Server Middleware Implementation**:

```javascript
io.use(async (socket, next) => {
	try {
		// Parse cookies from handshake headers
		const cookies = parseCookies(socket.handshake.headers.cookie);
		const sessionId = cookies['dispatch_session'];

		if (sessionId) {
			// Validate session
			const { session, user } = await sessionManager.validateSession(sessionId);

			if (session) {
				// Attach to socket context
				socket.data.user = user;
				socket.data.session = session;
				socket.data.authMethod = 'session_cookie';
				return next(); // Accept connection
			}
		}

		// If no session cookie, try API key auth (fallthrough)
		// ... (see Method 2)

		// No valid auth found
		next(new Error('Authentication required'));
	} catch (error) {
		next(new Error('Authentication failed'));
	}
});

// Helper function to parse cookies
function parseCookies(cookieHeader) {
	if (!cookieHeader) return {};

	return cookieHeader.split(';').reduce((cookies, cookie) => {
		const [name, value] = cookie.trim().split('=');
		cookies[name] = decodeURIComponent(value);
		return cookies;
	}, {});
}
```

**Cookie Requirements**:

- Cookie name: `dispatch_session`
- Cookie value: Session ID (UUID v4)
- Attributes: `HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` (30 days)

**Error Cases**:

- Missing cookie → Falls through to API key auth
- Invalid session ID → Falls through to API key auth
- Expired session → Connection rejected, client must re-login

---

### Method 2: API Key (Programmatic Clients)

**Use Case**: Node.js scripts, CLI tools, automation pipelines

**Client Configuration**:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3030', {
	transports: ['websocket', 'polling'],
	auth: {
		token: 'dGhpc19pc19hX3NlY3JldF9hcGlfa2V5X2V4YW1wbGU' // API key
	}
});

// OR via Authorization header (alternative)
const socket = io('http://localhost:3030', {
	transports: ['websocket', 'polling'],
	extraHeaders: {
		Authorization: 'Bearer dGhpc19pc19hX3NlY3JldF9hcGlfa2V5X2V4YW1wbGU'
	}
});
```

**Authentication Flow**:

1. **Client**: Establishes Socket.IO connection with API key in `auth.token` or Authorization header
2. **Server**: Extracts API key from `socket.handshake.auth.token` or `socket.handshake.headers.authorization`
3. **Server**: Validates API key using bcrypt comparison
4. **Server**: On success:
   - Attaches `socket.data.apiKey` (API key metadata)
   - Attaches `socket.data.authMethod = 'api_key'`
   - Calls `next()` to accept connection
5. **Server**: On failure:
   - Calls `next(new Error('Authentication required'))`
   - Connection rejected

**Server Middleware Implementation**:

```javascript
io.use(async (socket, next) => {
	try {
		// ... (session cookie auth attempt first)

		// Extract API key from auth option or Authorization header
		const apiKey =
			socket.handshake.auth.token ||
			socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

		if (apiKey) {
			// Validate API key
			const keyData = await apiKeyManager.verify(apiKey);

			if (keyData) {
				// Attach to socket context
				socket.data.apiKey = keyData;
				socket.data.authMethod = 'api_key';
				return next(); // Accept connection
			}
		}

		// No valid auth found
		next(new Error('Authentication required'));
	} catch (error) {
		next(new Error('Authentication failed'));
	}
});
```

**API Key Requirements**:

- Format: Base64url-encoded, 43-44 characters
- Pattern: `^[A-Za-z0-9_-]{43,44}$`
- Validation: Constant-time bcrypt comparison
- No rate limiting (per clarifications)

**Error Cases**:

- Missing API key → Connection rejected
- Invalid API key → Connection rejected
- Disabled API key → Connection rejected

---

## Server-to-Client Events

### `session:expired`

Emitted when a session expires during an active Socket.IO connection (browser clients only).

**When Emitted**:

- Periodic session validation detects expired session
- Session reaches `expires_at` timestamp
- Session invalidated due to logout from another tab

**Payload**:

```javascript
{
	message: 'Your session has expired. Please log in again.';
}
```

**Client Handling**:

```javascript
socket.on('session:expired', (data) => {
	console.log(data.message);

	// Redirect to login page
	window.location.href = '/login?reason=session_expired';
});
```

**Server Implementation**:

```javascript
// Periodic session validation (every 60 seconds)
setInterval(async () => {
	for (const [socketId, socket] of io.sockets.sockets) {
		if (socket.data.authMethod === 'session_cookie') {
			const { session, user } = await sessionManager.validateSession(socket.data.session.id);

			if (!session) {
				// Session expired, notify client
				socket.emit('session:expired', {
					message: 'Your session has expired. Please log in again.'
				});

				// Disconnect socket
				socket.disconnect(true);
			}
		}
	}
}, 60 * 1000); // Check every minute
```

---

## Error Handling

### Connection Errors

**Error**: `Authentication required`

**Cause**: No valid session cookie or API key provided

**Client Handling**:

```javascript
socket.on('connect_error', (error) => {
	if (error.message === 'Authentication required') {
		// Redirect to login or show auth error
		console.error('Socket.IO authentication failed:', error.message);
	}
});
```

---

**Error**: `Authentication failed`

**Cause**: Server-side error during authentication (e.g., database unavailable)

**Client Handling**:

```javascript
socket.on('connect_error', (error) => {
	if (error.message === 'Authentication failed') {
		// Retry or show error message
		console.error('Socket.IO authentication error:', error.message);
	}
});
```

---

## Unified Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│             Socket.IO Connection Established                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │  Parse handshake data   │
         └────────────┬────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
  ┌───────────────┐      ┌───────────────┐
  │ Cookie Present?│      │ API Key Present?│
  └───────┬───────┘      └───────┬───────┘
          │ Yes                  │ Yes
          │                      │
          ▼                      ▼
  ┌───────────────┐      ┌───────────────┐
  │Validate Session│      │ Validate Key  │
  │   (SQLite)    │      │   (bcrypt)    │
  └───────┬───────┘      └───────┬───────┘
          │                      │
          ├──────────┬───────────┤
          │ Valid?   │ Valid?    │
          ▼          ▼           ▼
        ┌─────┐  ┌─────┐     ┌─────┐
        │ Yes │  │ No  │     │ Yes │
        └──┬──┘  └──┬──┘     └──┬──┘
           │        │            │
           ▼        ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Attach   │ │ Reject   │ │ Attach   │
    │ Session  │ │Connection│ │ API Key  │
    │ Data     │ │          │ │ Data     │
    └────┬─────┘ └──────────┘ └────┬─────┘
         │                          │
         └────────┬──────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Connection     │
         │ Accepted       │
         └────────────────┘
```

---

## Security Considerations

### Session Cookie Auth

**Strengths**:

- httpOnly prevents XSS access to cookie
- Secure flag requires TLS in production
- SameSite=Lax prevents most CSRF attacks
- Automatic browser handling

**Limitations**:

- Requires browser environment
- Not suitable for programmatic clients

### API Key Auth

**Strengths**:

- Works for any client (browser, Node.js, CLI)
- Stateless (no session management)
- Constant-time validation prevents timing attacks

**Limitations**:

- Key must be securely stored by client
- No automatic rotation (user must create new key)

### Best Practices

1. **Always use `withCredentials: true`** for browser clients
2. **Never log API keys or session tokens**
3. **Validate session on every critical operation** (not just connection)
4. **Emit `session:expired` event** when session becomes invalid
5. **Use TLS in production** (Secure cookies + encrypted WebSocket)

---

## Testing

### Manual Test: Session Cookie Auth

1. Log in via web UI → Obtain session cookie
2. Open browser console
3. Establish Socket.IO connection:
   ```javascript
   const socket = io({ withCredentials: true });
   socket.on('connect', () => console.log('Connected with session cookie'));
   socket.on('connect_error', (err) => console.error('Auth failed:', err.message));
   ```
4. Verify connection succeeds

### Manual Test: API Key Auth

1. Create API key via UI → Copy secret
2. In Node.js script:
   ```javascript
   const { io } = require('socket.io-client');
   const socket = io('http://localhost:3030', {
   	auth: { token: 'YOUR_API_KEY_HERE' }
   });
   socket.on('connect', () => console.log('Connected with API key'));
   socket.on('connect_error', (err) => console.error('Auth failed:', err.message));
   ```
3. Verify connection succeeds

### Manual Test: Session Expiration

1. Connect with session cookie
2. In server, manually expire session in database:
   ```sql
   UPDATE auth_sessions SET expires_at = 0 WHERE id = 'SESSION_ID';
   ```
3. Wait for periodic validation (60 seconds)
4. Verify `session:expired` event emitted
5. Verify socket disconnected

---

## References

- [Socket.IO Authentication Documentation](https://socket.io/docs/v4/middlewares/)
- [Socket.IO Handshake Details](https://socket.io/docs/v4/server-socket-instance/#sockethandshake)
- [Cookie Specification (RFC 6265)](https://tools.ietf.org/html/rfc6265)
- [Authorization Header (RFC 7235)](https://tools.ietf.org/html/rfc7235)

---

**Status**: Socket.IO authentication protocol complete
