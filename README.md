# Dispatch

**Secure, sandboxed execution environment for Claude AI and CLI agents - run anywhere, resume everywhere.**

Dispatch provides developers with a secure, isolated environment for running Claude AI code assistance and other CLI agents safely. Whether you're prototyping with AI-generated code, running automated scripts, or collaborating with team members, Dispatch ensures your system stays protected while giving you full access to powerful development tools.

## 🛡️ Why Developers Choose Dispatch

### **Secure AI Agent Execution**

Run Claude AI and other agents in completely isolated Docker containers. No risk to your host system, no exposure of sensitive files - just safe, sandboxed execution that you can trust.

### **Resume Sessions Anywhere**

Start work on your laptop, continue on your desktop, finish on your tablet. Dispatch's event-sourced architecture lets you resume sessions across any device without requiring cloud hosting or file synchronization.

### **Unattended Operation**

Let AI agents work while you're away. Dispatch sessions run independently in the background, so you can start long-running tasks and check results later without keeping your main system tied up.

### **Local-First, Cloud-Optional**

Everything runs locally by default. Add cloud hosting only if you want it - no vendor lock-in, no mandatory subscriptions, no data leaving your control unless you choose otherwise.

### **100% Free and Open Source**

No usage limits, no premium tiers, no hidden costs. Use it however you want, modify it, contribute back to the community.

## 🚀 Quick Start

Get a secure development environment running in under 30 seconds:

```bash
# One command setup
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  --name dispatch \
  fwdslsh/dispatch:latest

# Open http://localhost:3030 in your browser
# Enter your password and start coding!
```

### For Developers

Set up a local development environment:

```bash
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install  # Requires Node.js 22+
npm run dev  # Opens http://localhost:5173
```

## 🔒 Security & Isolation Features

### **Container Isolation**

- Dispatch runes in its own Docker container
- No access to host filesystem unless explicitly mounted
- Non-root user execution for additional security

### **Secure AI Integration**

- Claude AI sessions authenticate via OAuth (your credentials never stored)
- Agent code execution isolated from your main system
- Full audit trail of all commands and outputs
- Ability to review and approve commands before execution

### **Network Security**

- Optional public URL sharing (disabled by default)
- Password-protected access to all sessions
- HTTPS support for production deployments

## 🔄 Session Management & Persistence

### **Event-Sourced Architecture**

Every session interaction is recorded and can be replayed:

- Resume sessions after browser crashes or network interruptions
- Full command history preserved across restarts
- Share session logs with team members for debugging
- Time-travel debugging through session history

### **Cross-Device Sync**

- Session state stored locally in SQLite
- Resume on any device with the same Dispatch instance
- No cloud dependency required for basic functionality
- Optional cloud backup for team scenarios

### **Multiple Session Types**

- **Terminal Sessions**: Full Linux shell access
- **Claude AI Sessions**: AI-powered coding assistance
- **File Editor Sessions**: Built-in code editor
- **Custom Adapters**: Extensible for other tools and agents

## 📊 Feature Comparison

| Feature                   | Dispatch           | CrewAI          | OpenDevin   | Superagent         |
| ------------------------- | ------------------ | --------------- | ----------- | ------------------ |
| **Pricing**               | Free & Open Source | Freemium        | Open Source | Paid Plans         |
| **Local Execution**       | ✅ Default         | ❌ Cloud Only   | ✅ Optional | ❌ Cloud Only      |
| **Container Isolation**   | ✅ Docker          | ❌ Process Only | ✅ Docker   | ❌ Cloud Sandboxes |
| **Session Resume**        | ✅ Cross-device    | ❌ No           | ⚠️ Limited  | ✅ Cloud Only      |
| **Claude AI Integration** | ✅ Native          | ❌ No           | ⚠️ Plugin   | ✅ API Only        |
| **Unattended Execution**  | ✅ Background      | ✅ Workflows    | ⚠️ Limited  | ✅ Cloud           |
| **No Cloud Dependency**   | ✅ Local-first     | ❌ Required     | ✅ Optional | ❌ Required        |
| **Web-based Access**      | ✅ Browser         | ✅ Dashboard    | ⚠️ Limited  | ✅ Dashboard       |
| **Team Collaboration**    | ✅ Shared Sessions | ✅ Workspaces   | ❌ No       | ✅ Paid            |
| **Custom Extensions**     | ✅ Adapter API     | ✅ Plugins      | ✅ Tools    | ⚠️ Limited         |

### Why Choose Dispatch?

