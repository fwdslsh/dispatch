# Data Model: Cookie-Based Authentication

**Feature**: 009-cookie-auth-refactor
**Date**: 2025-10-09

## Overview

This document defines the data entities, schemas, relationships, and validation rules for the cookie-based authentication system.

## Entity Definitions

### 1. Session

Represents an authenticated browser session with automatic cookie management.

**Database Table**: `auth_sessions`

**Schema**:

```sql
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,              -- Session ID (UUID v4)
  user_id TEXT NOT NULL,            -- User ID (default: 'default')
  provider TEXT NOT NULL,           -- Authentication provider
  expires_at INTEGER NOT NULL,      -- Session expiration (Unix timestamp ms)
  created_at INTEGER NOT NULL,      -- Session creation time (Unix timestamp ms)
  last_active_at INTEGER NOT NULL,  -- Last activity time (Unix timestamp ms)
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at);
```

**Fields**:

| Field          | Type    | Constraints              | Description                                                         |
| -------------- | ------- | ------------------------ | ------------------------------------------------------------------- |
| id             | TEXT    | PRIMARY KEY, NOT NULL    | Unique session identifier (UUID v4, cryptographically random)       |
| user_id        | TEXT    | NOT NULL, FOREIGN KEY    | User owning this session (default: 'default' for single-user)       |
| provider       | TEXT    | NOT NULL, CHECK IN (...) | Authentication method: 'api_key', 'oauth_github', or 'oauth_google' |
| expires_at     | INTEGER | NOT NULL                 | Absolute expiration timestamp (30 days from creation, Unix ms)      |
| created_at     | INTEGER | NOT NULL                 | Session creation timestamp (Unix ms)                                |
| last_active_at | INTEGER | NOT NULL                 | Last request timestamp for idle timeout tracking (Unix ms)          |

**Indexes**:

- `ix_sessions_user_id`: Efficient user session lookup
- `ix_sessions_expires_at`: Efficient cleanup of expired sessions

**Validation Rules**:

- `id` must be UUID v4 format (cryptographically secure random)
- `provider` must be one of: `'api_key'`, `'oauth_github'`, `'oauth_google'`
- `expires_at` must be in the future when session is created
- `last_active_at` must be <= current time
- `created_at` <= `last_active_at` <= `expires_at`

**Business Rules**:

- Session expires after 30 days from creation (`expires_at`)
- Session refreshes when within 24 hours of expiration (rolling window)
- Unlimited concurrent sessions per user (from clarifications)
- Sessions persist across server restarts (constitutional requirement)

---

### 2. API Key

Represents a programmatic access credential for scripts/automation.

**Database Table**: `auth_api_keys`

**Schema**:

```sql
CREATE TABLE auth_api_keys (
  id TEXT PRIMARY KEY,              -- API key ID (UUID v4)
  user_id TEXT NOT NULL,            -- Owner user ID (default: 'default')
  key_hash TEXT NOT NULL,           -- bcrypt hash of API key secret
  label TEXT NOT NULL,              -- User-friendly label
  created_at INTEGER NOT NULL,      -- Creation timestamp (Unix ms)
  last_used_at INTEGER,             -- Last usage timestamp (Unix ms, nullable)
  disabled INTEGER DEFAULT 0,       -- Soft delete flag (0=active, 1=disabled)
  FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
);

CREATE INDEX ix_api_keys_user_id ON auth_api_keys(user_id);
CREATE INDEX ix_api_keys_disabled ON auth_api_keys(disabled);
```

**Fields**:

| Field        | Type    | Constraints           | Description                                                            |
| ------------ | ------- | --------------------- | ---------------------------------------------------------------------- |
| id           | TEXT    | PRIMARY KEY, NOT NULL | Unique API key identifier (UUID v4)                                    |
| user_id      | TEXT    | NOT NULL, FOREIGN KEY | User owning this API key (default: 'default')                          |
| key_hash     | TEXT    | NOT NULL              | bcrypt hash of API key secret (cost factor 12)                         |
| label        | TEXT    | NOT NULL              | User-provided label for identification (e.g., "CI/CD Pipeline")        |
| created_at   | INTEGER | NOT NULL              | Key creation timestamp (Unix ms)                                       |
| last_used_at | INTEGER | NULLABLE              | Last successful authentication timestamp (Unix ms, NULL if never used) |
| disabled     | INTEGER | DEFAULT 0             | Soft delete flag (0=active, 1=disabled)                                |

