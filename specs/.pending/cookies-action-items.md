# Cookie Authentication - Action Items Summary (Big Bang Implementation)

## Quick Reference

This document summarizes the critical additions needed for the cookie authentication PRD based on the [detailed review](./cookies-review.md).

**Implementation Strategy**: Atomic big bang deployment with NO migration or backwards compatibility.

- All existing sessions will be invalidated
- All users must re-authenticate after upgrade
- No localStorage migration code
- No dual auth support
- Clean schema with DROP/CREATE migrations

---

## Critical Additions Required (Before Implementation)

### 1. Hooks Implementation (FR-HOOKS-\*)

**Add to Spec:**

```javascript
// FR-HOOKS-001: Session Validation in hooks.server.js
export const handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('dispatch_session');
	event.locals.user = null;
	event.locals.session = null;

	if (sessionId) {
		const { session, user } = await event.locals.services.sessionManager.validateSession(sessionId);

		if (session?.fresh) {
			// Refresh cookie
			event.cookies.set('dispatch_session', session.id, getSessionCookieAttributes());
		}

		if (!session) {
			// Clear expired cookie
			event.cookies.delete('dispatch_session', { path: '/' });
		}

		event.locals.user = user;
		event.locals.session = session;
	}

	return resolve(event);
};
```

**Requirements:**

- [ ] FR-HOOKS-001: Complete `handle` hook with session validation
- [ ] FR-HOOKS-002: Session refresh logic (sliding window)
- [ ] FR-HOOKS-003: Cookie deletion for expired sessions

---

### 2. Server-Only Modules (FR-SECURITY-\*)

**Add to Spec:**

```
All authentication logic MUST be in server-only modules:

✅ CORRECT:
  src/lib/server/auth/SessionManager.server.js
  src/lib/server/auth/ApiKeyManager.server.js
  src/lib/server/auth/CookieService.server.js

❌ WRONG:
  src/lib/client/* (never put auth logic here)
```

**Requirements:**

- [ ] FR-SECURITY-001: All auth logic in `$lib/server/` or `.server.js` files
- [ ] FR-SECURITY-002: Build validation to prevent server module leaks

---

### 3. Event Locals Types (FR-TYPES-\*)

**Add to Spec:**

```typescript
// src/app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: { id: string; email?: string; name?: string } | null;
			session: { id: string; userId: string; expiresAt: Date; fresh: boolean } | null;
			apiKey?: { id: string; label: string; lastUsed: Date };
			services: { sessionManager: SessionManager; apiKeyManager: ApiKeyManager /* ... */ };
		}
	}
}
```

**Requirements:**

- [ ] FR-TYPES-001: Complete TypeScript interface for `event.locals`

---

### 4. Form Actions (FR-FORM-\*)

**Add to Spec:**

```javascript
// src/routes/login/+page.server.js
export const actions = {
	login: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const key = data.get('key');

		const validKey = await locals.services.apiKeyManager.verify(key);
		if (!validKey) {
			return fail(401, { error: 'Invalid key' });
		}

		const session = await locals.services.sessionManager.createSession({
			userId: 'default',
			provider: 'api_key'
		});

		cookies.set('dispatch_session', session.id, {
			path: '/',
			httpOnly: true,
			secure: import.meta.env.PROD,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		redirect(303, '/');
	},

	logout: async ({ cookies, locals }) => {
		const sessionId = cookies.get('dispatch_session');
		if (sessionId) {
			await locals.services.sessionManager.invalidateSession(sessionId);
		}
		cookies.delete('dispatch_session', { path: '/' });
		redirect(303, '/login');
	}
};
```

**Requirements:**

- [ ] FR-FORM-001: Login form action with cookie setting
- [ ] FR-FORM-002: Logout form action with session invalidation

---

### 5. Database Schema (FR-DB-\*)

**Add to Spec:**

```sql
-- Clean slate migration (no data preservation)
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS auth_api_keys;

-- Session storage (clean schema)
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at);

-- API key storage (new table)
CREATE TABLE auth_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  disabled INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_api_keys_user_id ON auth_api_keys(user_id);
CREATE INDEX ix_api_keys_disabled ON auth_api_keys(disabled);
```

**Requirements:**

- [ ] FR-DB-001: `auth_sessions` table with clean schema (DROP/CREATE)
- [ ] FR-DB-002: `auth_api_keys` table with bcrypt hashes (new table)
- [ ] FR-DB-003: Migration script uses DROP/CREATE (no backwards compat)
- [ ] FR-DB-004: No data preservation for session tables (ephemeral data)

---

### 6. Session Expiration Policy (FR-SECURITY-004-006)

**Add to Spec:**

