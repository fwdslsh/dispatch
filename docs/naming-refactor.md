# Naming & Terminology Refactor Guide

Purpose: eliminate ambiguity around “session”, “project”, and related terms by standardizing names across server, client, socket events, APIs, database, and tests. This guide defines the canonical glossary, maps old→new names, and provides a safe, stepwise migration plan with concrete code touch‑points.

## Canonical Glossary (use these terms)

- Workspace UI: the client UI that contains one or more Session Panes and supporting components.
- Session: a series of interactions between the Workspace UI and the server environment; identified by a unified Session ID.
- Session Pane: the UI component hosting a Session (e.g., Claude Pane, Terminal Pane).
- Terminal: the UI component displayed within a Session Pane for a PTY type session.
- Claude Pane: the Claude Code UI component displayed within a Session Pane.
- Workspace directory: filesystem directory where sessions start and operate (path string `workspacePath`).
- Claude Code Project: the Claude Code notion of “project”, derived from the working directory and encoded in `~/.claude/projects`.
- Claude Code Session: a set of JSONL files within a Claude Code Project, tracking Claude history.
- PTY Session: a node‑pty process managed by the server.
- Socket: a specific Socket.IO connection between client and server.
- Session ID: the unified, app‑level ID assigned by Dispatch to track a Session (UUID v4). Always `sessionId`.
- Claude Code Session ID: the Claude‑managed ID for a Claude Code Session (JSONL filename stem). A Session‑Specific ID.
- Terminal Session ID: the node‑pty ID (e.g., `pty_1`). A Session‑Specific ID.
- Session‑Specific ID: the ID managed by the specific session type (Claude or PTY). Always `typeSpecificId` in server code; on the client, prefer `sessionSpecificId` when a second ID is needed.

Synonyms to avoid:
- Avoid “project” for filesystem paths. Use “Workspace directory” (`workspacePath`).
- Avoid “Claude session” when referring to the unified session; say “Session” (unified) vs “Claude Code Session” (Claude’s JSONL session).
- Avoid “ptyId” or “claudeId” as top‑level IDs; the unified `sessionId` is the primary ID.

## Old → New Naming Matrix

- project (filesystem path) → workspace directory / `workspacePath`
- Project UI / projects route → Workspace UI / workspaces route (UI naming only)
- ptyId (in UI) → `sessionId` (unified). Use `typeSpecificId` internally when needed.
- claudeSessionId (in UI) → typeSpecificId for `claude`
- appSessionId (server internal) → keep (internal), external name stays `sessionId`
- Terminal ID (server) → `typeSpecificId` when stored in descriptors/DB
- Claude Code Session ID (server) → `typeSpecificId` in descriptors/DB
- “tools.list” (socket event) → `claude.tools.available`
- “commands.refresh” (socket event) → `claude.commands.refresh`
- “message.delta/complete” (socket events) → `claude.message.delta` / `claude.message.complete`
- Terminal ‘data’/‘exit’ (socket events) → `terminal.output` / `terminal.exit`
- `session.id.updated` (socket event) retained for session metadata updates

## Event Names: Canonical Set

Source of truth: `src/lib/server/utils/events.js` and `src/lib/shared/utils/socket-events.js`

- Session lifecycle
  - `session.create`, `session.list`, `session.status` (request/ack), `session.end`, `session.detach`
  - Add: `session.typeSpecificId.updated`
- Claude messaging and tools
  - `claude.send`
  - `claude.message.delta`
  - `claude.message.complete`
  - `claude.tools.available` (replace `tools.list`)
  - `claude.commands.refresh` (replace `commands.refresh`)
- Terminal
  - `terminal.input`, `terminal.output`, `terminal.resize`, `terminal.error`, `terminal.exit` (add constant)

## Status Summary

All runtime code now uses canonical names only. Server emits `claude.message.*`, `claude.tools.available`, `claude.commands.refresh`, and terminal `terminal.*` events exclusively. Client listens/emits via shared constants. No legacy event names remain in code.

- UI naming status:
  - `src/lib/shared/components/ProjectSessionMenuSimplified.svelte` now uses `selectedWorkspace` for directory selection
  - `src/lib/components/CreateSessionModal.svelte` uses workspace-oriented labels
  - `/projects` route still exists for navigation; contents use workspace terminology
  - `src/lib/components/ClaudePane.svelte` displays workspace info consistently

- Terminal pane prop naming:
- `src/lib/components/TerminalPane.svelte` prop renamed to `sessionId` (was `ptyId`)

## API and Data Model Conventions

