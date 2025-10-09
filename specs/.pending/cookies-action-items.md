# Cookie Authentication - Action Items Summary

## Quick Reference

This document summarizes the critical additions needed for the cookie authentication PRD based on the [detailed review](./cookies-review.md).

---

## Critical Additions Required (Before Implementation)

### 1. Hooks Implementation (FR-HOOKS-*)

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

### 2. Server-Only Modules (FR-SECURITY-*)

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

### 3. Event Locals Types (FR-TYPES-*)

**Add to Spec:**

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: { id: string; email?: string; name?: string } | null;
      session: { id: string; userId: string; expiresAt: Date; fresh: boolean } | null;
      apiKey?: { id: string; label: string; lastUsed: Date };
      services: { sessionManager: SessionManager; apiKeyManager: ApiKeyManager; /* ... */ };
    }
  }
}
```

**Requirements:**
- [ ] FR-TYPES-001: Complete TypeScript interface for `event.locals`

---

### 4. Form Actions (FR-FORM-*)

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

### 5. Database Schema (FR-DB-*)

**Add to Spec:**

```sql
-- Session storage
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

-- API key storage
CREATE TABLE IF NOT EXISTS auth_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  disabled BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);
```

**Requirements:**
- [ ] FR-DB-001: `auth_sessions` table with expiration tracking
- [ ] FR-DB-002: `auth_api_keys` table with bcrypt hashes
- [ ] FR-DB-003: Migration scripts

---

### 6. Session Expiration Policy (FR-SECURITY-004-006)

**Add to Spec:**

```javascript
const SESSION_CONFIG = {
  absoluteTimeout: 30 * 24 * 60 * 60 * 1000,  // 30 days
  idleTimeout: 7 * 24 * 60 * 60 * 1000,       // 7 days
  refreshWindow: 24 * 60 * 60 * 1000,         // 24 hours
};

async function validateSession(sessionId) {
  const session = await db.getSession(sessionId);
  if (!session) return null;

  const now = Date.now();
  const absoluteExpired = now > session.expiresAt;
  const idleExpired = (now - session.lastActiveAt) > SESSION_CONFIG.idleTimeout;

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

### 7. Socket.IO Cookie Auth (FR-SOCKET-*)

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

### 9. Client State Refactor (FR-CLIENT-*)

**Add to Spec:**

```javascript
// Remove localStorage from AuthViewModel
export class AuthViewModel {
  constructor(sessionApi) {
    this.sessionApi = sessionApi;

    // UI state only (no localStorage)
    this.loginForm = $state({ key: '', error: null, loading: false });
    this.isAuthenticated = $state(false);  // Derived from server
    this.user = $state(null);              // From +layout.server.js
  }

  // Use form action instead of localStorage
  async loginWithKey(key) {
    // ... delegates to form action
  }
}

// Socket.IO: Enable cookies
export function createAuthenticatedSocket(config = {}) {
  const socket = io(config.socketUrl || window.location.origin, {
    transports: ['websocket', 'polling'],
    withCredentials: true  // ✅ Send cookies automatically
  });
  return socket;
}
```

**Requirements:**
- [ ] FR-CLIENT-001: Refactor `AuthViewModel` to remove localStorage
- [ ] FR-CLIENT-002: Remove token storage functions from `socket-auth.js`
- [ ] FR-CLIENT-003: Use `withCredentials: true` for Socket.IO

---

### 10. Testing Strategy (FR-TEST-*)

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
  const sessionCookie = cookies.find(c => c.name === 'dispatch_session');
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

## Implementation Phases

### Phase 1: Server Infrastructure (Week 1)
- [ ] Create `SessionManager.server.js`
- [ ] Create `ApiKeyManager.server.js`
- [ ] Create `CookieService.server.js`
- [ ] Database migrations
- [ ] Implement `hooks.server.js`
- [ ] Add TypeScript types

### Phase 2: Authentication Flows (Week 2)
- [ ] Login form action
- [ ] Logout form action
- [ ] OAuth callback handler (optional)
- [ ] API key management endpoints
- [ ] Onboarding flow

### Phase 3: Client Integration (Week 3)
- [ ] Refactor `AuthViewModel`
- [ ] Update `socket-auth.js`
- [ ] Root layout load function
- [ ] Protected route patterns
- [ ] API key management UI

### Phase 4: Socket.IO Integration (Week 4)
- [ ] Socket.IO auth middleware
- [ ] Cookie parsing utility
- [ ] Session expiration handling
- [ ] Test cookie + API key auth

### Phase 5: Testing & Documentation (Week 5)
- [ ] Unit tests (SessionManager, ApiKeyManager)
- [ ] E2E tests (login, logout, sessions)
- [ ] Update API documentation
- [ ] Create authentication guide
- [ ] Troubleshooting section

---

## Open Questions to Resolve

Before implementation, decide on:

1. **Session Duration**: Should we support "Remember Me" (longer sessions)?
2. **Rate Limiting**: Should we limit API key validation attempts?
3. **2FA**: Do we need two-factor auth for session creation?
4. **Concurrent Sessions**: Allow multiple browser sessions per user?
5. **API Key Limits**: Max number of API keys per user?
6. **Session Cleanup**: Background job frequency for expired session deletion?

---

## Priority Order

**Must Have (Blocking)**:
1. Hooks implementation (FR-HOOKS-*)
2. Server-only modules (FR-SECURITY-001-002)
3. Database schema (FR-DB-*)
4. Form actions (FR-FORM-*)
5. Socket.IO cookie auth (FR-SOCKET-*)

**Should Have (Important)**:
6. Session expiration policy (FR-SECURITY-004-006)
7. CSRF protection (FR-SECURITY-007-009)
8. Client state refactor (FR-CLIENT-*)
9. Testing strategy (FR-TEST-*)

**Nice to Have (Post-Launch)**:
10. OAuth integration (FR-OAUTH-*)
11. Migration from localStorage (FR-MIGRATE-*)
12. Documentation updates (DOC-*)

---

## Next Steps

1. **Review this action items doc** with the team
2. **Update the original PRD** with the functional requirements (FR-*)
3. **Create detailed technical design doc** based on code examples
4. **Prototype hooks.server.js** to validate approach
5. **Design database schema** and review with DBA
6. **Begin Phase 1 implementation**

---

For detailed explanations and complete code examples, see [cookies-review.md](./cookies-review.md).
