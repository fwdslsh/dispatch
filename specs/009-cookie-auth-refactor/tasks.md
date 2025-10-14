# Tasks: Cookie-Based Authentication System

**Input**: Design documents from `/home/founder3/code/github/fwdslsh/dispatch/specs/009-cookie-auth-refactor/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Execution Flow (main)

```
1. Load plan.md from feature directory ✅
   → Found: Cookie-based auth with API keys
   → Tech stack: Node.js 22+, SvelteKit 2.x, Svelte 5, Socket.IO, bcrypt, SQLite3
   → Structure: Unified src/lib with server/client separation
2. Load optional design documents ✅
   → data-model.md: 4 entities (Session, API Key, User, OAuth Provider)
   → contracts/: auth-api.yaml (7 endpoints), socket-auth.md (dual auth protocol)
   → research.md: 6 design decisions (SvelteKit cookies, bcrypt, Socket.IO, CSRF, SQLite, OAuth)
3. Generate tasks by category ✅
   → Database: Migration tasks (sequential)
   → Server Core: 3 manager classes (parallel)
   → Middleware: hooks + Socket.IO (sequential, depends on core)
   → API Routes: 5 endpoint groups (parallel after middleware)
   → Client: ViewModels and UI (parallel, depends on API)
   → Optional: OAuth integration
   → Testing: Optional/manual per user requirement
4. Apply task rules ✅
   → Different files = [P] for parallel
   → Same file = sequential
   → Testing optional/manual (no TDD requirement)
5. Number tasks sequentially (T001-T032) ✅
6. Generate dependency graph ✅
7. Create parallel execution examples ✅
8. Validate task completeness ✅
   → 7 endpoints with implementation tasks ✅
   → 3 entities with manager classes ✅
   → Socket.IO dual auth implemented ✅
9. Return: SUCCESS (tasks ready for execution) ✅
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **Note**: Testing is optional/manual per user requirement (no TDD enforcement)

## Path Conventions

Paths use existing Dispatch architecture (unified src/lib structure):

- **Server**: `src/lib/server/auth/`, `src/lib/server/shared/`, `src/lib/server/socket/`
- **Client**: `src/lib/client/shared/state/`, `src/lib/client/settings/`
- **Routes**: `src/routes/login/`, `src/routes/api/auth/`
- **Tests**: `tests/server/auth/`, `tests/client/state/`, `tests/e2e/`

---

## Phase 3.1: Database Migration

**Priority**: CRITICAL - Must complete before any auth code runs

- [x] **T001** Create database migration file `src/lib/server/shared/db/migrations/009-cookie-auth.js`
  - Drop old tables: `auth_sessions`, `auth_api_keys` (no data preservation, per spec)
  - Create `auth_sessions` table with fields: id, user_id, provider, expires_at, created_at, last_active_at
  - Create `auth_api_keys` table with fields: id, user_id, key_hash, label, created_at, last_used_at, disabled
  - Create `auth_users` table if not exists (user_id, email, name, created_at, last_login)
  - Add foreign keys: auth_sessions.user_id → auth_users.user_id, auth_api_keys.user_id → auth_users.user_id

- [x] **T002** Add database indexes in same migration file
  - `CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id)`
  - `CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at)` (for cleanup queries)
  - `CREATE INDEX ix_api_keys_user_id ON auth_api_keys(user_id)`
  - `CREATE INDEX ix_api_keys_disabled ON auth_api_keys(disabled)` (for filtering active keys)

**Output**: Database schema ready for cookie authentication

---

## Phase 3.2: Server-Side Core (Parallel Execution)

**Prerequisites**: Database migration complete (T001-T002)

- [x] **T003 [P]** Create ApiKeyManager in `src/lib/server/auth/ApiKeyManager.server.js`
  - Method: `async generateKey(userId, label)` - Generate 32-byte random key, bcrypt hash (cost 12), return plain key ONCE
  - Method: `async verify(key)` - Constant-time bcrypt comparison, update last_used_at (async, non-blocking)
  - Method: `async listKeys(userId)` - Return all keys (metadata only, no secrets)
  - Method: `async disableKey(keyId, userId)` - Set disabled=1 (soft delete)
  - Method: `async deleteKey(keyId, userId)` - Hard delete from database
  - Import: bcrypt, randomBytes from crypto, database manager

