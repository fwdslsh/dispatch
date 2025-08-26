# Dispatch - SvelteKit PTY + Claude Code in Docker

A containerized web application that provides interactive PTY (pseudoterminal) sessions accessible through your web browser. Perfect for development environments, remote access, and AI-assisted coding with Claude Code integration.

**What is Dispatch?** Think of it as a web-based terminal that runs in Docker containers. You can access powerful development environments from anywhere with just a browser, complete with AI assistance for coding tasks.

## Features

✅ **Zero-config run**: `docker run` → browser → login with key → start sessions  
✅ **Authentication**: Shared secret key protection for all access  
✅ **Multi-session support**: Multiple PTY sessions per user, each isolated  
✅ **Claude Code integration**: AI-assisted development with Claude's help  
✅ **Shell fallback**: Standard shell access when Claude isn't available  
✅ **LocalTunnel support**: Share your development environment via public URL  
✅ **Session isolation**: Each session runs in its own unique directory  
✅ **Non-root container**: Secure execution as non-privileged user

## ⚠️ Security Warning

**IMPORTANT**: Dispatch may require elevated access to your host machine. The maintainers make no claims regarding the security of this project. Please use at your own risk.

- This application provides terminal access which can execute system commands
- Sessions run with the permissions of the container user
- Always use strong authentication keys in production
- Consider network isolation when deploying
- Review the code before running in sensitive environments

## Quick Start

### Option 1: Docker (Recommended for most users)

The fastest way to get started is with Docker:

```bash
# 1. Run Dispatch with your own secret key
docker run -p 3000:3000 -e TERMINAL_KEY=your-secret-key dispatch

# 2. Open your browser to http://localhost:3000
# 3. Enter your secret key when prompted
# 4. Click "Create Session" to start a new terminal
```

**With public URL sharing** (great for remote access):
```bash
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e ENABLE_TUNNEL=true \
  dispatch
```

### Option 2: Local Development

For developers who want to modify or contribute to Dispatch:

```bash
# 1. Ensure you have Node.js 22+ installed
nvm use  # Uses the version specified in .nvmrc

# 2. Install dependencies
npm install

# 3. Build the application
npm run build

# 4. Start the server
TERMINAL_KEY=your-secret-key node src/app.js

# 5. Open http://localhost:3000 and enter your key
```

### First Steps After Login

1. **Create a Session**: Click "Create Session" to start a new terminal
2. **Choose Mode**: Select between shell mode or Claude Code mode (if available)
3. **Start Coding**: Your terminal is ready! Each session has its own isolated workspace
4. **Multiple Sessions**: Create additional sessions for different projects or tasks

### Enabling Claude Code

To use AI-assisted development with Claude:

```bash
# In your Docker container or local environment
npm install -g @anthropic-ai/claude-cli

# Then set the default mode
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e PTY_MODE=claude \
  dispatch
```

## Configuration Options

Customize Dispatch behavior with these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port where the web interface will be available |
| `TERMINAL_KEY` | `change-me` | **🔑 REQUIRED** - Your authentication password (⚠️ change this!) |
| `PTY_ROOT` | `/tmp/dispatch-sessions` | Directory where session files are stored |
| `PTY_MODE` | `shell` | Default session type: `claude` (AI-assisted) or `shell` (standard terminal) |
| `ENABLE_TUNNEL` | `false` | Create a public URL for remote access (`true`/`false`) |
| `LT_SUBDOMAIN` | `""` | Optional custom subdomain for public URL |

### Common Configuration Examples

**Basic usage:**
```bash
TERMINAL_KEY=my-secret-password
```

**With Claude Code:**
```bash
TERMINAL_KEY=my-secret-password
PTY_MODE=claude
```

**For remote access:**
```bash
TERMINAL_KEY=my-secret-password
ENABLE_TUNNEL=true
LT_SUBDOMAIN=my-dev-environment
```

## Architecture

```
┌─────────────────┐    ├───────────────────┤    ┌──────────────┐
│   Browser       │◄──►│   SvelteKit       │◄──►│  PTY Session │
│   (xterm.js)    │    │   + Socket.IO     │    │  (isolated)  │
└─────────────────┘    └───────────────────┘    └──────────────┘
                               │
                               ▼
                       ┌───────────────────┐
                       │   LocalTunnel     │
                       │   (optional)      │
                       └───────────────────┘
```

### Components

- **Frontend**: SvelteKit + xterm.js for browser terminal
- **Backend**: Socket.IO server for real-time PTY communication  
- **Session Manager**: node-pty for isolated shell/Claude sessions
- **Tunneling**: LocalTunnel for public URL sharing
- **Container**: Docker with non-root user execution

## Use Cases

**👨‍💻 Development Environments**: Create isolated development spaces for different projects

**🏫 Educational Settings**: Provide students with consistent, containerized coding environments

**🤖 AI-Assisted Coding**: Use Claude Code integration for intelligent code assistance and learning

**🌐 Remote Access**: Access your development environment from anywhere via web browser

**🔧 DevOps Tasks**: Run administrative commands and scripts in isolated environments

**👥 Team Collaboration**: Share temporary development environments with team members

## How Session Isolation Works

Each terminal session in Dispatch is completely isolated:

