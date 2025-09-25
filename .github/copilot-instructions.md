<!-- Concise Copilot instructions for Dispatch -->

# Copilot instructions (condensed)

Be small, precise, and follow project conventions. This file highlights the essential patterns and touchpoints
an AI agent needs to be productive in Dispatch.

- Big picture: SvelteKit frontend (Svelte 5) + Node backend. Core runtime: `src/lib/server/runtime/RunSessionManager.js`.
- Adapters: `src/lib/server/adapters/` (PtyAdapter, ClaudeAdapter, FileEditor). Adapters implement `create({onEvent})` and expose `input.write()` / `resize` / `close`.
- Realtime protocol: unified `run:*` Socket.IO events. Client API at `src/lib/client/shared/services/RunSessionClient.js`.
- Persistence: event-sourced `session_events` in SQLite. Sequence numbers matter for replay/resume logic.

- Common edits: change adapters in `src/lib/server/adapters/`; change client terminal behavior in `src/lib/client/terminal/TerminalPane.svelte`.
- Tests: unit tests under `tests/` (Vitest), E2E under `e2e/` (Playwright). Run: `npm test` and `npm run test:e2e`.

- Dev commands you can rely on:
  - `npm run dev` (dev server, uses `TERMINAL_KEY` and `.dispatch-home`)
  - `npm run build` / `npm run preview` / `npm run start`
  - `npm run lint` / `npm run format` / `npm run check`

- Conventions: Prettier with tabs + single quotes, Svelte 5 runes ($state/$derived), PascalCase components, Conventional Commits.
- Safety: never commit credentials (Claude tokens, TERMINAL_KEY). Document env vars instead.

- Quick tips:
  - To debug sessions, use `/console?key=TERMINAL_KEY` and enable `DEBUG=* npm run dev`.
  - When editing session logic, ensure events are both emitted to Socket.IO (`io.to('run:ID').emit('run:event', ...)`) and persisted via `appendSessionEvent`.
  - To add a session type: add adapter in `src/lib/server/adapters/`, register it with `RunSessionManager.registerAdapter()`, and add client UI under `src/lib/client/`.

If you want more detail on adapter registration, DB schema, or exact Socket.IO event flows, tell me which area to expand and I'll extend this file with precise file paths and examples.

<!-- .github/copilot-instructions.md - guidance for AI coding agents working on Dispatch -->

# Copilot instructions for this repository

These instructions are focused, actionable notes to help an AI coding agent be immediately productive in the
Dispatch codebase. Keep responses concise and make edits that follow the project's conventions.

## Quick summary (big picture)

- Frontend: SvelteKit + Svelte 5 (src/). UI components in `src/lib/client` and shared viewmodels in `src/lib/client/shared`.
- Backend: Node.js server with a unified RunSessionManager (`src/lib/server/runtime/RunSessionManager.js`) and adapters in `src/lib/server/adapters/` (Pty, Claude, FileEditor).
- Realtime: Socket.IO is used for client-server communication; use the unified `run:*` event API (e.g. `run:attach`, `run:input`, `run:event`).
- Persistence: Event-sourced session history in SQLite (`session_events`); sessions are resumeable via sequence numbers.

## What to change and what to avoid

- Prefer small, focused changes per PR. Follow Conventional Commits and keep the summary <72 chars.
- Do not change Svelte runes or switch Svelte major versions. Use Svelte 5 runes syntax throughout.
- Avoid committing secrets or hard-coded credentials. Use `TERMINAL_KEY` and environment variables.

## Key files and where to look for common tasks

