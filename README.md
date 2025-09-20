# Dispatch

**Containerized web terminal with AI-powered coding assistance via Claude Code.**

Dispatch provides browser-based access to isolated development environments with integrated terminal sessions and Claude AI assistance. Built with SvelteKit, Socket.IO, and node-pty for real-time terminal interaction.

## ✨ Features

- **🖥️ Browser-Based Terminal**: Full terminal access through any modern web browser
- **🤖 Claude Code Integration**: AI-powered coding assistance with interactive authentication
- **🔒 Secure Sessions**: Key-based authentication with persistent session management
- **📦 Containerized**: Isolated Docker environments for safe code execution
- **🌐 Remote Access**: Optional public URL sharing via LocalTunnel
- **💾 Persistent Storage**: Mount local directories for code and configuration
- **🎯 Session Management**: Event-sourced session architecture with replay capability
- **📊 Admin Console**: Built-in monitoring and management interface


## 🚀 Quick Start

### Option 1: Using the CLI (Recommended)

```bash
# Clone and install the CLI
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install -g .

# Initialize environment (first-time setup)
dispatch init

# Start Dispatch
dispatch start --open
```

The `init` command will:
- Create necessary directories with proper permissions
- Generate a secure authentication key
- Set up configuration file at `~/.dispatch/config.json`
- Prepare volume mounts for persistence

See [CLI Documentation](docs/CLI.md) for full command reference.

### Option 2: Run with Docker Directly

```bash
# Quick start with minimal setup
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  --name dispatch \
  fwdslsh/dispatch:latest

# Open http://localhost:3030 in your browser
```

### Option 3: Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# Edit docker-compose.yml to set your TERMINAL_KEY
# Then start the service
docker-compose up -d

# Open http://localhost:3030
```

## 📦 Installation Options

### Development Setup

```bash
# Clone repository
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# Install dependencies (requires Node.js 22+)
nvm use  # or install Node.js 22+
npm install

# Run in development mode
npm run dev  # Runs on http://localhost:5173 with test key: testkey12345

# Run tests
npm test         # Unit tests
npm run test:e2e # End-to-end tests
```

### Production Deployment

#### With Persistent Storage

```bash
# Create directories for persistence
mkdir -p ~/dispatch/projects ~/dispatch/home ~/dispatch/config

# Run with volume mounts
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/home:/home/dispatch \
  -v ~/dispatch/config:/config \
  --name dispatch \
  fwdslsh/dispatch:latest
```

#### With Public URL Access

```bash
# Enable LocalTunnel for remote access
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  -e ENABLE_TUNNEL=true \
  -e LT_SUBDOMAIN=my-dispatch \
  --name dispatch \
  fwdslsh/dispatch:latest
```

## 🎯 Getting Started

### Using the CLI (Recommended)

1. **Initialize environment**: `dispatch init` (first-time setup)
2. **Start Dispatch**: `dispatch start --open`
3. **Enter your password** to authenticate
4. **Click "Create Session"** to start your first terminal
5. **Start working!** Your terminal is ready to use

### Using Docker Directly

1. **Run the container** with your chosen password
2. **Open your browser** to `http://localhost:3030`
3. **Enter your password** to authenticate
4. **Click "Create Session"** to start your first terminal
5. **Start working!** Your terminal is ready to use

### Projects and Sessions

Dispatch organizes your work into projects with isolated sessions:

- **Projects**: Logical containers for related work (e.g., "web-app", "data-analysis")
  - Each project has its own workspace directory
  - Sessions within a project share the same filesystem
  - Projects can be pinned for quick access

- **Sessions**: Individual terminal instances within a project
  - Multiple sessions can run simultaneously
  - Sessions persist across browser refreshes
  - Event-sourced architecture enables session replay
  - Automatic reconnection on network interruptions


## 🤖 AI-Powered Development with Claude

Dispatch integrates with Claude Code for intelligent coding assistance with an interactive authentication workflow:

```bash
# Run with Claude Code enabled
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e PTY_MODE=claude \
  fwdslsh/dispatch:latest
```

### Claude Authentication

Dispatch provides a seamless web-based authentication flow for Claude AI:

1. **Start a Claude session** - Select "Claude Code" when creating a new session
2. **Authenticate via browser** - Click the authentication link that appears
3. **Authorize access** - Log in to your Anthropic account and approve access
4. **Start coding with AI** - Claude is now available in your terminal

