# Repository Guidelines

## Project Structure & Modules

- App code: `src/` (SvelteKit). Routes in `src/routes`, shared UI in `src/lib/shared`, server logic in `src/lib/server`.
- CLI: `bin/dispatch-cli.js`.
- Static assets: `static/`. Build artifacts: `.svelte-kit/`, `build/`.
- Tests: unit/integration in `tests/`; end‑to‑end in `e2e/` (Playwright).
- Ops: `docker/` and `docker-compose.yml`.
- Debugging Tools: `.debug/` contains scripts to help test various features

## Build, Test, Run

- `npm run dev` — start SvelteKit dev server (uses `TERMINAL_KEY`, `.dispatch-home`).
- `npm run start` — production start (build then launch Node adapter at `PORT=5170`).
- `npm run build` — build for production.
- `npm run preview` — preview built app.
- `npm run lint` — Prettier check + ESLint.
- `npm run format` — Prettier write.
- `npm test` — run Vitest in CI mode.
- `npm run test:e2e` — run Playwright E2E via `run-e2e-tests.js`.
- Optional: `docker-compose up` to run the containerized stack.

Node >= 22 is required.

## Coding Style & Naming

- Prettier: tabs, single quotes, no trailing commas, width 100. Run `npm run format` before pushing.
- ESLint with Svelte plugin; fix issues or justify disables.
- Svelte components: `PascalCase.svelte`. Routes follow SvelteKit patterns (`+page.svelte`, `+server.js`).
- Modules in `src/lib/server` and `src/lib/shared` should use clear, descriptive names (no single-letter vars).
- Use ONLY Svelte 5 runes syntax. Do not use deprecated APIs like createEventDispatcher.

When connected to the svelte-llm MCP server, you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools

### 1. list_sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get_documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list_sections tool, you MUST analyze the returned documentation sections and then use the get_documentation tool to fetch ALL documentation sections that are relevant for the users task.

## Testing Guidelines

- Frameworks: Vitest (unit), Playwright (E2E).
- Place unit tests under `tests/`; name `*.{test,spec}.{js,ts}`. Svelte tests: `**/*.svelte.{test,spec}.{js,ts}`.
- E2E tests live in `e2e/*.spec.js`. Install browsers with `npm run playwright:install` once.
- Ensure new features have unit coverage; add/adjust E2E where user flows change.

## Architecture Overview

- SvelteKit app with Node adapter; dev/build config in `vite.config.js`.
- Realtime via Socket.IO initialized by `setupSocketIO()`; server modules live under `src/lib/server/**`.
- UI composed of Svelte components in `src/lib/shared/components` and feature panes in `src/lib/components`.
- CLI entry `bin/dispatch-cli.js` complements the web UI.
- Environment-driven config (e.g., `TERMINAL_KEY`, `ENABLE_TUNNEL`); dev state under `.dispatch-home/` or Docker volumes.

## Commits & Pull Requests

- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, etc. Keep summaries imperative and < 72 chars.
- PRs must include: clear description, linked issues, test plan (commands + results), screenshots for UI, and notes on config/env changes (e.g., `TERMINAL_KEY`, `ENABLE_TUNNEL`).
- CI hygiene: run `npm run lint`, `npm test`, and relevant E2E locally before requesting review.

## Security & Configuration

- Do not commit secrets. Local dev uses `TERMINAL_KEY`; set via env and rotate for prod.
- Persistent data paths: `.dispatch-home/` (dev) or Docker volumes in `docker-compose.yml`.
- Prefer environment variables over hardcoded values; document new ones in README.