- [x] **T004 [P]** Create SessionManager in `src/lib/server/auth/SessionManager.server.js`
  - Method: `async createSession(userId, provider, sessionInfo)` - Generate UUID session ID, 30-day expiration
  - Method: `async validateSession(sessionId)` - Check expiration, idle timeout, return {session, user, needsRefresh}
  - Method: `async refreshSession(sessionId)` - Extend expiration by 30 days if within 24h window, update last_active_at
  - Method: `async invalidateSession(sessionId)` - Delete session from database
  - Method: `async cleanupExpiredSessions()` - Delete sessions where expires_at < now()
  - **Constructor**: Set up periodic cleanup timer using setInterval() to call cleanupExpiredSessions() every hour (3600000ms)
  - Import: randomUUID from crypto, database manager

- [x] **T005 [P]** Create CookieService in `src/lib/server/auth/CookieService.server.js`
  - Static method: `setSessionCookie(cookies, sessionId)` - Set dispatch_session cookie with correct attributes
  - Static method: `getSessionCookieAttributes()` - Return {path: '/', httpOnly: true, secure: !dev, sameSite: 'lax', maxAge: 2592000}
  - Static method: `deleteSessionCookie(cookies)` - Delete dispatch_session cookie
  - Import: dev flag from $app/environment (SvelteKit)

- [x] **T006** Refactor AuthService in `src/lib/server/shared/auth.js`
  - Remove: Terminal key validation logic (legacy, no backwards compatibility)
  - Add: `apiKeyManager` dependency injection
  - Update: `async validateAuth(token)` method to use apiKeyManager.verify(token)
  - Return: {valid: boolean, provider: 'api_key', apiKeyId, label, userId} on success
  - Keep: OAuth session validation if exists (separate from API keys)

**Parallel Execution Example**:

```bash
# Launch T003-T005 simultaneously (different files, no dependencies):
# All three manager classes can be implemented in parallel
```

**Output**: Core authentication services ready for integration

---

## Phase 3.3: Middleware & Hooks (Sequential)

**Prerequisites**: Server core complete (T003-T006)

- [x] **T007** Refactor `src/hooks.server.js` for unified cookie + API key auth
  - Import: SessionManager, ApiKeyManager, CookieService, AuthService
  - Update `authenticationMiddleware` function:
    - Strategy 1: Check for session cookie via `event.cookies.get('dispatch_session')`
    - If session cookie: Validate using SessionManager, refresh if needed, attach event.locals.session and event.locals.user
    - Strategy 2: Check for API key via `Authorization: Bearer` header
    - If API key: Validate using AuthService.validateAuth(), attach event.locals.auth
    - If neither valid: Return 401 for API routes, redirect to /login for pages
  - Preserve: Services injection middleware, public route handling
  - Update: event.locals.auth structure to include {authenticated, provider, userId}

- [x] **T008** Refactor Socket.IO auth middleware in `src/lib/server/socket/middleware/auth.js`
  - Remove: JWT token validation (legacy)
  - Add: Cookie parsing helper `parseCookies(cookieHeader)` - Split on ';' and '=', decode values
  - Update middleware function:
    - Strategy 1: Parse cookies from `socket.handshake.headers.cookie`, validate session via SessionManager
    - If valid session: Attach socket.data.user, socket.data.session, socket.data.authMethod = 'session_cookie'
    - Strategy 2: Extract API key from `socket.handshake.auth.token` or Authorization header
    - If valid API key: Attach socket.data.apiKey, socket.data.authMethod = 'api_key'
    - If neither valid: Call `next(new Error('Authentication required'))`
  - Add: Periodic session validation timer (every 60s) emitting 'session:expired' event and disconnecting socket

**Output**: Unified authentication working for both HTTP and WebSocket

---

## Phase 3.4: API Routes (Parallel Execution After Middleware)