**Indexes**:

- `ix_api_keys_user_id`: Efficient user key lookup
- `ix_api_keys_disabled`: Efficient filtering of active keys

**Validation Rules**:

- `id` must be UUID v4 format
- `key_hash` must be valid bcrypt hash (starts with `$2b$12$`)
- `label` must be non-empty, max 100 characters, trimmed
- `disabled` must be 0 or 1
- `last_used_at` must be >= `created_at` when set

**Business Rules**:

- API key secret is 32 bytes (256 bits) of cryptographically secure random data
- Secret is base64url-encoded for display (44 characters)
- Secret is shown EXACTLY ONCE on creation (from spec)
- Secret is hashed with bcrypt cost factor 12 before storage
- Validation uses constant-time bcrypt comparison
- Disabled keys reject all authentication attempts (from spec)
- No rate limiting on failed validation attempts (from clarifications)

---

### 3. User

Represents the single primary operator of the Dispatch application.

**Database Table**: `auth_users`

**Schema**:

```sql
CREATE TABLE IF NOT EXISTS auth_users (
  user_id TEXT PRIMARY KEY,         -- User identifier (default: 'default')
  email TEXT UNIQUE,                -- Email from OAuth or manual entry (optional)
  name TEXT,                        -- Display name (optional)
  created_at INTEGER NOT NULL,      -- User creation timestamp (Unix ms)
  last_login INTEGER                -- Last successful login timestamp (Unix ms)
);
```

**Fields**:

| Field      | Type    | Constraints           | Description                                             |
| ---------- | ------- | --------------------- | ------------------------------------------------------- |
| user_id    | TEXT    | PRIMARY KEY, NOT NULL | User identifier (always 'default' for single-user mode) |
| email      | TEXT    | UNIQUE, NULLABLE      | Email address from OAuth or manual entry                |
| name       | TEXT    | NULLABLE              | Display name for UI                                     |
| created_at | INTEGER | NOT NULL              | User account creation timestamp (Unix ms)               |
| last_login | INTEGER | NULLABLE              | Last successful authentication timestamp (Unix ms)      |

**Validation Rules**:

- `user_id` must always be `'default'` (single-user mode)
- `email` must be valid email format if provided
- `name` max 100 characters if provided
- `last_login` must be >= `created_at` when set

**Business Rules**:

- Single-user application (constitutional requirement)
- User ID is always `'default'`
- Email/name populated from OAuth providers (if used)
- User record created during onboarding flow

---

### 4. OAuth Provider Configuration

Represents optional OAuth provider settings.

**Storage**: Settings table (JSON blob) or environment variables

**Logical Schema** (not a dedicated table):

```javascript
{
  "oauth_providers": {
    "github": {
      "enabled": true,
      "client_id": "Iv1.abc123...",
      "client_secret": "encrypted_secret_here"
    },
    "google": {
      "enabled": false,
      "client_id": null,
      "client_secret": null
    }
  }
}
```

**Fields**:

| Field         | Type    | Description                               |
| ------------- | ------- | ----------------------------------------- |
| provider_name | STRING  | Provider identifier: 'github' or 'google' |
| enabled       | BOOLEAN | Whether provider is enabled for login     |
| client_id     | STRING  | OAuth client ID from provider             |
| client_secret | STRING  | OAuth client secret (encrypted at rest)   |

**Validation Rules**:

- `provider_name` must be 'github' or 'google'
- `client_id` and `client_secret` required when `enabled=true`
- `client_secret` must be encrypted (never stored plaintext)

**Business Rules**:

- OAuth is optional (progressive enhancement)
- Enabled providers create same session cookies as API key login
- Disabled providers reject new logins but preserve existing sessions
- OAuth unavailable → fallback to API key login (from clarifications)

---

## Entity Relationships

```
auth_users (1)
  ├── auth_sessions (*) - A user can have unlimited concurrent sessions
  └── auth_api_keys (*) - A user can have multiple API keys

oauth_providers (config)
  └── Used during session creation to record provider type
```

**Cardinality**:

- One user (`'default'`) has many sessions (1:N, unlimited)
- One user has many API keys (1:N)
- Sessions reference user via `user_id` foreign key
- API keys reference user via `user_id` foreign key

---

## State Transitions

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Session State Machine                     │
└─────────────────────────────────────────────────────────────┘

[CREATE]
   │
   ├──→ Active (fresh session, expires_at = now + 30 days)
   │
   ├──→ Refreshed (when now > expires_at - 24h)
   │      │ Update: expires_at = now + 30 days
   │      │ Update: last_active_at = now
   │      └──→ Active
   │
   ├──→ Expired (when now > expires_at OR manual logout)
   │      └──→ [DELETE] (via automatic cleanup)
   │
   └──→ [DELETE] (user logout or cleanup job)
```

**State Transitions**:

1. **CREATE → Active**: New login (API key or OAuth) creates session
   - Generate UUID v4 session ID
   - Set `expires_at = now + 30 days`
   - Set `created_at = last_active_at = now`
   - Set `provider` based on auth method
   - Write session cookie to browser

2. **Active → Refreshed**: Request when `now > expires_at - 24h`
   - Update `expires_at = now + 30 days` (rolling window)
   - Update `last_active_at = now`
   - Rewrite session cookie with new expiration

3. **Active → Expired**: Session past expiration or manual logout
   - `now > expires_at` OR user triggers logout
   - Delete session cookie
   - Mark session for cleanup (or delete immediately)

4. **Expired → DELETE**: Automatic cleanup job
   - Periodic job deletes expired sessions
   - Query: `DELETE FROM auth_sessions WHERE expires_at < now()`

**Triggers**:

- Login → CREATE
- Each authenticated request → Check for refresh
- Logout → Expire + DELETE
- Cleanup job (every hour) → DELETE expired

---

### API Key Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                  API Key State Machine                       │
└─────────────────────────────────────────────────────────────┘

[CREATE]
   │
   ├──→ Active (disabled=0)
   │      │
   │      ├──→ Disabled (disabled=1, soft delete)
   │      │      └──→ [DELETE] (hard delete, optional)
   │      │
   │      └──→ [DELETE] (hard delete)
   │
   └──→ [LOST] (user didn't save key, shown once)
         └──→ Must create new key
```

**State Transitions**:

1. **CREATE → Active**: New API key generation
   - Generate 32 bytes (256 bits) secure random data
   - Base64url encode for display (44 chars)
   - Hash with bcrypt cost factor 12
   - Store hash in `key_hash`
   - Set `disabled = 0`
   - Display plaintext key ONCE (warning shown)
   - User must save key (not retrievable later)

2. **Active → Disabled**: Soft delete
   - Set `disabled = 1`
   - All subsequent auth attempts fail with 401
   - Record preserved for audit trail

3. **Active → DELETE**: Hard delete
   - Permanently remove API key from database
   - All subsequent auth attempts fail with 401
   - Immediate effect (no grace period)

4. **Disabled → DELETE**: Hard delete from disabled state
   - Same as Active → DELETE
   - Can delete disabled keys

**Triggers**:

- User creates key → CREATE
- User disables key → Disabled
- User deletes key → DELETE
- Successful auth → Update `last_used_at`

---

## Validation Rules Summary

### Session Validation

```javascript
function validateSession(session) {
	const now = Date.now();

	// Check expiration
	if (now > session.expires_at) {
		return { valid: false, reason: 'expired' };
	}

	// Check idle timeout (optional, not in spec)
	// const IDLE_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
	// if (now - session.last_active_at > IDLE_TIMEOUT) {
	//   return { valid: false, reason: 'idle_timeout' };
	// }

	// Check if within refresh window (24h before expiration)
	const timeUntilExpiry = session.expires_at - now;
	const REFRESH_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
	const needsRefresh = timeUntilExpiry < REFRESH_WINDOW;

	return {
		valid: true,
		needsRefresh,
		session
	};
}
```

### API Key Validation

