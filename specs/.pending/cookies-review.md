# Cookie Authentication Spec Review - SvelteKit Integration

## Executive Summary

The cookie authentication PRD provides a solid foundation but needs significant SvelteKit-specific implementation details to be production-ready. This review identifies gaps, security concerns, and provides concrete recommendations aligned with SvelteKit best practices and the existing MVVM architecture.

**Overall Assessment**: ⚠️ Needs Enhancement
- **Security**: Good foundation, needs specifics
- **SvelteKit Integration**: Missing critical implementation details
- **MVVM Alignment**: Needs clarification on state management patterns
- **Socket.IO Integration**: Underspecified for cookie-based auth

---

## 1. What's Good (Alignment with Best Practices)

✅ **Correct architectural choice**: Cookie-based sessions for browser + API keys for programmatic access matches SvelteKit and industry best practices.

✅ **httpOnly, Secure, SameSite**: The spec mentions the right cookie security attributes.

✅ **Hashed API keys**: Proper security with bcrypt/argon2 for API key storage.

✅ **Optional OAuth**: Smart to keep OAuth optional while focusing on core session management.

✅ **No localStorage secrets**: Eliminating localStorage for auth tokens is the right move.

---

## 2. Critical Gaps - SvelteKit Implementation

### 2.1 Missing: `hooks.server.js` Implementation Details

**Gap**: The spec mentions a "SvelteKit `handle` hook" but doesn't specify:
- Complete session validation flow
- `event.locals` structure
- Cookie reading/writing patterns
- Session refresh logic

**Recommendation**: Add detailed functional requirement:

```javascript
// FR-HOOKS-001: Session Validation Hook
// src/hooks.server.js

export const handle = async ({ event, resolve }) => {
  // 1. Extract session ID from cookie
  const sessionId = event.cookies.get('dispatch_session');

  // 2. Initialize locals with null (unauthenticated state)
  event.locals.user = null;
  event.locals.session = null;

  // 3. Validate session if cookie exists
  if (sessionId) {
    const { session, user } = await event.locals.services.sessionManager.validateSession(sessionId);

    // 4. Handle fresh sessions (update cookie)
    if (session?.fresh) {
      const cookie = createSessionCookie(session.id);
      event.cookies.set(cookie.name, cookie.value, cookie.attributes);
    }

    // 5. Handle expired sessions (clear cookie)
    if (!session) {
      event.cookies.delete('dispatch_session', { path: '/' });
    }

    event.locals.user = user;
    event.locals.session = session;
  }

  return resolve(event);
};
```

**Add to spec**:
- [ ] FR-HOOKS-001: Complete `handle` hook implementation with session validation
- [ ] FR-HOOKS-002: Session refresh logic for extending sessions on activity
- [ ] FR-HOOKS-003: Cookie deletion for expired/invalid sessions

---

### 2.2 Missing: Server-Only Module Security

**Gap**: API key hashing and session management should use SvelteKit's server-only module pattern to prevent accidental client-side exposure.

**Recommendation**: Add security requirement:

```javascript
// FR-SECURITY-001: Server-Only Auth Modules
// All auth logic MUST be in server-only modules:

// ✅ CORRECT
src/lib/server/auth/
  ├── SessionManager.server.js    // Session CRUD + validation
  ├── ApiKeyManager.server.js     // API key hashing + verification
  └── CookieService.server.js     // Cookie generation helpers

// ❌ WRONG - Never put auth logic here
src/lib/client/auth/
  └── SessionState.svelte.js      // Only UI state, no secrets
```

**Add to spec**:
- [ ] FR-SECURITY-001: All session/API key logic in `$lib/server/` or `.server.js` files
- [ ] FR-SECURITY-002: Never import server-only modules in client code
- [ ] FR-SECURITY-003: Build-time validation to catch server module leaks

