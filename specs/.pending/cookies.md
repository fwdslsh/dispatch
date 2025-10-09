# Product Requirements Document — Cookie Sessions & Managed API Keys

## Overview

Dispatch will transition to an authentication architecture tailored for a single primary user that combines:

- Managed API keys created during onboarding and maintained in-app for any non-browser integrations.
- Optional OAuth providers the user can enable for convenience.
- Secure, SvelteKit-issued cookies for all authenticated browser sessions.

The system removes legacy bearer-token flows, keeps the browser experience frictionless, and gives the user explicit control over the credentials that reach the API or Socket.IO interfaces.

## Background

- Auth today is powered by a single terminal key stored in localStorage and re-used across API calls, pages, and Socket.IO, creating security concerns and awkward UX.
- We no longer need backwards compatibility with existing keys or stored sessions; we can re-imagine onboarding and session storage from a clean slate.
- A unified model that splits browser and programmatic access (cookies vs. API keys) reduces complexity while staying compatible with optional OAuth logins.

## Goals

- Provide a hardened onboarding flow that issues the first API key and sets up the default browser session.
- Allow the user to create, label, rotate, and revoke API keys at any point from the UI.
- Support optional OAuth providers; when enabled, successful OAuth login mints the same SvelteKit cookie session.
- Ensure every surface—pages, `+server` endpoints, and Socket.IO—relies on one session evaluator.

## Non-Goals

- Maintaining legacy bearer-token compatibility or migrating existing localStorage data.
- Multi-user account management or granular RBAC.
- Advanced audit tooling (can be layered later).

## Personas & Use Cases

1. **Primary operator (browser)** — completes onboarding, receives a cookie-backed session, and later manages API keys and OAuth settings from the dashboard.
2. **Automation scripts / CLI tools** — authenticate to REST endpoints and Socket.IO by sending an API key in headers or connection metadata.
3. **Support/secondary tooling** — optional OAuth-based login that still ends in a standard cookie session for browser usage.

## Solution Approach

- **Onboarding-generated API key**: First-run flow mints a random API key, hashes and stores it server-side, shows it once to the user, and immediately sets a browser session cookie.
- **Session cookies**: All browser logins—whether via API key or OAuth—issue an httpOnly, Secure, SameSite=Lax cookie from the SvelteKit `handle` hook. Session data lives in `event.locals.session` for downstream handlers.
- **API key management UI**: A settings section lets the user generate, label, disable, or delete API keys. Keys are stored hashed (bcrypt/argon2) with metadata and can be toggled without restarts.
- **OAuth toggles**: Settings allow enabling supported providers (GitHub, Google, etc.). Successful OAuth callback creates the same session cookie and optionally spawns a new API key if requested.
- **API enforcement**: REST `+server` endpoints and the CLI API layer expect an `Authorization: ApiKey <token>` header (or similar) and validate against the stored hashes. No cookie fallback is performed for these programmatic calls.
- **Socket.IO enforcement**: Handshake middleware checks for either the active session cookie (browser) or an API key passed via header/query, using the same validator as REST.
- **Central validator**: Refactor `AuthService` to act as a façade over the session store (cookies) and API key store, removing localStorage assumptions.

## Functional Requirements

- [ ] Onboarding flow that issues the first API key, stores it hashed, and writes an authenticated cookie for the browser.
- [ ] API endpoints to list, create, label, disable, and delete API keys, with UI integration.
- [ ] OAuth provider management UI and server plumbing to enable/disable providers and share session issuance logic.
- [ ] SvelteKit `handle` hook that reads/writes session cookies and populates `event.locals.session`.
- [ ] API guard utilities that validate either session cookies (browser) or API keys (programmatic) and reject all other auth attempts.
- [ ] Socket.IO middleware that mirrors the API guard logic for both cookies and API keys.

## Non-Functional Requirements

- API key secrets are hashed at rest, never logged, and only presented once on creation.
- Cookies are httpOnly, Secure (except in dev), and rotated on login, logout, and sensitive settings changes.
- Session and key stores survive restarts (SQLite persistence) and are accessible to background workers if needed.
- Automated unit and Playwright tests cover onboarding, key management, cookie session persistence, and Socket.IO auth.
- Docs (`docs/`, `README`) updated to describe onboarding, key usage, and OAuth configuration.

## Success Metrics

- Browser logins no longer rely on localStorage credentials (verified by instrumentation/tests).
- All API requests without an API key are rejected with 401.
- User can rotate an API key and see old credentials denied within one request.
- Zero critical auth regressions in post-launch smoke tests.

## Risks & Mitigations

- **API key leakage**: Present key only once, encourage copy-to-clipboard, and allow immediate revocation from UI.
- **Cookie misconfiguration**: Provide sensible defaults in dev vs. prod (`Secure`, `SameSite`) and add diagnostics when mis-set.
- **OAuth edge cases**: Keep OAuth optional; if disabled, the flow should gracefully fallback to API key login.
- **Single cookie failure**: Support re-login via API key if cookie expires or is cleared.

## Rollout Plan

1. Implement the new onboarding flow and session cookie handler (no migration needed).
2. Build API key CRUD APIs and UI, wired into `AuthService`.
3. Update REST endpoints and Socket.IO middleware to rely solely on the new guards.
4. Integrate optional OAuth callbacks with the shared session writer.
5. Ship documentation and automate Playwright coverage for browser + API key scenarios.

## Open Questions

- Should Socket.IO accept API keys via headers or only via handshake query/body? (default: header for parity with REST)
- Do we need rate limits or usage analytics per API key? (nice-to-have)
- Is a CLI helper command needed for key creation/rotation? (possible follow-up)

## QA & Validation

No code changes in this PRD drafting phase; automated checks not run.

