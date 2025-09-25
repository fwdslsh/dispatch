# Technical Stack

## Application Framework
**SvelteKit 2.x** - Modern meta-framework providing SSR, routing, and build optimizations

## Database System
**SQLite3 5.1.7** - Embedded database with event-sourced session persistence schema

## JavaScript Framework
**Svelte 5** - Reactive UI framework with runes-based state management and MVVM architecture

## Import Strategy
**node** - ES modules with Node.js-style imports via package.json type: "module"

## CSS Framework
**Custom CSS + Augmented UI 2.0.0** - Minimal custom styles with cyberpunk-themed UI components

## UI Component Library
**@battlefieldduck/xterm-svelte 2.1.0** - Terminal emulator with @xterm/xterm 5.5.0 and @xterm/addon-fit

## Real-time Communication
**Socket.IO 4.8.x** - Bidirectional WebSocket communication for session synchronization

## Terminal Integration
**node-pty 1.0.0** - Native terminal emulation for cross-platform PTY support

## AI Integration
**@anthropic-ai/claude-code 1.0.98** - Official Anthropic Claude Code integration

## Fonts Provider
**System fonts** - Native font stack with monospace fallbacks for terminal display

## Icon Library
**Custom SVG icons** - Minimal inline SVG icons integrated directly into components

## Application Hosting
**Node.js 22+** - Self-hosted via Express 5.1.0 server with SvelteKit adapter-node

## Database Hosting
**Local SQLite files** - Embedded database files within application deployment

## Asset Hosting
**Integrated static assets** - Vite 7.x bundled assets served via SvelteKit

## Deployment Solution
**Docker containerization** - Multi-stage Docker builds with docker-compose orchestration

## Code Repository URL
https://github.com/fwdslsh/dispatch

## Additional Technical Components

### Build & Development Tools
- **Vite 7.x** - Fast development server and build tool
- **ESLint 9.x** - Code linting with @eslint/js and svelte plugin
- **Prettier 3.x** - Code formatting with svelte plugin support
- **Vitest 3.x** - Unit testing framework with jsdom browser environment
- **Playwright 1.55** - End-to-end testing with headed/headless modes

### Runtime & Process Management
- **Commander 12.1** - CLI argument parsing for Docker management scripts
- **LocalTunnel 2.0.2** - Public URL tunneling for development and sharing
- **Open 10.1** - Cross-platform URL opening utilities

### Syntax & Rendering
- **Prism.js 1.30** - Syntax highlighting for code display
- **Markdown-it 14.1** - Markdown parsing and rendering
- **ansi_up 6.0.6** - ANSI escape sequence processing for terminal output

### UI Enhancement Libraries
- **@floating-ui/dom 1.7.4** - Positioning library for tooltips and dropdowns
- **HammerJS 2.0.8** - Touch gesture recognition for mobile support
- **svelte-virtual-list 3.0.1** - Virtualized list rendering for performance

### Testing & Quality Assurance
- **@testing-library/svelte 5.2.8** - Component testing utilities
- **@testing-library/jest-dom 6.8** - DOM testing assertions
- **@vitest/browser 3.2.3** - Browser-based test execution
- **vitest-browser-svelte 0.1.0** - Svelte-specific browser testing support

### Development Utilities
- **svelte-check 4.3.1** - TypeScript and Svelte validation
- **@sveltejs/kit** - SvelteKit core framework and CLI tools
- **vite-plugin-devtools-json 1.0.0** - Development debugging enhancements