**Reference**: [SvelteKit Server-Only Modules](https://kit.svelte.dev/docs/server-only-modules)

---

### 2.3 Missing: `event.locals` Type Definition

**Gap**: No specification for the `event.locals` structure that will be used throughout the app.

**Recommendation**: Add type safety requirement:

```typescript
// FR-TYPES-001: Event Locals Interface
// src/app.d.ts

declare global {
  namespace App {
    interface Locals {
      // Session-based auth (browser)
      user: {
        id: string;
        email?: string;
        name?: string;
      } | null;

      session: {
        id: string;
        userId: string;
        expiresAt: Date;
        fresh: boolean;
      } | null;

      // API key auth (programmatic)
      apiKey?: {
        id: string;
        label: string;
        lastUsed: Date;
      };

      // Services (injected by servicesMiddleware)
      services: {
        sessionManager: SessionManager;
        apiKeyManager: ApiKeyManager;
        db: DatabaseManager;
        // ... other services
      };
    }

    interface Error {
      message: string;
      code?: string;
    }
  }
}
```

**Add to spec**:
- [ ] FR-TYPES-001: Complete TypeScript interface for `event.locals`
- [ ] FR-TYPES-002: Discriminated union for auth type (session vs API key)

---

### 2.4 Missing: Form Action Integration

**Gap**: The spec doesn't specify how login/logout will work. SvelteKit form actions are the recommended pattern.

**Recommendation**: Add form action requirements:

```javascript
// FR-FORM-001: Login Form Action
// src/routes/login/+page.server.js

export const actions = {
  login: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    const key = data.get('key');

    // Validate API key
    const validKey = await locals.services.apiKeyManager.verify(key);
    if (!validKey) {
      return fail(401, { error: 'Invalid key', key });
    }

    // Create session
    const session = await locals.services.sessionManager.createSession({
      userId: 'default', // Single-user mode
      provider: 'api_key'
    });

    // Set session cookie
    cookies.set('dispatch_session', session.id, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
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

**Add to spec**:
- [ ] FR-FORM-001: Login form action with progressive enhancement
- [ ] FR-FORM-002: Logout form action with session invalidation
- [ ] FR-FORM-003: OAuth callback form action for provider login

**Reference**: [SvelteKit Form Actions](https://kit.svelte.dev/docs/form-actions)

---

### 2.5 Missing: OAuth Integration Specifics

**Gap**: "OAuth callbacks" mentioned but no SvelteKit-specific implementation pattern.

**Recommendation**: Add OAuth callback requirements:

```javascript
// FR-OAUTH-001: OAuth Callback Handler
// src/routes/auth/callback/[provider]/+server.js

export async function GET({ url, params, cookies, locals }) {
  const { provider } = params;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Validate state (CSRF protection)
  const storedState = cookies.get('oauth_state');
  if (!storedState || storedState !== state) {
    return new Response('Invalid state', { status: 400 });
  }

  try {
    // Exchange code for tokens (provider-specific)
    const tokens = await locals.services.oauthManager.exchangeCode({
      provider,
      code
    });

    // Get user info from provider
    const userInfo = await locals.services.oauthManager.getUserInfo({
      provider,
      accessToken: tokens.access_token
    });

    // Create or update user
    const user = await locals.services.userManager.upsert({
      email: userInfo.email,
      name: userInfo.name,
      provider
    });

    // Create session
    const session = await locals.services.sessionManager.createSession({
      userId: user.id,
      provider: `oauth_${provider}`
    });

    // Set session cookie
    cookies.set('dispatch_session', session.id, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });

    // Clean up OAuth state cookie
    cookies.delete('oauth_state', { path: '/' });

    // Redirect to app
    redirect(303, '/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    redirect(303, '/login?error=oauth_failed');
  }
}
```

**Add to spec**:
- [ ] FR-OAUTH-001: OAuth callback route implementation (`+server.js`)
- [ ] FR-OAUTH-002: CSRF protection with state parameter
- [ ] FR-OAUTH-003: User upsert logic (create or update from OAuth profile)
- [ ] FR-OAUTH-004: Session creation from successful OAuth login

---

### 2.6 Missing: Database Schema for Sessions

**Gap**: The spec says "SQLite persistence" but doesn't define schema changes needed.

**Recommendation**: Add database migration requirement:

```sql
-- FR-DB-001: Session Storage Schema
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,              -- Session ID (random secure token)
  user_id TEXT NOT NULL,            -- User identifier
  provider TEXT NOT NULL,           -- 'api_key' | 'oauth_github' | 'oauth_google'
  expires_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  last_active_at INTEGER NOT NULL,  -- Unix timestamp (ms) for session refresh

  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at);

