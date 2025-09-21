# Dispatch

**A web-based terminal that runs anywhere - develop, collaborate, and code with AI assistance right in your browser.**

Dispatch gives you instant access to a full Linux terminal through any web browser. Whether you're working from a Chromebook, tablet, or shared computer, you get a complete development environment with optional Claude AI coding assistance. Perfect for remote work, education, and team collaboration.

## ✨ Features

- **🖥️ Access Anywhere**: Full terminal in any web browser - no local setup required
- **🤖 AI Coding Assistant**: Built-in Claude AI integration for intelligent code help
- **🔒 Secure & Isolated**: Each session runs in its own secure Docker container
- **💾 Keep Your Work**: Automatic session persistence and project organization
- **🌐 Share Instantly**: Optional public URLs for remote access and collaboration
- **⚡ Start Fast**: One-command setup gets you coding in seconds
- **👥 Team Ready**: Perfect for education, pair programming, and remote teams
- **🛠️ Full Control**: Complete admin console for monitoring and management

## 🚀 Quick Start

The fastest way to get started is with our CLI tool:

```bash
# Install the CLI
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install -g .

# Set up everything automatically
dispatch init

# Start coding!
dispatch start --open
```

That's it! Your browser will open with a secure terminal ready to use.

### Alternative: Docker Only

If you prefer to use Docker directly:

```bash
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  --name dispatch \
  fwdslsh/dispatch:latest

# Open http://localhost:3030 in your browser
```

## 🤖 Using Dispatch Locally as AI Agent Sandbox

Dispatch is perfect for creating isolated AI agent environments with shared workspace access. This setup provides a secure sandbox where AI agents can work with files while protecting your host system.

### Prerequisites

- **Docker** installed and running
- **Node.js 22+** (for CLI installation)
- At least **2GB free disk space** for container and workspace

### Quick Sandbox Setup

The fastest way to set up an AI agent sandbox:

```bash
# Install the Dispatch CLI
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install -g .

# Initialize sandbox environment
dispatch init

# Start sandbox with shared workspace
dispatch start --open
```

### Directory Structure & Mounting Strategy

Dispatch creates an isolated environment while allowing controlled file sharing:

```
~/dispatch/                          # Protected sandbox root
├── home/                           # Isolated home directory
│   ├── .bashrc                     # Copied from your ~/.bashrc
│   ├── .gitconfig                  # Copied from your ~/.gitconfig
│   ├── .ssh/ -> ~/.ssh             # Read-only SSH keys
│   └── .claude/                    # Claude CLI configuration
├── projects/                       # Shared workspace directory
│   ├── project-a/                  # Individual project isolation
│   │   ├── workspace/              # Persistent project files
│   │   ├── sessions/               # Temporary session data
│   │   └── .dispatch/              # Project metadata
│   └── project-b/
└── config/                         # Dispatch configuration
```

### Manual Setup for Advanced Configuration

For more control over your sandbox environment:

```bash
# Create sandbox directory structure
mkdir -p ~/dispatch/{home,projects,config}

# Copy essential configurations (optional)
cp ~/.bashrc ~/.gitconfig ~/dispatch/home/ 2>/dev/null || true
cp -r ~/.claude ~/dispatch/home/ 2>/dev/null || true

# Start with explicit mounts
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=sandbox-key-$(date +%s) \
  -e PROJECT_SANDBOX_ENABLED=true \
  -v ~/dispatch/home:/home/appuser \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/config:/config \
  -v ~/.ssh:/home/appuser/.ssh:ro \
  --name dispatch-sandbox \
  fwdslsh/dispatch:latest
```

### Workspace Sharing Patterns

#### Pattern 1: Shared Development Workspace

```bash
# Mount a specific project directory for AI collaboration
dispatch start \
  --projects ~/my-ai-projects \
  --home ~/dispatch/home \
  --ssh ~/.ssh

# AI agents can access files in ~/my-ai-projects
# Host system remains protected in ~/dispatch/home
```

#### Pattern 2: Temporary Sandbox

```bash
# Create temporary workspace for experimentation
mkdir -p /tmp/ai-sandbox
dispatch start \
  --projects /tmp/ai-sandbox \
  --home ~/dispatch/home

# Perfect for testing AI-generated code safely
```

#### Pattern 3: Protected Production Setup

```bash
# Production setup with read-only host access
dispatch start \
  --projects ~/dispatch/projects \
  --home ~/dispatch/home \
  --config ~/.config:ro \
  --ssh ~/.ssh:ro

# AI agents work in isolation, critical configs are protected
```

