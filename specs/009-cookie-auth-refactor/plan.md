# Implementation Plan: Cookie-Based Authentication System

**Branch**: `009-cookie-auth-refactor` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/founder3/code/github/fwdslsh/dispatch/specs/009-cookie-auth-refactor/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path ✅
   → Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✅
   → Project Type: web (SvelteKit frontend + Node.js backend)
   → Structure Decision: Existing Dispatch architecture (unified src/lib structure)
3. Fill the Constitution Check section ✅
4. Evaluate Constitution Check section ✅
   → No violations - aligns with single-user focus, simplicity, event-sourcing
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md ✅
   → No NEEDS CLARIFICATION markers
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✅
7. Re-evaluate Constitution Check section ✅
   → No new violations
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach ✅
9. STOP - Ready for /tasks command ✅
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Replace Dispatch's current localStorage-based authentication with a secure, dual-authentication system:

- **Browser users**: Automatic httpOnly session cookies (30-day expiration, rolling refresh)
- **Automation/scripts**: Managed API keys with bcrypt hashing
- **Unified support**: Both REST API routes and Socket.IO accept cookies OR API keys
- **Optional OAuth**: GitHub/Google providers create same session cookies as API key login
- **Event-sourced sessions**: Sessions persist across restarts, support multi-tab, automatic cleanup

This refactor eliminates localStorage security concerns while maintaining the single-user, developer-first model. No backwards compatibility needed (pre-release app).

## Technical Context

**Language/Version**: Node.js 22+ (JavaScript/TypeScript)
**Primary Dependencies**:

- SvelteKit 2.x (framework)
- Svelte 5 (frontend with $state runes)
- Socket.IO 4.8.x (WebSocket)
- bcrypt (API key hashing)
- SQLite3 5.1.7 (session storage)

**Storage**: SQLite database (existing workspace.db) with new tables for sessions, api_keys, auth_users
**Testing**: Vitest (unit tests), Playwright (E2E tests) - **testing is optional/manual per user requirement**
**Target Platform**: Linux server (Docker container), accessible via browser
**Project Type**: web - SvelteKit full-stack application
**Performance Goals**:

- API key validation <100ms (bcrypt constant-time comparison)
- Session cookie validation <50ms (in-memory + SQLite lookup)
- No performance degradation on existing session management

**Constraints**:

- Single-user application (constitutional requirement)
- Must leverage SvelteKit's `event.cookies` API for cookie handling
- Must maintain existing MVVM architecture (ViewModels with $state runes)
- Must support both browser (cookies) and programmatic (API keys) access simultaneously

**Scale/Scope**:

- Single user (default: 'default')
- Unlimited concurrent sessions per user (clarified)
- No rate limiting on failed auth attempts (clarified)
- ~20 new API routes, ~5 new database tables, ~10 new UI components

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Simplicity & Maintainability ✅ PASS

- **Alignment**: Uses SvelteKit's built-in `event.cookies` API (minimizes custom cookie code)
- **Alignment**: Reuses existing `AuthSessionManager` structure (minimal new abstractions)
- **Alignment**: bcrypt for API key hashing (battle-tested, industry standard)
- **Alignment**: Minimal new dependencies (bcrypt for secure password hashing)

### II. Single-User, Developer-First Platform ✅ PASS

- **Alignment**: Explicitly designed for single developer use case
- **Alignment**: API keys enable developer's automation scripts
- **Alignment**: No multi-user features (single user ID: 'default')
- **Alignment**: Unlimited sessions support developer's multiple devices/tabs

### III. Isolated, Remotely Accessible Development Environment ✅ PASS

- **Alignment**: httpOnly cookies prevent XSS attacks in browser
- **Alignment**: Secure cookies in production (TLS)
- **Alignment**: CSRF protection via Origin validation
- **Alignment**: API keys allow secure remote CLI/script access

### IV. Event-Sourced State Management ✅ PASS

- **Alignment**: Sessions stored in existing SQLite event-sourced database
- **Alignment**: Session lifecycle events (create, refresh, invalidate) are traceable
- **Alignment**: API key usage tracked with last-used timestamp
- **Note**: Authentication state itself is not event-sourced (sessions are entities, not events)

### V. Adapter Pattern for Extensibility ✅ PASS

- **Alignment**: Does not interfere with existing adapter pattern for session types (pty, claude, file-editor)
- **Alignment**: Authentication is orthogonal to session types
- **Alignment**: All adapters gain dual-auth support (cookies + API keys) automatically

