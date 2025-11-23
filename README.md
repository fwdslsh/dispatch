# Dispatch

**Secure sandboxed execution for Claude AI and CLI agents - run anywhere, resume everywhere.**

> 🚀 YOLO on the go!

Run AI agents and automated scripts in complete isolation. Start on your laptop, continue on your desktop, finish on your tablet. No cloud required, no vendor lock-in, 100% free and open source.

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-CC--BY--4.0-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-33%20passing-brightgreen.svg)](#testing)

## What is Dispatch?

Dispatch is a production-ready containerized development environment that lets you safely run Claude AI code assistance and other CLI agents without risking your host system. Every session is isolated, resumable, and completely under your control with enterprise-grade security features.

**Get started and install the CLI**

```bash
# Install the dispatch CLI
curl -fsSL https://raw.githubusercontent.com/fwdslsh/dispatch/main/install.sh | bash

# Initialize configuration and start
dispatch init
dispatch start

# Attach directly to the container for development
dispatch attach

# Open http://localhost:3030 and start coding!
```

_Note: Requires bash and Docker_

📖 **[Quick Start Guide](docs/quickstart.md)** - Complete setup and usage walkthrough

## Why Dispatch?

**🛡️ Enterprise-Grade Security**

- Sandboxed Docker containers protect your host system
- Multiple authentication methods: Cookie sessions, API keys, OAuth (GitHub/Google)
- Rate limiting on authentication endpoints (10 attempts/minute)
- bcrypt password hashing with cost factor 12
- Secure session cookies (httpOnly, Secure, SameSite)
- Path traversal attack prevention
- AI agents execute safely without access to sensitive files
- Non-root execution with complete audit trails
- HTTPS support with Let's Encrypt or self-signed certificates

**🔄 Resume Anywhere**

- Event-sourced architecture preserves complete session state
- Continue work across devices with seamless session recovery
- Survive crashes and network interruptions
- Time-travel debugging through command history

**⚡ Built for AI & Automation**

- Multiple session types: Terminal, Claude AI, File Editor, Custom Adapters
- **Clean MVVM architecture** with Svelte 5 runes and dependency injection
- **Comprehensive test coverage** - 33 E2E tests ensuring reliability
- **VS Code Remote Tunnel integration** for seamless IDE access (requires VS Code CLI)
- Git worktree support with automated project initialization detection
- Workspace-level environment variables for consistent development environments
- **Standardized API error handling** across all 57 routes
- Let long-running tasks complete unattended in the background
- Perfect for AI-assisted development workflows
- SQLite-based persistence with cross-device synchronization

**💰 Local-First Freedom**

- Runs locally by default - your data stays under your control
- No usage limits, premium tiers, or vendor lock-in
- Add cloud hosting only if needed
- Open source with full customization access

## First-Run Experience

On first launch, Dispatch guides you through a quick onboarding process:

1. **Workspace Setup** - Choose your project directory
2. **Theme Selection** - Pick your preferred color scheme
3. **API Key Generation** - Automatically creates your first API key (shown only once!)
4. **Auto-Login** - Seamlessly logs you in with a secure session cookie

After onboarding, you can:
- **Manage API Keys** - Create labeled keys for different tools/scripts
- **Configure OAuth** - Optional GitHub/Google authentication
- **Customize Settings** - Themes, workspace variables, and more

## Configuration

### Authentication

Dispatch supports three authentication methods:

- **Session Cookies** (Browser) - Automatic after onboarding, 30-day expiration with auto-refresh
- **API Keys** (Programmatic) - Create via Settings → API Keys, manage multiple keys with labels
- **OAuth** (Optional) - GitHub/Google login via Settings → OAuth

### Environment Variables

When using the dispatch CLI the init command will create a `~/dispatch/home/.env` file with these variables.

| Variable          | Default                          | Description                           |
| ----------------- | -------------------------------- | ------------------------------------- |
| `TERMINAL_KEY`    | `change-me-to-a-strong-password` | Initial setup key (first run only)    |
| `PORT`            | `3030`                           | Web interface port                    |
| `WORKSPACES_ROOT` | `/workspace`                     | Project directory                     |
| `ENABLE_TUNNEL`   | `false`                          | Public URL sharing via LocalTunnel    |
| `LT_SUBDOMAIN`    | `""`                             | Custom subdomain for tunnel           |
| `SSL_ENABLED`     | `true`                           | Enable HTTPS (dev: self-signed cert)  |

📖 **[Complete Configuration Reference](docs/configuration/configuration-reference.md)**

### VS Code Remote Tunnel

The VS Code CLI is pre-installed in the Docker container. Simply use Settings → VS Code Tunnel in the web interface to start/stop the tunnel. The tunnel will be automatically named `dispatch-{hostname}` and provides:

- Direct access via VS Code Web at `https://vscode.dev/tunnel/{tunnel-name}/{folder}`
- Integration with VS Code Desktop using the Remote - Tunnels extension
- Device authentication flow shown directly in the UI

## Using Docker with SSL (Recommended)

**Single-container with automatic SSL:**

```bash
# Production with Let's Encrypt (free, trusted SSL)
docker run -d -p 80:80 -p 443:443 \
  -e DOMAIN=dispatch.yourdomain.com \
  -e LETSENCRYPT_EMAIL=admin@yourdomain.com \
  -e TERMINAL_KEY=super-secure-password \
  fwdslsh/dispatch:latest

# Development with self-signed SSL
docker run -d -p 80:80 -p 443:443 \
  -e SSL_MODE=self-signed \
  -e TERMINAL_KEY=test-password \
  fwdslsh/dispatch:latest

# HTTP only (no SSL)
docker run -d -p 80:80 \
  -e SSL_MODE=none \
  -e TERMINAL_KEY=test-password \
  fwdslsh/dispatch:latest
```

## Tech Stack

- **Frontend**: SvelteKit 5 with MVVM architecture (Svelte 5 runes + dependency injection)
- **Backend**: Node.js 22 + Socket.IO + Strategy pattern auth
- **Terminal**: xterm.js + node-pty
- **Database**: SQLite with event sourcing and repository pattern
- **Security**: bcrypt, rate limiting, OAuth 2.0, session management
- **Testing**: Vitest (unit) + Playwright (E2E) - 33 tests passing
- **Containers**: Docker with multi-stage builds
- **AI**: Official Claude Code SDK v1.0.98

## Testing

Dispatch has comprehensive test coverage to ensure reliability:

- **33 E2E Tests** - Full user flow testing with Playwright
  - Authentication & session management (23 tests)
  - Onboarding regression tests (10 tests)
  - Accessibility compliance
  - Workspace and session operations
- **Unit Tests** - Component and service testing with Vitest
- **Test Infrastructure** - Automated database seeding and test helpers

```bash
npm test                # Run all unit tests
npm run test:e2e        # Run E2E test suite
npm run dev:test        # Start test server (port 7173, no SSL)
```

📖 **[Testing Quick Start Guide](docs/testing-quickstart.md)** - Complete testing setup and helpers

## Documentation & Support

**Getting Started**
- 📖 [Quick Start Guide](docs/quickstart.md) - Complete setup walkthrough
- 🎯 [Configuration Reference](docs/configuration/configuration-reference.md) - All settings explained
- 📋 [CHANGELOG](CHANGELOG.md) - Version history and release notes

**Features & Guides**
- 🌿 [Git Worktree Guide](docs/features/git-worktrees.md) - Multiple working directories
- 🏗️ [MVVM Patterns](docs/architecture/mvvm-patterns.md) - Frontend architecture
- 🔌 [Adapter Guide](docs/architecture/adapter-guide.md) - Adding session types
- 🐛 [Error Handling](docs/contributing/error-handling.md) - Best practices

**API & Development**
- 🔗 [API Routes Reference](docs/reference/api-routes.md) - REST API documentation
- 🔌 [Socket Events Reference](docs/reference/socket-events.md) - WebSocket protocol
- 💾 [Database Schema](docs/reference/database-schema.md) - SQLite structure
- 🏢 [Workspace API](docs/reference/workspace-api.md) - Workspace management

**Support**
- 🐛 [GitHub Issues](https://github.com/fwdslsh/dispatch/issues) - Bug reports and features
- 💬 [Discussions](https://github.com/fwdslsh/dispatch/discussions) - Community help

## Contributing

We welcome contributions! Check out:

- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- [Docker README](docker/README.md) - Container configuration

## Development Setup

```bash
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# Setup - Requires Node.js 22+ (see .nvmrc)
nvm use                 # Use correct Node version
npm install             # Install dependencies

# Development modes
npm run dev             # Standard dev server with SSL (port 5173)
npm run dev:http        # Dev server without SSL
npm run dev:test        # Test server (port 7173, no SSL, isolated tmp storage)
npm run dev:tunnel      # Enable public URLs via LocalTunnel
npm run dev:local       # Use $HOME/code as workspace root

# Testing & Quality
npm test                # Unit tests (Vitest)
npm run test:e2e        # E2E tests (Playwright) - 33 tests
npm run test:e2e:headed # E2E with browser UI
npm run lint            # ESLint + Prettier
npm run check           # TypeScript type checking
npm run format          # Auto-format code

# Build & Production
npm run build           # Production build
npm run preview         # Preview production build
```

**Key Development Features:**
- 🔄 Hot module reload with Vite
- 🧪 Comprehensive test suite (33 E2E + unit tests)
- 🔍 Type checking with JSDoc
- 📝 Code formatting with Prettier
- 🎯 Dedicated test server for automated testing

## License

**Creative Commons Attribution 4.0 International License**

Free to share, adapt, and use for any purpose. See [LICENSE](LICENSE) for details.

---

**Ready to start?**

```bash
docker run -d -p 3030:3030 -e TERMINAL_KEY=your-password fwdslsh/dispatch:latest
```

Open `http://localhost:3030` and code safely! 🚀