### Sample AI Agent Workflows

#### Code Review & Analysis

```bash
# Start sandbox for code analysis
dispatch start --projects ~/code-review --open

# In the web terminal:
# 1. Clone repository: git clone <repo-url>
# 2. Create Claude session for code review
# 3. AI analyzes code safely in isolated environment
# 4. Results saved to ~/code-review on host
```

#### Data Processing Pipeline

```bash
# Set up data processing sandbox
mkdir -p ~/ai-data/{input,output,temp}
dispatch start --projects ~/ai-data --open

# Mount data directories:
# - input/: Raw data files (read-only)
# - output/: Processed results
# - temp/: Temporary processing files
```

#### Collaborative Development

```bash
# Enable public access for team collaboration
dispatch start \
  --projects ~/team-project \
  --tunnel --subdomain team-ai-workspace \
  --open

# Share the tunnel URL with team members
# Multiple people can collaborate with AI in the same environment
```

### Environment Variables for AI Sandbox

| Variable                  | Value           | Purpose                  |
| ------------------------- | --------------- | ------------------------ |
| `PROJECT_SANDBOX_ENABLED` | `true`          | Enable project isolation |
| `HOST_HOME_DIR`           | `/home/appuser` | Isolated home directory  |
| `DISPATCH_PROJECTS_DIR`   | `/workspace`    | Shared workspace path    |
| `CLAUDE_PROJECTS_DIR`     | `/workspace`    | Claude AI workspace      |

### Security & Isolation Features

- **Container Isolation**: Each session runs in its own secure Docker container
- **Filesystem Sandboxing**: AI agents can only access mounted directories
- **User Mapping**: Files created maintain proper ownership on host system
- **Read-only Mounts**: Sensitive configs (SSH keys) mounted read-only
- **Network Isolation**: Container network separated from host
- **Resource Limits**: Container resources can be limited via Docker

### Monitoring & Management

Access the admin console to monitor AI agent activity:

```bash
# Open admin console
open http://localhost:3030/console?key=your-terminal-key

# View active sessions, resource usage, and logs
# Perfect for monitoring AI agent behavior
```

### Troubleshooting Sandbox Issues

**AI Agent Can't Access Files:**

```bash
# Check mount permissions
ls -la ~/dispatch/projects
docker exec dispatch-sandbox ls -la /workspace
```

**Container Won't Start:**

```bash
# Check Docker status and logs
docker ps -a
docker logs dispatch-sandbox
```

**Permission Errors:**

```bash
# Fix ownership issues
sudo chown -R $(id -u):$(id -g) ~/dispatch/
```

## 📦 More Installation Options

### For Developers

Want to modify Dispatch or contribute? Set up a development environment:

```bash
# Clone and set up for development
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install  # Requires Node.js 22+

# Run in development mode
npm run dev  # Opens http://localhost:5173

# Run tests
npm test
```

### Docker Compose Setup

For production deployments with persistent storage:

```bash
# Clone the repository
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# Edit docker-compose.yml to set your TERMINAL_KEY
docker-compose up -d
```

### Advanced Docker Setup

For custom configurations with persistent storage:

```bash
# Create directories for your projects
mkdir -p ~/dispatch/projects ~/dispatch/config

# Run with custom settings
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  -e ENABLE_TUNNEL=true \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/config:/config \
  --name dispatch \
  fwdslsh/dispatch:latest
```

## 🎯 Getting Started

### First Time Setup

1. **Start Dispatch** using one of the methods above
2. **Open your browser** to `http://localhost:3030`
3. **Enter your password** (the `TERMINAL_KEY` you set)
4. **Click "Create Session"** to start your first terminal
5. **Start working!** You now have a full Linux terminal in your browser

### Working with Projects

Dispatch organizes your work into projects for better organization:

- **Create a project**: Give your work a name (like "my-website" or "data-analysis")
- **Multiple sessions**: Open different types of sessions within the same project:
  - **Terminal Sessions**: Full Linux shell access via xterm.js
  - **Claude Sessions**: AI-powered coding assistance
  - **File Editor Sessions**: Built-in code editor for quick edits
- **Persistent sessions**: Your work is automatically saved - just refresh to reconnect
- **Shared workspace**: All sessions in a project share the same files and directories

### Tips for New Users