-- FR-DB-002: API Key Storage Schema
CREATE TABLE IF NOT EXISTS auth_api_keys (
  id TEXT PRIMARY KEY,              -- API key ID
  user_id TEXT NOT NULL,            -- Owner user ID
  key_hash TEXT NOT NULL,           -- bcrypt hash of API key
  label TEXT NOT NULL,              -- User-friendly label
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  last_used_at INTEGER,             -- Unix timestamp (ms)
  disabled BOOLEAN DEFAULT 0,       -- 0=active, 1=disabled

  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_api_keys_user_id ON auth_api_keys(user_id);
CREATE INDEX ix_api_keys_disabled ON auth_api_keys(disabled);

-- FR-DB-003: Users Table (if not exists)
CREATE TABLE IF NOT EXISTS auth_users (
  user_id TEXT PRIMARY KEY,         -- 'default' for single-user mode
  email TEXT UNIQUE,                -- From OAuth or manual entry
  name TEXT,                        -- Display name
  created_at INTEGER NOT NULL,
  last_login INTEGER                -- Unix timestamp (ms)
);
```

**Add to spec**:
- [ ] FR-DB-001: `auth_sessions` table schema with expiration tracking
- [ ] FR-DB-002: `auth_api_keys` table schema with bcrypt hashes
- [ ] FR-DB-003: `auth_users` table schema for user profiles
- [ ] FR-DB-004: Migration script to add new tables without breaking existing data

**Note**: The spec mentions existing `auth_sessions` and `auth_users` tables in the database schema doc, so this is primarily about ensuring the schema supports the new requirements.

---

## 3. Security Concerns

### 3.1 Missing: Session Expiration Strategy

**Gap**: No specification for session lifetime, refresh logic, or "remember me" functionality.

**Recommendation**: Add session management policy:

```javascript
// FR-SECURITY-004: Session Expiration Policy
const SESSION_CONFIG = {
  // Absolute expiration (30 days from creation)
  absoluteTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days

  // Idle timeout (7 days of inactivity)
  idleTimeout: 7 * 24 * 60 * 60 * 1000,      // 7 days

  // Refresh window (extend session if < 24h remaining)
  refreshWindow: 24 * 60 * 60 * 1000,        // 24 hours

  // Cookie settings
  cookie: {
    name: 'dispatch_session',
    httpOnly: true,
    secure: true,  // Always true in production
    sameSite: 'lax',
    path: '/'
  }
};

// Session validation checks both absolute and idle timeouts
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

  // Determine if session should be refreshed
  const timeUntilExpiry = session.expiresAt - now;
  const fresh = timeUntilExpiry < SESSION_CONFIG.refreshWindow;

  if (fresh) {
    // Extend session
    await db.updateSession(sessionId, {
      lastActiveAt: now,
      expiresAt: now + SESSION_CONFIG.absoluteTimeout
    });
  }

  return { session, fresh };
}
```

**Add to spec**:
- [ ] FR-SECURITY-004: Session expiration policy (absolute + idle timeouts)
- [ ] FR-SECURITY-005: Session refresh mechanism (sliding window)
- [ ] FR-SECURITY-006: Automatic cleanup of expired sessions (background job)

---

### 3.2 Missing: CSRF Protection for State-Changing Operations

**Gap**: Cookie-based auth requires CSRF protection for POST/PUT/DELETE endpoints.

**Recommendation**: Add CSRF requirements:

```javascript
// FR-SECURITY-007: CSRF Protection
// SvelteKit provides built-in CSRF protection for form actions,
// but API endpoints need explicit protection

// Option 1: Use SvelteKit's built-in CSRF protection for form actions
// (automatically protected, no extra work needed)

// Option 2: For API endpoints, validate origin header
async function validateOrigin(request, url) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    url.origin,  // Same origin
    // Add tunnel URLs if ENABLE_TUNNEL is set
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    return false;
  }

  return true;
}

// Apply to all state-changing API endpoints
export async function POST({ request, url }) {
  if (!validateOrigin(request, url)) {
    return json({ error: 'Invalid origin' }, { status: 403 });
  }
  // ... handle request
}
```

**Add to spec**:
- [ ] FR-SECURITY-007: CSRF protection for form actions (built-in SvelteKit)
- [ ] FR-SECURITY-008: Origin validation for API endpoints
- [ ] FR-SECURITY-009: Document that API key auth bypasses CSRF (stateless)

**Reference**: SvelteKit form actions have built-in CSRF protection. For custom API endpoints, use origin/referer validation.

---

### 3.3 Missing: Secure Cookie Configuration per Environment

**Gap**: "Secure (except in dev)" mentioned but needs environmental configuration.

**Recommendation**: Add environment-aware cookie config:

```javascript
// FR-SECURITY-010: Environment-Based Cookie Security
import { dev } from '$app/environment';

