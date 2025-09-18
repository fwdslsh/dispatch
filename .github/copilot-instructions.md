# Copilot instructions — Dispatch

Quick orientation

- Purpose: web-based PTY sessions (SvelteKit frontend, Socket.IO backend) with optional Claude Code mode.
- Key entry points: `src/app.js` (production runtime), Vite dev (frontend), `src/lib/server/*` (PTY & sockets).

Essential commands

- Dev: `npm install` then `npm run dev` (note: dev script sets `TERMINAL_KEY=test` and runs `vite dev --host`).
- Build: `npm run build` (Vite). Preview: `npm run preview`.
- Start (production): `npm start` or use Docker (see `Dockerfile`). `start.sh` also execs `node src/app.js`.
- Typecheck: `npm run check` and `npm run check:watch`.

```markdown
# Copilot instructions — Dispatch (condensed)

Short goal: Make contributors productive quickly. Focus on the SvelteKit frontend, Socket.IO layer, and PTY/session managers in `src/lib/server`.

Quick commands (dev + CI)

- Install: `npm install` (Node >= 22)
- Dev (hot-reload): `npm run dev` (dev script sets `TERMINAL_KEY=test` and serves on :3030)
- Build/preview: `npm run build` then `npm run preview`
- Start (prod): `npm start` or `node src/app.js`
- Typecheck: `npm run check` (Svelte-check via `jsconfig.json`)
- Tests: `npm test` (Vitest), E2E: `npm run test:e2e` (Playwright)

Where to start (important files)

- `src/app.js` — production entry, LocalTunnel wiring, Socket.IO bootstrap
- `src/lib/server/socket-handler.js` — authentication and socket event routing
- `src/lib/server/terminal.js` (TerminalManager) — PTY spawn, env, mode switching (`shell` vs `claude`)
- `src/lib/server/session-store.js` — persistent session JSON store and shape
- `src/lib/server/core/*` — `SessionManager`, `SessionRouter`, `WorkspaceManager`, `DatabaseManager` (SQLite)
- `src/lib/client/*` — MVVM ViewModels and Svelte 5 runes (views under `shared/components`, viewmodels under `shared/viewmodels`)

Key conventions & patterns (project-specific)

- MVVM with Svelte 5 runes: Views are pure presentation; business logic lives in ViewModels (`src/lib/client/shared/viewmodels`). Look for `$state`, `$derived` usage.
- Unified Session API: `SessionManager.createSession({type, workspacePath, options})` supports `pty` and `claude` types. Routing is done via `SessionRouter`.
- Socket.IO contract: auth first (`auth(key)`), then session ops (`terminal.start`, `terminal.write`, `terminal.resize`, `claude.send`, etc.). See `CLAUDE.md` for full event names.
- Env-driven behavior: `TERMINAL_KEY`, `PTY_MODE` (`shell|claude`), `ENABLE_TUNNEL`, `WORKSPACES_ROOT`.
- Non-root container: production image runs as `appuser` (uid 10001). Files and volume mounts must respect ownership.

Editing rules for common tasks

- Add socket events: modify `socket-handler.js` and mirror client calls in `src/lib/client/*` (Terminal or Claude panes).
- Change PTY spawn/behavior: edit `terminal.js` and ensure session persistence in `session-store.js` remains compatible.
- Add workspace/session persistence fields: update `session-store.js` and `src/lib/server/db/*` migrations.

Quick debugging tips

- Reproduce locally with `npm run dev` and use browser at `http://localhost:3030` with key `test`.
- Check LocalTunnel URL at `/tmp/tunnel-url.txt` when `ENABLE_TUNNEL=true`.
- If PTY/Claude fails, confirm the CLI is present in container and inspect `src/lib/server/terminal.js` for spawn args.

Files to reference when making cross-cutting changes

- `src/app.js`, `src/lib/server/socket-handler.js`, `src/lib/server/terminal.js`, `src/lib/server/session-store.js`, `src/lib/server/core/SessionManager.js`, `src/lib/server/core/SessionRouter.js`, `src/lib/server/core/WorkspaceManager.js`

If anything is missing or you'd like more examples (event payloads, session JSON schema, or a short workflow for adding a socket event + test), tell me which area to expand.

``` 
Files referenced: `src/app.js`, `start.sh`, `Dockerfile`, `package.json`, `src/lib/server/socket-handler.js`, `src/lib/server/terminal.js`, `src/lib/server/session-store.js`, `src/lib/components/Terminal.svelte`, `src/lib/components/Chat.svelte`, sessions stored in `PTY_ROOT/sessions.json` at runtime.
