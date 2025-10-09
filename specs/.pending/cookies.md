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
