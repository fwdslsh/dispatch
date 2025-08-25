# Dispatch - GitHub Copilot Development Instructions

**ALWAYS** reference these instructions first and fallback to search, documentation, or bash commands only when you encounter unexpected information that does not match the information provided here. These instructions are validated and comprehensive.

## Project Overview

**Dispatch** is a containerized web application that provides interactive PTY (pseudoterminal) sessions accessible via browser. Built with SvelteKit and Socket.IO for real-time terminal communication. Primary use case: providing Claude Code sessions in isolated Docker environments with web-based terminal access.

## Working Effectively

### Bootstrap and Build Process

**CRITICAL BUILD TIMING**: All builds have been validated with actual timing measurements. NEVER CANCEL long-running commands.

1. **Environment Setup**:
   ```bash
   # Node.js 20+ required (check with node --version)
   npm install  # Takes ~30 seconds
   ```

2. **Development Server**:
   ```bash
   npm run dev  # Starts on http://localhost:5173
   # Ready in ~1.5 seconds. Uses vite.config.js with Socket.IO integration
   ```

3. **Production Build**:
   ```bash
   npm run build  # Takes ~8 seconds. NEVER CANCEL - Set timeout to 60+ seconds
   # Uses vite.config.prod.js (separate config to avoid node-pty imports during build)
   ```

4. **Type Checking**:
   ```bash
   npm run check  # Takes ~5 seconds. NEVER CANCEL - Set timeout to 30+ seconds
   ```

5. **Complete Build and Run**:
   ```bash
   npm run start  # Takes ~10 seconds total (build + start). NEVER CANCEL - Set timeout to 60+ seconds
   # Builds with production config and starts server on port 5170
   ```

### Docker Deployment

**CRITICAL DOCKER TIMING**: Docker builds take significant time due to npm install in container.

```bash
# Docker build - Takes 7-8 minutes. NEVER CANCEL - Set timeout to 600+ seconds (10+ minutes)
docker build -t dispatch .

# Run container
docker run -p 3000:3000 -e TERMINAL_KEY=your-secret-key dispatch

# With public tunnel support
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e ENABLE_TUNNEL=true \
  dispatch
```

**Docker Compose**:
```bash
# Quick setup with docker-compose
docker-compose up -d  # Takes 8+ minutes on first build. NEVER CANCEL
```

## Validation Requirements

**ALWAYS** run these validation steps after making any changes:

### 1. Build Validation
```bash
# All commands must complete successfully:
npm run check    # Type checking - ~5 seconds
npm run build    # Production build - ~8 seconds  
npm run start    # Build + run - ~10 seconds
```

### 2. Manual Functionality Testing

**CRITICAL**: ALWAYS test actual user scenarios. Starting/stopping servers is NOT sufficient validation.

1. **Authentication Flow**:
   - Start development server: `npm run dev`
   - Navigate to http://localhost:5173
   - Enter terminal key (default: "test" for dev)
   - Click "connect" button
   - Verify redirect to /sessions page

2. **Session Management**:
   - On sessions page, verify mode selector (claude/bash)
   - Click "Create new session" button
   - Verify navigation to session page (/sessions/{uuid})
   - Verify session ID appears in header

3. **Docker Deployment**:
   - Build Docker image: `docker build -t dispatch-test .`
   - Run container: `docker run -d -p 3001:3000 -e TERMINAL_KEY=test-key dispatch-test`
   - Test HTTP response: `curl -I http://localhost:3001`
   - Verify 200 OK response

### 3. Pre-commit Validation
```bash
# Run these before committing changes:
npm run check    # Must pass - fixes type issues
npm run build    # Must complete successfully
# Manual testing above must pass
```

## Architecture and Key Files

### Core Structure
```
src/
├── app.js                     # Production server entry point
├── lib/
│   ├── components/
│   │   ├── Terminal.svelte    # Main terminal component with xterm.js
│   │   └── HeaderToolbar.svelte
│   └── server/
│       ├── socket-handler.js  # Socket.IO connection management
│       ├── terminal.js        # TerminalManager class (imports node-pty)
│       └── session-store.js   # Session metadata persistence
└── routes/
    ├── +page.svelte          # Main authentication interface  
    ├── sessions/+page.svelte # Session management interface
    └── sessions/[id]/+page.svelte # Individual session view
```