### VI. Progressive Enhancement ✅ PASS

- **Alignment**: OAuth providers are optional (can disable)
- **Alignment**: System works with just API key authentication (no OAuth required)
- **Alignment**: Fallback to API key login when OAuth unavailable (clarified)
- **Alignment**: Minimal Docker environment still functional

**Overall Assessment**: ✅ **CONSTITUTIONAL COMPLIANCE - APPROVED**

No complexity deviations. Feature aligns with all constitutional principles.

## Project Structure

### Documentation (this feature)

```
specs/009-cookie-auth-refactor/
├── spec.md              # Feature specification (✅ complete)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── auth-api.yaml   # OpenAPI spec for auth endpoints
│   └── socket-auth.md  # Socket.IO auth protocol
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── server/
│   │   ├── auth/                      # Authentication module
│   │   │   ├── ApiKeyManager.server.js      # NEW: API key CRUD + validation
│   │   │   ├── SessionManager.server.js     # REFACTOR: Cookie-based sessions
│   │   │   ├── CookieService.server.js      # NEW: Cookie helpers
│   │   │   └── OAuth.server.js              # NEW: OAuth provider management
│   │   ├── shared/
│   │   │   ├── auth.js                      # REFACTOR: AuthService (API key validation)
│   │   │   └── db/migrations/              # NEW: Migration for auth tables
│   │   └── socket/
│   │       └── middleware/
│   │           └── auth.js                  # REFACTOR: Cookie + API key support
│   ├── client/
│   │   ├── shared/
│   │   │   ├── state/
│   │   │   │   ├── AuthViewModel.svelte.js  # REFACTOR: Remove localStorage
│   │   │   │   └── ApiKeyState.svelte.js    # NEW: API key management state
│   │   │   └── services/
│   │   │       └── socket-auth.js           # REFACTOR: withCredentials for cookies
│   │   └── settings/
│   │       ├── ApiKeyManager.svelte         # NEW: API key UI component
│   │       └── OAuthSettings.svelte         # NEW: OAuth provider toggles
│   └── shared/
│       └── auth-types.js                    # NEW: Shared auth constants
├── routes/
│   ├── login/
│   │   ├── +page.svelte                     # REFACTOR: API key login form
│   │   └── +page.server.js                  # NEW: Login form action
│   ├── onboarding/
│   │   └── +page.server.js                  # REFACTOR: Generate first API key
│   ├── api/
│   │   ├── auth/
│   │   │   ├── callback/+server.js          # REFACTOR: OAuth callback (set cookie)
│   │   │   ├── logout/+server.js            # NEW: Logout action
│   │   │   └── keys/
│   │   │       └── +server.js               # NEW: API key CRUD endpoints
│   │   └── [existing routes]                # REFACTOR: Accept cookies OR API keys
│   └── +layout.server.js                    # REFACTOR: Load session from cookie
└── hooks.server.js                          # REFACTOR: Cookie + API key validation

tests/
├── server/
│   ├── auth/
│   │   ├── ApiKeyManager.test.js            # NEW: API key validation tests
│   │   ├── SessionManager.test.js           # NEW: Session lifecycle tests
│   │   └── CookieService.test.js            # NEW: Cookie helper tests
│   └── socket/
│       └── middleware/auth.test.js          # REFACTOR: Dual auth tests
├── client/
│   └── state/
│       ├── AuthViewModel.test.js            # REFACTOR: Cookie-based tests
│       └── ApiKeyState.test.js              # NEW: API key state tests
└── e2e/
    ├── onboarding.spec.js                   # NEW: First API key generation
    ├── login.spec.js                        # NEW: Cookie-based login
    ├── api-key-management.spec.js           # NEW: API key CRUD UI
    └── oauth.spec.js                        # NEW: OAuth flow (optional)
```

**Structure Decision**: Existing Dispatch architecture maintained. Authentication module expanded under `src/lib/server/auth/` with new managers for API keys, sessions, and OAuth. Client-side MVVM pattern preserved with new ViewModels for API key management. SvelteKit routes gain form actions for login/logout. Testing structure follows existing Vitest (unit) + Playwright (E2E) pattern, but **testing is optional/manual per user requirement**.

## Phase 0: Outline & Research

### Research Topics

Since the specification is complete and technical context is well-defined, Phase 0 focuses on validating design choices and documenting best practices:

1. **SvelteKit Cookie Handling Best Practices**
   - Decision: Use `event.cookies.set()`, `event.cookies.get()`, `event.cookies.delete()`
   - Rationale: Built-in SvelteKit API handles cookie parsing, serialization, and security attributes automatically
   - Alternatives considered: Manual cookie header manipulation (rejected: error-prone, reinvents framework)

2. **bcrypt vs argon2 for API Key Hashing**
   - Decision: bcrypt with cost factor 12
   - Rationale: Already used in codebase, battle-tested, sufficient for API key hashing, constant-time comparison
   - Alternatives considered: argon2 (rejected: new dependency, overkill for single-user API keys)

3. **Socket.IO Cookie Authentication Pattern**
   - Decision: Parse cookies from `socket.handshake.headers.cookie` manually
   - Rationale: Socket.IO doesn't use SvelteKit's event object, requires manual parsing but simple implementation
   - Alternatives considered: JWT tokens (rejected: adds complexity, cookie-based is simpler and aligns with browser auth)

4. **CSRF Protection Strategy**
   - Decision: Origin header validation for cookie-based state-changing requests
   - Rationale: Simple, effective, built into SvelteKit form actions, minimal code
   - Alternatives considered: CSRF tokens (rejected: overkill for single-user app, adds complexity)

5. **Session Storage Strategy**
   - Decision: Extend existing SQLite `auth_sessions` table with provider field
   - Rationale: Reuses existing session management infrastructure, minimal schema changes
   - Alternatives considered: Redis/in-memory (rejected: adds dependency, SQLite already handles single-user load)

