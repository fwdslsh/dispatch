# Dispatch Refactoring Plan

This plan proposes targeted refactors to improve maintainability, consistency, and reliability across the app, with minimal disruption to existing behavior. It is organized by phases with concrete scope, acceptance criteria, and specific code references to guide implementation.

## Goals

- Single source of truth for sessions; eliminate duplication and ad‑hoc hydration logic.
- Reduce complexity in large Svelte components by splitting concerns and moving state logic into dedicated modules.
- Standardize server utilities (paths, env, logging, event names) to reduce bugs and drift between dev/prod.
- Improve testability and add coverage where changes alter behavior.
- Address security and error‑handling gaps (path validation, auth flow, failures surfaced to users).

## High‑Impact Issues (Summary)

- Session hydration/lookup duplicated across server paths; inconsistent IDs (`claude_<uuid>`, raw UUID) and code paths (see `src/lib/server/claude/ClaudeSessionManager.js`, `src/lib/server/socket-setup.js`).
- Monolithic UI component: `src/lib/components/ClaudePane.svelte` (>1,000 lines) mixes socket, data, and presentation concerns.
- Event names and error handling are inconsistent; many silent catch blocks and heavy console noise.
- Inconsistent path roots for Claude projects; multiple candidate roots hardcoded across files.
- Public URL UI emits `get-public-url` with no matching server handler.
- Docs/CLI mismatch: docs reference `bin/dispatch-cli.js`, package exposes `bin/cli.js`.

---

## Phase 1: Unify Session Management (Server)

Scope: remove duplicated hydration/resume logic and centralize session state + available tools caching.

- Consolidate hydration and resume into `ClaudeSessionManager` only.
  - Replace the ad‑hoc `directResume()` in `src/lib/server/socket-setup.js:190` with calls to `ClaudeSessionManager.#ensureSession()` and `send()`.
  - Normalize accepted IDs to a single canonical key form (`claude_<uuid>`), with helper methods for extracting/normalizing.

- Standardize projects root resolution in one place.
  - Use `src/lib/server/claude/cc-root.js` from all consumers. Remove/replace candidate arrays in:
    - `src/lib/server/claude/ClaudeSessionManager.js:194` and `:304`
    - `src/lib/server/socket-setup.js:197`

- Extract common env/options building into a utility.
  - Create `src/lib/server/utils/env.js` with `buildExecEnv()` and `buildClaudeOptions({ cwd, pathToClaude })`.
  - Replace inline `{ ...process.env, HOME: process.env.HOME }` instances.

- Standardize Socket.IO event names and emission helpers.
  - Add `src/lib/server/utils/events.js` exporting string constants and small emit helpers (e.g., `emitMessageDelta`, `emitComplete`, `emitError`).
  - Replace string literals in `ClaudeSessionManager.send()` and `socket-setup.js`.

Acceptance criteria

- No direct filesystem scanning for sessions outside `ClaudeSessionManager`.
- `socket-setup.js` calls `claude.send()` only; retry logic and completion events flow from manager.
- Available tools caching handled exclusively in manager; session.status returns cached tools when present.

---

## Phase 2: Normalize Paths, Config and Logging

Scope: one source of truth for paths and configurable logging/noise.

- Paths/utilities
  - Ensure all code that references Claude projects uses `projectsRoot()` only (see references above).
  - Add guard util for workspace paths: `assertInWorkspacesRoot(workspacePath)` to prevent path traversal. Use in `src/routes/api/workspaces/+server.js` and anywhere sessions are created.

- Logging
  - Add `src/lib/server/utils/logger.js` with levels and env‑guard (`DISPATCH_LOG_LEVEL`) to reduce noisy console logs in production.
  - Replace direct `console.log/error` in `ClaudeSessionManager`, `TerminalManager`, `socket-setup.js` with logger calls.

- Public URL retrieval
  - Implement `get-public-url` in `socket-setup.js` that reads the file written by `src/app.js` (`<configDir>/tunnel-url.txt`) and returns `{ ok: true, url }` when present; `{ ok: false }` otherwise. This matches `src/lib/shared/components/PublicUrlDisplay.svelte:17`.