## Requirements Coverage

- Updated PRD describing cookie sessions + managed API keys architecture ✔️

---

## Code Refactoring Analysis

### Executive Summary

This analysis examines the current Dispatch authentication implementation to identify refactoring opportunities, code removal candidates, and reusable components for implementing cookie-based authentication. The codebase currently uses localStorage-based bearer token authentication across client and server layers, Socket.IO middleware, and MVVM ViewModels.

**Key Findings:**
- **Current Implementation**: localStorage-based bearer tokens managed by `AuthViewModel.svelte.js` and `socket-auth.js`
- **Server Auth**: `AuthService` class with terminal key validation and OAuth session support
- **Database**: Existing `auth_sessions` and `auth_users` tables suitable for cookie sessions
- **MVVM Pattern**: Clean separation between ViewModels and Services, ideal for refactoring
- **Migration Path**: Gradual migration possible with dual auth support during transition

---

### Current Implementation Inventory

#### Client-Side Authentication Components

**1. `/src/lib/client/shared/state/AuthViewModel.svelte.js`** (286 lines)
- **Purpose**: Authentication ViewModel with Svelte 5 runes
- **localStorage usage**:
  - Line 141: `localStorage.getItem('dispatch-auth-token')`
  - Line 161: `localStorage.removeItem('dispatch-auth-token')`
  - Line 198: `localStorage.setItem('dispatch-auth-token', key)`
- **Key methods**:
  - `checkExistingAuth()` - Validates stored key on init
  - `loginWithKey(key)` - Terminal key login
  - `loginWithOAuth()` - OAuth redirect flow
- **Refactor needed**: Remove localStorage, adapt for cookie sessions
- **Reusable**: MVVM structure, reactive state patterns, error handling

**2. `/src/lib/client/shared/socket-auth.js`** (158 lines)
- **Purpose**: Socket.IO authentication utilities
- **localStorage usage**:
  - Line 17: `getStoredAuthToken()` - Retrieves token from localStorage
  - Line 24: `storeAuthToken()` - Stores token in localStorage
  - Line 31: `clearAuthToken()` - Removes token from localStorage
- **Key functions**:
  - `createAuthenticatedSocket()` - Creates Socket.IO connection with auth
  - `testAuthKey()` - Tests key validity
  - `authenticateSocket()` - Authenticates existing socket
- **Refactor needed**: Remove token storage, add `withCredentials: true` for cookies
- **Delete candidates**: Lines 13-33 (all localStorage functions)

**3. `/src/lib/client/shared/services/SocketService.svelte.js`** (448 lines)
- **Purpose**: Centralized Socket.IO management
- **Current auth**: `authenticate(key)` method emits 'auth' event
- **Refactor needed**: Add cookie support, remove manual auth emission
- **Reusable**: Connection management, event handling, message queuing

**4. `/src/lib/client/shared/services/ServiceContainer.svelte.js`**
- **Purpose**: Dependency injection container
- **Current state**: Clean architecture, no auth-specific code
- **Action**: No changes needed, can inject new SessionService

#### Server-Side Authentication Components

**5. `/src/lib/server/shared/auth.js`** (239 lines)
- **Purpose**: `AuthService` singleton for authentication
- **Current implementation**:
  - Terminal key validation (sync, fast path)
  - OAuth session validation (async, DB lookup)
  - Multi-strategy auth via `validateAuth(token)`
- **Refactor needed**:
  - Keep multi-strategy pattern
  - Add cookie session validation
  - Adapt `validateAuth()` to check cookies OR API keys OR OAuth sessions
- **Reusable**: `AuthService` class structure, terminal key caching

**6. `/src/hooks.server.js`** (114 lines)
- **Purpose**: SvelteKit hooks middleware
- **Current implementation**:
  - `servicesMiddleware` - Injects services into `event.locals`
  - `authenticationMiddleware` - Validates Bearer token from Authorization header
  - Public routes bypass auth
- **Refactor needed**:
  - Add session cookie reading/writing
  - Add session validation and refresh logic
  - Keep API route protection pattern
- **Reusable**: Services injection, public route handling, multi-auth strategy

**7. `/src/lib/server/auth/session.js`** (418 lines)
- **Purpose**: `AuthSessionManager` - 30-day rolling sessions
- **Current implementation**:
  - Creates `auth_sessions` table with terminal key hashes
  - Session creation, validation, extension
  - Cleanup of expired sessions
- **Refactor needed**:
  - Adapt for cookie-based session IDs instead of terminal key validation
  - Add provider field for 'api_key' vs 'oauth_github' vs 'cookie'
  - Keep session lifecycle management
- **Highly reusable**: Session CRUD, expiration logic, cleanup timer

**8. `/src/lib/server/auth/JWTService.js`** (58 lines)
- **Purpose**: JWT token generation and validation
- **Current usage**: Used for Socket.IO middleware
- **Future role**: May be deprecated in favor of cookie sessions + API key hashes
- **Decision needed**: Keep for API keys or remove entirely?

**9. `/src/lib/server/socket/middleware/auth.js`** (45 lines)
- **Purpose**: Socket.IO authentication middleware using JWT
- **Refactor needed**:
  - Add cookie parsing from handshake headers
  - Support both cookie sessions AND API key auth
  - Remove JWT dependency if not needed
- **Reusable**: Middleware pattern, event filtering

**10. `/src/lib/server/socket/handlers/authHandlers.js`** (85 lines)
- **Purpose**: Socket.IO auth event handlers
- **Current events**: `hello`, `validateToken`, `refreshToken`
- **Refactor needed**:
  - Remove JWT-specific handlers
  - Add session validation handlers if needed
- **Decision needed**: May be obsolete if cookies handle auth automatically