**Prerequisites**: Middleware complete (T007-T008)
**Note**: SvelteKit form actions provide built-in CSRF protection for cookie-based requests. Origin header validation handles API requests.

- [x] **T009 [P]** Create login form action in `src/routes/login/+page.server.js`
  - Export: `actions.login` function
  - Validate: API key from formData.get('key'), return fail(400) if missing
  - Authenticate: Use ApiKeyManager.verify(key), return fail(401) if invalid
  - Create session: Use SessionManager.createSession(userId, 'api_key', {apiKeyId, label})
  - Set cookie: Use CookieService.setSessionCookie(cookies, sessionId)
  - Redirect: throw redirect(303, '/') on success

- [x] **T010 [P]** Create logout action in `src/routes/api/auth/logout/+server.js`
  - Export: `POST` function
  - Get session ID: From `cookies.get('dispatch_session')`
  - Invalidate: Call SessionManager.invalidateSession(sessionId)
  - Clear cookie: Call CookieService.deleteSessionCookie(cookies)
  - Redirect: throw redirect(303, '/login')

- [x] **T011 [P]** Create API key endpoints in `src/routes/api/auth/keys/+server.js`
  - Export: `GET` function - List keys via ApiKeyManager.listKeys(userId), return JSON {keys: [...]}
  - Export: `POST` function - Generate key via ApiKeyManager.generateKey(userId, label), return JSON {id, key, label, message} (key shown ONCE)
  - Validate: Check locals.auth.authenticated, return 401 if not authenticated
  - CSRF: Validate Origin header for cookie-based requests (skip for API key auth)

- [x] **T012 [P]** Create API key detail endpoints in `src/routes/api/auth/keys/[keyId]/+server.js`
  - Export: `DELETE` function - Delete key via ApiKeyManager.deleteKey(keyId, userId), return JSON {success: true}
  - Export: `PATCH` function - Update disabled flag via ApiKeyManager.disableKey(keyId, userId), return JSON {success: true}
  - Validate: Check key exists and belongs to user, return 404 if not found

- [x] **T013 [P]** Refactor OAuth callback in `src/routes/api/auth/callback/+server.js`
  - Update: Remove token-based response
  - Add: Create session via SessionManager.createSession(userId, 'oauth\_' + provider, {email, name})
  - Add: Set session cookie via CookieService.setSessionCookie(cookies, sessionId)
  - Redirect: throw redirect(303, '/') on success
  - Error handling: If OAuth provider unavailable, return error with fallback message suggesting API key login

- [x] **T014** Refactor onboarding in `src/routes/onboarding/+page.server.js`
  - Update: Generate first API key via ApiKeyManager.generateKey('default', 'First API Key')
  - Create session: Use SessionManager.createSession('default', 'api_key', {apiKeyId})
  - Set cookie: Use CookieService.setSessionCookie(cookies, sessionId)
  - Return: {apiKey: {id, key, label}} for display (key shown once with warning)

**Parallel Execution Example**:

```bash
# Launch T009-T013 simultaneously (different route files):
# All API endpoint implementations can proceed in parallel
```

**Output**: All authentication API routes functional

---

## Phase 3.5: Client-Side ViewModels (Parallel Execution)

**Prerequisites**: API routes complete (T009-T014)

- [x] **T015 [P]** Refactor AuthViewModel in `src/lib/client/shared/state/AuthViewModel.svelte.js`
  - Remove: All localStorage access (lines 141, 161, 198 from analysis)
  - Update: `checkExistingAuth()` to use fetch('/api/auth/check') instead of localStorage
  - Update: `loginWithKey(key)` to submit form to /login action instead of manual fetch
  - Add: Form action pattern with FormData and response handling
  - Remove: Token storage logic
  - Keep: Reactive $state runes, error handling, loading states