Acceptance criteria

- All path computations for Claude sessions go through `cc-root.js`.
- Server logs are controllable via env and reduced in production.
- `PublicUrlDisplay` shows the URL when `ENABLE_TUNNEL=true` without code changes.

---

## Phase 3: Component Decomposition (Frontend)

Scope: split `ClaudePane.svelte` into smaller, testable components and move stateful logic out.

- Create a Claude chat feature folder and split responsibilities:
  - `src/lib/components/claude/ClaudePane.svelte` (thin container)
  - `src/lib/components/claude/ClaudeHeader.svelte` (status, cwd)
  - `src/lib/components/claude/ClaudeMessageList.svelte` (render list)
  - `src/lib/components/claude/ClaudeInputBar.svelte` (input + send)
  - `src/lib/components/claude/CommandMenu.svelte` (tools/commands)
  - `src/lib/components/claude/EventIconStrip.svelte` (live icons)

- Extract non‑UI logic into modules:
  - `src/lib/components/claude/chat-store.js`: derived state, message accumulation, scrolling helpers.
  - `src/lib/components/claude/commands.js`: parse/extract/normalize available commands.
  - `src/lib/shared/actions/clickOutside.js`: replace manual `document.addEventListener('click', ...)` logic.

- Remove direct DOM queries in favor of bound refs and Svelte actions.
- Gate verbose `console.log` under a dev flag.

Key references

- `src/lib/components/ClaudePane.svelte` (all sections; break apart, move helpers into modules)
- `src/lib/components/SessionSocketManager.js` (retain, but type improvements below)

Acceptance criteria

- `ClaudePane.svelte` < 300 lines; all menu/icon parsing logic is in modules.
- No `document.querySelector` usage in chat; outside‑click handled via action.
- No logic duplication between live icons vs completed message icons.

---

## Phase 4: Socket Layer Hardening

Scope: clarify ownership and lifecycles of sockets and types.

- Type safety for `SessionSocketManager`
  - Stop attaching custom properties directly to `socket` (e.g., `sessionId`, `isActive`). Use WeakMap for metadata and JSDoc typedefs.
  - Add small facade to encapsulate `emit('session.status')` and other calls with typed payloads.
  - Reference: `src/lib/components/SessionSocketManager.js`

- Server event map
  - Add `src/lib/shared/utils/socket-events.js` with the canonical event names for UI.
  - Replace string literals in components.

Acceptance criteria

- No custom properties exist on `Socket` instances; linter doesn’t flag type misuse.
- Client/socket events are imported from a shared constant file.

---

## Phase 5: API Validation and Security

Scope: tighten inputs and auth flow.

- Validate workspace paths and constrain to `WORKSPACES_ROOT`.
  - Update `src/routes/api/workspaces/+server.js:11` (create) and `:6` (open) to normalize and assert within root.
  - Add path traversal checks for any API accepting a path.

- Centralize key validation
  - Replace scattered `validateKey` checks with a socket middleware (namespaced room or auth handshake); reduce per‑event checks.
  - Reference: `src/lib/server/auth.js`, `src/lib/server/socket-setup.js`.

- Consider migrating from a static key in `localStorage` to a short‑lived session token; at minimum, prefix Storage key, document risks, and sanitize usage.

Acceptance criteria

- All APIs that accept file paths enforce root boundaries and reject traversal.
- Auth checks are consistent and share a single helper/middleware.

---

## Phase 6: Tests and CI Hygiene

Scope: unbreak existing tests, add targeted unit coverage for refactors, and stabilize E2E flows.

- Fix broken imports and missing modules called out in `docs/CODEBASE_INCONSISTENCIES_REPORT.md`.
- Add unit tests for:
  - `ClaudeSessionManager` hydration and available tools caching.
  - Command extraction utility used by the chat UI.
  - Public URL endpoint behavior when tunnel file exists/missing.