6. **OAuth Provider Integration**
   - Decision: Optional feature with enable/disable toggles in settings
   - Rationale: Progressive enhancement principle, not all users need OAuth
   - Alternatives considered: Always-on OAuth (rejected: forces complexity on users who don't need it)

### Key Findings

- **Minimal new dependencies required** (bcrypt for API key hashing; SvelteKit built-ins handle cookies)
- **Existing `AuthSessionManager` can be adapted** for cookie-based sessions (minimal refactor)
- **Socket.IO manual cookie parsing is ~10 lines of code** (simple helper function)
- **SvelteKit form actions provide built-in CSRF protection** for login/logout flows
- **Testing can be optional/manual** per user requirement (no TDD enforcement)

**Output**: research.md documenting these decisions

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

### 1. Data Model (`data-model.md`)

**Entities from Feature Spec**:

**Session** (auth_sessions table):

- `id` (TEXT PRIMARY KEY) - Unique session identifier (UUID)
- `user_id` (TEXT NOT NULL) - User ID (default: 'default')
- `provider` (TEXT NOT NULL) - Authentication provider: 'api_key' | 'oauth_github' | 'oauth_google'
- `expires_at` (INTEGER NOT NULL) - Unix timestamp (ms)
- `created_at` (INTEGER NOT NULL) - Unix timestamp (ms)
- `last_active_at` (INTEGER NOT NULL) - Unix timestamp (ms) for idle timeout tracking
- FOREIGN KEY (user_id) REFERENCES auth_users(user_id)

**API Key** (auth_api_keys table):

- `id` (TEXT PRIMARY KEY) - Unique API key identifier (UUID)
- `user_id` (TEXT NOT NULL) - Owner user ID (default: 'default')
- `key_hash` (TEXT NOT NULL) - bcrypt hash of API key secret (cost factor 12)
- `label` (TEXT NOT NULL) - User-friendly label for key
- `created_at` (INTEGER NOT NULL) - Unix timestamp (ms)
- `last_used_at` (INTEGER) - Unix timestamp (ms), NULL if never used
- `disabled` (INTEGER DEFAULT 0) - 0=active, 1=disabled (soft delete)
- FOREIGN KEY (user_id) REFERENCES auth_users(user_id)

**User** (auth_users table - may already exist):

- `user_id` (TEXT PRIMARY KEY) - User identifier (default: 'default')
- `email` (TEXT UNIQUE) - Email from OAuth or manual entry (optional)
- `name` (TEXT) - Display name (optional)
- `created_at` (INTEGER NOT NULL) - Unix timestamp (ms)
- `last_login` (INTEGER) - Unix timestamp (ms) of last successful login

**OAuth Provider** (settings table - stored as JSON):

- `provider_name` (TEXT) - 'github' | 'google'
- `enabled` (BOOLEAN) - Provider enabled/disabled state
- `client_id` (TEXT) - OAuth client ID
- `client_secret` (TEXT) - OAuth client secret (encrypted)

**State Transitions**:

Session lifecycle:

1. CREATE → Active (on login)
2. Active → Refreshed (when within 24h of expiration)
3. Active → Expired (after 30 days or manual logout)
4. Expired → Deleted (automatic cleanup)

API Key lifecycle:

1. CREATE → Active
2. Active → Disabled (soft delete)
3. Active → Deleted (hard delete)
4. Disabled → Deleted (hard delete)

**Validation Rules**:

- API key secrets must be at least 32 bytes (256 bits) random data
- Session IDs must be cryptographically random (UUID v4)
- Cookies must have httpOnly, Secure (prod), SameSite=Lax attributes
- API key labels must be non-empty, max 100 characters
- User ID 'default' is reserved for single-user mode

### 2. API Contracts (`contracts/`)

**REST API Endpoints** (OpenAPI 3.0 spec in `contracts/auth-api.yaml`):

```yaml
/api/auth/keys:
  GET:
    summary: List all API keys for authenticated user
    responses:
      200: { keys: [{ id, label, created_at, last_used_at, disabled }] }
      401: Unauthorized

  POST:
    summary: Create new API key
    requestBody: { label: string }
    responses:
      200: { id, key (shown once), label, message }
      401: Unauthorized

/api/auth/keys/{keyId}:
  DELETE:
    summary: Delete API key
    responses:
      200: { success: true }
      401: Unauthorized
      404: Not found

  PATCH:
    summary: Disable/enable API key
    requestBody: { disabled: boolean }
    responses:
      200: { success: true }
      401: Unauthorized
      404: Not found

/login (form action):
  POST:
    summary: Log in with API key
    requestBody: { key: string }
    responses:
      303: Redirect to / (with session cookie)
      400: { error: 'API key required' }
      401: { error: 'Invalid API key' }

/api/auth/logout (form action):
  POST:
    summary: Log out and clear session
    responses:
      303: Redirect to /login

/api/auth/callback:
  GET:
    summary: OAuth callback handler
    queryParams: { code, state, provider }
    responses:
      303: Redirect to / (with session cookie)
      400: { error: 'Invalid OAuth response' }
      401: { error: 'OAuth authentication failed' }
```

**Socket.IO Protocol** (`contracts/socket-auth.md`):

```markdown
# Socket.IO Authentication Protocol

## Connection Authentication

### Option 1: Session Cookie (Browser Clients)

- Cookie sent automatically via `withCredentials: true`
- Server parses `dispatch_session` cookie from handshake headers
- Validates session ID against database
- Attaches `socket.data.user` and `socket.data.session`

### Option 2: API Key (Programmatic Clients)

- Client sends API key via `auth` option or Authorization header
- Server validates key using bcrypt comparison
- Attaches `socket.data.apiKey` and `socket.data.authMethod = 'api_key'`

## Events

### Server → Client

- `session:expired` - Emitted when session expires during active connection
  Payload: { message: string }
  Client action: Redirect to /login

### Error Cases

- Connection rejected with error if no valid auth (cookie or key)
- Error message: 'Authentication required'
```

### 3. Test Scenarios (from User Stories → Integration Tests)

**Test File Structure** (optional, based on user requirement for optional/manual testing):

```
tests/e2e/auth/
├── onboarding.spec.js          # AS-1: First-run API key generation
├── login-api-key.spec.js       # AS-2: API key login with cookie
├── api-key-management.spec.js  # AS-3, AS-4, AS-5: CRUD operations
├── oauth-flow.spec.js          # AS-6: OAuth login (optional)
├── session-refresh.spec.js     # AS-11: Session expiration refresh
└── logout.spec.js              # AS-12: Logout and cookie clearing
```

**Key Test Scenarios** (can be executed manually):

1. **Onboarding Flow** (AS-1):
   - Fresh install → Navigate to onboarding
   - Complete onboarding → API key displayed once
   - Verify session cookie set → Redirect to main app

2. **API Key Login** (AS-2):
   - Have valid API key → Navigate to /login
   - Enter key → Submit form
   - Verify session cookie set → Redirect to main app

3. **API Key Management** (AS-3, AS-4, AS-5):
   - Authenticated → Navigate to API key settings
   - Create new key → Verify shown once with warning
   - List keys → Verify metadata displayed
   - Disable key → Verify subsequent use fails (401)

4. **Session Refresh** (AS-11):
   - Active session → Fast-forward time to 29 days
   - Make request → Verify cookie refreshed to 30 days again

### 4. Update CLAUDE.md

Run the update script to add cookie authentication context:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This will incrementally add:

- New authentication flow (cookies + API keys)
- bcrypt API key hashing
- SvelteKit cookie handling patterns
- Socket.IO dual auth support
- Recent changes: "Cookie-based authentication refactor (009)"

**Output**:

- `data-model.md` with entity schemas and state transitions
- `contracts/auth-api.yaml` with OpenAPI spec
- `contracts/socket-auth.md` with Socket.IO protocol
- `quickstart.md` with manual test scenarios (testing optional per user)
- Updated `CLAUDE.md` (incremental, <150 lines)

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

The /tasks command will load `.specify/templates/tasks-template.md` and generate tasks based on Phase 1 design artifacts. Key task categories:

1. **Database Migration Tasks** (Sequential):
   - Task 1: Create database migration for auth tables (auth_sessions, auth_api_keys, auth_users)
   - Task 2: Add indexes for session expiration and API key lookup

2. **Server-Side Core** (Parallel after DB):
   - Task 3: [P] Create ApiKeyManager.server.js (generate, verify, list, disable, delete)
   - Task 4: [P] Create SessionManager.server.js (create, validate, refresh, cleanup)
   - Task 5: [P] Create CookieService.server.js (set/get/delete helpers)
   - Task 6: Refactor AuthService to validate API keys (remove old terminal key logic)

3. **Middleware & Hooks** (Sequential after Core):
   - Task 7: Refactor hooks.server.js for cookie + API key validation
   - Task 8: Refactor Socket.IO auth middleware for dual auth (cookie + API key)

4. **API Routes** (Parallel after Middleware):
   - Task 9: [P] Create /login form action (API key login)
   - Task 10: [P] Create /api/auth/logout action
   - Task 11: [P] Create /api/auth/keys endpoints (GET, POST, DELETE, PATCH)
   - Task 12: [P] Refactor /api/auth/callback for OAuth (set cookie)
   - Task 13: Refactor /onboarding to generate first API key

5. **Client-Side ViewModels** (Parallel after API Routes):
   - Task 14: [P] Refactor AuthViewModel.svelte.js (remove localStorage)
   - Task 15: [P] Create ApiKeyState.svelte.js (API key management state)
   - Task 16: [P] Refactor socket-auth.js (withCredentials: true)

6. **UI Components** (Parallel after ViewModels):
   - Task 17: [P] Refactor /login/+page.svelte (API key input form)
   - Task 18: [P] Create ApiKeyManager.svelte (list, create, disable keys)
   - Task 19: [P] Create OAuthSettings.svelte (enable/disable providers)
   - Task 20: Refactor /onboarding/+page.svelte (display API key once)

7. **OAuth Integration** (Optional, Sequential):
   - Task 21: Create OAuth.server.js (provider management, callback handling)
   - Task 22: Add OAuth settings UI integration

8. **Testing** (Optional/Manual per user requirement):
   - Task 23: Manual test onboarding flow (or write E2E spec)
   - Task 24: Manual test login flow (or write E2E spec)
   - Task 25: Manual test API key management (or write E2E spec)
   - Task 26: Manual test session refresh (or write E2E spec)

9. **Documentation & Cleanup**:
   - Task 27: Update CLAUDE.md with new auth patterns
   - Task 28: Update API documentation in docs/reference/
   - Task 29: Run code formatting (`npm run format`)
   - Task 30: Security audit of cookie/API key implementation

**Ordering Strategy**:

- **Database first**: Migration must run before any auth code
- **Core services parallel**: ApiKeyManager, SessionManager, CookieService are independent
- **Middleware sequential**: Depends on core services
- **API routes parallel**: Independent endpoints after middleware ready
- **Client parallel**: ViewModels and components can be built concurrently
- **Testing optional**: Per user requirement, can be manual or automated
- **Documentation last**: After implementation complete

**Estimated Output**: ~30 numbered, ordered tasks in tasks.md with [P] markers for parallel execution

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (optional/manual testing, performance validation, security audit)

**Key Validation Checkpoints**:

- API key validation performance <100ms (bcrypt cost factor 12)
- Session cookie validation <50ms (SQLite lookup)
- No localStorage code remaining (grep verification)
- All cookie attributes correct (httpOnly, Secure, SameSite)
- CSRF protection working (Origin header validation)
- Socket.IO dual auth functioning (cookies + API keys)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

No violations detected. Table not needed.

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (N/A - no deviations)

---

_Based on Constitution v1.3.0 - See `.specify/memory/constitution.md`_