```javascript
const SESSION_CONFIG = {
	absoluteTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
	idleTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
	refreshWindow: 24 * 60 * 60 * 1000 // 24 hours
};

async function validateSession(sessionId) {
	const session = await db.getSession(sessionId);
	if (!session) return null;

	const now = Date.now();
	const absoluteExpired = now > session.expiresAt;
	const idleExpired = now - session.lastActiveAt > SESSION_CONFIG.idleTimeout;

	if (absoluteExpired || idleExpired) {
		await db.deleteSession(sessionId);
		return null;
	}

	const timeUntilExpiry = session.expiresAt - now;
	const fresh = timeUntilExpiry < SESSION_CONFIG.refreshWindow;

	if (fresh) {
		await db.updateSession(sessionId, {
			lastActiveAt: now,
			expiresAt: now + SESSION_CONFIG.absoluteTimeout
		});
	}

	return { session, fresh };
}
```

**Requirements:**

- [ ] FR-SECURITY-004: Session expiration policy (absolute + idle)
- [ ] FR-SECURITY-005: Session refresh mechanism
- [ ] FR-SECURITY-006: Background cleanup of expired sessions

---

### 7. Socket.IO Cookie Auth (FR-SOCKET-\*)

**Add to Spec:**

```javascript
// Socket.IO middleware for cookie auth
export function createSocketAuthMiddleware(services) {
	return async (socket, next) => {
		// Strategy 1: Cookie-based (browser)
		const cookies = parseCookies(socket.handshake.headers.cookie);
		const sessionId = cookies['dispatch_session'];

		if (sessionId) {
			const { session, user } = await services.sessionManager.validateSession(sessionId);
			if (session) {
				socket.data.user = user;
				socket.data.session = session;
				socket.data.authMethod = 'session_cookie';
				return next();
			}
		}

		// Strategy 2: API key (programmatic)
		const authHeader = socket.handshake.auth.token || socket.handshake.headers.authorization;
		if (authHeader) {
			const key = authHeader.replace(/^Bearer\s+/i, '');
			const apiKey = await services.apiKeyManager.verify(key);
			if (apiKey) {
				socket.data.apiKey = apiKey;
				socket.data.authMethod = 'api_key';
				return next();
			}
		}

		next(new Error('Authentication required'));
	};
}

function parseCookies(cookieHeader) {
	if (!cookieHeader) return {};
	return cookieHeader.split(';').reduce((cookies, cookie) => {
		const [name, value] = cookie.trim().split('=');
		cookies[name] = decodeURIComponent(value);
		return cookies;
	}, {});
}
```

**Requirements:**

- [ ] FR-SOCKET-001: Socket.IO middleware for cookie + API key auth
- [ ] FR-SOCKET-002: Manual cookie parsing from handshake headers
- [ ] FR-SOCKET-003: Store auth context in `socket.data`

---

### 8. CSRF Protection (FR-SECURITY-007-009)

**Add to Spec:**

```javascript
// Form actions: Built-in CSRF protection (SvelteKit automatic)

// API endpoints: Origin validation
async function validateOrigin(request, url) {
	const origin = request.headers.get('origin');
	const allowedOrigins = [url.origin /* add tunnel URLs if needed */];
	return origin ? allowedOrigins.includes(origin) : true;
}

export async function POST({ request, url }) {
	if (!validateOrigin(request, url)) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}
	// ... handle request
}
```

**Requirements:**

- [ ] FR-SECURITY-007: CSRF protection for form actions (built-in)
- [ ] FR-SECURITY-008: Origin validation for API endpoints
- [ ] FR-SECURITY-009: Document API key auth bypasses CSRF

---

### 9. Client State Refactor (FR-CLIENT-\*) - No Migration Code

**Add to Spec:**

```javascript
// AuthViewModel - Clean implementation, no localStorage
export class AuthViewModel {
	constructor(sessionApi) {
		this.sessionApi = sessionApi;

		// UI state only (NO localStorage checking)
		this.loginForm = $state({ key: '', error: null, loading: false });
		this.isAuthenticated = $state(false); // Derived from server
		this.user = $state(null); // From +layout.server.js
	}

	// Use form action only (no localStorage fallback)
	async loginWithKey(key) {
		// Delegates to form action, no migration code
	}

	// No checkExistingAuth() that checks localStorage
	// No migration prompts or localStorage cleanup
}

// Socket.IO: Enable cookies (no token passing)
export function createAuthenticatedSocket(config = {}) {
	const socket = io(config.socketUrl || window.location.origin, {
		transports: ['websocket', 'polling'],
		withCredentials: true // ✅ Send cookies automatically (NO manual auth)
	});
	return socket;
}

// DELETE from socket-auth.js:
// - getStoredAuthToken()  ❌
// - storeAuthToken()      ❌
// - clearAuthToken()      ❌
```

**Requirements:**

- [ ] FR-CLIENT-001: Refactor `AuthViewModel` to remove ALL localStorage code
- [ ] FR-CLIENT-002: DELETE token storage functions from `socket-auth.js` entirely
- [ ] FR-CLIENT-003: Use `withCredentials: true` for Socket.IO (no manual auth)
- [ ] FR-CLIENT-004: NO migration detection or localStorage cleanup code

---

### 10. Testing Strategy (FR-TEST-\*)

**Add to Spec:**

