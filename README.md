# Dispatch

**Secure sandboxed execution for Claude AI and CLI agents - run anywhere, resume everywhere.**

> 🚀 Instant YOLO mode from any device!

Run AI agents and automated scripts in complete isolation. Start on your laptop, continue on your desktop, finish on your tablet. No cloud required, no vendor lock-in, 100% free and open source.

## What is Dispatch?

Dispatch is a containerized development environment that lets you safely run Claude AI code assistance and other CLI agents without risking your host system. Every session is isolated, resumable, and completely under your control.

**Get started in 30 seconds:**

```bash
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  --name dispatch fwdslsh/dispatch:latest

# Open http://localhost:3030 and start coding!
```

## Why Dispatch?

**🛡️ Security by Design**
- Isolated Docker containers protect your host system
- AI agents execute in sandboxed environments
- No access to sensitive files unless explicitly mounted
- Full audit trail of all commands and outputs

**🔄 Resume Anywhere**
- Event-sourced architecture preserves complete session state
- Continue work across any device with the same Dispatch instance
- Recover from crashes and network interruptions
- Time-travel debugging through command history

**⚡ Unattended Operation**
- Let long-running tasks complete in the background
- Check results later without tying up your system
- Perfect for AI-assisted development workflows

**💰 Local-First, No Lock-In**
- Everything runs locally by default
- Add cloud hosting only if needed
- No usage limits, premium tiers, or hidden costs
- Your data stays under your control

## Core Features

### Multiple Session Types
- **Terminal Sessions**: Full Linux shell access
- **Claude AI Sessions**: AI-powered coding with OAuth authentication
- **File Editor**: Built-in code editor
- **Custom Adapters**: Extensible for other tools

### Security & Isolation
- Non-root container execution
- Optional public URL sharing (disabled by default)
- Password-protected access
- HTTPS support for production

### Session Persistence
- SQLite-based event sourcing
- Complete command history
- Cross-device synchronization
- Shareable session logs for team debugging

## Use Cases

**AI-Assisted Development**
```bash
# Ask Claude to scaffold a new microservice
# Test it safely in isolation
# Deploy only after verification
```

**Remote Development**
```bash
# Start at office → continue at home → finish on mobile
# All sessions resume seamlessly
```

**Team Collaboration**
```bash
# Share live sessions via public URL
# Perfect for pair programming and code reviews
```

**Safe Experimentation**
```bash
# Test risky commands
# Try new frameworks
# Clean slate for each prototype
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TERMINAL_KEY` | `change-me` | **Required** - Access password |
| `PORT` | `3030` | Web interface port |
| `WORKSPACES_ROOT` | `/workspace` | Project directory |
| `ENABLE_TUNNEL` | `false` | Public URL sharing |
| `LT_SUBDOMAIN` | `""` | Custom subdomain |
| `HOST_UID` / `HOST_GID` | - | User/group ID mapping |

### Persistent Storage

```bash
mkdir -p ~/dispatch/{home,workspace}

docker run -d -p 3030:3030 \
  --env-file .env \
  -v ~/dispatch/workspace:/var/lib/dispatch \
  -v ~/dispatch/home:/home/dispatch \
  --name dispatch fwdslsh/dispatch:latest
```

## Development Setup

```bash
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install  # Requires Node.js 22+

# Development modes
npm run dev              # Standard dev server
npm run dev:local       # Use local filesystem
npm run dev:no-key      # No authentication
npm run dev:tunnel      # Enable public URLs

# Testing & quality
npm test                # Unit tests
npm run test:e2e        # End-to-end tests
npm run lint            # Code quality
```

### Tech Stack
- **Frontend**: SvelteKit 5 with real-time updates
- **Backend**: Node.js 22 + Socket.IO
- **Terminal**: xterm.js + node-pty
- **Database**: SQLite for event sourcing
- **Containers**: Docker
- **AI**: Official Claude Code SDK

## Troubleshooting

**Session won't start?**
```bash
docker --version          # Check Docker is running
lsof -i :3030            # Verify port availability
docker logs dispatch     # Review container logs
```

**Can't connect to Claude?**
- Ensure valid Anthropic account
- Check internet connectivity for OAuth

**Data not persisting?**
- Verify volume mount permissions
- Check data directories exist and are writable
- Confirm container user ownership (uid 10001)

## Contributing

We welcome contributions! Check out:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- [CLAUDE.md](CLAUDE.md) - Technical implementation
- [Docker README](docker/README.md) - Container configuration

## Documentation & Support

- 📖 [Full Documentation](https://github.com/fwdslsh/dispatch/tree/main/docs)
- 🐛 [GitHub Issues](https://github.com/fwdslsh/dispatch/issues)

## License

**Creative Commons Attribution 4.0 International License**

Free to share, adapt, and use for any purpose. See [LICENSE](LICENSE) for details.

---

**Ready to start?**

```bash
docker run -d -p 3030:3030 -e TERMINAL_KEY=your-password fwdslsh/dispatch:latest
```

Open `http://localhost:3030` and code safely! 🚀