- [x] **T016 [P]** Create ApiKeyState in `src/lib/client/shared/state/ApiKeyState.svelte.js`
  - State: `keys = $state([])` - List of API key metadata
  - State: `loading = $state(false)`, `error = $state(null)`
  - Method: `async loadKeys()` - Fetch from /api/auth/keys, update keys state
  - Method: `async createKey(label)` - POST to /api/auth/keys, return {id, key, label, message}
  - Method: `async deleteKey(keyId)` - DELETE to /api/auth/keys/[keyId]
  - Method: `async toggleKey(keyId, disabled)` - PATCH to /api/auth/keys/[keyId]
  - Derived: `activeKeys = $derived.by(() => keys.filter(k => !k.disabled))`

- [x] **T017 [P]** Refactor socket-auth in `src/lib/client/shared/socket-auth.js`
  - Delete: `getStoredAuthToken()`, `storeAuthToken()`, `clearAuthToken()` functions (lines 13-33)
  - Update: `createAuthenticatedSocket(options, config)` to include `withCredentials: true` in socket config
  - Remove: Manual 'auth' event emission (cookies sent automatically)
  - Keep: Socket.IO connection logic, error handling

**Parallel Execution Example**:

```bash
# Launch T015-T017 simultaneously (different files):
# All client-side state management can be built concurrently
```

**Output**: Client-side authentication state ready for UI

---

## Phase 3.6: UI Components (Parallel Execution)

**Prerequisites**: Client ViewModels complete (T015-T017)

- [x] **T018 [P]** Refactor login page in `src/routes/login/+page.svelte`
  - Update form: Use SvelteKit form action pattern with `use:enhance`
  - Add input: API key field with type="password" and autocomplete="off"
  - Add button: "Log In" submit button
  - Add error display: Show form.error if returned from action
  - Add OAuth buttons: "Log in with GitHub", "Log in with Google" (if OAuth enabled)
  - Preserve: Existing styling, layout structure

- [x] **T019 [P]** Create ApiKeyManager component in `src/lib/client/settings/ApiKeyManager.svelte`
  - Import: ApiKeyState
  - Display: List of API keys with columns (label, created, last used, status)
  - Button: "Create New API Key" opening modal/form
  - Modal: Label input, "Generate Key" button
  - Display generated key: Show key ONCE with warning message, copy button
  - Actions per key: "Disable"/"Enable" toggle, "Delete" button with confirmation
  - State: Use ApiKeyState.keys for rendering, handle loading and error states

- [x] **T020 [P]** Create OAuthSettings component in `src/lib/client/settings/OAuthSettings.svelte`
  - Display: List of OAuth providers (GitHub, Google)
  - Toggle per provider: Enable/disable switch
  - Form per provider: Client ID and Client Secret inputs (shown when enabled)
  - Save button: POST to /api/settings/oauth
  - Display: Current OAuth status (enabled providers)

- [x] **T021** Refactor onboarding page in `src/routes/onboarding/+page.svelte`
  - Add: API key display section (shown after onboarding submission)
  - Display: Generated API key with large, copyable text
  - Warning: "Save this key - it will not be shown again" (prominent, styled)
  - Button: "Copy Key" with clipboard API
  - Button: "Continue to App" navigating to '/' (only enabled after key copied or confirmed)
  - Update: Use server load data to get apiKey from action

**Parallel Execution Example**:

```bash
# Launch T018-T020 simultaneously (different component files):
# All UI components can be built in parallel
```

**Output**: Complete authentication UI

---

## Phase 3.7: OAuth Integration (Optional, Sequential)

**Prerequisites**: UI components complete (T018-T021)
**Note**: OAuth is optional per progressive enhancement principle

- [x] **T022** Create OAuth.server.js in `src/lib/server/auth/OAuth.server.js`
  - Method: `async getProviders()` - Fetch enabled OAuth providers from settings
  - Method: `async initiateOAuth(provider)` - Generate OAuth URL with state token
  - Method: `async handleCallback(code, state, provider)` - Exchange code for tokens, fetch user profile
  - Method: `async enableProvider(provider, clientId, clientSecret)` - Save provider config
  - Method: `async disableProvider(provider)` - Disable provider (preserve existing sessions)
  - Import: Provider-specific OAuth libraries (if needed)

