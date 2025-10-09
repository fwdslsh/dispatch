# Research Document: Cookie-Based Authentication

**Feature**: 009-cookie-auth-refactor
**Date**: 2025-10-09
**Status**: Complete

## Overview

This document captures research findings and design decisions for transitioning Dispatch from localStorage-based authentication to a secure cookie + API key system.

## Research Questions & Answers

### 1. SvelteKit Cookie Handling Best Practices

**Question**: How should we handle HTTP cookies in SvelteKit for session management?

**Decision**: Use SvelteKit's built-in `event.cookies` API

**Rationale**:

- SvelteKit provides `event.cookies.set()`, `event.cookies.get()`, and `event.cookies.delete()` methods
- Automatic cookie parsing from request headers
- Automatic serialization and security attribute handling
- Framework integration ensures consistent behavior across all routes
- Reduces custom code and potential security bugs

**Alternatives Considered**:

1. **Manual cookie header manipulation**: Rejected - error-prone, requires manual parsing/serialization, reinvents framework functionality
2. **Third-party cookie library**: Rejected - unnecessary dependency when framework provides built-in solution

**Implementation Notes**:

```javascript
// In hooks.server.js or +page.server.js
export function handle({ event, resolve }) {
	// Get cookie
	const sessionId = event.cookies.get('dispatch_session');

	// Set cookie with security attributes
	event.cookies.set('dispatch_session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});

	// Delete cookie
	event.cookies.delete('dispatch_session', { path: '/' });
}
```

**References**:

