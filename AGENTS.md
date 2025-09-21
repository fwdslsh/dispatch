# Dispatch Development Guidelines

## Project Structure

### Core Application

- **SvelteKit App**: `src/` - Main web application
  - `src/routes/` - SvelteKit routes and pages
  - `src/lib/client/` - Client-side components organized by feature:
    - `terminal/` - Terminal session components
    - `claude/` - Claude AI session components
    - `file-editor/` - File editor components
    - `shared/` - Shared components, services, and state management
  - `src/lib/server/` - Server-side logic:
    - `shared/` - Core server functionality including `RunSessionManager`
    - `terminal/` - Terminal adapter (`PtyAdapter.js`)
    - `claude/` - Claude adapter and auth management
    - `file-editor/` - File editor adapter
  - `src/lib/shared/` - Shared constants and utilities

### Supporting Files

- **CLI Tool**: `bin/cli.js` - Docker management CLI
- **Static Assets**: `static/` - Fonts, icons, manifest
- **Build Artifacts**: `.svelte-kit/`, `build/` (gitignored)
- **Tests**:
  - `tests/` - Unit and integration tests
  - `e2e/` - Playwright end-to-end tests
- **Docker**: `docker/` directory with Dockerfile and scripts
- **Config**: `docker-compose.yml`, `vite.config.js`, `svelte.config.js`

## Build, Test, Run

- `npm run dev` — start SvelteKit dev server with test key (port 5173)
- `npm run dev:local` — dev server using `$HOME/code` as workspace root
- `npm run dev:no-key` — dev server without authentication
- `npm run dev:tunnel` — dev server with LocalTunnel enabled
- `npm run start` — production build + start with LocalTunnel (port 5170)
- `npm run build` — build for production.
- `npm run preview` — preview built app.
- `npm run lint` — Prettier check + ESLint.
- `npm run format` — Prettier write.
- `npm test` — run Vitest in CI mode.
- `npm run test:e2e` — run Playwright E2E tests
- `npm run test:e2e:headed` — run E2E tests with browser UI
- `npm run docker:dev` — start Docker dev environment with build
- `npm run docker:start` — start Docker without rebuild
- `npm run docker:stop` — stop Docker containers
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

### Backend Architecture

- **RunSessionManager**: Core session management with event sourcing
  - Manages all session types via adapter pattern
  - Event replay capability with sequence numbers
  - Multi-client synchronization support
- **Adapters**: Session type implementations
  - `PtyAdapter` - Terminal sessions via node-pty
  - `ClaudeAdapter` - Claude Code integration
  - `FileEditorAdapter` - Built-in file editing
- **Socket.IO**: Real-time communication layer
  - Unified event protocol across all session types
  - Auto-reconnection with state recovery
- **SQLite Database**: Persistent storage
  - Event-sourced session history
  - Workspace and project metadata
  - Client layout preferences

### Frontend Architecture (Svelte 5)

- **MVVM Pattern**: Clean separation of concerns
  - ViewModels using Svelte 5 `$state` runes
  - Dependency injection via `ServiceContainer`
  - Shared services across components
- **Session Management**: Dynamic session rendering
  - Session type modules for extensibility
  - Window manager for layout control
  - Workspace organization

### Configuration

- Environment variables: `TERMINAL_KEY`, `ENABLE_TUNNEL`, `WORKSPACES_ROOT`
- Docker support with user mapping (`HOST_UID`/`HOST_GID`)
- LocalTunnel integration for public URLs

## Key Session Types

### Terminal Sessions (`pty`)

- Full Linux shell access via xterm.js and node-pty
- Persistent working directory per session
- Multi-tab support within same workspace
- Session resumption after disconnect

### Claude Sessions (`claude`)

- Claude Code integration for AI assistance
- OAuth authentication via Anthropic
- Tool use visualization with activity summaries
- Session persistence and replay

### File Editor Sessions (`file-editor`)

- Built-in Monaco-based editor
- Syntax highlighting and basic editing
- Integrated with workspace file system
- Auto-save functionality

## Commits & Pull Requests

- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, etc. Keep summaries imperative and < 72 chars.
- PRs must include: clear description, linked issues, test plan (commands + results), screenshots for UI, and notes on config/env changes.
- CI hygiene: run `npm run lint`, `npm test`, and relevant E2E locally before requesting review.

## Security & Configuration

- Do not commit secrets. Local dev uses `TERMINAL_KEY`; set via env and rotate for prod.
- Persistent data paths: `.dispatch-home/` (dev) or Docker volumes in `docker-compose.yml`.
- Prefer environment variables over hardcoded values; document new ones in README.
