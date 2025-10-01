# Dispatch

**Secure sandboxed execution for Claude AI and CLI agents - run anywhere, resume everywhere.**

> 🚀 YOLO on the go!

Run AI agents and automated scripts in complete isolation. Start on your laptop, continue on your desktop, finish on your tablet. No cloud required, no vendor lock-in, 100% free and open source.

## What is Dispatch?

Dispatch is a containerized development environment that lets you safely run Claude AI code assistance and other CLI agents without risking your host system. Every session is isolated for your sensitive files, resumable, and completely under your control.

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

**🛡️ Isolated & Remotely Accessible**

- Sandboxed Docker containers protect your host system
- Secure remote access for a single developer—no cloud or complex home networking required
- AI agents execute safely without access to sensitive files
- Non-root execution with complete audit trails
- Password-protected access with optional HTTPS

**🔄 Resume Anywhere**

- Event-sourced architecture preserves complete session state
- Continue work across devices with seamless session recovery
- Survive crashes and network interruptions
- Time-travel debugging through command history

**⚡ Built for AI & Automation**

- Multiple session types: Terminal, Claude AI, File Editor, Custom Adapters
- **VS Code Remote Tunnel integration** for seamless IDE access (requires VS Code CLI)
- Git worktree support with automated project initialization detection
- Workspace-level environment variables for consistent development environments
- Let long-running tasks complete unattended in the background
- Perfect for AI-assisted development workflows
- SQLite-based persistence with cross-device synchronization

**💰 Local-First Freedom**

- Runs locally by default - your data stays under your control
- No usage limits, premium tiers, or vendor lock-in
- Add cloud hosting only if needed
- Open source with full customization access

## Configuration

### Environment Variables

When using the dispatch CLI the init command will create a `~/dispatch/home/.env` file with these variables.

| Variable          | Default      | Description                    |
| ----------------- | ------------ | ------------------------------ |
| `TERMINAL_KEY`    | `change-me-to-a-strong-password`  | **Required** - Access password |
| `PORT`            | `3030`       | Web interface port             |
| `WORKSPACES_ROOT` | `/workspace` | Project directory              |
| `ENABLE_TUNNEL`   | `false`      | Public URL sharing             |
| `LT_SUBDOMAIN`    | `""`         | Custom subdomain               |

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

- **Frontend**: SvelteKit 5 with real-time updates
- **Backend**: Node.js 22 + Socket.IO
- **Terminal**: xterm.js + node-pty
- **Database**: SQLite for event sourcing
- **Containers**: Docker
- **AI**: Official Claude Code SDK

## Documentation & Support

- 📖 [Full Documentation](docs)
- 🌿 [Git Worktree Guide](docs/features/git-worktrees.md) - Multiple working directories with auto-initialization
- 🐛 [GitHub Issues](https://github.com/fwdslsh/dispatch/issues)

## Contributing

We welcome contributions! Check out:

- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- [Docker README](docker/README.md) - Container configuration

## Development Setup

```bash
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install  # Requires Node.js 22+

# Development modes
npm run dev              # Standard dev server with SSL
npm run dev:http         # Dev server without SSL
npm run dev:test         # Automated test server (port 7173, no SSL, tmp storage)
npm run dev:tunnel       # Enable public URLs

# Testing & quality
npm test                # Unit tests
npm run test:e2e        # End-to-end tests
npm run lint            # Code quality
```

## License

**Creative Commons Attribution 4.0 International License**

Free to share, adapt, and use for any purpose. See [LICENSE](LICENSE) for details.

---

**Ready to start?**

```bash
docker run -d -p 3030:3030 -e TERMINAL_KEY=your-password fwdslsh/dispatch:latest
```

Open `http://localhost:3030` and code safely! 🚀
