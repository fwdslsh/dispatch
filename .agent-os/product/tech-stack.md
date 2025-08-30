# Technical Stack

> Last Updated: 2025-08-30
> Version: 1.0.0

## Application Framework

- **Framework:** SvelteKit
- **Version:** v2.36.2

## Database

- **Primary Database:** JSON file-based storage (sessions.json)
- **Location:** PTY_ROOT/sessions.json (default: /tmp/dispatch-sessions/)

## JavaScript

- **Framework:** SvelteKit v2.36.2
- **Runtime:** Node.js 22+
- **Build Tool:** Vite v7.1.3

## CSS Framework

- **Framework:** augmented-ui v2.0.0
- **Styling:** Custom CSS with CSS custom properties
- **Responsive:** Mobile-first design

## Backend Technologies

- **Web Server:** Express v5.1.0
- **Real-time Communication:** Socket.IO v4.8.1
- **Terminal Emulation:** node-pty v1.0.0
- **Process Management:** Native Node.js child_process

## Frontend Technologies

- **Desktop Terminal Interface:** xterm.js v5.5.0
- **WebSocket Client:** Socket.IO Client v4.8.1
- **UI Components:** Native Svelte components
- **Icons:** Custom SVG icon components

## Development Tools

- **Type Checking:** JSDoc (via SvelteKit)
- **Testing Framework:** Playwright (available, not configured)
- **Package Manager:** npm
- **Development Server:** Vite with hot reload

## Containerization

- **Container Runtime:** Docker
- **Base Images:** 
  - Build: node:22-slim
  - Runtime: node:22-slim
- **User:** Non-root (appuser, uid 10001)
- **Multi-stage:** Build optimization

## External Services

- **Public URL Sharing:** LocalTunnel v2.0.2
- **AI Integration:** Claude CLI (optional, installed separately)

## Security Technologies

- **Authentication:** Shared secret (TERMINAL_KEY)
- **Session Isolation:** Filesystem-based (separate directories)
- **Container Security:** Non-root execution, minimal attack surface
- **Process Isolation:** Independent PTY processes per session

## Storage & Persistence

- **Session Metadata:** JSON file storage
- **File System:** Ephemeral container storage with optional volume mounts
- **Session Directories:** Isolated per session in PTY_ROOT
- **Logs:** Container stdout/stderr

## Environment Configuration

- **Configuration:** Environment variables
- **Required:** TERMINAL_KEY
- **Optional:** PORT, PTY_ROOT, PTY_MODE, ENABLE_TUNNEL, LT_SUBDOMAIN