function getSessionCookieAttributes() {
  return {
    httpOnly: true,
    secure: !dev,  // Only send over HTTPS in production
    sameSite: dev ? 'lax' : 'strict',  // Stricter in production
    path: '/',
    maxAge: 60 * 60 * 24 * 30  // 30 days
  };
}

// Development mode: Allow localhost + tunnel URLs
// Production mode: Enforce HTTPS + strict same-site
```

**Add to spec**:
- [ ] FR-SECURITY-010: Environment-aware cookie security (`$app/environment`)
- [ ] FR-SECURITY-011: Support for LocalTunnel URLs in development
- [ ] FR-SECURITY-012: Strict same-site policy in production

---

### 3.4 Missing: API Key Rotation and Revocation

**Gap**: Spec mentions "rotate" but no implementation details.

**Recommendation**: Add key lifecycle requirements:

```javascript
// FR-APIKEY-001: API Key Lifecycle Management

// Create new API key
async function createApiKey({ userId, label }) {
  // Generate cryptographically secure random key
  const key = crypto.randomBytes(32).toString('base64url'); // 256 bits
  const keyHash = await bcrypt.hash(key, 12);  // High cost factor

  const keyId = crypto.randomUUID();

  await db.insertApiKey({
    id: keyId,
    userId,
    keyHash,
    label,
    createdAt: Date.now(),
    disabled: false
  });

  // Return plain key ONCE (never stored or logged)
  return { id: keyId, key, label };
}

// Verify API key (constant-time comparison)
async function verifyApiKey(key) {
  // Query all active keys for user (or use key prefix for lookup)
  const keys = await db.getActiveApiKeys();

  for (const storedKey of keys) {
    const match = await bcrypt.compare(key, storedKey.keyHash);
    if (match) {
      // Update last used timestamp (async, don't block)
      db.updateApiKeyLastUsed(storedKey.id).catch(err =>
        console.error('Failed to update key last used:', err)
      );
      return storedKey;
    }
  }

  return null;
}

// Disable API key (soft delete)
async function disableApiKey(keyId, userId) {
  await db.updateApiKey(keyId, { disabled: true });
}

// Delete API key (hard delete)
async function deleteApiKey(keyId, userId) {
  await db.deleteApiKey(keyId, { userId });  // Ensure ownership
}
```

**Add to spec**:
- [ ] FR-APIKEY-001: API key generation with secure random (crypto.randomBytes)
- [ ] FR-APIKEY-002: bcrypt hashing with cost factor 12
- [ ] FR-APIKEY-003: Constant-time comparison to prevent timing attacks
- [ ] FR-APIKEY-004: Soft delete (disable) vs hard delete
- [ ] FR-APIKEY-005: Track last_used_at timestamp for audit

---

## 4. Socket.IO Integration Concerns

### 4.1 Missing: Cookie Access in Socket.IO Handshake

**Gap**: The spec mentions "session cookie (browser) or an API key" but doesn't specify how Socket.IO reads cookies.

**Current Problem**: Socket.IO handshake needs to validate cookies, but the middleware pattern is different from SvelteKit routes.

**Recommendation**: Add Socket.IO auth requirements:

```javascript
// FR-SOCKET-001: Socket.IO Authentication Middleware
// src/lib/server/socket/middleware/auth.js

export function createSocketAuthMiddleware(services) {
  return async (socket, next) => {
    try {
      // Strategy 1: Cookie-based auth (browser clients)
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

      // Strategy 2: API key auth (programmatic clients)
      const authHeader = socket.handshake.auth.token ||
                         socket.handshake.headers.authorization;

      if (authHeader) {
        const key = authHeader.replace(/^Bearer\s+/i, '');
        const apiKey = await services.apiKeyManager.verify(key);

        if (apiKey) {
          socket.data.apiKey = apiKey;
          socket.data.authMethod = 'api_key';
          return next();
        }
      }

      // No valid auth found
      next(new Error('Authentication required'));
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  };
}

// Helper to parse cookie header
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}
```

**Add to spec**:
- [ ] FR-SOCKET-001: Socket.IO middleware for cookie + API key auth
- [ ] FR-SOCKET-002: Cookie parsing from handshake headers
- [ ] FR-SOCKET-003: Store auth context in `socket.data` for downstream use
- [ ] FR-SOCKET-004: Graceful handling of unauthenticated connections

**Note**: Socket.IO doesn't automatically parse cookies like SvelteKit does, so manual parsing is required.

---

### 4.2 Missing: Socket Session Refresh Handling

**Gap**: If a browser session expires while Socket.IO is connected, what happens?

**Recommendation**: Add session expiration handling:

```javascript
// FR-SOCKET-005: Session Expiration During Active Connection