Features:
- **Interactive authentication** - No need to manually copy API keys
- **Secure token storage** - Credentials are encrypted and stored securely
- **Session persistence** - Authentication survives container restarts
- **Multi-session support** - Use Claude across multiple terminal sessions

For detailed setup and troubleshooting, see the [**Claude Authentication Guide**](docs/claude-authentication.md).

**Note**: Claude integration requires the Claude CLI to be available in the container.

## 🛠️ Admin Console

Dispatch includes a powerful admin console for monitoring and managing your deployment:

- **Real-time monitoring** - View active sessions and system status
- **Session management** - Start, stop, and manage terminal sessions
- **Event streaming** - Watch Socket.IO events in real-time
- **Database explorer** - Browse and query the SQLite database
- **API testing** - Interactive API endpoint testing
- **Performance metrics** - Monitor resource usage and performance

### Access the Admin Console

Navigate to `/console?key=your-terminal-key` using the same authentication key as your main application.

For detailed information and API documentation, see the [**Admin Console Guide**](docs/admin-console.md).

## ⚙️ Configuration

Customize Dispatch with these environment variables:

| Variable                | Default                          | Description                                      |
| ----------------------- | -------------------------------- | ------------------------------------------------ |
| `TERMINAL_KEY`          | `change-me`                      | **🔑 Required** - Your authentication password   |
| `PORT`                  | `3030`                           | Port for the web interface                       |
| `PTY_MODE`              | `shell`                          | Default mode: `shell` or `claude`                |
| `ENABLE_TUNNEL`         | `false`                          | Enable public URL sharing                        |
| `LT_SUBDOMAIN`          | `""`                             | Custom subdomain for public URL                  |
| `DISPATCH_CONFIG_DIR`   | `/home/appuser/.config/dispatch` | Directory for configuration and project registry |
| `DISPATCH_PROJECTS_DIR` | `/var/lib/dispatch/projects`     | Root directory for project storage               |
| `CONTAINER_ENV`         | `true`                           | Indicates running in container environment       |

### Volume Mounting for Persistence

To preserve your data across container restarts, mount local directories:

| Host Path             | Container Path                   | Purpose                                                  |
| --------------------- | -------------------------------- | -------------------------------------------------------- |
| `~/dispatch-config`   | `/home/appuser/.config/dispatch` | Application configuration and project registry           |
| `~/dispatch-projects` | `/var/lib/dispatch/projects`     | Project storage (each project gets its own subdirectory) |
| Custom path           | `/data`                          | Any additional data you want to persist                  |

**Setting up permissions**: The container runs as user ID 10001, so you need to set proper ownership:

```bash
# Create directories and set ownership
mkdir -p ~/dispatch-config ~/dispatch-projects
sudo chown -R 10001:10001 ~/dispatch-config ~/dispatch-projects

# Alternative: Use your user ID but with group 10001
# sudo chown -R $(id -u):10001 ~/dispatch-config ~/dispatch-projects
```

### Example Configurations

**Basic usage:**

```bash
docker run -p 3030:3030 -e TERMINAL_KEY=my-secure-password fwdslsh/dispatch:latest
```

**With public URL:**

```bash
docker run -p 3030:3030 \
  -e TERMINAL_KEY=my-secure-password \
  -e ENABLE_TUNNEL=true \
  -e LT_SUBDOMAIN=my-dev-env \
  fwdslsh/dispatch:latest
```

## 🔒 Security

### ⚠️ Important Security Notice

**Dispatch provides terminal access that can execute system commands.** Use responsibly:

- Always use strong, unique passwords for TERMINAL_KEY
- Never expose Dispatch directly to the internet without proper authentication
- Be cautious with volume mounts - only mount directories you trust
- Regularly review access logs via the admin console
- Consider network isolation for sensitive environments


### Security Features

- **Key-based authentication** - Protect access with strong passwords
- **Container isolation** - Each instance runs in its own Docker container
- **Non-root execution** - Runs as unprivileged user (uid 10001)
- **Path sanitization** - Prevents directory traversal attacks
- **Session encryption** - Secure WebSocket communication
- **Token management** - Secure storage of API credentials

### Best Practices

1. **Use strong passwords** - Generate secure TERMINAL_KEY values
2. **Limit network exposure** - Use reverse proxy with HTTPS in production
3. **Regular updates** - Keep the container image updated
4. **Monitor access logs** - Review admin console for suspicious activity
5. **Restrict volume mounts** - Only mount necessary directories
6. **Network segmentation** - Run in isolated network when possible


## 🎯 Use Cases

