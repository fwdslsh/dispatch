# Dispatch

**Web-based terminal access with AI assistance - accessible from anywhere with just a browser.**

Dispatch provides secure, containerized terminal sessions through your web browser. Perfect for remote development, education, and AI-assisted coding with Claude integration.

## ✨ What You Get

- 🌐 **Access anywhere**: Full terminal in your browser - no SSH or VPN needed
- 🔐 **Secure**: Password-protected with isolated sessions  
- 🤖 **AI-powered**: Optional Claude Code integration for intelligent assistance
- 🚀 **Zero setup**: One Docker command gets you running
- 📱 **Share easily**: Optional public URLs for collaboration
- 🔒 **Isolated**: Each session runs in its own secure environment

## 🚀 Quick Start

### Run with Docker (Recommended)

```bash
# Start Dispatch with your password
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password fwdslsh/dispatch:latest

# Open http://localhost:3030 in your browser
# Enter your password and click "Create Session"
```

**That's it!** You now have a secure web terminal running.

### With Public URL Sharing

Perfect for remote access or sharing with team members:

```bash
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e ENABLE_TUNNEL=true \
  fwdslsh/dispatch:latest
```

The container will display a public URL you can access from anywhere.

### With Persistent Storage

Mount local directories to preserve your work across container restarts:

```bash
# First, create and set up the directories with proper permissions
mkdir -p ~/dispatch-home ~/dispatch-projects
sudo chown -R 10001:10001 ~/dispatch-home ~/dispatch-projects

# Then mount your home directory and workspace
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -v ~/dispatch-home:/home/appuser \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

This setup provides:

- **Persistent home directory**: Your shell history, configs, and dotfiles survive container restarts
- **Project workspace**: A dedicated folder for your code and projects
- **Data safety**: Your work is saved on your host machine, not lost when the container stops

**Important**: The container runs as user ID 10001, so mounted directories need proper ownership for write access.

### Combined: Persistent Storage + Public URL

For the complete setup with both persistence and remote access:

```bash
# Set up directories with proper permissions first
mkdir -p ~/dispatch-home ~/dispatch-projects
sudo chown -R 10001:10001 ~/dispatch-home ~/dispatch-projects

# Run with both features enabled
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e ENABLE_TUNNEL=true \
  -v ~/dispatch-home:/home/appuser \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

## 🎯 Getting Started

1. **Run the container** with your chosen password
2. **Open your browser** to `http://localhost:3030`
3. **Enter your password** to authenticate
4. **Click "Create Session"** to start your first terminal
5. **Start working!** Your terminal is ready to use

### Multiple Sessions

Create multiple isolated terminals for different projects:

- Each session has its own directory and environment
- Sessions persist until you explicitly end them
- Switch between sessions easily in the web interface

## 🤖 AI-Powered Development with Claude

Dispatch can integrate with Claude Code for intelligent assistance:

```bash
# Run with Claude Code enabled
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e PTY_MODE=claude \
  fwdslsh/dispatch:latest
```

**Note**: Claude integration requires the Claude CLI to be available in the container.

## ⚙️ Configuration

Customize Dispatch with these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TERMINAL_KEY` | `change-me` | **🔑 Required** - Your authentication password |
| `PORT` | `3030` | Port for the web interface |
| `PTY_MODE` | `shell` | Default mode: `shell` or `claude` |
| `ENABLE_TUNNEL` | `false` | Enable public URL sharing |
| `LT_SUBDOMAIN` | `""` | Custom subdomain for public URL |

### Volume Mounting for Persistence

To preserve your data across container restarts, mount local directories:

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `~/dispatch-home` | `/home/appuser` | User home directory (shell history, configs, dotfiles) |
| `~/dispatch-projects` | `/workspace` | Project workspace for your code |
| Custom path | `/data` | Any additional data you want to persist |

**Setting up permissions**: The container runs as user ID 10001, so you need to set proper ownership:

```bash
# Create directories and set ownership
mkdir -p ~/dispatch-home ~/dispatch-projects
sudo chown -R 10001:10001 ~/dispatch-home ~/dispatch-projects

# Alternative: Use your user ID but with group 10001
# sudo chown -R $(id -u):10001 ~/dispatch-home ~/dispatch-projects
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

- Always use strong passwords for `TERMINAL_KEY`
- **Public URL mode requires authentication** - your `TERMINAL_KEY` provides security even with public access
- Sessions run with container user permissions
- Consider network isolation for sensitive deployments
- Review code before running in production environments

### Security Features

- 🔐 Password authentication required for all access
- 👤 Non-root container execution  
- 📁 Isolated session directories
- 🗑️ Automatic cleanup when sessions end

### Best Practices

- Use unique, strong passwords (20+ characters recommended)
- **Use extra-strong passwords when enabling public URLs** - this is your only protection against unauthorized access
- Regularly rotate your `TERMINAL_KEY`
- Monitor active sessions
- Enable public URLs only when needed
- Use reverse proxy with SSL in production

## 🎯 Use Cases

**Remote Development**: Access your development environment from anywhere

**Education**: Provide students with consistent, isolated coding environments  

**Team Collaboration**: Share temporary environments with colleagues

**AI-Assisted Coding**: Get intelligent help with Claude Code integration

**DevOps Tasks**: Run administrative commands in isolated containers

## 🆘 Troubleshooting

**Can't log in?**

- Verify your `TERMINAL_KEY` matches what you're entering
- Check for special characters that might need escaping

**Container won't start?**

- Ensure Docker is running and port 3030 is available
- Check Docker permissions

**Public URL not working?**

- Verify `ENABLE_TUNNEL=true` is set
- Check internet connection and firewall settings

**Cannot write to mounted directories?**

- Ensure directories have proper ownership: `sudo chown -R 10001:10001 ~/dispatch-home ~/dispatch-projects`
- Check that directories exist before mounting: `mkdir -p ~/dispatch-home ~/dispatch-projects`
- Verify the mount paths are correct in your docker run command

**Need more help?** Check our [GitHub Issues](https://github.com/fwdslsh/dispatch/issues) or create a new issue.

## 🤝 Contributing

Want to help improve Dispatch? We'd love your contributions!

See our [**Contributing Guide**](CONTRIBUTING.md) for:

- Setting up the development environment
- Running tests and type checking
- Development workflow and guidelines
- Architecture and technical details

## 📄 License

Creative Commons Attribution 4.0 International License - see [LICENSE](LICENSE) file for details.

---

**Ready to start?** Run the Docker command above and open `http://localhost:3030` in your browser! 🚀