// Server-side: Periodically check session validity
io.use((socket, next) => {
  // Set up session validation interval
  const checkInterval = setInterval(async () => {
    if (socket.data.authMethod === 'session_cookie') {
      const valid = await services.sessionManager.validateSession(
        socket.data.session.id
      );

      if (!valid) {
        socket.emit('session:expired', {
          message: 'Your session has expired. Please log in again.'
        });
        socket.disconnect(true);
      }
    }
  }, 60 * 1000);  // Check every minute

  socket.on('disconnect', () => {
    clearInterval(checkInterval);
  });

  next();
});

// Client-side: Handle session expiration
socket.on('session:expired', () => {
  // Clear local state
  sessionState.clear();

  // Redirect to login
  goto('/login?reason=session_expired');
});
```

**Add to spec**:
- [ ] FR-SOCKET-005: Periodic session validation for active connections
- [ ] FR-SOCKET-006: Emit `session:expired` event to client
- [ ] FR-SOCKET-007: Client-side session expiration handler

---

## 5. MVVM Architecture Integration

### 5.1 Missing: Client-Side State Management Pattern

**Gap**: The spec doesn't clarify how cookie sessions integrate with the existing MVVM architecture (ViewModels, Services, State).

**Current Architecture**:
- `AuthViewModel.svelte.js` - Manages auth UI state
- `socket-auth.js` - Client-side Socket.IO auth utilities
- `ServiceContainer` - Dependency injection for services

**Recommendation**: Add state management requirements:

```javascript
// FR-CLIENT-001: AuthViewModel Integration with Cookie Sessions

// src/lib/client/shared/state/AuthViewModel.svelte.js
export class AuthViewModel {
  constructor(sessionApi, socketService) {
    this.sessionApi = sessionApi;
    this.socketService = socketService;

    // Remove localStorage-based token state
    // Sessions are now managed server-side via cookies

    // UI state only
    this.loginForm = $state({
      key: '',
      error: null,
      loading: false
    });

    // Derived from server session (via +page.server.js load)
    this.isAuthenticated = $state(false);
    this.user = $state(null);
  }

  // Remove localStorage logic
  async loginWithKey(key) {
    this.loginForm.loading = true;
    this.loginForm.error = null;

    try {
      // Use form action instead of direct API call
      // Form action handles cookie setting
      const response = await fetch('/login', {
        method: 'POST',
        body: new FormData([['key', key]])
      });

      if (response.redirected) {
        // Successful login, SvelteKit will handle navigation
        window.location.href = response.url;
      } else {
        // Extract error from response
        const html = await response.text();
        this.loginForm.error = extractError(html);
      }
    } catch (error) {
      this.loginForm.error = error.message;
    } finally {
      this.loginForm.loading = false;
    }
  }

  async logout() {
    // Use form action to clear session cookie
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/login';
  }
}

// FR-CLIENT-002: Remove localStorage Dependencies
// Delete these functions from socket-auth.js:
// - getStoredAuthToken()  ❌
// - storeAuthToken()      ❌
// - clearAuthToken()      ❌

// Socket.IO auth now automatic via cookie
export function createAuthenticatedSocket(config = {}) {
  // Cookies sent automatically by browser
  // No manual token handling needed
  const socket = io(config.socketUrl || window.location.origin, {
    transports: ['websocket', 'polling'],
    withCredentials: true  // ✅ Send cookies
  });

  return socket;
}
```

**Add to spec**:
- [ ] FR-CLIENT-001: Refactor `AuthViewModel` to remove localStorage usage
- [ ] FR-CLIENT-002: Remove `socket-auth.js` token storage functions
- [ ] FR-CLIENT-003: Use `withCredentials: true` for Socket.IO cookie auth
- [ ] FR-CLIENT-004: Derive auth state from `event.locals` in `+layout.server.js`

---

### 5.2 Missing: Server Load Function Pattern

**Gap**: How do pages access session data? SvelteKit uses load functions.

**Recommendation**: Add load function requirements:

```javascript
// FR-CLIENT-005: Root Layout Load Function
// src/routes/+layout.server.js

