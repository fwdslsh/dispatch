# Contributing to Dispatch

We welcome contributions to Dispatch! This guide will help you get started with development and contributing to the project.

## 🚀 Quick Development Setup

### Prerequisites

- **Node.js 22+**
- **Docker** (for containerized testing)
- **Git**

### Getting Started

```bash
# 1. Fork and clone the repository
git clone https://github.com/your-username/dispatch.git
cd dispatch

# 2. Use the correct Node.js version
nvm use --lts

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
```

The dev server will start at `http://localhost:3030` with the test key `test`.

## 🛠️ Development Commands

```bash
# Development server with hot reload (uses TERMINAL_KEY=test)
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

## 🏗️ Project Architecture

### Overview

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

### Key Components

- **Frontend**: SvelteKit + xterm.js for browser terminal
- **Backend**: Socket.IO server for real-time PTY communication
- **Session Manager**: node-pty for isolated shell/Claude sessions
- **Tunneling**: LocalTunnel for public URL sharing
- **Container**: Docker with non-root user execution

### Project Structure

```
src/
├── app.js                 # Production runtime entry point
├── lib/
│   ├── components/        # Svelte components
│   │   ├── Terminal.svelte    # Main terminal interface
│   │   ├── Chat.svelte        # Claude chat interface
│   │   └── ...
│   └── server/           # Backend server code
│       ├── socket-handler.js  # Socket.IO event handling
│       ├── terminal.js        # PTY management
│       └── session-store.js   # Session persistence
└── routes/               # SvelteKit routes
    ├── +page.svelte      # Main interface
    └── sessions/         # Session management UI