- **Files persist**: Everything you create is automatically saved
- **Multiple tabs**: Open multiple terminal sessions in different browser tabs
- **Copy/paste**: Use standard browser shortcuts (Ctrl+C, Ctrl+V)
- **Share your screen**: Enable public URLs to share your terminal with others
- **Get help**: Type common commands like `ls`, `cd`, `mkdir` to navigate

## 🤖 AI-Powered Coding with Claude

Get intelligent coding assistance right in your terminal with Claude AI integration:

```bash
# Enable Claude AI when starting
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-password \
  fwdslsh/dispatch:latest
```

### How It Works

1. **Create a Claude session** - Choose "Claude Code" when starting a new session
2. **One-click authentication** - Click the login link that appears
3. **Log in securely** - Use your Anthropic account (opens in new tab)
4. **Start coding with AI** - Claude is now available to help with your code

### What You Can Do

- **Get code suggestions**: Ask Claude to help write functions or fix bugs
- **Explain code**: Have Claude explain complex code in plain English
- **Refactor code**: Get help improving and cleaning up your code
- **Debug issues**: Claude can help identify and fix problems
- **Learn new concepts**: Ask questions about programming concepts

**Note**: You'll need a Claude account from Anthropic to use Claude sessions. Authentication is handled via OAuth flow - simply click the login link that appears when creating a Claude session.

## 🛠️ Admin Console

Monitor and manage your Dispatch instance with the built-in admin console:

### What You Can Do

- **Monitor active sessions**: See who's connected and what they're doing
- **View system status**: Check resource usage and performance
- **Manage sessions**: Start, stop, or restart terminal sessions
- **Browse logs**: Review system logs and debug issues
- **Test APIs**: Interactive testing of system endpoints

### Access the Console

Just add `/console` to your Dispatch URL and use the same password:

```
http://localhost:3030/console?key=your-terminal-key
```

Perfect for administrators, troubleshooting, and understanding how your Dispatch instance is performing.

## ⚙️ Configuration

Customize Dispatch behavior with these settings:

| Setting           | Default Value | What It Does                                  |
| ----------------- | ------------- | --------------------------------------------- |
| `TERMINAL_KEY`    | `change-me`   | **🔑 Required** - Password to access Dispatch |
| `PORT`            | `3030`        | Which port the web interface uses             |
| `WORKSPACES_ROOT` | `/workspace`  | Default directory for workspaces              |
| `ENABLE_TUNNEL`   | `false`       | Create public URLs for sharing                |
| `LT_SUBDOMAIN`    | `""`          | Custom name for your public URL               |
| `HOST_UID`        | -             | Container user ID mapping (optional)          |
| `HOST_GID`        | -             | Container group ID mapping (optional)         |

### Keeping Your Data

To make sure your files and projects survive container restarts, mount local directories:

```bash
# Create directories first
mkdir -p ~/dispatch-config ~/dispatch-projects

# Set proper permissions
sudo chown -R 10001:10001 ~/dispatch-config ~/dispatch-projects

# Run with persistent storage
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=my-secure-password \
  -v ~/dispatch-config:/home/appuser/.config/dispatch \
  -v ~/dispatch-projects:/var/lib/dispatch/projects \
  fwdslsh/dispatch:latest
```

### Example Setups

**Basic setup (no data persistence):**

```bash
docker run -p 3030:3030 -e TERMINAL_KEY=my-password fwdslsh/dispatch:latest
```

**With public URL sharing:**

```bash
docker run -p 3030:3030 \
  -e TERMINAL_KEY=my-password \
  -e ENABLE_TUNNEL=true \
  -e LT_SUBDOMAIN=my-dev-space \
  fwdslsh/dispatch:latest
```

## 🔒 Security

### Important Security Information

**Dispatch gives you full terminal access that can run any system command.** Please use it responsibly:

- **Use strong passwords** - Always set a secure `TERMINAL_KEY`
- **Don't expose publicly** - Never put Dispatch directly on the internet without proper security
- **Be careful with file access** - Only mount directories you trust
- **Monitor usage** - Check the admin console regularly for unexpected activity

### Built-in Security Features

- **Password protection** - All access requires your secret key
- **Container isolation** - Each session runs in its own secure Docker container
- **No root access** - Runs as a regular user (not administrator) for safety
- **Secure connections** - All communication is encrypted
- **Safe credential storage** - API keys and tokens are stored securely

### Best Practices

1. **Generate strong passwords** - Use random characters for your `TERMINAL_KEY`
2. **Use HTTPS in production** - Put a reverse proxy in front for secure connections
3. **Keep updated** - Regularly update to the latest Docker image
4. **Monitor access** - Review the admin console for any suspicious activity
5. **Limit file access** - Only mount the directories you actually need
6. **Use private networks** - Run on isolated networks when possible