export async function load({ locals }) {
  return {
    // Expose session data to all pages
    user: locals.user,
    session: locals.session ? {
      id: locals.session.id,
      expiresAt: locals.session.expiresAt,
      provider: locals.session.provider
    } : null
  };
}

// FR-CLIENT-006: Protected Page Pattern
// src/routes/dashboard/+page.server.js

export async function load({ locals }) {
  // Sessions validated in hooks, just check locals
  if (!locals.session) {
    redirect(303, '/login');
  }

  // Locals guaranteed to have user here
  return {
    sessions: await locals.services.db.getSessionsForUser(locals.user.id)
  };
}
```

**Add to spec**:
- [ ] FR-CLIENT-005: Root layout load exposes session to all pages
- [ ] FR-CLIENT-006: Protected pages check `locals.session` and redirect if null
- [ ] FR-CLIENT-007: Use `redirect()` helper from `@sveltejs/kit` for auth redirects

**Reference**: [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)

---

## 6. Testing Requirements

### 6.1 Missing: Test Strategy for Cookie-Based Auth

**Gap**: The spec mentions "Automated unit and Playwright tests" but doesn't specify test patterns.

**Recommendation**: Add testing requirements:

```javascript
// FR-TEST-001: Unit Test Pattern for SessionManager

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '$lib/server/auth/SessionManager.server.js';

describe('SessionManager', () => {
  let sessionManager;
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDatabase();
    sessionManager = new SessionManager(mockDb);
  });

  it('should create session with valid expiration', async () => {
    const session = await sessionManager.createSession({
      userId: 'test-user',
      provider: 'api_key'
    });

    expect(session.id).toBeDefined();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should reject expired session', async () => {
    const expiredSession = {
      id: 'expired-123',
      expiresAt: Date.now() - 1000
    };

    mockDb.getSession.mockResolvedValue(expiredSession);

    const result = await sessionManager.validateSession('expired-123');
    expect(result).toBeNull();
  });
});

// FR-TEST-002: Playwright E2E Test Pattern

import { test, expect } from '@playwright/test';

test.describe('Cookie-based authentication', () => {
  test('should login with API key and set cookie', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('input[name="key"]', 'test-api-key-12345');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');

    // Verify session cookie exists
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'dispatch_session');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.secure).toBe(true);
  });

  test('should maintain session across page loads', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="key"]', 'test-api-key-12345');
    await page.click('button[type="submit"]');

    // Navigate to different page
    await page.goto('/settings');

    // Should still be authenticated (no redirect to login)
    await expect(page).toHaveURL('/settings');
  });

  test('should logout and clear cookie', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="key"]', 'test-api-key-12345');
    await page.click('button[type="submit"]');

    // Logout
    await page.click('button[data-action="logout"]');

    // Should redirect to login
    await expect(page).toHaveURL('/login');

    // Session cookie should be cleared
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'dispatch_session');
    expect(sessionCookie).toBeUndefined();
  });
});
```

**Add to spec**:
- [ ] FR-TEST-001: Unit tests for SessionManager (create, validate, expire)
- [ ] FR-TEST-002: Unit tests for ApiKeyManager (hash, verify, timing attacks)
- [ ] FR-TEST-003: E2E test for login flow with cookie verification
- [ ] FR-TEST-004: E2E test for session persistence across page loads
- [ ] FR-TEST-005: E2E test for logout and cookie deletion
- [ ] FR-TEST-006: E2E test for Socket.IO auth with cookies

---

## 7. Migration Strategy Gaps

### 7.1 Missing: Backward Compatibility Plan

**Gap**: The spec says "No backwards compatibility" but existing users with localStorage tokens need a migration path.

**Recommendation**: Add migration requirements:

```javascript
// FR-MIGRATE-001: Graceful Migration from localStorage