```

## 🔧 Key Files and Their Purpose

### Entry Points

- **`src/app.js`**: Production runtime, imports `../build/handler.js` and starts Socket.IO
- **Vite dev**: Frontend development server
- **`src/lib/server/*`**: PTY & socket backend logic

### Core Backend Files

- **`src/lib/server/socket-handler.js`**: Socket.IO connection handling and authentication
- **`src/lib/server/terminal.js`**: PTY lifecycle management, environment setup, mode switching
- **`src/lib/server/session-store.js`**: Session persistence and JSON storage (stores file at `PTY_ROOT/sessions.json`)

### Frontend Components

- **`src/lib/components/Terminal.svelte`**: Main terminal interface with xterm.js
- **`src/lib/components/Chat.svelte`**: Claude chat interface
- **`src/routes/+page.svelte`**: Main application page

## 📡 Socket.IO API

### Authentication

```javascript
socket.emit('auth', 'your-key', (response) => {
	if (response.ok) {
		// Authenticated successfully
	}
});
```

### Session Management

```javascript
// List sessions
socket.emit('list', (response) => {
	// response: { ok: true, sessions: [...], active }
});

// Create session
socket.emit('create', { mode: 'shell', cols: 80, rows: 24, meta: {} }, (response) => {
	// response: { ok: true, sessionId: 'uuid' }
});

// Attach to session
socket.emit('attach', { sessionId: 'uuid', cols: 80, rows: 24 }, (response) => {
	// response: { ok: true }
});

// Send input
socket.emit('input', data);

// Resize terminal
socket.emit('resize', { cols: 80, rows: 24 });

// End session
socket.emit('end', sessionId);

// Detach from session
socket.emit('detach');
```

### Server Events

```javascript
// Terminal output
socket.on('output', (data) => {
	terminal.write(data);
});

// Sessions updated
socket.on('sessions-updated', () => {
	// Refresh session list
});
```

## 🐳 Docker Development

### Building the Container

```bash
# Build with current code
docker build -f docker/Dockerfile -t dispatch:dev .

# Run development container
docker run -p 3030:3030 -e TERMINAL_KEY=test dispatch:dev
```

### Container Structure

- **Base**: Node.js 22
- **User**: `appuser` (uid 10001) for security
- **Sessions**: Stored in `PTY_ROOT` (default `/tmp/dispatch-sessions`)
- **Ports**: Exposes port 3030

## 🧪 Testing

### Manual Testing

1. **Start dev server**: `npm run dev`
2. **Open browser**: `http://localhost:3030`
3. **Test authentication**: Use key `test`
4. **Test session creation**: Both shell and Claude modes
5. **Test multiple sessions**: Create and switch between sessions
6. **Test public URLs**: Set `ENABLE_TUNNEL=true`

### Testing Claude Mode

```bash
# Install Claude CLI globally
npm install -g @anthropic-ai/claude-cli

# Start with Claude mode
PTY_MODE=claude npm run dev
```

### Docker Testing

```bash
# Test production build
npm run build
docker build -f docker/Dockerfile -t dispatch:test .
docker run -p 3030:3030 -e TERMINAL_KEY=test-key dispatch:test
```

## 🔄 Development Workflow

### Making Changes

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Test thoroughly**:
   - Run `npm run check` for type checking
   - Test both shell and Claude modes
   - Test in both dev and production Docker builds

4. **Submit a pull request** with:
   - Clear description of changes
   - Test cases you've verified
   - Any breaking changes noted

### Adding Socket Events

1. **Update `socket-handler.js`**: Add new event handlers
2. **Update frontend**: Add client-side event handling in components
3. **Test**: Verify event flow works correctly

### Modifying PTY Behavior

1. **Update `terminal.js`**: Modify spawn args, environment setup
2. **Update session store**: If changing session data structure
3. **Test**: Verify sessions work in both modes

### Adding UI Components

1. **Create component**: In `src/lib/components/`
2. **Import and use**: In appropriate routes or other components
3. **Style**: Follow existing CSS patterns
4. **Test**: Verify responsive behavior

## 🌍 Environment Variables

### Development

```bash
# Automatically set by npm run dev
TERMINAL_KEY=test

# Optional for testing
PTY_MODE=shell          # or 'claude'
ENABLE_TUNNEL=false     # or 'true'
PORT=3030
PTY_ROOT=/tmp/dispatch-sessions
```

### Production

```bash
# Required
TERMINAL_KEY=your-strong-password

# Optional
PTY_MODE=shell
ENABLE_TUNNEL=false
LT_SUBDOMAIN=your-subdomain
PORT=3030
PTY_ROOT=/tmp/dispatch-sessions
```

## 🐛 Debugging Tips

### Common Development Issues

**Port already in use**:

```bash
# Find and kill process using port 3030
lsof -ti:3030 | xargs kill -9
```

**Node version mismatch**:

```bash
# Use correct version
nvm use
```

**Socket connection issues**:

- Check browser console for WebSocket errors
- Verify `TERMINAL_KEY` matches between client and server
- Check that Socket.IO server is running

**PTY spawn failures**:

- Ensure the shell/CLI exists in the environment
- Check file permissions
- Verify environment variables are set correctly

### Development Server Debug

The dev server runs with `TERMINAL_KEY=test` and enables hot reload. Check:

1. **Vite output**: Look for compilation errors
2. **Browser console**: Check for runtime errors
3. **Network tab**: Verify Socket.IO connection
4. **Terminal output**: Check server-side logs

### Production Debug

```bash
# Run with debug output
DEBUG=* node src/app.js

# Check container logs
docker logs container-name

# Inspect running container
docker exec -it container-name sh
```

## 📝 Code Style

### General Guidelines

- **Clear, descriptive variable names**
- **Small, focused functions**
- **Consistent indentation** (2 spaces)
- **Comments for complex logic**
- **Error handling** for all async operations

### JavaScript/Svelte

- Use modern ES6+ features
- Prefer `const` over `let` when possible
- Use async/await over Promise chains
- Follow SvelteKit conventions

### Socket Events

- Use descriptive event names
- Always provide callback responses
- Handle errors gracefully
- Document event payloads

## 🚀 Release Process

### Versioning

We follow semantic versioning:

- **Major**: Breaking changes
- **Minor**: New features
- **Patch**: Bug fixes

### Docker Images

Images are published to `fwdslsh/dispatch:latest`:

```bash
# Build and tag
docker build -f docker/Dockerfile -t fwdslsh/dispatch:latest .

# Test locally
docker run -p 3030:3030 -e TERMINAL_KEY=test fwdslsh/dispatch:latest

# Push (maintainers only)
docker push fwdslsh/dispatch:latest
```

## 🤝 Contributing Guidelines

### Pull Request Process

1. **Fork** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** with clear commits
4. **Test thoroughly** (see testing section above)
5. **Update documentation** if needed
6. **Submit pull request** with clear description

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add session export functionality
fix: resolve Socket.IO connection timeout
docs: update API documentation
style: fix code formatting
refactor: simplify session management
test: add unit tests for terminal manager
```

### Code Review

All contributions require review:

- **Functionality**: Does it work as expected?
- **Security**: No security vulnerabilities introduced?
- **Performance**: No significant performance regression?
- **Style**: Follows project conventions?
- **Tests**: Adequate testing coverage?

## 📚 Additional Resources

### Dependencies

- **[SvelteKit](https://kit.svelte.dev/)**: Full-stack framework
- **[Socket.IO](https://socket.io/)**: Real-time communication
- **[xterm.js](https://xtermjs.org/)**: Browser terminal emulator
- **[node-pty](https://github.com/microsoft/node-pty)**: PTY bindings
- **[LocalTunnel](https://localtunnel.github.io/www/)**: Public URL sharing

### References

- **[SvelteKit Docs](https://kit.svelte.dev/docs)**
- **[Socket.IO Docs](https://socket.io/docs/)**
- **[xterm.js API](https://xtermjs.org/docs/)**
- **[Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)**

## 🆘 Getting Help

- **GitHub Issues**: Report bugs or request features
- **Discussions**: Ask questions or share ideas
- **Code Review**: Request feedback on your contributions

Remember to include:

- **Environment details** (OS, Node.js version, Docker version)
- **Steps to reproduce** any issues
- **Expected vs actual behavior**
- **Relevant logs** or error messages

---

Thank you for contributing to Dispatch! 🚀