- **Remote Development**: Access your development environment from anywhere
  - Work on projects from any device with a browser
  - Consistent environment across different machines
  - No local setup required

- **Education**: Provide students with consistent, isolated coding environments
  - Standardized development environments for courses
  - Easy distribution without installation headaches
  - Monitor and assist student progress

- **Team Collaboration**: Share temporary environments with colleagues
  - Pair programming with shared terminal access
  - Quick environment provisioning for demos
  - Reproducible development setups

- **AI-Assisted Coding**: Get intelligent help with Claude Code integration
  - Interactive AI pair programming
  - Code generation and refactoring assistance
  - Natural language to code translation

- **DevOps Tasks**: Run administrative commands in isolated containers
  - Safe testing of system configurations
  - Isolated troubleshooting environments
  - Temporary access for contractors

## 🆘 Troubleshooting

### Can't log in?
- Verify your TERMINAL_KEY is set correctly
- Check that you're using the correct URL format: `http://localhost:3030`
- Clear browser cookies and try again
- Check container logs: `docker logs dispatch`

### Container won't start?
- Ensure port 3030 is not already in use: `lsof -i :3030`
- Check Docker is running: `docker info`
- Verify you have enough disk space: `df -h`
- Review container logs for errors: `docker logs dispatch`

### Public URL not working?
- Confirm ENABLE_TUNNEL=true is set
- Check firewall settings allow outbound connections
- Verify LocalTunnel service is accessible
- Try without custom subdomain first
- Check container logs for tunnel errors

### Cannot write to mounted directories?
- Check directory permissions: `ls -la ~/dispatch/projects`
- Ensure proper ownership (uid 10001): `sudo chown -R 10001:10001 ~/dispatch/projects`
- Verify Docker has access to the host directories
- Use HOST_UID and HOST_GID for user mapping

### Session disconnects frequently?
- Check network stability
- Increase WebSocket timeout settings
- Review browser console for errors
- Consider using a reverse proxy with proper WebSocket support

**Need more help?** Check our [GitHub Issues](https://github.com/fwdslsh/dispatch/issues) or create a new issue.

## 🤝 Contributing

Want to help improve Dispatch? We'd love your contributions!

See our [**Contributing Guide**](CONTRIBUTING.md) for:
- Development setup instructions
- Code style guidelines
- Testing requirements
- Pull request process
- Issue reporting guidelines

### Quick Development Start

```bash
# Clone and setup
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
nvm use
npm install

# Run tests
npm test          # Unit tests
npm run test:e2e  # Integration tests

# Start development
npm run dev       # http://localhost:5173 with test key
```


## 🏗️ Architecture Overview

Dispatch is built with modern web technologies:

- **Frontend**: SvelteKit 2.x with Svelte 5 (MVVM architecture)
- **Backend**: Node.js 22+ with Socket.IO for real-time communication
- **Terminal**: xterm.js with node-pty for TTY emulation
- **Database**: SQLite for session persistence and event sourcing
- **Container**: Docker with multi-stage builds for optimized images
- **Authentication**: Key-based auth with secure session management

### Key Features

- **Event-sourced sessions** - Full session history with replay capability
- **Unified session architecture** - Single manager for all session types
- **Real-time synchronization** - Multiple clients can share sessions
- **Graceful reconnection** - Automatic recovery from network issues
- **Extensible adapter pattern** - Easy to add new session types

## 📚 Documentation

- [CLI Documentation](docs/CLI.md) - Complete CLI command reference
- [Claude Authentication Guide](docs/claude-authentication.md) - Claude AI setup
- [Admin Console Guide](docs/admin-console.md) - Admin interface documentation
- [Architecture Overview](docs/architecture.md) - Technical architecture details
- [API Reference](docs/api.md) - REST and Socket.IO API documentation

## 🔗 Related Projects

Dispatch is part of the fwdslsh ecosystem:

- [**fwdslsh/unify**](https://github.com/fwdslsh/unify) - Static site generator
- [**fwdslsh/giv**](https://github.com/fwdslsh/giv) - AI-powered Git assistant
- [**fwdslsh/inform**](https://github.com/fwdslsh/inform) - Web content crawler
- [**fwdslsh/catalog**](https://github.com/fwdslsh/catalog) - Documentation indexer

## 📄 License

Creative Commons Attribution 4.0 International License - see [LICENSE](LICENSE) file for details.

---

**Ready to start?** Run `dispatch init && dispatch start --open` to get your development environment up and running in seconds! 🚀