- [SvelteKit Cookies Documentation](https://kit.svelte.dev/docs/types#public-types-cookies)
- [MDN Set-Cookie Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)

---

### 2. bcrypt vs argon2 for API Key Hashing

**Question**: Which hashing algorithm should we use for API key storage?

**Decision**: bcrypt with cost factor 12

**Rationale**:

- Already used in Dispatch codebase (no new dependency)
- Battle-tested, industry-standard for password/key hashing
- Constant-time comparison prevents timing attacks
- Cost factor 12 provides strong security for single-user API keys
- Sufficient performance for API key validation (<100ms target)

**Alternatives Considered**:

1. **argon2**: Rejected - newer algorithm, but requires new dependency; overkill for single-user API keys
2. **PBKDF2**: Rejected - older algorithm, less resistant to GPU attacks than bcrypt
3. **Plain SHA-256**: Rejected - NOT suitable for password hashing (no salt, fast brute-forcing)

**Performance Characteristics**:

- bcrypt cost factor 12: ~100-150ms per hash on modern CPUs
- Acceptable for API key validation (infrequent operation)
- Not suitable for high-frequency operations (but auth is cached)

**Implementation Notes**:

```javascript
import bcrypt from 'bcrypt';

// Hash API key on creation
const keyHash = await bcrypt.hash(plainKey, 12); // cost factor 12

// Validate API key (constant-time)
const match = await bcrypt.compare(submittedKey, storedHash);
```

**References**:

- [bcrypt npm package](https://www.npmjs.com/package/bcrypt)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

### 3. Socket.IO Cookie Authentication Pattern

**Question**: How should Socket.IO connections authenticate with session cookies?

**Decision**: Manually parse cookies from `socket.handshake.headers.cookie`

**Rationale**:

- Socket.IO handshake doesn't use SvelteKit's `event` object
- Cookies are available in handshake headers
- Simple manual parsing (split on `;` and `=`)
- Aligns with browser cookie-based auth model
- ~10 lines of helper code

**Alternatives Considered**:

1. **JWT tokens in handshake auth**: Rejected - adds complexity, requires separate token issuance, doesn't align with browser cookie auth
2. **Separate Socket.IO authentication endpoint**: Rejected - overcomplicated, requires two auth flows
3. **socket.io-client auto-cookie sending**: Rejected - requires `withCredentials: true` (which we use), but server still needs manual parsing

**Implementation Notes**:

```javascript
// Server-side Socket.IO middleware
io.use(async (socket, next) => {
	try {
		// Parse cookies from handshake headers
		const cookies = parseCookies(socket.handshake.headers.cookie);
		const sessionId = cookies['dispatch_session'];

		if (sessionId) {
			const session = await sessionManager.validateSession(sessionId);
			if (session) {
				socket.data.session = session;
				return next();
			}
		}

		// Fallback to API key auth
		const apiKey = socket.handshake.auth.token;
		if (apiKey) {
			const keyData = await apiKeyManager.verify(apiKey);
			if (keyData) {
				socket.data.apiKey = keyData;
				return next();
			}
		}

		next(new Error('Authentication required'));
	} catch (error) {
		next(new Error('Authentication failed'));
	}
});

// Helper function
function parseCookies(cookieHeader) {
	if (!cookieHeader) return {};
	return cookieHeader.split(';').reduce((cookies, cookie) => {
		const [name, value] = cookie.trim().split('=');
		cookies[name] = decodeURIComponent(value);
		return cookies;
	}, {});
}
```

// Client-side configuration

```javascript
const socket = io({
	transports: ['websocket', 'polling'],
	withCredentials: true // ← Send cookies automatically
});
```

**References**:

- [Socket.IO Handshake Documentation](https://socket.io/docs/v4/server-socket-instance/#sockethandshake)
- [MDN Cookie Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)

---

### 4. CSRF Protection Strategy

**Question**: How should we protect cookie-based requests from CSRF attacks?

**Decision**: Origin header validation for cookie-based state-changing requests

**Rationale**:

- Simple, effective CSRF protection
- SvelteKit form actions have built-in CSRF protection
- Origin header validation prevents cross-site request forgery
- Minimal code required
- API key requests exempt (stateless, not cookie-based)

**Alternatives Considered**:

1. **CSRF tokens**: Rejected - overkill for single-user app, adds complexity, requires token generation/validation/storage
2. **SameSite cookies only**: Rejected - not sufficient alone (SameSite=Lax doesn't protect against all CSRF scenarios)
3. **Double-submit cookie pattern**: Rejected - more complex than Origin validation, requires client-side JavaScript

**Implementation Notes**:

```javascript
// In hooks.server.js or API route
export async function POST({ request, url, locals }) {
	// Skip CSRF check for API key auth
	if (locals.auth.method === 'api_key') {
		// API keys are stateless, no CSRF risk
	} else if (locals.auth.method === 'cookie') {
		// Validate Origin header for cookie-based requests
		const origin = request.headers.get('origin');
		if (origin && origin !== url.origin) {
			return json({ error: 'Invalid origin' }, { status: 403 });
		}
	}

	// Process request
}
```

**SvelteKit Form Actions**:

- Automatic CSRF protection for `use:enhance` forms
- No additional code needed for login/logout forms

**References**:

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [SvelteKit Form Actions](https://kit.svelte.dev/docs/form-actions)

---

### 5. Session Storage Strategy

**Question**: Where should we store session data (cookies + metadata)?

**Decision**: Extend existing SQLite `auth_sessions` table with provider field

**Rationale**:

- Reuses existing session management infrastructure
- SQLite already used for workspace database
- Minimal schema changes (add `provider` field)
- Session persistence across server restarts (constitutional requirement)
- Sufficient performance for single-user application
- No new dependencies

**Alternatives Considered**:

1. **Redis/in-memory cache**: Rejected - adds dependency, overkill for single-user, requires separate service
2. **File-based storage**: Rejected - less structured than SQLite, no ACID guarantees
3. **PostgreSQL**: Rejected - heavyweight for single-user, additional setup complexity

**Schema Design**:

```sql
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,              -- Session ID (UUID)
  user_id TEXT NOT NULL,            -- User ID (default: 'default')
  provider TEXT NOT NULL,           -- 'api_key' | 'oauth_github' | 'oauth_google'
  expires_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  last_active_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at);
```

**Performance Considerations**:

- Index on `expires_at` for cleanup queries
- Index on `user_id` for user session lookup
- Expected load: Single user, <100 sessions
- Query performance: <10ms for indexed lookups

**References**:

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- Existing `src/lib/server/auth/session.js` implementation

---

### 6. OAuth Provider Integration

**Question**: Should OAuth support be always-on or optional?

**Decision**: Optional feature with enable/disable toggles in settings

**Rationale**:

- Progressive enhancement principle (constitutional requirement)
- Not all users need OAuth (some prefer API keys only)
- Reduces complexity for users who don't want OAuth
- Allows graceful degradation if OAuth providers unavailable
- Simpler deployment (no forced OAuth configuration)

**Alternatives Considered**:

1. **Always-on OAuth**: Rejected - forces complexity on all users, violates progressive enhancement
2. **OAuth-only auth**: Rejected - removes API key option for automation/scripts
3. **Separate OAuth build**: Rejected - unnecessary build complexity

**Implementation Strategy**:

- OAuth providers stored in settings table (JSON)
- Enable/disable toggle per provider in UI
- When disabled: Existing sessions remain valid, new logins rejected
- Fallback to API key login when OAuth unavailable (from clarifications)

**Supported Providers** (initial):

- GitHub OAuth
- Google OAuth

**References**:

- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)

---

## Summary of Key Decisions

| Topic             | Decision                             | Rationale                                               |
| ----------------- | ------------------------------------ | ------------------------------------------------------- |
| Cookie handling   | SvelteKit `event.cookies` API        | Built-in, secure, framework-integrated                  |
| API key hashing   | bcrypt cost factor 12                | Existing dependency, battle-tested, sufficient security |
| Socket.IO auth    | Manual cookie parsing from handshake | Simple, aligns with browser auth model                  |
| CSRF protection   | Origin header validation             | Simple, effective, built into form actions              |
| Session storage   | SQLite with provider field           | Reuses existing infrastructure, no new dependencies     |
| OAuth integration | Optional with enable/disable toggles | Progressive enhancement, simpler deployment             |

## No New Dependencies Required

All decisions leverage existing Dispatch dependencies:

- ✅ bcrypt (already present)
- ✅ SvelteKit built-in APIs
- ✅ Socket.IO built-in APIs
- ✅ SQLite3 (already present)

## Testing Strategy

Per user requirement: **Testing is optional/manual**

Recommended manual test scenarios:

1. Onboarding flow (API key generation)
2. Login with API key (cookie set)
3. API key management (CRUD operations)
4. Session refresh (30-day rolling window)
5. Socket.IO dual auth (cookies + API keys)
6. OAuth login (optional, if enabled)

Automated tests can be added later if desired (Vitest + Playwright).

---

**Status**: Research complete, ready for Phase 1 (Design & Contracts)