### Configuration Files
- **vite.config.js**: Development config with Socket.IO integration
- **vite.config.prod.js**: Production build config (NO Socket.IO to avoid node-pty issues)  
- **package.json**: Build scripts use production config for builds
- **jsconfig.json**: TypeScript checking configuration (no invalid options)
- **Dockerfile**: Multi-stage build with node-pty compilation support

### Environment Variables
```bash
# Required
TERMINAL_KEY=change-me        # Authentication key (⚠️ change in production!)

# Optional  
PORT=3000                     # Server port
PTY_ROOT=/tmp/dispatch-sessions # Session directory root
PTY_MODE=shell               # Default session mode (shell|claude)
ENABLE_TUNNEL=false          # Enable LocalTunnel for public access
LT_SUBDOMAIN=""             # Optional LocalTunnel subdomain
```

## Common Issues and Solutions

### Build Issues

1. **"node-pty build failed"**: 
   - Solution: Use separate production vite config (already implemented)
   - Never import node-pty during build phase
   - Production builds use `vite.config.prod.js`

2. **"GLIBC version not found" in Docker**:
   - Solution: Multi-stage Docker build with proper base images (already implemented)
   - Build stage uses node:20-bullseye with build tools
   - Runtime stage uses node:20-slim with runtime dependencies

3. **"Terminal is not a constructor" in dev**:
   - Known development issue with xterm.js imports
   - Does not affect production builds
   - Core functionality (auth, sessions, navigation) works correctly

### Development Issues

1. **Socket.IO not working in development**:
   - Check vite.config.js has webSocketServer plugin
   - Verify NODE_ENV is not set to production during dev
   - Plugin only loads in non-production environment

2. **Type checking fails**:
   - Run `npm run check` to see specific errors
   - Common fix: ensure jsconfig.json has valid compiler options
   - Avoid invalid options like `"jsDoc": "import"`

## File Change Guidelines

### When modifying server files:
- **terminal.js**: Contains node-pty imports - changes may affect Docker builds
- **socket-handler.js**: Core Socket.IO logic - test with real browser scenarios
- **app.js**: Production entry point - verify both dev and prod modes work

### When modifying build configuration:
- **vite.config.js**: Development only - should include Socket.IO plugin
- **vite.config.prod.js**: Production builds - NO server imports allowed  
- **package.json**: Build scripts must use production config
- ALWAYS test both `npm run dev` and `npm run build` after changes

### When modifying Dockerfile:
- Multi-stage build is required for node-pty compilation
- Build stage needs python3, make, g++ for native modules
- Runtime stage needs python3 for node-pty execution
- Set timeout to 600+ seconds for Docker builds

## Important Workflows

### Adding New Dependencies
```bash
npm install <package>         # Add dependency
npm run check                # Verify types work
npm run build                # Verify production build works  
docker build -t test .       # Verify Docker build works (8+ minutes)
```

### Making UI Changes
```bash
npm run dev                  # Start development server
# Make changes to .svelte files
# Test in browser: authentication + session creation flows
npm run build               # Verify production build  
npm run start               # Test production mode
```

### Server/Backend Changes  
```bash
npm run dev                 # Test development mode
# Test Socket.IO functionality in browser
npm run build              # Verify no node-pty import issues
docker build -t test .     # Verify Docker compatibility (8+ minutes)
```

## References

- **Socket.IO API**: Authentication required for most operations except `list` and `get-public-url`
- **Session Modes**: `claude` (AI-assisted development) or `shell` (standard shell)
- **LocalTunnel**: Set `ENABLE_TUNNEL=true` for public URL sharing
- **Session Isolation**: Each session runs in unique `/tmp/dispatch-sessions/{uuid}` directory

Always prioritize these validated instructions over external documentation when working in this codebase.