#### API Routes

**11. `/src/routes/api/auth/check/+server.js`** (18 lines)
- **Purpose**: Auth validation endpoint
- **Current**: Checks `locals.auth.authenticated` from hooks
- **Refactor needed**: No changes (hooks handle validation)
- **Reusable**: Entire file unchanged

**12. `/src/routes/api/auth/config/+server.js`** (143 lines)
- **Purpose**: Get/set authentication configuration
- **Current**: Returns terminal key and OAuth config status
- **Refactor needed**: Add API key configuration endpoints
- **Reusable**: Settings repository pattern, public route pattern

**13. `/src/routes/api/auth/callback/+server.js`**
- **Purpose**: OAuth callback handler
- **Refactor needed**: Set session cookie instead of returning token
- **Reusable**: OAuth exchange logic

#### Database Schema

**14. Database Tables** (from `/docs/reference/database-schema.md`)

**Existing tables that can be reused:**
- `auth_sessions` (lines 284-289) - Session storage
  - Current fields: `session_id`, `user_id`, `expires_at`, `created_at`
  - **Migration needed**: Add `provider`, `last_active_at`, `session_data` JSON
- `auth_users` (lines 293-304) - User accounts
  - Current fields: `user_id`, `email`, `name`, `created_at`, `last_login`
  - **Reusable**: No changes needed

**New tables needed:**
- `auth_api_keys` - API key storage (see cookies-review.md lines 328-341)
  - Fields: `id`, `user_id`, `key_hash`, `label`, `created_at`, `last_used_at`, `disabled`

#### Layout and UI Components

**15. `/src/routes/+layout.server.js`** (14 lines)
- **Purpose**: Root layout load function
- **Current**: Exposes `hasTerminalKey` to client
- **Refactor needed**: Expose session data from `event.locals.session`
- **Pattern**: Load function for session propagation (cookies-review.md line 813)

**16. `/src/lib/client/onboarding/AuthenticationStep.svelte`**
- **Purpose**: Onboarding authentication step
- **Uses**: `AuthViewModel` for login
- **Refactor needed**: Update to use cookie-based flow

---

### Refactoring Strategy by Component

#### A. Client-Side Refactoring

##### **MUST REFACTOR: AuthViewModel.svelte.js**

**Before (localStorage-based):**
```javascript
async checkExistingAuth() {
  const storedKey = localStorage.getItem('dispatch-auth-token');
  if (!storedKey) return false;

  const response = await fetch('/api/auth/check', {
    headers: { authorization: `Bearer ${storedKey}` }
  });

  if (response.ok) return true;
  localStorage.removeItem('dispatch-auth-token');
  return false;
}

async loginWithKey(key) {
  const response = await fetch('/api/auth/check', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` }
  });

  if (response.ok) {
    localStorage.setItem('dispatch-auth-token', key);
    return { success: true };
  }
}
```

**After (cookie-based via form actions):**
```javascript
async checkExistingAuth() {
  // Session is now server-side, check via load function
  // No localStorage access needed
  const response = await fetch('/api/auth/check');
  return response.ok;
}

async loginWithKey(key) {
  // Use SvelteKit form action instead of manual fetch
  const formData = new FormData();
  formData.append('key', key);

  const response = await fetch('/login', {
    method: 'POST',
    body: formData
  });

  if (response.redirected) {
    // Cookie set by server, redirect to app
    window.location.href = response.url;
    return { success: true };
  }

  // Extract error from form action response
  const html = await response.text();
  return { success: false, error: extractError(html) };
}
```

**Changes:**
- **Remove**: Lines 141, 161, 198 (all localStorage access)
- **Add**: Form action submission pattern
- **Keep**: Reactive state (`$state`), error handling, loading states

**Impact**: ✅ Breaking change (requires new login flow)

---

##### **MUST REFACTOR: socket-auth.js**

**Before (manual token passing):**
```javascript
export function getStoredAuthToken() {
  return localStorage.getItem('dispatch-auth-token');
}

export async function createAuthenticatedSocket(options, config) {
  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    ...options
  });

  const token = getStoredAuthToken();
  if (!token) {
    socket.disconnect();
    return { socket: null, authenticated: false };
  }

  socket.emit('auth', token, (response) => {
    if (response?.success) {
      resolve({ socket, authenticated: true });
    }
  });
}
```

**After (cookie-based auth):**
```javascript
// DELETE: getStoredAuthToken(), storeAuthToken(), clearAuthToken()

