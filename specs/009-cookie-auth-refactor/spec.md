# Feature Specification: Cookie-Based Authentication System

**Feature Branch**: `009-cookie-auth-refactor`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "cookie-auth-refactor create a new spec from the @specs/.pending/cookies.md document. keep in mind this app has not been released and we do not need to be concerned with backward compatibility, migration, user notification/support etc."

## Execution Flow (main)

```
1. Parse user description from Input
   → Feature clearly defined: Replace localStorage-based auth with cookie sessions + managed API keys
2. Extract key concepts from description
   → Actors: Primary operator (browser), automation scripts/CLI tools, optional OAuth users
   → Actions: Onboarding with API key generation, browser login with cookies, programmatic access with API keys
   → Data: Session cookies (httpOnly, Secure), API keys (hashed), OAuth tokens (optional)
   → Constraints: Single primary user, no backwards compatibility needed (pre-release)
3. For each unclear aspect:
   → None - requirements are clear from source document
4. Fill User Scenarios & Testing section
   → Primary flows: Onboarding, browser login, API key management, OAuth login (optional)
5. Generate Functional Requirements
   → All requirements testable and concrete
6. Identify Key Entities
   → Sessions, API Keys, Users, OAuth Providers
7. Run Review Checklist
   → No implementation details in spec (tech details in separate analysis)
   → All requirements testable
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-09

- Q: When an OAuth provider's API is unavailable during a login attempt, what should happen? → A: Show error message, offer fallback to API key login
- Q: Should the system enforce a maximum limit on concurrent active sessions per user, or allow unlimited sessions? → A: Unlimited concurrent sessions (default behavior)
- Q: When an API key fails validation repeatedly (e.g., incorrect key used multiple times), how should the system respond? → A: No rate limiting - always process validation attempt and return 401

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

A developer wants to run the Dispatch application with secure authentication that separates browser access (convenient, automatic) from programmatic access (explicit API keys for scripts/automation). During first-run onboarding, the system generates an API key for programmatic use and immediately logs the browser in with a secure session cookie. The developer can then manage multiple API keys for different tools, enable optional OAuth providers for convenient login, and have all sessions automatically expire and refresh appropriately.

### Acceptance Scenarios

1. **Given** fresh installation, **When** user completes onboarding, **Then** system generates first API key, displays it once, and sets browser session cookie
2. **Given** valid API key, **When** user enters it in login form, **Then** system creates session cookie and redirects to main application
3. **Given** authenticated browser session, **When** user navigates to API key management, **Then** system displays list of existing keys with creation dates, labels, and last-used timestamps
4. **Given** API key management page, **When** user creates new API key with label, **Then** system displays key once with warning, stores hashed version, and adds to key list
5. **Given** existing API key, **When** user disables or deletes it, **Then** subsequent requests with that key are rejected with 401 error
6. **Given** OAuth provider enabled, **When** user completes OAuth flow, **Then** system creates same type of session cookie as API key login
7. **Given** authenticated session, **When** user makes REST API request with session cookie, **Then** request is authenticated and processed
8. **Given** valid API key, **When** script makes REST API request with Authorization header, **Then** request is authenticated and processed
9. **Given** authenticated browser session, **When** Socket.IO connection is established with cookies, **Then** connection is authenticated via session cookie
10. **Given** valid API key, **When** Socket.IO connection includes API key in auth metadata, **Then** connection is authenticated via API key
11. **Given** active session, **When** session approaches expiration (within 24h), **Then** system automatically refreshes session cookie on next request
12. **Given** session cookie or API key, **When** user logs out, **Then** session is invalidated and cookie is cleared

### Edge Cases

- What happens when session cookie expires during active Socket.IO connection? → Connection receives session expiration event and client redirects to login
- What happens when API key is deleted while actively in use? → Next request with that key is rejected with 401 error
- What happens when user clears browser cookies? → User can re-login with API key to create new session
- What happens when OAuth provider is disabled after user logged in with it? → Existing sessions remain valid until expiration, but no new OAuth logins allowed
- What happens when multiple browser tabs are open with same session? → All tabs share same session cookie and see synchronized state
- What happens when user requests API key creation but doesn't save it? → Key is lost forever (only shown once), user must create new key
- What happens when OAuth provider's API is unavailable during login attempt? → System shows error message and offers fallback option to log in with API key instead

## Requirements _(mandatory)_

### Functional Requirements

#### Onboarding & Initial Setup

- **FR-001**: System MUST provide first-run onboarding flow that generates the first API key
- **FR-002**: System MUST display generated API key exactly once during onboarding with clear warning to save it
- **FR-003**: System MUST automatically create browser session cookie after successful onboarding
- **FR-004**: System MUST store all API keys in hashed format (never plaintext)

#### Browser Authentication (Session Cookies)

- **FR-005**: System MUST issue httpOnly, Secure (in production), SameSite=Lax cookies for all browser sessions
- **FR-006**: System MUST create session cookies for both API key login and OAuth login (unified approach)
- **FR-007**: System MUST automatically validate and refresh session cookies on each request
- **FR-008**: System MUST extend session expiration when session is within 24 hours of expiring (rolling window)
- **FR-009**: System MUST invalidate and clear session cookies on user logout
- **FR-010**: System MUST reject expired or invalid session cookies with redirect to login page

#### API Key Management

- **FR-011**: System MUST allow users to create multiple API keys with custom labels
- **FR-012**: System MUST display created API key exactly once with clear warning that it cannot be retrieved later
- **FR-013**: System MUST allow users to list all their API keys with metadata (label, creation date, last used date)
- **FR-014**: System MUST allow users to disable (soft delete) or permanently delete API keys
- **FR-015**: System MUST reject all requests using disabled or deleted API keys with 401 error
- **FR-016**: System MUST record last-used timestamp when API key is successfully used for authentication

#### Programmatic Authentication (API Keys)

- **FR-017**: System MUST accept API keys via Authorization header with Bearer scheme
- **FR-018**: System MUST validate API keys using constant-time comparison (bcrypt with cost factor 12)
- **FR-019**: System MUST support API key authentication for all REST API endpoints
- **FR-020**: System MUST support API key authentication for Socket.IO connections via handshake metadata

#### Unified Authentication (Dual Support)

- **FR-021**: All REST API routes MUST accept EITHER session cookies OR API keys for authentication
- **FR-022**: All Socket.IO connections MUST accept EITHER session cookies OR API keys for authentication
- **FR-023**: System MUST reject requests with neither valid session cookie nor valid API key with 401 error
- **FR-024**: System MUST identify authentication method (cookie vs API key) for each request

#### OAuth Integration

- **FR-025**: System MUST allow users to enable/disable OAuth providers via settings UI
- **FR-026**: System MUST support OAuth login flow that creates same type of session cookie as API key login
- **FR-027**: System MUST track authentication provider (api_key, oauth_github, oauth_google) for each session
- **FR-028**: When OAuth provider is disabled, system MUST prevent new OAuth logins but preserve existing sessions
- **FR-029**: When OAuth provider API is unavailable, system MUST display error message and offer fallback to API key login

#### Session Lifecycle

- **FR-030**: System MUST persist sessions across server restarts
- **FR-031**: System MUST support multiple browser clients attached to same session (multi-tab)
- **FR-032**: System MUST allow unlimited concurrent active sessions per user (no session limit enforced)
- **FR-033**: System MUST clean up expired sessions automatically
- **FR-034**: System MUST set session expiration to 30 days from creation
- **FR-035**: System MUST notify Socket.IO clients when their session expires during active connection

#### Security Requirements

- **FR-036**: System MUST hash all API key secrets at rest using bcrypt with high cost factor (12)
- **FR-037**: System MUST never log API key secrets or session tokens
- **FR-038**: System MUST rotate session cookies on login, logout, and sensitive settings changes
- **FR-039**: System MUST implement CSRF protection for cookie-based requests on state-changing operations (via SvelteKit form actions and Origin validation)
- **FR-040**: System MUST validate Origin header for cookie-based API requests to prevent CSRF attacks
- **FR-041**: System MUST process all API key validation attempts without rate limiting and return 401 for invalid keys

### Key Entities _(include if feature involves data)_

- **Session**: Represents authenticated browser session with unique ID, user ID, authentication provider (api_key/oauth_github/oauth_google), expiration timestamp, and last-active timestamp for idle timeout tracking
- **API Key**: Represents programmatic access credential with unique ID, user ID, hashed secret, user-provided label, creation timestamp, last-used timestamp, and disabled flag for soft deletion
- **User**: Represents single primary operator with ID (default: 'default'), optional email from OAuth, optional display name, creation timestamp, and last-login timestamp
- **OAuth Provider**: Represents optional authentication provider configuration with provider name (github/google), enabled/disabled status, and client credentials for OAuth flow

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (via acceptance scenarios)
- [x] Scope is clearly bounded (single-user, no backwards compatibility)
- [x] Dependencies and assumptions identified (pre-release app, no existing users)

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none found)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