- [x] **T023** Integrate OAuth settings UI
  - Add route: `src/routes/settings/oauth/+page.svelte` using OAuthSettings component
  - Add endpoint: `src/routes/api/settings/oauth/+server.js` for saving provider config
  - Update login page: Show OAuth buttons only if providers enabled
  - Update callback handler: Use OAuth.server.js for processing

**Output**: Optional OAuth authentication functional

---

## Phase 3.8: Shared Types & Constants

**Prerequisites**: None (can run anytime, no dependencies)

- [x] **T024 [P]** Create auth types in `src/lib/shared/auth-types.js`
  - Export: AUTH_PROVIDERS constant: ['api_key', 'oauth_github', 'oauth_google']
  - Export: COOKIE_NAME constant: 'dispatch_session'
  - Export: SESSION*DURATION constant: 30 * 24 _ 60 _ 60 \_ 1000 (30 days in ms)
  - Export: REFRESH*WINDOW constant: 24 * 60 \_ 60 \* 1000 (24 hours in ms)
  - Export: API_KEY_LENGTH constant: 32 (bytes)

**Output**: Shared constants for consistent behavior

---

## Phase 3.9: Testing (Optional/Manual)

**Prerequisites**: All implementation complete (T001-T024)
**Note**: Testing is optional/manual per user requirement (no TDD enforcement)

- [ ] **T025** Manual test: Onboarding flow (Scenario 1 from quickstart.md)
  - Navigate to /onboarding
  - Complete form, verify API key displayed once
  - Verify session cookie set in DevTools
  - Verify redirect to main app
  - Verify database has session and API key records

- [ ] **T026** Manual test: API key login (Scenario 2 from quickstart.md)
  - Clear cookies, navigate to /login
  - Enter valid API key, submit
  - Verify session cookie set
  - Verify redirect to main app

- [ ] **T027** Manual test: API key CRUD operations (Scenario 3 from quickstart.md)
  - Navigate to API key settings
  - Create new key, verify shown once
  - List keys, verify metadata
  - Disable key, verify auth fails
  - Delete key, verify removed

- [ ] **T028** Manual test: Session refresh (Scenario 4 from quickstart.md)
  - Log in, check initial session expiration in database
  - Manually set expires_at to 23 hours from now
  - Make authenticated request
  - Verify session refreshed to 30 days again

- [ ] **T029** Manual test: Socket.IO dual auth (Scenario 5 from quickstart.md)
  - Test 5A: Browser client with session cookie (withCredentials: true)
  - Test 5B: Node.js client with API key (auth.token)
  - Test 5C: Session expiration event and disconnect

- [ ] **T030** Optional: Write E2E test for onboarding in `tests/e2e/onboarding.spec.js`
  - Setup: Fresh database, navigate to /onboarding
  - Assert: API key displayed, session cookie set, redirect to /
  - (Only if automated testing desired)

**Output**: Authentication system validated

---

## Phase 3.10: Documentation & Cleanup

**Prerequisites**: Implementation and testing complete

- [x] **T031** Update CLAUDE.md with authentication patterns
  - Already updated by `.specify/scripts/bash/update-agent-context.sh claude` during planning
  - Verify: Cookie authentication flow documented
  - Verify: API key management patterns included
  - Verify: Socket.IO dual auth mentioned

- [x] **T032** Run code formatting
  - Execute: `npm run format` from repository root
  - Fix: Any linting errors reported
  - Verify: All files formatted consistently

**Output**: Clean, documented codebase ready for review

---

## Dependencies

### Critical Path (Sequential)

1. Database migration (T001-T002) MUST complete first
2. Server core (T003-T006) depends on database
3. Middleware (T007-T008) depends on server core
4. API routes (T009-T014) depend on middleware
5. Client ViewModels (T015-T017) depend on API routes
6. UI components (T018-T021) depend on ViewModels

### Parallel Opportunities

- **T003, T004, T005**: All manager classes can be built simultaneously
- **T009-T013**: All API route files can be created in parallel
- **T015-T017**: All client-side state files can be built together
- **T018-T020**: All UI components can be developed concurrently

### Optional Branches