// On first load after upgrade, detect old auth
export async function load({ locals, cookies }) {
  // If no cookie session but localStorage had token,
  // show migration prompt

  return {
    needsMigration: !locals.session,  // Will trigger client-side check
    user: locals.user,
    session: locals.session
  };
}

// Client-side migration helper
// src/routes/+layout.svelte
<script>
  import { onMount } from 'svelte';

  let { data } = $props();

  onMount(() => {
    if (data.needsMigration) {
      const oldToken = localStorage.getItem('dispatch-auth-token');
      if (oldToken) {
        // Show migration UI: "Re-enter your key to continue"
        // or auto-login if we can validate the old token
        showMigrationPrompt(oldToken);
      }
    }
  });
</script>
```

**Add to spec**:
- [ ] FR-MIGRATE-001: Detect localStorage auth and prompt re-authentication
- [ ] FR-MIGRATE-002: Show user-friendly migration message
- [ ] FR-MIGRATE-003: Clean up localStorage tokens after successful migration

---

## 8. Documentation Gaps

### 8.1 Missing: API Documentation Updates

**Gap**: The spec mentions updating docs but doesn't specify what needs to change.

**Recommendation**: Add documentation requirements:

**Add to spec**:
- [ ] DOC-001: Update API Routes Reference with cookie auth examples
- [ ] DOC-002: Update Socket.IO Events Reference with cookie auth pattern
- [ ] DOC-003: Add "Authentication Guide" with cookie vs API key comparison
- [ ] DOC-004: Update quickstart to show new login flow
- [ ] DOC-005: Add troubleshooting section for cookie issues (CORS, tunnel URLs, etc.)

---

## 9. Recommended Additions to Spec

### Add New Sections:

#### 9.1 Technical Architecture

```markdown
## Technical Architecture

### Session Management Flow

1. **Login via API Key**:
   - User submits API key via form action (`/login`)
   - Server validates key against hashed storage
   - Server creates session in database
   - Server sets httpOnly cookie with session ID
   - Client receives redirect to dashboard

2. **Authenticated Request**:
   - Browser sends cookie automatically
   - `hooks.server.js` extracts session ID from cookie
   - Server validates session (expiry, user lookup)
   - Server populates `event.locals.user` and `event.locals.session`
   - Route handler accesses `locals` for user context

3. **OAuth Login**:
   - User clicks "Login with GitHub"
   - Server redirects to GitHub OAuth
   - GitHub redirects back to `/auth/callback/github?code=...`
   - Server exchanges code for tokens
   - Server creates session (same flow as API key)
   - Client receives redirect to dashboard

4. **Logout**:
   - User submits logout form action
   - Server invalidates session in database
   - Server deletes session cookie
   - Client receives redirect to login page
```

#### 9.2 Security Considerations

```markdown
## Security Considerations

### Cookie Security
- **httpOnly**: Prevents JavaScript access (XSS protection)
- **Secure**: HTTPS-only in production
- **SameSite=lax**: CSRF protection for GET requests
- **Domain**: Not set (defaults to current domain)
- **Path**: `/` (accessible to entire app)

### Session Security
- **Absolute timeout**: 30 days maximum session lifetime
- **Idle timeout**: 7 days of inactivity invalidates session
- **Sliding window**: Sessions refresh when < 24h remaining
- **Secure random**: Session IDs generated with crypto.randomBytes(32)

### API Key Security
- **Hashing**: bcrypt with cost factor 12
- **Entropy**: 256-bit random keys (crypto.randomBytes(32))
- **Constant-time comparison**: Prevents timing attacks
- **Rate limiting**: (Future) Limit key validation attempts

### CSRF Protection
- **Form actions**: Built-in SvelteKit CSRF protection
- **API endpoints**: Origin header validation for session-based requests
- **API keys**: Exempt from CSRF (stateless, not cookie-based)
```

#### 9.3 Implementation Checklist

```markdown
## Implementation Checklist

### Phase 1: Server Infrastructure (Week 1)
- [ ] Create `SessionManager.server.js` with CRUD operations
- [ ] Create `ApiKeyManager.server.js` with hash/verify logic
- [ ] Create `CookieService.server.js` helper for cookie generation
- [ ] Add database migrations for sessions and API keys tables
- [ ] Implement `hooks.server.js` session validation
- [ ] Add TypeScript types for `event.locals`