export async function createAuthenticatedSocket(options, config) {
  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    withCredentials: true,  // ← Send cookies automatically
    ...options
  });

  // No manual auth needed - cookies sent automatically
  return { socket, authenticated: true };
}
```

**Changes:**
- **Delete**: Lines 13-33 (localStorage functions)
- **Add**: `withCredentials: true` to socket config
- **Remove**: Manual `auth` event emission
- **Keep**: Socket.IO connection logic, error handling

**Impact**: ✅ Breaking change (simplified auth flow)

---

##### **CAN REUSE: SocketService.svelte.js**

**Current `authenticate()` method:**
```javascript
async authenticate(key) {
  return new Promise((resolve, reject) => {
    this.socket.emit('auth', key, (response) => {
      if (response?.success) {
        this.authenticated = true;
        resolve(true);
      }
    });
  });
}
```

**Refactor to cookie-based:**
```javascript
async authenticate() {
  // With cookies, authentication is automatic
  // Just verify connection is authenticated
  return new Promise((resolve, reject) => {
    this.socket.emit('auth:verify', (response) => {
      this.authenticated = response?.authenticated ?? false;
      resolve(this.authenticated);
    });
  });
}
```

**OR remove entirely if cookies make it unnecessary:**
```javascript
// Delete authenticate() method
// Connection with withCredentials: true is already authenticated
```

**Changes:**
- **Option 1**: Simplify `authenticate()` to verification only
- **Option 2**: Remove `authenticate()` entirely
- **Keep**: All connection management, event handling, message queuing

**Impact**: ⚠️ Minor breaking change (method signature change or removal)

---

#### B. Server-Side Refactoring

##### **MUST REFACTOR: hooks.server.js**

**Before (Bearer token validation):**
```javascript
async function authenticationMiddleware({ event, resolve }) {
  if (!pathname.startsWith('/api/')) return resolve(event);

  const authService = event.locals.services.auth;
  const token = authService.getAuthKeyFromRequest(event.request);

  if (!token) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  const authResult = await authService.validateAuth(token);
  if (!authResult.valid) {
    return json({ error: 'Invalid authentication token' }, { status: 401 });
  }

  event.locals.auth = {
    provider: authResult.provider,
    userId: authResult.userId,
    authenticated: true
  };

  return resolve(event);
}
```

**After (cookie + API key multi-auth):**
```javascript
async function authenticationMiddleware({ event, resolve }) {
  const { pathname } = event.url;
  const { auth, sessionManager } = event.locals.services;

  // Skip auth for public routes
  if (isPublicRoute(pathname)) return resolve(event);

  // Strategy 1: Check for session cookie (browser clients)
  const sessionId = event.cookies.get('dispatch_session');
  if (sessionId) {
    const { session, user } = await sessionManager.validateSession(sessionId);

    if (session?.fresh) {
      // Refresh cookie with new expiration
      event.cookies.set('dispatch_session', session.id, {
        path: '/',
        httpOnly: true,
        secure: !dev,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    if (session) {
      event.locals.user = user;
      event.locals.session = session;
      event.locals.auth = {
        provider: session.provider,
        authenticated: true
      };
      return resolve(event);
    } else {
      // Expired session, clear cookie
      event.cookies.delete('dispatch_session', { path: '/' });
    }
  }

  // Strategy 2: Check for API key (programmatic clients)
  // Only for API routes
  if (pathname.startsWith('/api/')) {
    const apiKey = auth.getAuthKeyFromRequest(event.request);
    if (apiKey) {
      const authResult = await auth.validateAuth(apiKey);
      if (authResult.valid) {
        event.locals.auth = {
          provider: authResult.provider,
          authenticated: true
        };
        return resolve(event);
      }
    }

    // No valid auth found for API route
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  // Non-API routes without session redirect to login
  if (!event.locals.session && !isPublicRoute(pathname)) {
    return new Response(null, {
      status: 303,
      headers: { location: '/login' }
    });
  }

  return resolve(event);
}
```

**Changes:**
- **Add**: Cookie reading via `event.cookies.get()`
- **Add**: Session validation and refresh logic
- **Add**: Cookie writing for session refresh
- **Add**: Redirect to login for unauthenticated browser requests
- **Keep**: API key validation for programmatic access
- **Keep**: Multi-strategy auth pattern

**Impact**: ✅ Major enhancement (dual auth support)

---

##### **MUST REFACTOR: AuthService (auth.js)**

**Current validateAuth():**
```javascript
async validateAuth(token) {
  // Strategy 1: Terminal key validation (sync)
  if (this.validateKey(token)) {
    return { valid: true, provider: 'terminal_key' };
  }

  // Strategy 2: OAuth session validation (async)
  if (this.multiAuthManager) {
    const session = await this.multiAuthManager.validateSession(token);
    if (session) {
      return {
        valid: true,
        provider: session.provider,
        userId: session.userId
      };
    }
  }

  return { valid: false };
}
```

**After (add API key validation):**
```javascript
async validateAuth(token) {
  // Strategy 1: API key validation (async, bcrypt compare)
  if (this.apiKeyManager) {
    try {
      const apiKey = await this.apiKeyManager.verify(token);
      if (apiKey) {
        return {
          valid: true,
          provider: 'api_key',
          apiKeyId: apiKey.id,
          label: apiKey.label
        };
      }
    } catch (error) {
      // Continue to next strategy
    }
  }

  // Strategy 2: Terminal key validation (sync, backwards compat)
  if (this.validateKey(token)) {
    return { valid: true, provider: 'terminal_key' };
  }

  // Strategy 3: OAuth session validation (async)
  if (this.multiAuthManager) {
    const session = await this.multiAuthManager.validateSession(token);
    if (session) {
      return {
        valid: true,
        provider: session.provider,
        userId: session.userId
      };
    }
  }

  return { valid: false };
}
```

**Changes:**
- **Add**: `ApiKeyManager` dependency
- **Add**: API key validation as first strategy
- **Keep**: Terminal key validation (backwards compat during migration)
- **Keep**: OAuth session validation
- **Keep**: Multi-strategy pattern

**Impact**: ✅ Non-breaking addition (new auth method)

---

##### **HIGHLY REUSABLE: AuthSessionManager (session.js)**

**Current session.js implementation:**
- ✅ Already has session CRUD operations
- ✅ Already has 30-day rolling window
- ✅ Already has cleanup timer
- ✅ Already uses SQLite for persistence

**Minor adaptations needed:**

```javascript
// BEFORE: Hash terminal key for storage
async createSession(terminalKey, sessionInfo) {
  const terminalKeyHash = this.hashTerminalKey(terminalKey);
  // ...
}

// AFTER: Store provider and session metadata
async createSession(userId, provider, sessionInfo) {
  const sessionId = randomUUID();
  const now = Date.now();

  await db.run(`
    INSERT INTO auth_sessions (
      id, user_id, provider, expires_at, created_at, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    sessionId,
    userId,
    provider,  // 'api_key' | 'oauth_github' | 'oauth_google'
    now + SESSION_DURATION_MS,
    now,
    now
  ]);

  return { sessionId, expiresAt: now + SESSION_DURATION_MS };
}
```

**Changes:**
- **Remove**: Terminal key hashing (not needed for cookie sessions)
- **Add**: Provider field ('api_key', 'oauth_github', etc.)
- **Keep**: Session validation, extension, cleanup
- **Keep**: 30-day rolling window logic

**Impact**: ✅ Minor refactor (adapt to cookie sessions)

---

##### **MUST CREATE: ApiKeyManager.server.js**

**New server-only module for API key management:**

```javascript
// src/lib/server/auth/ApiKeyManager.server.js

import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

export class ApiKeyManager {
  constructor(dbManager) {
    this.db = dbManager;
  }

  /**
   * Generate new API key
   * @returns {Promise<{id, key, label}>} - Plain key returned ONCE
   */
  async generateKey(userId, label) {
    const key = randomBytes(32).toString('base64url'); // 256-bit
    const keyHash = await bcrypt.hash(key, 12); // High cost factor
    const keyId = randomUUID();

    await this.db.run(`
      INSERT INTO auth_api_keys (
        id, user_id, key_hash, label, created_at, disabled
      ) VALUES (?, ?, ?, ?, ?, 0)
    `, [keyId, userId, keyHash, label, Date.now()]);

    // Return plain key ONCE (never stored)
    return { id: keyId, key, label };
  }

  /**
   * Verify API key (constant-time comparison)
   */
  async verify(key) {
    const keys = await this.db.all(`
      SELECT * FROM auth_api_keys WHERE disabled = 0
    `);

    for (const storedKey of keys) {
      const match = await bcrypt.compare(key, storedKey.key_hash);
      if (match) {
        // Update last used (async, don't block)
        this.db.run(`
          UPDATE auth_api_keys
          SET last_used_at = ?
          WHERE id = ?
        `, [Date.now(), storedKey.id]).catch(console.error);

        return {
          id: storedKey.id,
          label: storedKey.label,
          userId: storedKey.user_id
        };
      }
    }

    return null;
  }

  /**
   * List API keys for user
   */
  async listKeys(userId) {
    return await this.db.all(`
      SELECT id, label, created_at, last_used_at, disabled
      FROM auth_api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
  }

  /**
   * Disable API key (soft delete)
   */
  async disableKey(keyId, userId) {
    await this.db.run(`
      UPDATE auth_api_keys SET disabled = 1
      WHERE id = ? AND user_id = ?
    `, [keyId, userId]);
  }

  /**
   * Delete API key (hard delete)
   */
  async deleteKey(keyId, userId) {
    await this.db.run(`
      DELETE FROM auth_api_keys
      WHERE id = ? AND user_id = ?
    `, [keyId, userId]);
  }
}
```

**Impact**: ✅ New module (no breaking changes)

---

##### **MUST REFACTOR: Socket.IO Middleware**

**Before (JWT-based):**
```javascript
// src/lib/server/socket/middleware/auth.js
export function createAuthMiddleware(jwtService) {
  return ([event, ...args], next) => {
    const data = args[0];
    const token = data?.authKey;

    const claims = jwtService.validateToken(token);
    data.userId = claims.userId;
    next();
  };
}
```

**After (cookie + API key based):**
```javascript
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

// Helper to parse cookies from header
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}
```

**Changes:**
- **Add**: Cookie parsing from handshake headers
- **Add**: API key validation from auth header
- **Remove**: JWT dependency
- **Keep**: Middleware pattern

**Impact**: ✅ Breaking change (new auth mechanism)

---

#### C. Form Actions and Routes

##### **MUST CREATE: Login Form Action**

```javascript
// src/routes/login/+page.server.js

import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  login: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    const key = data.get('key');

    if (!key) {
      return fail(400, { error: 'API key required', key: '' });
    }

    // Validate API key
    const validKey = await locals.services.apiKeyManager.verify(key);

    if (!validKey) {
      return fail(401, { error: 'Invalid API key', key });
    }

    // Create session
    const session = await locals.services.sessionManager.createSession(
      validKey.userId || 'default',
      'api_key',
      { apiKeyId: validKey.id, label: validKey.label }
    );

    // Set session cookie
    cookies.set('dispatch_session', session.sessionId, {
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

**Impact**: ✅ New file (no breaking changes)

---

##### **MUST CREATE: API Key Management Endpoints**

```javascript
// src/routes/api/keys/+server.js

import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
  if (!locals.auth?.authenticated) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = locals.user?.id || 'default';
  const keys = await locals.services.apiKeyManager.listKeys(userId);

  return json({ keys });
}

export async function POST({ request, locals }) {
  if (!locals.auth?.authenticated) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { label } = await request.json();
  const userId = locals.user?.id || 'default';

  // Generate new API key
  const { id, key, label: keyLabel } = await locals.services.apiKeyManager.generateKey(
    userId,
    label || 'Unnamed Key'
  );

  // Return plain key ONCE
  return json({
    success: true,
    apiKey: {
      id,
      key,  // Only time this is exposed
      label: keyLabel,
      message: 'Save this key - it will not be shown again'
    }
  });
}

export async function DELETE({ request, locals }) {
  if (!locals.auth?.authenticated) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { keyId } = await request.json();
  const userId = locals.user?.id || 'default';

  await locals.services.apiKeyManager.deleteKey(keyId, userId);

  return json({ success: true });
}
```

**Impact**: ✅ New file (no breaking changes)

---

### Code Removal Candidates

#### **HIGH PRIORITY: DELETE**

1. **`/src/lib/client/shared/socket-auth.js`** - Lines 13-33
   ```javascript
   // DELETE: All localStorage functions
   export function getStoredAuthToken() { ... }
   export function storeAuthToken(token) { ... }
   export function clearAuthToken() { ... }
   ```
   **Justification**: Cookie-based auth eliminates need for client-side token storage

2. **`/src/lib/client/shared/state/AuthViewModel.svelte.js`** - Lines 141, 161, 198
   ```javascript
   // DELETE: All localStorage access
   localStorage.getItem('dispatch-auth-token')
   localStorage.removeItem('dispatch-auth-token')
   localStorage.setItem('dispatch-auth-token', key)
   ```
   **Justification**: Sessions managed server-side via cookies

3. **`/src/lib/server/auth/JWTService.js`** - Entire file (58 lines)
   ```javascript
   // DELETE: JWT token generation/validation
   export class JWTService { ... }
   ```
   **Justification**: Replaced by cookie sessions + bcrypt-hashed API keys
   **Caveat**: May keep if JWT needed for other purposes

4. **`/src/lib/server/socket/handlers/authHandlers.js`** - Lines 36-82
   ```javascript
   // DELETE: JWT-specific handlers
   async validateToken(socket, data, callback) { ... }
   async refreshToken(socket, data, callback) { ... }
   ```
   **Justification**: Cookie auth handles token lifecycle

#### **MEDIUM PRIORITY: DEPRECATE (keep during migration)**

5. **`/src/lib/server/shared/auth.js`** - Terminal key validation (Lines 106-109, 118-122)
   ```javascript
   // DEPRECATE: Direct terminal key validation
   validateKey(key) { ... }
   requireAuth(key) { ... }
   ```
   **Justification**: Keep for backwards compatibility during migration, remove later

6. **`/src/routes/+layout.server.js`** - Lines 4-9
   ```javascript
   // DEPRECATE: Terminal key exposure to client
   export async function load() {
     const hasTerminalKey = !!(env.TERMINAL_KEY && env.TERMINAL_KEY.trim() !== '');
     return { hasTerminalKey, terminalKey: hasTerminalKey ? process.env.TERMINAL_KEY : '' };
   }
   ```
   **Justification**: Replace with session data from `event.locals`

#### **LOW PRIORITY: REFACTOR (not delete)**

7. **`/src/lib/client/shared/services/SocketService.svelte.js`** - Lines 206-232
   ```javascript
   // REFACTOR: Simplify authenticate() method
   async authenticate(key) { ... }
   ```
   **Justification**: Cookies make manual auth unnecessary, but method may be useful for verification

---

### Reusable Components (No Changes Needed)

#### **Client-Side**

1. **ServiceContainer.svelte.js** - Dependency injection
   - ✅ No auth-specific code
   - ✅ Can inject new SessionService
   - ✅ Pattern unchanged

2. **MVVM ViewModel Pattern**
   - ✅ Reactive `$state` runes
   - ✅ Derived state `$derived.by()`
   - ✅ Error handling patterns
   - ✅ Loading states

3. **SocketService Event Handling**
   - ✅ Connection management
   - ✅ Event registration/cleanup
   - ✅ Message queuing
   - ✅ Reconnection logic

#### **Server-Side**

4. **AuthSessionManager (session.js)**
   - ✅ Session CRUD operations
   - ✅ 30-day rolling window
   - ✅ Expiration and cleanup
   - ✅ SQLite persistence
   - Minor adaptation: Remove terminal key hashing, add provider field

5. **hooks.server.js Patterns**
   - ✅ Services injection (`servicesMiddleware`)
   - ✅ Public route handling
   - ✅ Multi-strategy auth pattern
   - ✅ `event.locals` propagation

6. **Database Schema**
   - ✅ `auth_sessions` table (minor migration needed)
   - ✅ `auth_users` table (no changes)
   - ✅ WAL mode and pragmas
   - ✅ Migration system

7. **Error Handling Patterns**
   - ✅ Async/await with try-catch
   - ✅ Standardized error responses
   - ✅ Logger integration

---

### Migration Risks and Mitigation

#### **Risk 1: Breaking Changes for Existing Users**

**Issue**: Users with localStorage tokens will lose authentication

**Mitigation**:
1. **Dual Auth Support**: Keep terminal key validation during transition period
2. **Migration Prompt**: Detect localStorage token on first load, show re-auth prompt
3. **Cleanup**: Remove old localStorage tokens after successful migration

**Implementation**:
```javascript
// src/routes/+layout.svelte
onMount(() => {
  const oldToken = localStorage.getItem('dispatch-auth-token');
  if (oldToken && !data.session) {
    // Show migration UI: "Please log in with your API key to continue"
    showMigrationDialog();
    localStorage.removeItem('dispatch-auth-token');
  }
});
```

---

#### **Risk 2: Socket.IO Cookie Parsing**

**Issue**: Socket.IO doesn't automatically parse cookies like SvelteKit

**Mitigation**:
1. Manual cookie parsing from `socket.handshake.headers.cookie`
2. Test across browsers (Chrome, Firefox, Safari)
3. Handle missing/malformed cookie headers gracefully

**Implementation**: See "MUST REFACTOR: Socket.IO Middleware" above

---

#### **Risk 3: CSRF Protection**

**Issue**: Cookie-based auth requires CSRF protection for state-changing operations

**Mitigation**:
1. **Form Actions**: SvelteKit provides built-in CSRF protection
2. **API Endpoints**: Validate `Origin` header for cookie-based requests
3. **API Keys**: Exempt from CSRF (stateless, not cookie-based)

**Implementation**:
```javascript
// API routes with cookie auth
export async function POST({ request, url, locals }) {
  if (locals.auth.provider === 'session_cookie') {
    // Validate origin for cookie-based requests
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) {
      return json({ error: 'Invalid origin' }, { status: 403 });
    }
  }

  // API key requests don't need CSRF validation
  // ...
}
```

---

#### **Risk 4: Session Expiration During Active Connection**

**Issue**: If session expires while Socket.IO is connected, what happens?

**Mitigation**:
1. **Periodic Validation**: Check session validity every minute
2. **Emit Event**: Notify client of session expiration
3. **Graceful Disconnect**: Client redirects to login

**Implementation**:
```javascript
// Server-side: Check session validity periodically
io.use((socket, next) => {
  const checkInterval = setInterval(async () => {
    if (socket.data.authMethod === 'session_cookie') {
      const valid = await validateSession(socket.data.session.id);
      if (!valid) {
        socket.emit('session:expired', {
          message: 'Your session has expired. Please log in again.'
        });
        socket.disconnect(true);
      }
    }
  }, 60 * 1000); // Check every minute

  socket.on('disconnect', () => clearInterval(checkInterval));
  next();
});

// Client-side: Handle session expiration
socket.on('session:expired', () => {
  goto('/login?reason=session_expired');
});
```

---

#### **Risk 5: Database Migration Failures**

**Issue**: Schema changes could fail on production databases

**Mitigation**:
1. **Idempotent Migrations**: Use `IF NOT EXISTS` and `PRAGMA table_info()` checks
2. **Rollback Plan**: Keep old auth system running until migration confirmed
3. **Testing**: Run migrations on copy of production database first

**Implementation**:
```javascript
// src/lib/server/shared/db/migrate.js
{
  id: 'add_auth_api_keys_table',
  run: async (db) => {
    // Check if table exists
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='auth_api_keys'"
    );

    if (tables.length === 0) {
      await db.run(`
        CREATE TABLE auth_api_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          label TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_used_at INTEGER,
          disabled BOOLEAN DEFAULT 0
        )
      `);
    }
  }
}
```

---

### Estimated Effort (T-Shirt Sizing)

#### **Phase 1: Infrastructure (Week 1) - L (Large)**
- [ ] Create `ApiKeyManager.server.js` module - **S**
- [ ] Create `SessionManager.server.js` (adapt existing) - **M**
- [ ] Create `CookieService.server.js` helper - **S**
- [ ] Add database migration for `auth_api_keys` table - **S**
- [ ] Update `hooks.server.js` with cookie validation - **M**
- [ ] Add TypeScript types for `event.locals` - **S**

**Total**: **L** (3-5 days)

---

#### **Phase 2: Authentication Flows (Week 2) - XL (Extra Large)**
- [ ] Create login form action (`/login/+page.server.js`) - **M**
- [ ] Create logout form action - **S**
- [ ] Create OAuth callback handler - **M**
- [ ] Create API key management endpoints (`/api/keys/*`) - **L**
- [ ] Implement onboarding flow for first API key - **M**
- [ ] Update `AuthService.validateAuth()` - **M**

**Total**: **XL** (5-8 days)

---

#### **Phase 3: Client Integration (Week 3) - L (Large)**
- [ ] Refactor `AuthViewModel.svelte.js` - **M**
- [ ] Update `socket-auth.js` - **M**
- [ ] Update `SocketService.svelte.js` - **S**
- [ ] Add root layout load function - **S**
- [ ] Update protected routes with session checks - **M**
- [ ] Create API key management UI - **L**

**Total**: **L** (3-5 days)

---

#### **Phase 4: Socket.IO Integration (Week 4) - M (Medium)**
- [ ] Create Socket.IO auth middleware for cookies - **M**
- [ ] Add cookie parsing utility - **S**
- [ ] Implement session expiration handling - **M**
- [ ] Test Socket.IO with both cookie and API key auth - **M**

**Total**: **M** (2-3 days)

---

#### **Phase 5: Testing & Documentation (Week 5) - L (Large)**
- [ ] Write unit tests for `SessionManager` - **M**
- [ ] Write unit tests for `ApiKeyManager` - **M**
- [ ] Write E2E tests for login/logout flows - **L**
- [ ] Write E2E tests for session persistence - **M**
- [ ] Update API documentation - **M**
- [ ] Create authentication guide - **M**
- [ ] Add troubleshooting section - **S**

**Total**: **L** (3-5 days)

---

#### **Phase 6: Cleanup (Week 6) - S (Small)**
- [ ] Remove old auth code (JWT, localStorage) - **S**
- [ ] Remove feature flags - **S**
- [ ] Final testing and validation - **M**

**Total**: **S** (1-2 days)

---

### **TOTAL EFFORT: ~4-6 weeks** (20-30 working days)

---

### Code Quality Improvements Beyond Auth Migration

#### **1. Apply SOLID Principles**

**Current Issue**: `AuthService` has multiple responsibilities
- Terminal key validation
- OAuth session validation
- API key validation (future)
- Cache management

**Refactor**: Single Responsibility Principle
```javascript
// BEFORE: God class with mixed concerns
class AuthService {
  validateKey(key) { ... }
  validateAuth(token) { ... }
  getCachedKey() { ... }
}

// AFTER: Separated concerns
class TerminalKeyValidator {
  validate(key) { ... }
}

class SessionValidator {
  validate(sessionId) { ... }
}

class ApiKeyValidator {
  verify(key) { ... }
}

class AuthCoordinator {
  constructor(validators) {
    this.validators = validators;
  }

  async authenticate(credentials, type) {
    const validator = this.validators[type];
    return await validator.validate(credentials);
  }
}
```

**Impact**: Easier testing, clearer responsibilities

---

#### **2. Eliminate Code Duplication**

**Current Issue**: Cookie setting logic duplicated across routes

**Refactor**: Extract to CookieService
```javascript
// BEFORE: Duplicated in login, OAuth callback, session refresh
cookies.set('dispatch_session', session.id, {
  path: '/',
  httpOnly: true,
  secure: !dev,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 30
});

// AFTER: Centralized cookie service
// src/lib/server/auth/CookieService.server.js
export class CookieService {
  static setSessionCookie(cookies, sessionId) {
    const attributes = this.getSessionCookieAttributes();
    cookies.set('dispatch_session', sessionId, attributes);
  }

  static getSessionCookieAttributes() {
    return {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    };
  }

  static deleteSessionCookie(cookies) {
    cookies.delete('dispatch_session', { path: '/' });
  }
}

// Usage everywhere
CookieService.setSessionCookie(cookies, session.id);
```

**Impact**: DRY principle, single source of truth for cookie config

---

#### **3. Type Safety Improvements**

**Current Issue**: Loosely typed `event.locals`

**Refactor**: Add comprehensive TypeScript types
```typescript
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
        provider: 'api_key' | 'oauth_github' | 'oauth_google';
        expiresAt: Date;
        fresh: boolean;
      } | null;

      // API key auth (programmatic)
      apiKey?: {
        id: string;
        label: string;
        lastUsed: Date;
      };

      // Auth context (unified)
      auth: {
        authenticated: boolean;
        provider: string;
        userId?: string;
      };

      // Services
      services: {
        sessionManager: SessionManager;
        apiKeyManager: ApiKeyManager;
        auth: AuthService;
        db: DatabaseManager;
      };
    }
  }
}
```

**Impact**: Better IDE support, compile-time error checking

---

#### **4. Test Coverage Enhancements**

**Current Gaps**:
- No E2E tests for cookie-based Socket.IO auth
- Limited unit tests for session lifecycle
- No tests for session expiration edge cases

**Additions**:
```javascript
// tests/server/auth/session-lifecycle.test.js
describe('SessionManager', () => {
  it('should expire sessions after 30 days', async () => {
    const session = await sessionManager.createSession('user-1', 'api_key');

    // Fast-forward 31 days
    await timeTravel(31 * 24 * 60 * 60 * 1000);

    const valid = await sessionManager.validateSession(session.id);
    expect(valid).toBeNull();
  });

  it('should refresh sessions within 24h window', async () => {
    const session = await sessionManager.createSession('user-1', 'api_key');

    // Fast-forward 29 days (within refresh window)
    await timeTravel(29 * 24 * 60 * 60 * 1000);

    const { session: refreshed } = await sessionManager.validateSession(session.id);
    expect(refreshed.fresh).toBe(true);
  });
});

// e2e/auth-socket-cookies.spec.ts
test('should authenticate Socket.IO with cookies', async ({ page, context }) => {
  // Login to set cookie
  await page.goto('/login');
  await page.fill('input[name="key"]', testApiKey);
  await page.click('button[type="submit"]');

  // Connect to Socket.IO (cookies sent automatically)
  const socketConnected = await page.evaluate(() => {
    return new Promise((resolve) => {
      const socket = io({ withCredentials: true });
      socket.on('connect', () => resolve(true));
      socket.on('connect_error', () => resolve(false));
    });
  });

  expect(socketConnected).toBe(true);
});
```

**Impact**: Catch regressions, ensure reliability

---

#### **5. Documentation Improvements**

**Current Gaps**:
- No API documentation for new `/api/keys/*` endpoints
- No migration guide for localStorage → cookies
- No troubleshooting for cookie issues

**Additions**:

**docs/authentication-guide.md**:
```markdown
# Authentication Guide

## Overview
Dispatch uses cookie-based sessions for browser access and API keys for programmatic access.

## Browser Login
1. Navigate to `/login`
2. Enter API key (created during onboarding)
3. Session cookie set automatically (30-day expiration)

## API Key Management
- Create: `POST /api/keys` with `{ label: "My Key" }`
- List: `GET /api/keys`
- Delete: `DELETE /api/keys` with `{ keyId: "..." }`

## Programmatic Access
Use API key in Authorization header:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://dispatch.example.com/api/sessions
```

## Troubleshooting
- **Cookie not persisting**: Check browser settings (third-party cookies)
- **CORS errors**: Ensure `withCredentials: true` in fetch/socket config
- **Session expired**: Re-login, sessions auto-refresh within 24h of expiry
```

**Impact**: Better developer experience, reduced support burden

---

### Summary

This refactoring analysis provides:

1. **Complete Inventory**: All auth-related code identified with line numbers
2. **Refactoring Strategy**: Before/after examples for each component
3. **Removal Candidates**: Specific files/functions to delete with justification
4. **Reusable Components**: Code that requires no changes
5. **Migration Risks**: Identified risks with concrete mitigation strategies
6. **Effort Estimation**: T-shirt sizing for each phase (4-6 weeks total)
7. **Quality Improvements**: SOLID principles, DRY, type safety, test coverage

**Key Takeaways**:
- ✅ Existing `AuthSessionManager` highly reusable with minor adaptations
- ✅ MVVM architecture clean, easy to refactor ViewModels
- ✅ Database schema already supports cookie sessions
- ⚠️ Socket.IO cookie parsing requires manual implementation
- ⚠️ Breaking changes managed via dual auth support during migration
- ✅ Clear path from localStorage to cookies without data loss

**Next Steps**:
1. Review and approve this analysis
2. Create feature branch `cookie-auth-migration`
3. Start with Phase 1 (Infrastructure)
4. Implement dual auth support before removing old code
5. Run comprehensive E2E tests before deploying

---
