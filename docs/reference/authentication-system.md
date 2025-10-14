# Authentication System Reference

**Last Updated**: January 2025
**Version**: 2.0 (Cookie-based authentication)

## Overview

Dispatch implements a modern dual authentication system supporting both browser sessions (cookies) and programmatic access (API keys). This architecture provides secure, convenient authentication for interactive users while enabling automation and scripting.

## Architecture

### Dual Authentication Model

**Browser Sessions** (Interactive Users):

- httpOnly, Secure (production), SameSite=Lax cookies
- Automatic inclusion in all requests via browser
- 30-day expiration with 24-hour rolling refresh
- Multi-tab support (shared cookie)
- Automatic logout on session expiry

**API Keys** (Programmatic Access):

- Bearer token authentication via Authorization header
- User-managed keys with custom labels
- bcrypt hashing (cost 12) for storage security
- Per-key tracking of creation and last-used timestamps
- Disable/delete operations for key lifecycle management

**Unified Support**: All protected routes accept EITHER authentication method.

## Authentication Flow

### First-Run Onboarding

**Route**: `/onboarding`

**Process**:

1. User completes multi-step wizard (workspace, theme, settings)
2. System generates first API key (shown once with warning)
3. User copies and saves API key
4. System creates session cookie automatically
5. User is logged in and redirected to main application

**Database Changes**:

- Creates default user (`user_id='default'`)
- Stores hashed API key in `auth_api_keys` table
- Creates session record in `auth_sessions` table
- Marks onboarding as complete in settings

**Security**:

- API key displayed ONLY ONCE (cannot be retrieved later)
- bcrypt hashing before storage (never plaintext)
- Session cookie set with secure attributes

### Browser Login

**Route**: `/login` (SvelteKit form action: `?/login`)

**Process**:

1. User enters API key in login form
2. Server validates key via bcrypt comparison (constant-time)
3. On success:
   - Creates session record in database
   - Generates session cookie (httpOnly, Secure, SameSite=Lax)
   - Sets cookie in response
   - Redirects to `/workspace`
4. On failure:
   - Returns error message
   - No redirect, no cookie

**Session Cookie Attributes**:

```javascript
{
  name: 'dispatch_session',
  value: '<bcrypt-hashed-session-id>',  // UUID hashed for security
  httpOnly: true,                       // Not accessible via JavaScript
  secure: true,                         // HTTPS only (production)
  sameSite: 'Lax',                      // CSRF protection
  maxAge: 2592000,                      // 30 days in seconds
  path: '/'
}
```

### Programmatic Authentication

**Method**: Authorization header with Bearer scheme

**Usage**:

```bash
# cURL example
curl -H "Authorization: Bearer dpk_YOUR_API_KEY_HERE" \
  http://localhost:3030/api/sessions

# Node.js example
const response = await fetch('http://localhost:3030/api/sessions', {
  headers: {
    'Authorization': 'Bearer dpk_YOUR_API_KEY_HERE'
  }
});
```

**Validation**:

- Server extracts token from Authorization header
- Looks up API key in `auth_api_keys` table
- Validates using bcrypt.compare() (constant-time)
- Updates `last_used_at` timestamp on success
- Returns 401 if invalid, disabled, or not found

### Session Lifecycle

**Creation**: On successful login (API key or OAuth)

**Storage**:

```sql
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,              -- UUID (hashed for cookie)
  user_id TEXT NOT NULL,            -- Foreign key to auth_users
  provider TEXT NOT NULL,           -- 'api_key', 'oauth_github', 'oauth_google'
  expires_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  last_active_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);
```

**Refresh Logic**:

- On each authenticated request, check if session expires within 24 hours
- If yes: Extend `expires_at` by 30 days from current time
- Update `last_active_at` to current timestamp
- Generate new cookie with updated Max-Age
- Set cookie in response

**Expiration**:

- Sessions expire 30 days from last refresh
- Expired sessions automatically cleaned up by background job
- Socket.IO clients receive `session:expired` event
- Browser clients redirected to `/login`

**Multi-Client Support**:

- Same session cookie shared across browser tabs
- All tabs receive synchronized state updates
- Logout in one tab logs out all tabs

**Termination**:

- User clicks logout → POST to `/api/auth/logout`
- Session removed from database
- Cookie cleared (Max-Age=0)
- Redirect to `/login`

## API Key Management

### Data Model