```javascript
async function validateApiKey(submittedKey, storedKey) {
	// Check if key is disabled
	if (storedKey.disabled === 1) {
		return { valid: false, reason: 'disabled' };
	}

	// Constant-time comparison (bcrypt)
	const match = await bcrypt.compare(submittedKey, storedKey.key_hash);

	if (!match) {
		return { valid: false, reason: 'invalid' };
	}

	// Update last used timestamp (async, don't block)
	updateLastUsed(storedKey.id, Date.now()).catch(console.error);

	return {
		valid: true,
		apiKey: storedKey
	};
}
```

### Cookie Attributes Validation

```javascript
function validateCookieAttributes(cookie) {
	// Required attributes
	return (
		cookie.httpOnly === true &&
		cookie.sameSite === 'lax' &&
		cookie.path === '/' &&
		(dev ? true : cookie.secure === true) && // Secure in production only
		cookie.maxAge === 60 * 60 * 24 * 30 // 30 days
	);
}
```

---

## Data Constraints

### Uniqueness Constraints

- `auth_sessions.id` - PRIMARY KEY (UUID v4, globally unique)
- `auth_api_keys.id` - PRIMARY KEY (UUID v4, globally unique)
- `auth_users.user_id` - PRIMARY KEY (always 'default')
- `auth_users.email` - UNIQUE (optional, from OAuth)

### Foreign Key Constraints

- `auth_sessions.user_id` → `auth_users.user_id` (CASCADE DELETE recommended)
- `auth_api_keys.user_id` → `auth_users.user_id` (CASCADE DELETE recommended)

### Length Constraints

- `auth_api_keys.label` - Max 100 characters, non-empty
- `auth_users.name` - Max 100 characters (optional)
- `auth_users.email` - Max 255 characters (optional)

### Temporal Constraints

- `created_at` <= `last_active_at` (sessions)
- `created_at` <= `last_used_at` (API keys, when set)
- `expires_at` > `created_at` (sessions)

---

## Performance Considerations

### Expected Data Volume (Single User)

- **Sessions**: <100 active sessions (conservative estimate for multi-device/tab usage)
- **API Keys**: <20 active keys (typical: 1-5 keys for different tools)
- **Users**: 1 record (always 'default')

### Query Performance

- Session lookup by ID: <10ms (indexed PRIMARY KEY)
- API key lookup by hash: <50ms (bcrypt comparison + index lookup)
- Expired session cleanup: <100ms (indexed `expires_at`)

### Optimization Strategies

- Index on `expires_at` for cleanup queries
- Index on `user_id` for user session/key listing
- Periodic cleanup job (hourly) to remove expired sessions
- In-memory session cache (optional, for sub-ms lookups)

---

## Migration Strategy

**From**: localStorage-based terminal key
**To**: Cookie-based sessions + managed API keys

**Approach**: Big bang (no backwards compatibility per spec)

**Migration Steps**:

1. **DROP old tables** (no data preservation):

   ```sql
   DROP TABLE IF EXISTS auth_sessions;
   DROP TABLE IF EXISTS auth_api_keys;
   ```

2. **CREATE new tables**:

   ```sql
   -- Run schemas defined above
   CREATE TABLE auth_sessions (...);
   CREATE TABLE auth_api_keys (...);
   CREATE TABLE IF NOT EXISTS auth_users (...);
   ```

3. **CREATE indexes**:

   ```sql
   CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id);
   CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at);
   CREATE INDEX ix_api_keys_user_id ON auth_api_keys(user_id);
   CREATE INDEX ix_api_keys_disabled ON auth_api_keys(disabled);
   ```

4. **Result**: Clean database, all users logged out, must complete onboarding again

---

## Security Considerations

### Data at Rest

- **API Key Secrets**: NEVER stored (bcrypt hashes only, cost factor 12)
- **Session Tokens**: Not stored (cookie value = session ID, which is UUID v4)
- **OAuth Secrets**: Encrypted (if stored in database)

### Data in Transit

- **Session Cookies**: httpOnly (prevent XSS), Secure in prod (TLS only), SameSite=Lax
- **API Keys**: Sent via Authorization header (TLS encrypted)
- **OAuth Callbacks**: TLS required, state parameter validates origin

### Timing Attack Prevention

- **API Key Validation**: bcrypt constant-time comparison
- **Session Lookup**: Indexed query (predictable timing)
- **No rate limiting**: Per clarifications, but bcrypt inherently rate-limits via cost factor

---

**Status**: Data model complete, ready for contract generation