- **OAuth (T022-T023)**: Can be implemented later if desired
- **Testing (T025-T030)**: Can be manual or automated based on preference

---

## Parallel Execution Examples

### Example 1: Server Core (T003-T005)

```bash
# Launch three manager classes simultaneously:
# Each file is independent with no shared dependencies

# Terminal 1:
Task: "Create ApiKeyManager in src/lib/server/auth/ApiKeyManager.server.js with methods: generateKey, verify, listKeys, disableKey, deleteKey"

# Terminal 2:
Task: "Create SessionManager in src/lib/server/auth/SessionManager.server.js with methods: createSession, validateSession, refreshSession, invalidateSession, cleanupExpiredSessions"

# Terminal 3:
Task: "Create CookieService in src/lib/server/auth/CookieService.server.js with static methods: setSessionCookie, getSessionCookieAttributes, deleteSessionCookie"
```

### Example 2: API Routes (T009-T013)

```bash
# Launch five route files simultaneously:
# Each route is in a separate file under src/routes/

# All five can proceed in parallel:
# T009: src/routes/login/+page.server.js
# T010: src/routes/api/auth/logout/+server.js
# T011: src/routes/api/auth/keys/+server.js
# T012: src/routes/api/auth/keys/[keyId]/+server.js
# T013: src/routes/api/auth/callback/+server.js
```

### Example 3: Client ViewModels (T015-T017)

```bash
# Launch three client state files simultaneously:
# Each file manages independent state

# All three can proceed in parallel:
# T015: src/lib/client/shared/state/AuthViewModel.svelte.js
# T016: src/lib/client/shared/state/ApiKeyState.svelte.js
# T017: src/lib/client/shared/services/socket-auth.js
```

---

## Notes

### About Parallel Execution

- **[P] tasks** = different files, no dependencies, can run simultaneously
- **Sequential tasks** = same file or dependency chain, must run in order
- **Verify**: Before marking task complete, ensure it works with existing code

### About Testing

- **Optional/manual** per user requirement (no TDD enforcement)
- **Manual scenarios** in quickstart.md (Scenarios 1-9)
- **Automated tests** can be added later if desired (T030 placeholder)
- **Performance targets**: API key validation <100ms, session validation <50ms

### Avoid

- Vague task descriptions without file paths
- Parallel tasks that modify the same file
- Implementing before dependencies are ready

---

## Validation Checklist

_GATE: Verify before marking tasks complete_

- [x] All 7 API endpoints have implementation tasks (T009-T014) ✅
- [x] All 3 core managers have creation tasks (T003-T005) ✅
- [x] Database migration comes first (T001-T002) ✅
- [x] Parallel tasks truly independent (verified: different files) ✅
- [x] Each task specifies exact file path ✅
- [x] No same-file conflicts in [P] tasks ✅
- [x] Socket.IO dual auth implemented (T008) ✅
- [x] OAuth is optional branch (T022-T023) ✅
- [x] Testing is optional/manual (T025-T030) ✅

---

## Progress Tracking

**Total Tasks**: 32
**Estimated Time**: 2-3 weeks (10-16 working days per plan.md)

### Phase Status

- [x] Phase 3.1: Database Migration (T001-T002) - 2 tasks ✅
- [x] Phase 3.2: Server Core (T003-T006) - 4 tasks ✅
- [x] Phase 3.3: Middleware (T007-T008) - 2 tasks ✅
- [x] Phase 3.4: API Routes (T009-T014) - 6 tasks ✅
- [x] Phase 3.5: Client ViewModels (T015-T017) - 3 tasks ✅
- [x] Phase 3.6: UI Components (T018-T021) - 4 tasks ✅
- [x] Phase 3.7: OAuth Integration (T022-T023) - 2 tasks (optional) ✅
- [x] Phase 3.8: Shared Types (T024) - 1 task ✅
- [ ] Phase 3.9: Testing (T025-T030) - 6 tasks (optional/manual)
- [x] Phase 3.10: Documentation (T031-T032) - 2 tasks ✅

---

**Status**: Tasks ready for execution
**Next**: Begin with T001 (database migration)