```sql
CREATE TABLE auth_api_keys (
  id TEXT PRIMARY KEY,           -- UUID
  user_id TEXT NOT NULL,         -- Foreign key to auth_users
  key_hash TEXT NOT NULL,        -- bcrypt hash of API key secret
  label TEXT NOT NULL,           -- User-provided description
  disabled INTEGER DEFAULT 0,    -- Soft delete flag
  created_at INTEGER NOT NULL,   -- Unix timestamp (ms)
  last_used_at INTEGER,          -- Unix timestamp (ms), NULL if never used
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);
```

### Key Generation

**Format**: `dpk_[43-char-base64url]`

- Prefix: `dpk_` (Dispatch Private Key)
- Secret: 32 bytes random data → base64url encoding
- Total length: 47 characters
- Character set: `A-Za-z0-9_-` (URL-safe, no special chars)

**Security**:

- Generated via `crypto.randomBytes(32)`
- Hashed with bcrypt (cost factor 12) before storage
- Original secret NEVER stored or logged
- Displayed exactly ONCE on creation

### API Endpoints

**List Keys**: `GET /api/auth/keys`

```json
{
	"keys": [
		{
			"id": "key-uuid",
			"label": "Production Server",
			"createdAt": "2025-01-15T10:30:00.000Z",
			"lastUsedAt": "2025-01-16T14:20:00.000Z",
			"disabled": false
		}
	]
}
```

**Create Key**: `POST /api/auth/keys`