```javascript
// Unit test example
describe('SessionManager', () => {
	it('should reject expired session', async () => {
		const expiredSession = { id: '123', expiresAt: Date.now() - 1000 };
		mockDb.getSession.mockResolvedValue(expiredSession);
		const result = await sessionManager.validateSession('123');
		expect(result).toBeNull();
	});
});

// E2E test example
test('should login and set cookie', async ({ page }) => {
	await page.goto('/login');
	await page.fill('input[name="key"]', 'test-key');
	await page.click('button[type="submit"]');

	await expect(page).toHaveURL('/');

	const cookies = await page.context().cookies();
	const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');
	expect(sessionCookie).toBeDefined();
	expect(sessionCookie.httpOnly).toBe(true);
});
```

**Requirements:**

- [ ] FR-TEST-001: Unit tests for SessionManager
- [ ] FR-TEST-002: Unit tests for ApiKeyManager
- [ ] FR-TEST-003: E2E tests for login flow with cookie verification
- [ ] FR-TEST-004: E2E tests for session persistence
- [ ] FR-TEST-005: E2E tests for logout and cookie deletion

---

## Implementation Phases (Big Bang - No Migration)

### Phase 1: Server Infrastructure (Week 1) - 2-3 days

- [ ] Create `SessionManager.server.js` (clean implementation)
- [ ] Create `ApiKeyManager.server.js`
- [ ] Create `CookieService.server.js`
- [ ] Database migrations (DROP/CREATE, no data migration)
- [ ] Implement `hooks.server.js` (single auth path, no dual support)
- [ ] Add TypeScript types

**Effort Reduction**: No dual auth complexity

### Phase 2: Authentication Flows (Week 2) - 3-5 days

- [ ] Login form action (clean, no migration UI)
- [ ] Logout form action
- [ ] OAuth callback handler (optional)
- [ ] API key management endpoints
- [ ] Onboarding flow
- [ ] Update `AuthService.validateAuth()` (API keys only)

**Effort Reduction**: Simplified validation logic (no backwards compat)

### Phase 3: Client Integration (Week 2-3) - 2-3 days

- [ ] Refactor `AuthViewModel` (DELETE localStorage code)
- [ ] Update `socket-auth.js` (DELETE token functions)
- [ ] Root layout load function
- [ ] Protected route patterns (simple redirect)
- [ ] API key management UI

**Effort Reduction**: No migration code, no localStorage detection

### Phase 4: Socket.IO Integration (Week 3) - 1-2 days

- [ ] Socket.IO auth middleware
- [ ] Cookie parsing utility
- [ ] Session expiration handling
- [ ] Test cookie + API key auth

**Unchanged**: Core Socket.IO work same as gradual approach

### Phase 5: Testing & Documentation (Week 3-4) - 2-3 days

- [ ] Unit tests (SessionManager, ApiKeyManager)
- [ ] E2E tests (login, logout, sessions)
- [ ] Update API documentation
- [ ] Create authentication guide
- [ ] Troubleshooting section

**Effort Reduction**: No migration test cases, simpler test scenarios

---

## Total Effort: ~2-3 weeks (10-16 days)

**Reduction from gradual approach**: ~40-50% faster due to:

- No dual auth complexity
- No migration code/testing
- No backwards compatibility
- Simpler database migrations

---

## Open Questions to Resolve

Before implementation, decide on:

1. **Session Duration**: Should we support "Remember Me" (longer sessions)?
2. **Rate Limiting**: Should we limit API key validation attempts?
3. **2FA**: Do we need two-factor auth for session creation?
4. **Concurrent Sessions**: Allow multiple browser sessions per user?
5. **API Key Limits**: Max number of API keys per user?
6. **Session Cleanup**: Background job frequency for expired session deletion?
7. **User Notice Period**: How much advance warning? (recommended: 1 week)
8. **Automatic API Key**: Generate API key automatically on first post-upgrade login?
9. **Support Preparation**: What FAQs/guides do support team need before deployment?

---

## Priority Order

**Must Have (Blocking)**:

1. Hooks implementation (FR-HOOKS-\*)
2. Server-only modules (FR-SECURITY-001-002)
3. Database schema (FR-DB-\*)
4. Form actions (FR-FORM-\*)
5. Socket.IO cookie auth (FR-SOCKET-\*)

**Should Have (Important)**: 6. Session expiration policy (FR-SECURITY-004-006) 7. CSRF protection (FR-SECURITY-007-009) 8. Client state refactor (FR-CLIENT-_) 9. Testing strategy (FR-TEST-_)

**Nice to Have (Post-Launch)**: 10. OAuth integration (FR-OAUTH-\*) 11. Advanced features (rate limiting, 2FA, audit logging) 12. Extended documentation (advanced use cases, troubleshooting)

---

## Next Steps

1. **Review this action items doc** with the team
2. **Update the original PRD** with the functional requirements (FR-\*)
3. **Create detailed technical design doc** based on code examples
4. **Prototype hooks.server.js** to validate approach
5. **Design database schema** and review with DBA
6. **Begin Phase 1 implementation**

---

For detailed explanations and complete code examples, see [cookies-review.md](./cookies-review.md).
