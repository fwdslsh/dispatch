# Copilot instructions — Dispatch

Quick orientation

- Purpose: web-based PTY sessions (SvelteKit frontend, Socket.IO backend) with optional Claude Code mode.
- Key entry points: `src/app.js` (production runtime), Vite dev (frontend), `src/lib/server/*` (PTY & sockets).

Essential commands

- Dev: `npm install` then `npm run dev` (note: dev script sets `TERMINAL_KEY=test` and runs `vite dev --host`).
- Build: `npm run build` (Vite). Preview: `npm run preview`.
- Start (production): `npm start` or use Docker (see `Dockerfile`). `start.sh` also execs `node src/app.js`.
- Typecheck: `npm run check` and `npm run check:watch`.

Project constraints & conventions

- Node >= 22 (see `.nvmrc` / `package.json` engines). Use `nvm use` in local dev.
- Non-root runtime: Docker image creates `appuser` (uid 10001); session dirs live in `PTY_ROOT` (default `/tmp/dispatch-sessions`).
- Sessions persist in a simple JSON store and ephemeral session directories — search `src/lib/server/session-store.js` and `sessions.json`.

Where to look first (fast map)

- HTTP + SvelteKit handler: `src/app.js` -> imports `../build/handler.js` and starts Socket.IO.
- Socket entrypoints / auth: `src/lib/server/socket-handler.js` (look for `handleConnection`).
- PTY lifecycle: `src/lib/server/terminal.js` (TerminalManager / spawn logic, environment setup, mode switching).
- Session persistence: `src/lib/server/session-store.js` (stores sessions at `PTY_ROOT/sessions.json`).
- Frontend terminal: `src/lib/components/Terminal.svelte` and chat/aux UI in `Chat.svelte`.
- LocalTunnel integration: `src/app.js` (spawns `npx localtunnel`, writes `/tmp/tunnel-url.txt`).

Runtime & integration details worth knowing

- Socket.IO API (all real-time session operations):
  - `auth(key, cb)` — authenticate with `TERMINAL_KEY`.
  - `create({mode, cols, rows, meta}, cb)` — create a new session; returns `{ok, sessionId}`.
  - `attach({sessionId, cols, rows}, cb)` — attach to an existing session.
  - `list(cb)` — list sessions.
  - `input`, `resize`, `end`, `detach` — runtime I/O and lifecycle events.
- PTY modes: `PTY_MODE` env var selects default (`shell` or `claude`). Claude mode spawns the external `claude` CLI if installed.
- Tunnel: when `ENABLE_TUNNEL=true` app spawns `npx localtunnel --port <PORT>` and writes URL to `/tmp/tunnel-url.txt`.

Editing guidelines for common tasks

- Add/modify socket events: update `socket-handler.js`, then update frontend client usage in `Terminal.svelte` / `Chat.svelte`.
- Change PTY behavior: update `terminal.js` (spawn args, env setup) and ensure session-store updates are synchronous-safe.
- Persisted session shape: follow existing JSON structure in `sessions.json` — modify `session-store.js` when changing fields.
- Docker: Dockerfile uses multi-stage build and expects runtime defaults in ENV (see `Dockerfile` for `PORT`, `PTY_ROOT`, `PTY_MODE`). Building with Claude requires installing the Claude CLI in the image.

Debug & dev tips (concrete)

- Dev server: `npm run dev` exposes Vite host; use browser at `http://localhost:3030` and key `test` (dev script).
- Production local run: `TERMINAL_KEY=your-key node src/app.js` or use `start.sh` for a small wrapper that prepares `PTY_ROOT`.
- Check tunnel output: when enabled, see `/tmp/tunnel-url.txt` for the public URL.
- If PTY spawn fails, inspect `src/lib/server/terminal.js` and ensure the CLI exists (e.g., `claude`) and container has execute permissions.

Testing & CI pointers

- Playwright is a dependency; add tests under a `tests/` folder if needed and shell out to `playwright` from npm scripts.
- Keep type checking green: `npm run check` (uses `svelte-check` with `jsconfig.json`).

When in doubt

- Trace a user action from front-end -> `build/handler.js` -> `src/app.js` -> Socket.IO -> `socket-handler.js` -> `terminal.js`.
- Update the small surface areas: socket events, terminal spawn, session-store; these three files cover most runtime changes.

Files referenced: `src/app.js`, `start.sh`, `Dockerfile`, `package.json`, `src/lib/server/socket-handler.js`, `src/lib/server/terminal.js`, `src/lib/server/session-store.js`, `src/lib/components/Terminal.svelte`, `src/lib/components/Chat.svelte`, sessions stored in `PTY_ROOT/sessions.json` at runtime.

If anything above is unclear or you want more examples (e.g., exact event payloads, session JSON schema, or a short workflow for adding a socket event + test), tell me which part and I'll expand.