```json
// Request
{
  "label": "CI/CD Pipeline"
}

// Response (key shown ONLY ONCE)
{
  "id": "key-uuid",
  "key": "dpk_1234567890abcdefghijklmnopqrstuvwxyzABCDE",
  "label": "CI/CD Pipeline",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Disable Key**: `PUT /api/auth/keys/[keyId]`

```json
{
	"disabled": true
}
```

**Delete Key**: `DELETE /api/auth/keys/[keyId]`

- Hard delete from database
- Immediately invalidates all requests using this key

### Client Integration

**MVVM Components**:

- `ApiKeyState.svelte.js` - Reactive state management
- `ApiKeyManager.svelte` - UI component for key CRUD operations
- `AuthViewModel.svelte.js` - Authentication orchestration

**Features**:

- Create keys with custom labels
- View all keys with metadata (never the secret)
- Disable keys (soft delete, reversible)
- Delete keys (hard delete, permanent)
- Copy newly generated keys with visual feedback
- Track last-used timestamps for security auditing

## OAuth Integration (Optional)

### Supported Providers

- **GitHub**: OAuth 2.0 via `oauth_github` provider
- **Google**: OAuth 2.0 via `oauth_google` provider

### Configuration

**Settings UI**: `/settings/oauth`

**Required Credentials**:

- Client ID (public)
- Client Secret (encrypted at rest, never sent to browser)

**Database Storage**:

```sql
-- Stored in settings table, category 'oauth'
{
  "github": {
    "enabled": true,
    "clientId": "abc123...",
    "clientSecret": "<encrypted>"  -- AES-256 encrypted
  },
  "google": {
    "enabled": false
  }
}
```

### OAuth Flow

1. **Initiate**: `POST /api/auth/oauth/initiate`
   - Request: `{ "provider": "github" }`
   - Response: `{ "authUrl": "https://...", "state": "random-token" }`

2. **Redirect**: Client redirects to `authUrl`

3. **Authorization**: User authorizes on OAuth provider

4. **Callback**: Provider redirects to `/api/auth/callback?code=...&state=...`

5. **Token Exchange**: Server exchanges authorization code for access token

6. **Session Creation**:
   - Creates user record (if needed) with email/name from OAuth profile
   - Creates session record with `provider='oauth_github'` or `'oauth_google'`
   - Sets session cookie
   - Redirects to `/workspace`

### Provider Lifecycle

**Enabling Provider**:

- Configure credentials in `/settings/oauth`
- Save settings
- Provider becomes available on login page

**Disabling Provider**:

- Uncheck provider in settings
- Prevents NEW OAuth logins
- Existing sessions remain valid until expiration

**Unavailable Provider**:

- If OAuth provider API is down during login attempt
- System displays error message
- Offers fallback: "Log in with API key instead"

### Session Tracking

Sessions created via OAuth are tracked with provider information:

```javascript
{
  id: 'session-uuid',
  user_id: 'default',
  provider: 'oauth_github',  // or 'oauth_google'
  expires_at: 1234567890000,
  last_active_at: 1234567890000,
  created_at: 1234567890000
}
```

This enables:

- Auditing of authentication methods
- Provider-specific session management
- Analytics on authentication patterns

## Socket.IO Authentication

### Dual Auth Support

Socket.IO connections accept BOTH authentication methods:

**Session Cookie** (Browser):

```javascript
const socket = io({ withCredentials: true });
// Cookies automatically sent by browser
```

**API Key** (Programmatic):

```javascript
const socket = io({
	auth: {
		apiKey: 'dpk_YOUR_API_KEY_HERE'
	}
});
```

### Authentication Middleware

**Location**: `src/lib/server/shared/socket-setup.js`

**Process**:

1. Extract cookies from `socket.request.headers.cookie`
2. Extract API key from `socket.handshake.auth.apiKey`
3. Validate cookie session OR API key (whichever present)
4. Attach `socket.data.user` and `socket.data.sessionId` on success
5. Emit `connect_error` on failure

**Session Validation**:

- Check `auth_sessions` table for matching session ID
- Verify `expires_at > current_time`
- Update `last_active_at` timestamp
- Emit `session:expired` event if session becomes invalid during connection

**API Key Validation**:

- Look up key in `auth_api_keys` table
- Verify not disabled
- Validate using bcrypt.compare()
- Update `last_used_at` timestamp

### Events

**Client → Server**:

- `client:hello` - Initial authentication and identification
- Requires valid authentication before accepting other events

**Server → Client**:

- `session:expired` - Session became invalid, client should redirect to login
- Payload: `{ message: 'Session has expired' }`

## Security Considerations

### Password/Key Hashing

- **Algorithm**: bcrypt
- **Cost Factor**: 12 (adjustable based on hardware capabilities)
- **Validation**: Constant-time comparison via bcrypt.compare()
- **Never Logged**: API key secrets and session IDs never appear in logs

### Session Security

- **httpOnly**: Cookies not accessible via JavaScript (XSS protection)
- **Secure**: HTTPS-only in production (prevents interception)
- **SameSite=Lax**: CSRF protection while allowing navigation
- **Rotation**: Sessions rotated on login/logout/sensitive changes
- **Expiration**: Automatic cleanup of expired sessions

### CSRF Protection

- **SvelteKit Form Actions**: Built-in CSRF token validation
- **Origin Validation**: `hooks.server.js` validates Origin header for cookie-based requests
- **API Keys**: Not subject to CSRF (explicit Authorization header)

### Rate Limiting

**Current Status**: No rate limiting implemented

**Rationale**: bcrypt's cost factor (12) provides natural rate limiting:

- ~100ms per API key validation attempt
- Prevents brute-force attacks at reasonable throughput

**Future Consideration**: Add rate limiting for production deployments:

- Per-IP limits on login attempts
- Per-user limits on API key generation
- Global rate limits on authentication endpoints

### Key Rotation

**API Keys**:

- Users can create new keys and delete old ones at any time
- No forced expiration (keys valid until explicitly disabled/deleted)
- Best practice: Rotate keys periodically (e.g., every 90 days)

**Sessions**:

- Automatic 30-day expiration enforced
- 24-hour refresh window for active users
- Rotation on sensitive operations (change password, etc.)

## Middleware & Hooks

### Server Hooks

**Location**: `src/hooks.server.js`

**Authentication Hook**:

```javascript
export async function handle({ event, resolve }) {
	// 1. Check for session cookie
	const sessionCookie = event.cookies.get('dispatch_session');

	// 2. Validate session if cookie present
	if (sessionCookie) {
		const session = await SessionManager.validateSession(sessionCookie);
		if (session) {
			event.locals.user = session.user;
			event.locals.sessionId = session.id;
			event.locals.authMethod = 'cookie';
		}
	}

	// 3. Fallback to API key if no valid session
	if (!event.locals.user) {
		const apiKey = event.request.headers.get('Authorization')?.replace('Bearer ', '');
		if (apiKey) {
			const key = await ApiKeyManager.verifyApiKey(apiKey);
			if (key) {
				event.locals.user = key.user;
				event.locals.authMethod = 'api_key';
			}
		}
	}

	// 4. Protect routes
	if (requiresAuth(event.url.pathname) && !event.locals.user) {
		throw redirect(303, '/login');
	}

	return resolve(event);
}
```

**Protected Routes**:

- `/workspace`
- `/settings`
- `/console`
- All `/api/*` routes (except `/api/status`)

**Public Routes**:

- `/login`
- `/onboarding`
- `/` (root, redirects based on auth state)

### API Route Protection

All API routes automatically inherit authentication from hooks:

```javascript
// src/routes/api/sessions/+server.js
export async function GET({ locals }) {
	// locals.user populated by hooks if authenticated
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// ... authorized logic
}
```

## Testing

### E2E Test Helpers

**Location**: `e2e/helpers/`

**Database Reset**:

```javascript
import { resetToOnboarded } from './helpers/index.js';

const { apiKey } = await resetToOnboarded();
// Database now has user + API key, onboarding complete
```

**Onboarding Flow**:

```javascript
import { completeOnboarding } from './helpers/onboarding-helpers.js';

const apiKey = await completeOnboarding(page, {
	workspaceName: 'test-project',
	clickContinue: true // Auto-login
});
// Page is now authenticated
```

**Authentication Patterns**:

```javascript
// Pattern 1: Fresh install
await resetToFreshInstall();
await page.goto('/onboarding');

// Pattern 2: Pre-authenticated
const { apiKey } = await resetToOnboarded();
await page.goto('/login');
await page.fill('[name="key"]', apiKey.key);
await page.click('button[type="submit"]');

// Pattern 3: Complete onboarding
const apiKey = await completeOnboarding(page, { clickContinue: true });
// Ready to test authenticated features
```

### Test Server

**Command**: `npm run dev:test`

**Configuration**:

- Port: 7173 (avoids conflict with dev server)
- SSL: Disabled (no certificate warnings in automated browsers)
- Isolated storage: `/tmp/.dispatch-test/` (fresh state)
- Known credentials: Predictable for test setup

**Usage**:

```javascript
// Test setup
test.beforeEach(async ({ page }) => {
	// Server running on localhost:7173
	const { apiKey } = await resetToOnboarded();
	await page.goto('http://localhost:7173/login');
	// ... authenticate
});
```

## Migration from localStorage

### What Changed

**Before** (localStorage-based):

- API key stored in localStorage
- No session management
- No multi-tab support
- No server-side session tracking
- Vulnerable to XSS

**After** (Cookie-based):

- httpOnly, Secure session cookies
- Server-side session management
- Multi-tab support via shared cookies
- Session expiration and refresh
- API key management system
- XSS protection via httpOnly

### Breaking Changes

1. **Authentication Method**: localStorage auth tokens NO LONGER WORK
   - Must use API keys via Authorization header or session cookies

2. **Login Flow**: New dedicated login page at `/login`
   - Old direct access patterns replaced with proper authentication

3. **Test Helpers**: E2E tests must use new helpers
   - `resetToOnboarded()` instead of localStorage injection
   - `completeOnboarding()` for full flow testing

### Migration Path

**For Users**:

1. Complete onboarding flow (one-time)
2. Save generated API key securely
3. Use session cookie for browser access OR
4. Use API key for programmatic access

**For Tests**:

```javascript
// OLD (localStorage)
await page.evaluate(() => {
	localStorage.setItem('auth-token', 'test-key');
});

// NEW (session cookie via helpers)
const { apiKey } = await resetToOnboarded();
await page.goto('/login');
await page.fill('[name="key"]', apiKey.key);
await page.click('button[type="submit"]');
```

## Troubleshooting

### Cookie Not Set

**Symptom**: Login succeeds but cookie not in browser

**Causes**:

- `Secure` attribute in dev environment (should be `false` for http://)
- SameSite restrictions in cross-origin scenarios
- Browser blocking third-party cookies

**Fix**:

- Ensure `process.env.NODE_ENV !== 'production'` sets `Secure: false`
- Check browser DevTools → Application → Cookies for warnings

### Socket.IO Authentication Rejected

**Symptom**: `connect_error: Authentication required`

**Causes**:

- Missing `withCredentials: true` for cookie auth
- Invalid API key format
- Expired session

**Fix**:

```javascript
// Browser (cookie)
const socket = io({ withCredentials: true });

// Programmatic (API key)
const socket = io({
	auth: { apiKey: 'dpk_YOUR_KEY_HERE' }
});
```

### Session Not Refreshing

**Symptom**: Session expires despite active use

**Causes**:

- `last_active_at` not updating on requests
- Refresh logic not triggering (should trigger within 24h of expiry)

**Debug**:

```sql
-- Check session details
SELECT
  id,
  datetime(expires_at / 1000, 'unixepoch') as expires,
  datetime(last_active_at / 1000, 'unixepoch') as last_active
FROM auth_sessions
WHERE user_id = 'default';
```

### API Key Generation Fails

**Symptom**: Error creating new API key

**Causes**:

- Not authenticated with session cookie (API key management requires browser session)
- Database write error

**Fix**:

- Ensure logged in via browser (not API key)
- Check server logs for bcrypt errors

## References

- **Spec**: `/specs/009-cookie-auth-refactor/spec.md`
- **API Routes**: `/docs/reference/api-routes.md`
- **Database Schema**: `/docs/reference/database-schema.md`
- **Socket Events**: `/docs/reference/socket-events.md`
- **E2E Test Helpers**: `/e2e/helpers/README.md`
- **Onboarding Tests**: `/e2e/ONBOARDING_TEST_PLAN.md`
