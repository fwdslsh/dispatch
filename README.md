# Dispatch

**The AI Agent Sandbox: Develop, collaborate, and code with powerful AI assistance in a secure environment from any device.**

Dispatch transforms any machine into a safe, isolated workspace for AI agents and developers. Instantly spin up workspace accessible via the terminal or in your browser, complete with real-time collaboration, persistent sessions, and mobile friendly Claude integration. Whether you're developing locally on the host machine, or working remotely, Dispatch gives you a secure sandbox where you and your AI tools can work with files—without risking the agents accessing the host system.

> Instant YOLO mode from your phone!

## Features

- 🛠️ Supports any CLI coding agent tool: Use the built-in terminal for any CLI-based agent or tool
- 📱 Mobile-friendly Terminal: Includes a keyboard shortcut toolbar for efficient use on mobile devices
- 🤖 Custom Claude Code integration for mobile friendly usage
- 🌐 Access anywhere: Full terminal in any web browser—no local setup required
- 🔒 Secure & isolated: Sessions run in secure Docker containers with filesystem sandboxing
- 💾 Persistent sessions: Sessions survive browser refreshes and reconnections
- 🔄 Real-time sync: Multiple people can share the same workspace
- ♻️ Automatic recovery: Seamless reconnection after network hiccups
- 🧩 Extensible design: Easily add new session types and features
- 🚀 Share instantly: Optional public URLs for remote access and collaboration
- ⚡ Fast setup: One-command install and launch
- 🖥️ Admin console: Monitor and manage sessions in real time

## Prerequisites

- **Docker** installed and running
- At least **2GB free disk space** for container and workspace

## Quick Sandbox Setup

The fastest way to set up an AI agent sandbox:

```bash
# Clone and install the Dispatch CLI
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
./install.sh

# Initialize sandbox environment
dispatch init

# Start sandbox with shared workspace
dispatch start
```

Once dispatch starts, you can navigate to <http://localhost:3030> to access the web based workspace, or simply connection an interactive docker session to the `dispatch` container.

> See the [Advanced Configuration](./docs/advanced-configuration.md) document for information and examples

## 🏗️ How It Works

Dispatch is built with modern, reliable technologies:

- **Frontend**: Web interface built with SvelteKit and JavaScript
- **Backend**: Node.js server with real-time communication via Socket.IO
- **Terminal**: Full Linux terminal powered by xterm.js and node-pty
- **Storage**: SQLite database for sessions and project data
- **Container**: Docker for security and isolation
- **AI Integration**: Claude Code SDK for AI-powered coding assistance

### ⚙️ Configuration

Customize Dispatch behavior by settings these variables in the dispatch docker container environment:

| Setting           | Default Value | What It Does                                  |
| ----------------- | ------------- | --------------------------------------------- |
| `TERMINAL_KEY`    | `change-me`   | **🔑 Required** - Password to access Dispatch |
| `PORT`            | `3030`        | Which port the web interface uses             |
| `WORKSPACES_ROOT` | `/workspace`  | Default directory for workspaces              |
| `ENABLE_TUNNEL`   | `false`       | Create public URLs for sharing                |
| `LT_SUBDOMAIN`    | `""`          | Custom name for your public URL               |
| `HOST_UID`        | -             | Container user ID mapping (optional)          |
| `HOST_GID`        | -             | Container group ID mapping (optional)         |

### Directory Structure & Mounting Strategy

Dispatch creates an isolated environment while allowing controlled file sharing:

```
~/dispatch/                          # Protected sandbox root
├── home/                           # Isolated home directory
│   ├── .bashrc                     # Copied from your ~/.bashrc
│   ├── .gitconfig                  # Copied from your ~/.gitconfig
│   ├── .ssh/ -> ~/.ssh             # Read-only SSH keys
│   └── .claude/                    # Claude CLI configuration
├── workspace/                       # Shared workspace directory
    ├── project-a/                  # Individual project isolation
    └── project-b/
```

### Monitoring & Management

Access the admin console to monitor AI agent activity:

```bash
# Open admin console
open http://localhost:3030/console?key=your-terminal-key

# View active sessions, resource usage, and logs
# Perfect for monitoring AI agent behavior
```

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
