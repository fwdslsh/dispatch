# Dispatch

**Secure sandboxed execution for Claude AI and CLI agents - run anywhere, resume everywhere.**

> 🚀 YOLO on the go!

Run AI agents and automated scripts in complete isolation. Start on your laptop, continue on your desktop, finish on your tablet. No cloud required, no vendor lock-in, 100% free and open source.

## What is Dispatch?

Dispatch is a containerized development environment that lets you safely run Claude AI code assistance and other CLI agents without risking your host system. Every session is isolated, resumable, and completely under your control.

**Get started and install the CLI**

```bash
# Install the dispatch CLI
curl -fsSL https://raw.githubusercontent.com/fwdslsh/dispatch/main/install.sh | bash

# Initialize configuration and start
dispatch init
dispatch start

# Open http://localhost:3030 and start coding!
```

_Note: Requires bash and Docker_

## Why Dispatch?

**🛡️ Secure & Isolated**

- Sandboxed Docker containers protect your host system
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
| `TERMINAL_KEY`    | `change-me`  | **Required** - Access password |
| `PORT`            | `3030`       | Web interface port             |
| `WORKSPACES_ROOT` | `/workspace` | Project directory              |
| `ENABLE_TUNNEL`   | `false`      | Public URL sharing             |
| `LT_SUBDOMAIN`    | `""`         | Custom subdomain               |

## Using Docker Directly

```bash
mkdir -p ~/dispatch/{home,workspace}

docker run -d -p 3030:3030 \
  --env-file ~/dispatch/home/.env \
  -v ~/dispatch/workspace:/var/lib/dispatch \
  -v ~/dispatch/home:/home/dispatch \
  --name dispatch fwdslsh/dispatch:latest
```

## Tech Stack

- **Frontend**: SvelteKit 5 with real-time updates
- **Backend**: Node.js 22 + Socket.IO
- **Terminal**: xterm.js + node-pty
- **Database**: SQLite for event sourcing
- **Containers**: Docker
- **AI**: Official Claude Code SDK

## Documentation & Support

- 📖 [Full Documentation](https://github.com/fwdslsh/dispatch/tree/main/docs)
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
npm run dev              # Standard dev server

npm run dev:tunnel      # Enable public URLs

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