- **Unique Directory**: Each session runs in `/sessions/{uuid}` with its own filesystem space
- **Independent Environment**: Sessions don't interfere with each other's files or processes  
- **Mode Selection**: Choose between standard shell or AI-assisted Claude Code mode per session
- **Persistent Until Ended**: Sessions maintain their state and files until explicitly terminated
- **Secure Cleanup**: All session data is automatically cleaned up when sessions end

This means you can have multiple projects running simultaneously without conflicts!

## Security Features & Considerations

**Built-in Security Features:**
- 🔐 All access requires authentication with `TERMINAL_KEY`
- 👤 Container runs as non-root user (`appuser`) for reduced privilege
- 📁 Sessions isolated in separate directories
- 🗑️ No persistent storage beyond session lifetime
- 🔒 Optional public URL access with LocalTunnel

**Security Best Practices:**
- Use strong, unique authentication keys
- Regularly rotate your `TERMINAL_KEY`
- Monitor which sessions are active
- Consider network isolation for sensitive deployments
- Review logs for suspicious activity
- Be cautious when enabling public URL sharing

## API Endpoints

- `GET /` - Main application interface
- `GET /public-url` - Returns LocalTunnel URL if enabled
- `WebSocket /socket.io/` - PTY session communication

Note: The previous REST session management endpoint (`/sessions/api`) has been deprecated. Use the WebSocket API (`socket.io`) to list, create, attach, and end sessions. See the "WebSocket usage" section below.

### WebSocket usage

Clients should connect to the Socket.IO server and use these events:

- `list` (callback) — returns `{ ok: true, sessions: [...], active }`
- `create` (opts, callback) — create PTY; server expects `{ mode, cols, rows, meta }`; callback returns `{ ok: true, sessionId }`
- `attach` (opts, callback) — attach to existing session `{ sessionId, cols, rows }`
- `end` (sessionId?) — end a session; server broadcasts `sessions-updated`
- server broadcasts `sessions-updated` whenever session metadata changes

## Development & Contributing

### Development Commands

```bash
# Development server with hot reload (uses test key)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Type checking
npm run check

# Continuous type checking
npm run check:watch
```

### Contributing Guidelines

We welcome contributions! Here's how to get started:

1. **Fork the repository** on GitHub
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** with clear, focused commits
4. **Test thoroughly** with both shell and Claude modes
5. **Submit a pull request** with a clear description

### Development Notes

- This project uses Node.js 22+ (see `.nvmrc`)
- Built with SvelteKit and Socket.IO for real-time communication
- Uses xterm.js for the browser-based terminal experience
- Styled with a custom CSS framework and augmented-ui components

## Troubleshooting

### Common Issues

**"Invalid key" error:**
- Make sure your `TERMINAL_KEY` environment variable matches what you're entering in the browser
- Check that the key doesn't contain special characters that might be interpreted by your shell

**Container won't start:**
- Verify Docker is running and you have permission to run containers
- Check if port 3000 is already in use: `lsof -i :3000`
- Ensure you're using Node.js 22+ if running locally

**Claude Code not working:**
- Install the Claude CLI: `npm install -g @anthropic-ai/claude-cli`
- Set `PTY_MODE=claude` in your environment variables
- Verify the Claude CLI is accessible in your container/environment

**Public URL not working:**
- Ensure `ENABLE_TUNNEL=true` is set
- Check your internet connection and firewall settings
- LocalTunnel may have rate limits or temporary issues

### Getting Help

- Check the [GitHub Issues](https://github.com/fwdslsh/dispatch/issues) for known problems
- Create a new issue with detailed information about your problem
- Include your environment details (OS, Docker version, Node.js version)

## Production Deployment

### Quick Production Setup

```bash
# Build and run in production mode
docker build -t dispatch .
docker run -d \
  --name dispatch-prod \
  -p 3000:3000 \
  -e TERMINAL_KEY=your-strong-production-key \
  -e PTY_MODE=shell \
  dispatch
```

### Production with Claude Code

To enable AI-assisted development in production:

```dockerfile
# Add to your Dockerfile for Claude support
RUN npm install -g @anthropic-ai/claude-cli
ENV PTY_MODE=claude
```

Then deploy:
```bash
docker run -d \
  --name dispatch-claude \
  -p 3000:3000 \
  -e TERMINAL_KEY=your-strong-production-key \
  -e PTY_MODE=claude \
  your-claude-enabled-image
```

### Production Considerations

- **Use strong authentication keys** (at least 20 characters, mix of letters/numbers/symbols)
- **Set up proper logging** and monitoring
- **Consider using a reverse proxy** (nginx, Caddy) for SSL termination
- **Regularly update** the container image for security patches
- **Use volume mounts** if you need persistent data across container restarts
- **Monitor resource usage** - each session consumes memory and CPU

### Docker Compose Example

```yaml
version: '3.8'
services:
  dispatch:
    build: .
    ports:
      - "3000:3000"
    environment:
      - TERMINAL_KEY=your-strong-production-key
      - PTY_MODE=shell
      - ENABLE_TUNNEL=false
    restart: unless-stopped
    volumes:
      - dispatch-sessions:/tmp/dispatch-sessions

volumes:
  dispatch-sessions:
```

## License

Creative Commons Attribution 4.0 International License - see LICENSE file for details.

---

**Ready to get started?** Jump to the [Quick Start](#quick-start) section above! 🚀