- Unified ID: external API returns `{ id }` (unified Session ID).
- Type‑Specific ID: returned alongside as `{ typeSpecificId }`.
- Request payloads: always include `type` (`'claude'|'pty'|...)`, `workspacePath`, and optional `options`.
- DB schema is aligned (`workspace_sessions.type_specific_id`); no changes required beyond naming in code.

Reference:
- `src/routes/api/sessions/+server.js` returns `{ id, typeSpecificId }`.

## Stepwise Migration Plan

Phase 0 — Prep (docs + constants)
- Add this guide and share across the team.
- Ensure `SOCKET_EVENTS` enumerates the final canonical names, including:
  - `CLAUDE_TOOLS_AVAILABLE: 'claude.tools.available'`
  - `CLAUDE_COMMANDS_REFRESH: 'claude.commands.refresh'`
  - `TERMINAL_EXIT: 'terminal.exit'`

Phase 1 — Server event bridging (non‑breaking)
- ClaudeSessionManager.js
  - Switch emits to canonical events AND bridge legacy:
    - On delta: emit `claude.message.delta` and also `message.delta` (temporary)
    - On complete: emit `claude.message.complete` and also `message.complete` (temporary)
    - Replace `tools.list` with `claude.tools.available` and emit both for a deprecation window
  - Where supported, include `{ sessionId, type: 'claude' }` in payloads to enable generic listeners
  - File refs: `src/lib/server/claude/ClaudeSessionManager.js:258,307,571,618`
- TerminalManager.js
  - Replace `data` → `terminal.output` and `exit` → `terminal.exit`; emit both names for one release
  - File refs: `src/lib/server/terminals/TerminalManager.js:105,114`
- Socket handlers (`src/lib/server/socket-setup.js`)
  - Add handler for `claude.commands.refresh` (mirror current `commands.refresh`), respond with same payload
  - Ensure `session.status` remains a request/ack pattern; add push variant `session.status.changed` if needed for future

Phase 2 — Client listeners and props (dual‑stack)
- ClaudePane.svelte
  - Listen to canonical `claude.message.delta` / `claude.message.complete` and keep legacy listeners temporarily
  - Continue using unified `sessionId`; keep optional `sessionSpecificId` for resume/history
  - File refs: `src/lib/components/ClaudePane.svelte:421,559`
- ClaudeCommands.svelte
  - Replace listener for `tools.list` with `claude.tools.available` (keep both during migration)
  - Replace `commands.refresh` emits with `claude.commands.refresh`
  - File refs: `src/lib/components/ClaudeCommands.svelte:384,390`
- TerminalPane.svelte
  - Rename prop `ptyId` → `sessionId` and update call sites; keep a transitional adapter prop if needed
  - Update listeners to `terminal.output` / `terminal.exit` while supporting legacy names

Phase 3 — UI nomenclature (project→workspace)
- ProjectSessionMenuSimplified.svelte
  - Rename `selectedProject` → `selectedWorkspace` (all internal vars and events)
  - Update labels: “Workspace” for directories; reserve “Claude Project” when listing Claude Code projects specifically
  - File ref: `src/lib/shared/components/ProjectSessionMenuSimplified.svelte`
- CreateSessionModal.svelte
  - `projectName` → `workspaceName` (UI label); keep payload key `workspacePath`
  - Make “New Project” wording explicit as “New Workspace directory for Claude Code project”
  - File ref: `src/lib/components/CreateSessionModal.svelte`
- Routes
  - Consider renaming `/projects` route to `/workspaces` and updating page/component names. Do this last, post‑stabilization.

Phase 4 — API responses
- `/api/sessions` POST returns `{ id, typeSpecificId }` only (legacy fields removed)

Phase 5 — Remove bridges
- Legacy event emits/listeners removed from server and client.

## Concrete Edits Checklist (by file)

Server
- `src/lib/server/utils/events.js`
  - Add/verify: `CLAUDE_TOOLS_AVAILABLE`, `CLAUDE_COMMANDS_REFRESH`, `TERMINAL_EXIT`, optional `SESSION_STATUS_CHANGED`
- `src/lib/server/claude/ClaudeSessionManager.js`
  - Replace emits to match constants; add dual emits for back‑compat (delta, complete, tools.available)
  - Include `{ sessionId: <unified or claude>, type: 'claude' }` in payloads
- `src/lib/server/terminals/TerminalManager.js`
  - Replace `socket.emit('data' ...)` → `socket.emit('terminal.output', ...)`
  - Replace `socket.emit('exit' ...)` → `socket.emit('terminal.exit', ...)`
- `src/lib/server/socket-setup.js`
  - Add handler for `claude.commands.refresh`; keep `commands.refresh` temporarily
  - Ensure `session.status` semantics documented (request/ack)
- `src/lib/server/core/SessionManager.js`
  - No structural changes; continue to use `typeSpecificId`
- `src/lib/server/core/WorkspaceManager.js`
  - No schema change; align naming in log messages (“workspace directory”)

Client
- `src/lib/components/ClaudePane.svelte`
  - Switch listeners to canonical Claude events; accept legacy during migration
- `src/lib/components/ClaudeCommands.svelte`
  - Switch to `claude.tools.available` and `claude.commands.refresh`
- `src/lib/components/TerminalPane.svelte`
  - Prop rename `ptyId` → `sessionId`; update socket listeners to `terminal.output` / `terminal.exit`
- `src/lib/shared/components/ProjectSessionMenuSimplified.svelte`
  - Rename `selectedProject` → `selectedWorkspace` and user‑facing copy
- `src/lib/components/CreateSessionModal.svelte`
  - Rename UI labels from “Project” to “Workspace directory” where appropriate

API
- `src/routes/api/sessions/+server.js`
  - Response `{ id, typeSpecificId }` (canonical only)

Tests & Docs
- Update E2E test names and expectations:
  - `e2e/project-page-claude-sessions.spec.js` → workspace terminology in title/steps
  - Any test stubbing `/api/sessions` or socket events to cover canonical names
- Update user‑facing docs to distinguish “Workspace UI” vs “Workspace directory” vs “Claude Code Project”.

## Search/Replace Aids

Use ripgrep to discover hotspots:
- `rg -n "\btools\.list\b|\bcommands\.refresh\b|\bmessage\.(delta|complete)\b|\bptyId\b|\bselectedProject\b|\bprojectName\b"`

Suggested replacements (review per call site):
- `tools.list` → `claude.tools.available`
- `commands.refresh` → `claude.commands.refresh`
- `message.delta` → `claude.message.delta` (or `session.message.delta`)
- `message.complete` → `claude.message.complete` (or `session.message.complete`)
- `socket.on('data'` → `socket.on('terminal.output'`
- `socket.on('exit'` → `socket.on('terminal.exit'`
- `ptyId` → `sessionId`
- `selectedProject` → `selectedWorkspace`
- UI copy: “Project” (filesystem) → “Workspace directory”

## Acceptance Criteria

- One glossary across code and UI; no ambiguous “project” for directories.
- All sockets use constants in `events.js`, with canonical names.
- Unified ID is always `sessionId`; session type ID consistently `typeSpecificId` (server) or `sessionSpecificId` (client when needed).
- APIs return `{ id, typeSpecificId }` and deprecate legacy fields after migration.
- Terminal and Claude panes consume canonical events; tests pass for both types.

## Risk Notes

- Socket event changes are the riskiest surface; dual‑emit and dual‑listen first, then remove legacy names after E2E passes.
- Route renames (`/projects` → `/workspaces`) are optional and should be deferred; update deep links and navigation if/when doing it.
- Keep backwards compatibility for one release cycle to avoid breaking external automation.

## Quick File References (for implementers)

- Server
  - `src/lib/server/claude/ClaudeSessionManager.js`
  - `src/lib/server/terminals/TerminalManager.js`
  - `src/lib/server/utils/events.js`
  - `src/lib/server/socket-setup.js`
- Client
  - `src/lib/components/ClaudePane.svelte`
  - `src/lib/components/ClaudeCommands.svelte`
  - `src/lib/components/TerminalPane.svelte`
  - `src/lib/shared/components/ProjectSessionMenuSimplified.svelte`
  - `src/lib/components/CreateSessionModal.svelte`
- API
  - `src/routes/api/sessions/+server.js`

All changes are applied; code and tests now use canonical event names and IDs throughout.

## Changelog

- Phase 1 (Server bridging) — Introduced canonical events and constants; added tools discovery cache. Completed.
- Phase 2 (Paths/Config/Logging) — Centralized roots; added logger and public URL handler. Completed.
- Phase 3 (UI terminology) — Switched UI to workspace terminology; `TerminalPane` prop renamed to `sessionId`. Completed.
- Phase 4 (API response) — `/api/sessions` returns `{ id, typeSpecificId }` only. Completed.
- Phase 5 (Remove bridges) — Removed legacy events/listeners (`tools.list`, `commands.refresh`, `message.*`, raw `data`/`exit`). Completed.