### Phase 2: Authentication Flows (Week 2)
- [ ] Create login form action (`/login/+page.server.js`)
- [ ] Create logout form action
- [ ] Create OAuth callback handler (`/auth/callback/[provider]/+server.js`)
- [ ] Add API key management endpoints (`/api/keys/+server.js`)
- [ ] Implement onboarding flow for first API key

### Phase 3: Client Integration (Week 3)
- [ ] Refactor `AuthViewModel` to remove localStorage
- [ ] Update `socket-auth.js` for cookie-based Socket.IO auth
- [ ] Add root layout load function for session exposure
- [ ] Update protected routes with session checks
- [ ] Create API key management UI

### Phase 4: Socket.IO Integration (Week 4)
- [ ] Create Socket.IO auth middleware for cookies
- [ ] Add cookie parsing utility
- [ ] Implement session expiration handling
- [ ] Test Socket.IO with both cookie and API key auth

### Phase 5: Testing & Documentation (Week 5)
- [ ] Write unit tests for SessionManager
- [ ] Write unit tests for ApiKeyManager
- [ ] Write E2E tests for login/logout flows
- [ ] Write E2E tests for session persistence
- [ ] Update API documentation
- [ ] Create authentication guide
- [ ] Add troubleshooting section
```

---

## 10. Priority Recommendations

### High Priority (Must Address Before Implementation)

1. **Hooks Implementation Details** (Section 2.1)
   - Complete `hooks.server.js` specification
   - Session validation and refresh logic

2. **Server-Only Module Security** (Section 2.2)
   - Ensure no server auth logic leaks to client

3. **Database Schema** (Section 2.6)
   - Define complete schema for sessions and API keys
   - Migration scripts

4. **Form Actions** (Section 2.4)
   - Login/logout implementation patterns

5. **Socket.IO Cookie Auth** (Section 4.1)
   - Cookie parsing in handshake middleware

### Medium Priority (Important for Production)

6. **Session Expiration Policy** (Section 3.1)
   - Absolute and idle timeouts
   - Refresh mechanism

7. **CSRF Protection** (Section 3.2)
   - Origin validation for API endpoints

8. **API Key Lifecycle** (Section 3.4)
   - Secure generation and rotation

9. **Client State Management** (Section 5.1)
   - MVVM integration patterns

10. **Testing Strategy** (Section 6.1)
    - Unit and E2E test specifications

### Lower Priority (Can Be Addressed Post-Launch)

11. **OAuth Integration** (Section 2.5)
    - Optional feature, can iterate

12. **Migration Strategy** (Section 7.1)
    - Nice-to-have for smooth upgrade

13. **Documentation** (Section 8.1)
    - Can be updated incrementally

---

## 11. Final Recommendations

### Update the Spec With:

1. **New Functional Requirements Section**: Add FR-HOOKS-001 through FR-TEST-006 as enumerated requirements

2. **New Technical Architecture Section**: Add session flow diagrams and component interactions

3. **New Security Section**: Expand cookie security, session policy, and CSRF details

4. **New Implementation Guide Section**: Add code examples for hooks, form actions, and Socket.IO

5. **Revised Rollout Plan**: Break into 5 phases with clear deliverables

6. **Add to "Open Questions"**:
   - Should we support "Remember Me" (longer session duration)?
   - Should we implement rate limiting for API key validation?
   - Should we add 2FA support for session creation?
   - How should we handle concurrent sessions (multiple browsers)?

### Before Implementation:

- [ ] Review database schema changes with DBA
- [ ] Confirm Socket.IO cookie parsing works with current version
- [ ] Prototype hooks.server.js validation logic
- [ ] Design UI mockups for API key management
- [ ] Create test plan document referencing FR-TEST-* requirements

---

## Conclusion

The cookie authentication PRD provides a solid conceptual foundation but requires significant SvelteKit-specific implementation details to be production-ready. The main gaps are:

1. **Missing SvelteKit Patterns**: Hooks, form actions, load functions, locals
2. **Security Specifics**: Session expiration, CSRF, secure cookies per environment
3. **Socket.IO Integration**: Cookie parsing, session validation in handshake
4. **MVVM Alignment**: Client state management without localStorage
5. **Testing Strategy**: Unit and E2E patterns for cookie-based auth

By addressing the recommendations in this review—particularly the High Priority items—the spec will be ready for implementation with clear, actionable requirements that align with SvelteKit best practices and the existing Dispatch architecture.