- **Privacy First**: Your code and data stay on your infrastructure
- **Cost Effective**: No recurring fees or usage limits
- **Developer Control**: Full access to source code and customization
- **Security Focused**: Isolation by design, not as an afterthought
- **Simple Setup**: Works out of the box, no complex configuration

## 🛠️ Use Cases

### **AI-Assisted Development**

Perfect for developers experimenting with AI-generated code who want the safety of sandboxed execution:

```bash
# Ask Claude to create a new microservice
# Test it safely in isolation
# Deploy only after verification
```

### **Remote Development**

Access your development environment from anywhere:

```bash
# Start work at office
# Continue from home
# Finish on mobile device
# All sessions resume seamlessly
```

### **Team Collaboration**

Share live coding sessions with colleagues:

```bash
# Share a public URL for real-time collaboration
# Multiple developers can work in the same session
# Perfect for pair programming and code reviews
```

### **Prototype & Experiment**

Try new technologies safely:

```bash
# Test potentially risky commands
# Experiment with new frameworks
# Clean slate for each experiment
```

## ⚙️ Configuration & Deployment

### **Environment Variables**

| Variable          | Default      | Description                        |
| ----------------- | ------------ | ---------------------------------- |
| `TERMINAL_KEY`    | `change-me`  | **Required** - Password for access |
| `PORT`            | `3030`       | Web interface port                 |
| `WORKSPACES_ROOT` | `/workspace` | Default directory for projects     |
| `ENABLE_TUNNEL`   | `false`      | Enable public URL sharing          |
| `LT_SUBDOMAIN`    | `""`         | Custom subdomain for public URLs   |

### **Production Deployment**

```bash
# Docker Compose for production
version: '3.8'
services:
  dispatch:
    image: fwdslsh/dispatch:latest
    ports:
      - "3030:3030"
    environment:
      - TERMINAL_KEY=your-very-secure-password
      - ENABLE_TUNNEL=false
    volumes:
      - ./data:/var/lib/dispatch
      - ./config:/home/appuser/.config/dispatch
    restart: unless-stopped
```

### **Persistent Storage**

```bash
# Create data directories
mkdir -p ~/dispatch/{data,config}
sudo chown -R 10001:10001 ~/dispatch/

# Run with persistent storage
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=secure-password \
  -v ~/dispatch/data:/var/lib/dispatch \
  -v ~/dispatch/config:/home/appuser/.config/dispatch \
  --name dispatch \
  fwdslsh/dispatch:latest
```

## 🏗️ Architecture & Technical Details

### **Built With Modern Technologies**

- **Frontend**: SvelteKit 5 with real-time updates
- **Backend**: Node.js 22 with Socket.IO for WebSocket communication
- **Terminal**: xterm.js with node-pty for full Linux shell access
- **Database**: SQLite for event sourcing and session persistence
- **Containers**: Docker for security and isolation
- **AI Integration**: Official Claude Code SDK

## 🔧 Development & Contributing

### **Local Development**

```bash
# Setup development environment
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch
npm install

# Development modes
npm run dev                # Standard dev server
npm run dev:local         # Use local filesystem
npm run dev:no-key        # No authentication
npm run dev:tunnel        # Enable public URLs

# Testing
npm test                  # Unit tests
npm run test:e2e          # End-to-end tests
npm run lint              # Code quality checks
```

### **Contributing**

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup details
- Code style guidelines
- Testing procedures
- Pull request process

### **Documentation**

- [CONTRIBUTING.md](CONTRIBUTING.md) - Developer guide
- [CLAUDE.md](CLAUDE.md) - Technical implementation details
- [Docker README](docker/README.md) - Container configuration

## 🆘 Support & Community

### **Getting Help**

- 📖 [Documentation](https://github.com/fwdslsh/dispatch/tree/main/docs)
- 🐛 [GitHub Issues](https://github.com/fwdslsh/dispatch/issues)

### **Common Issues**

**Session won't start?**

- Check Docker is running: `docker --version`
- Verify port 3030 is available: `lsof -i :3030`
- Review container logs: `docker logs dispatch`

**Can't connect to Claude?**

- Ensure you have a valid Anthropic account
- Check internet connectivity for OAuth flow

**Data not persisting?**

- Check volume mount permissions
- Ensure data directories exist and are writable
- Verify container user ownership (uid 10001)

## 📄 License

**Creative Commons Attribution 4.0 International License**

You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material for any purpose

See [LICENSE](LICENSE) for full details.

---

**Ready to start secure AI development?**

```bash
docker run -d -p 3030:3030 -e TERMINAL_KEY=your-password fwdslsh/dispatch:latest
```

Open `http://localhost:3030` and start coding safely! 🚀