- Strengthen E2E:
  - Resume flow using raw UUID vs `claude_<uuid>`.
  - Mobile navigation basics (one test per gesture path).

Acceptance criteria

- `npm test` passes; flaky tests quarantined or fixed.
- New tests assert the refactored APIs and utilities.

---

## Phase 7: Cleanup and Documentation

Scope: remove dead code, align docs with reality, and document new contracts.

- Remove or fold `src/lib/server/io/SocketIOServer.js` if unused in runtime.
- Align CLI docs and binary name:
  - Docs currently reference `bin/dispatch-cli.js`. Repo uses `bin/cli.js` with `"bin": { "dispatch": "./bin/cli.js" }` in `package.json`.
  - Update `docs/CLI.md` examples or add a symlink/entry for backwards compatibility.

- Add README sections for:
  - Socket events contract (names, payloads, when emitted).
  - Environment variables used by server and how to configure them (DEV vs PROD).

Acceptance criteria

- No unused server modules remain.
- CLI docs/examples match the published bin.
- New docs describe socket events and expected API payloads.

---

## Quick Wins (Can ship incrementally)

> **Note**: Quick wins triaged on 2025-09-12 as part of issue #44. Converting to GitHub issues.

- [TRIAGED → ISSUE TBD] **Implement `get-public-url` in `socket-setup.js`** and wire to `PublicUrlDisplay`.
  - Priority: High (missing handler confirmed - PublicUrlDisplay emits but no server handler)
- [TRIAGED → ISSUE TBD] **Replace magic strings for events** with constants file (`socket-events.js`).
  - Priority: Medium (no constants file currently exists)
- [TRIAGED → ISSUE TBD] **Add `clickOutside` action** and use it in `CommandMenu` to remove document‑level listeners (safer, testable).
  - Priority: Medium (safer event handling)
- [TRIAGED → ISSUE TBD] **Reduce log noise** behind `DISPATCH_LOG_LEVEL` gate.
  - Priority: Low (no log level gating currently exists)

---

## Risk Mitigation

- Keep behavior‑preserving refactors small and incremental; wire new utilities and keep old code paths until covered by tests, then remove.
- Add E2E probes where UI depends on event timing (e.g., `message.complete`, resume flows).
- Do not alter Anthropic SDK usage semantics; isolate changes to composition and error handling.

---

## Implementation Checklist (Condensed)

> **Note**: Checklist triaged on 2025-09-12 as part of issue #44. High-impact items will be converted to individual GitHub issues.

- Server
  - [TRIAGED] Add `utils/env.js`, `utils/events.js`, `utils/logger.js` and swap call sites.
  - [TRIAGED] Use `projectsRoot()` everywhere; remove duplicated candidate scans.
  - [TRIAGED] Delete `directResume` and call `ClaudeSessionManager.send()` exclusively.
  - [TRIAGED] Add `get-public-url` socket handler.

- Frontend
  - [TRIAGED] Create `claude/` subcomponents; move logic to `chat-store.js` and `commands.js`.
  - [TRIAGED] Add `shared/actions/clickOutside.js`; replace document listeners.
  - [TRIAGED] Replace event name strings with constants.

- Tests/Docs
  - [TRIAGED] Fix broken tests and add new unit tests for utilities.
  - [TRIAGED] Update CLI docs and add socket event contract to README.

---

## Appendix: Notable References

- `src/lib/server/claude/ClaudeSessionManager.js:252` – session hydration logic (centralize here).
- `src/lib/server/socket-setup.js:78` – claude.send event; retries/processing state.
- `src/lib/shared/components/PublicUrlDisplay.svelte:17` – emits `get-public-url` (server handler missing).
- `src/routes/api/claude/cc-root.js:1` – projects root resolver (use everywhere).
- `src/lib/components/SessionSocketManager.js:17` – custom props on socket instance (avoid; use WeakMap).
- `src/lib/components/ClaudePane.svelte:1` – monolithic UI; split into feature components.