- Start here for architecture & style: `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Unified session code: `src/lib/server/runtime/RunSessionManager.js` (create/attach/sendInput/resume logic).
- PTY adapter: `src/lib/server/adapters/PtyAdapter.js` (how PTYs are spawned and written to).
- Client session API: `src/lib/client/shared/services/RunSessionClient.js` (client-side API for `run:*` events).
- Terminal UI: `src/lib/client/terminal/TerminalPane.svelte` (attaching, term.onData, initial resize, mobile input components).
- DI container & services: `src/lib/client/shared/services/ServiceContainer.*` and `__API_SERVICES` usage across server and client.

## Development workflows (commands you can rely on)

- Dev server: `npm run dev` (uses `TERMINAL_KEY` and `.dispatch-home` for dev state).
- Build: `npm run build`; Preview: `npm run preview`; Start: `npm run start`.
- Tests: `npm test` (Vitest), E2E: `npm run test:e2e` (Playwright). Use `npm run playwright:install` once to install browsers.
- Lint & format: `npm run lint` (check), `npm run format` (apply Prettier tabs + single quotes).

## Project-specific conventions & patterns

- Prettier style: tabs, single quotes, width 100, no trailing commas. Respect existing formatting.
- Svelte components: PascalCase and route files use `+page.svelte` / `+server.js` conventions.
- ViewModels use Svelte 5 runes: reactive state uses `$state` and derived values via `$derived`.
- Event-sourcing: all session activity is recorded as events with a monotonic sequence number. When editing session logic, always consider both live emission (`io.to('run:ID')`) and database persistence (`appendSessionEvent`).
- Adapters follow a simple contract: implement `create({onEvent, ...})`, expose `input.write()` for input, and optional operations like `resize` or `close`.

## Integration points & external dependencies to be aware of

- Socket.IO: server-side setup in `src/lib/server/socket-setup.js` and Send/receive via `run:*` events.
- Claude: `@anthropic-ai/claude-code` integration in `src/lib/server/adapters/ClaudeAdapter.js` (requires credentials; avoid leaking tokens).
- node-pty: used by the PTY adapter. PTY writes flow through `RunSessionManager.sendInput()` -> `live.proc.input.write()`.
- SQLite DB: migrations and schema are under `src/lib/server/db` (session events and session metadata are critical for resume).

## Examples of common edits and where to place tests

- Add/modify adapter: create file in `src/lib/server/adapters/`, update registration where `RunSessionManager.registerAdapter()` is called (search for `.registerAdapter(` in server startup). Add unit tests under `tests/server/*`.
- Change terminal input behavior: edit `src/lib/client/terminal/TerminalPane.svelte` (client-side send) and `RunSessionManager.sendInput()` (server-side write). Ensure tests in `tests/client/terminal/` and `tests/server/` updated accordingly.
- Add a route or API: follow SvelteKit routing in `src/routes/`. Use `+server.js` for server endpoints.

## Debugging tips specific to this repo

- Admin console: `/console?key=TERMINAL_KEY` provides live session monitoring and is useful for reproduction.
- Enable verbose logs: `DEBUG=* npm run dev` to see debug logs from server modules.
- For socket troubleshooting, watch the browser DevTools Network WS frames and server logs (server emits `run:event` rows).
- Session replay/resume issues usually originate from sequence numbers or missing event persistence; inspect `session_events` table and timestamps.

## Safety & testing notes for AI agents

- Never add credentials or tokens to the repo or code. If a change requires credentials for local testing, document how to set env vars but do not commit values.
- Add unit tests for any server-side behavior change (Vitest). For user-facing changes, add/adjust Playwright E2E tests under `e2e/`.
- Keep changes small and include a test plan in PR description (commands to run locally: `npm run lint && npm test && npm run test:e2e`).

## Pull request checklist for AI-generated changes

- Use Conventional Commit style in the commit message (e.g., `fix(terminal): stop sending automatic newline on attach`).
- Run `npm run format`, `npm run lint`, and `npm test` locally before submitting.
- Update documentation (AGENTS.md or README) only if behavior or configuration changes.

## Writing articles and documentation

- Place articles in `docs/articles/` directory for organized documentation
- When writing articles for potential dev.to publishing, include front matter with:
  - `published: false` - prevents accidental publishing
  - `draft: true` - marks as draft content
  - `title:` - article title
  - `description:` - brief article summary
  - `tags:` - relevant tags for categorization
  - Example front matter:
    ```yaml
    ---
    title: 'Your Article Title Here'
    description: 'Brief description of the article content'
    published: false
    draft: true
    tags: dispatch, sveltekit, nodejs
    series: dispatch
    ---
    ```