## 🎯 Perfect For

### Remote Work & Development

Access your development environment from anywhere - work from home, coffee shops, or while traveling. No need to sync files or set up local environments on every device.

### Education & Training

Provide students with identical, ready-to-use coding environments. No installation headaches, no "it works on my machine" problems. Perfect for coding bootcamps and computer science courses.

### Team Collaboration

Share live terminals with colleagues for pair programming, troubleshooting, or demonstrations. Get everyone on the same page instantly.

### AI-Assisted Coding

Integrate Claude AI directly into your coding workflow. Get intelligent suggestions, code explanations, and debugging help right in your terminal.

### Quick Prototyping

Spin up isolated environments for testing ideas, trying new technologies, or running potentially risky commands safely.

### Contractor & Client Work

Provide temporary, secure access to development environments without setting up full user accounts or VPNs.

## 🆘 Need Help?

### Common Issues

**Can't log in?**

- Check that you're using the correct password (your `TERMINAL_KEY`)
- Make sure you're going to the right URL: `http://localhost:3030`
- Try clearing your browser cookies and refresh the page
- Check the container logs: `docker logs dispatch`

**Container won't start?**

- Make sure port 3030 isn't already being used: `lsof -i :3030`
- Check that Docker is running: `docker --version`
- Ensure you have enough disk space: `df -h`
- Look at the error logs: `docker logs dispatch`

**Public URL not working?**

- Confirm you set `ENABLE_TUNNEL=true`
- Check that your firewall allows outbound connections
- Try without a custom subdomain first (remove `LT_SUBDOMAIN`)
- Look at container logs for tunnel errors: `docker logs dispatch`

**Can't save files?**

- Check directory permissions if using volume mounts
- Make sure the mounted directories exist on your host
- Verify ownership: `sudo chown -R 10001:10001 ~/dispatch-projects`

**Session keeps disconnecting?**

- Check your internet connection stability
- Try using a wired connection instead of WiFi
- Look for browser console errors (F12 → Console tab)

### Get More Help

- Check our [GitHub Issues](https://github.com/fwdslsh/dispatch/issues) for known problems
- Create a new issue if you can't find a solution
- Include your Docker logs and browser console errors when reporting issues

## 🤝 Contributing

Want to help make Dispatch better? We welcome contributions!

**Quick Development Setup:**

```bash
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install
npm run dev  # Opens http://localhost:5173
```

See our [Contributing Guide](CONTRIBUTING.md) for:

- Development setup details
- Code style guidelines
- How to run tests
- Pull request process
- Bug reporting guidelines

We appreciate bug reports, feature requests, documentation improvements, and code contributions!

## 🏗️ How It Works

Dispatch is built with modern, reliable technologies:

- **Frontend**: Web interface built with SvelteKit and JavaScript
- **Backend**: Node.js server with real-time communication via Socket.IO
- **Terminal**: Full Linux terminal powered by xterm.js and node-pty
- **Storage**: SQLite database for sessions and project data
- **Container**: Docker for security and isolation
- **AI Integration**: Claude Code SDK for AI-powered coding assistance

### Key Technical Features

- **Persistent sessions** - Your terminal sessions survive browser refreshes and reconnections
- **Real-time sync** - Multiple people can share the same terminal session
- **Automatic recovery** - Seamless reconnection when your network hiccups
- **Event replay** - Full session history for debugging and learning
- **Extensible design** - Easy to add new session types and features

For technical details, see [CLAUDE.md](CLAUDE.md).

## 📚 Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to the project
- [Docker README](docker/README.md) - Docker setup and configuration details

## 🔗 Related Projects

Dispatch is part of the fwdslsh toolkit:

- [**fwdslsh/unify**](https://github.com/fwdslsh/unify) - Static site generator
- [**fwdslsh/giv**](https://github.com/fwdslsh/giv) - AI-powered Git assistant
- [**fwdslsh/inform**](https://github.com/fwdslsh/inform) - Web content crawler
- [**fwdslsh/catalog**](https://github.com/fwdslsh/catalog) - Documentation indexer

## 📄 License

Creative Commons Attribution 4.0 International License - see [LICENSE](LICENSE) file for details.

---

**Ready to start?** Run `dispatch init && dispatch start --open` and you'll be coding in your browser in seconds! 🚀
