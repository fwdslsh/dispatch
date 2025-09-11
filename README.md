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

### Option 1: Using the CLI (Recommended)

Install the Dispatch CLI for the easiest setup:

```bash
# Install globally
npm install -g fwdslsh/dispatch

# Initialize your Dispatch environment (recommended for first-time setup)
dispatch init

# Start with browser opening automatically
dispatch start --open
```

The `init` command will:

- Set up your directory structure (`~/dispatch/projects`, `~/dispatch/home`)
- Copy existing Claude and Dispatch configurations
- Configure volume mounts for persistent storage
- Make the CLI globally available
- Pull the latest Docker image
- **Handle Docker permissions automatically** (no host permission changes needed)

For manual setup, you can also generate configuration separately:

```bash
dispatch config  # Generate configuration file manually
```

**📋 For detailed Docker permissions setup, see [DOCKER_PERMISSIONS.md](DOCKER_PERMISSIONS.md)**

See [CLI Documentation](CLI.md) for full CLI usage.

### Option 2: Run with Docker (Direct)

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
# Create directories (no sudo needed!)
mkdir -p ~/dispatch/home ~/dispatch/projects

# Run with runtime user mapping (works with Docker Hub images)
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/home:/home/dispatch \
  fwdslsh/dispatch:latest
```

This setup provides:

- **Persistent configuration**: Home directory and shell history survive container restarts
- **Organized project storage**: Projects are saved in `~/dispatch/projects` on your host
- **Data safety**: Your work is saved on your host machine, not lost when the container stops
- **No sudo required**: Runtime user mapping ensures files are owned by your user
- **Works with Docker Hub**: No need to build locally - just pull and run

**Security isolation**: The container can only access the two mounted directories you specify.

### Combined: Persistent Storage + Public URL

For the complete setup with both persistence and remote access:

```bash
# Create directories (no sudo needed!)
mkdir -p ~/dispatch/home ~/dispatch/projects

# Run with both features enabled
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e ENABLE_TUNNEL=true \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/home:/home/dispatch \
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

**Projects**: Logical containers for related work (e.g., "web-app", "data-analysis")

- Each project has its own directory and storage space
- Projects can be created, listed, and managed through the web interface
- Projects persist across container restarts when using persistent storage

**Sessions**: Individual terminal instances within a project

- Each session runs in its own isolated environment
- Sessions inherit the project's working directory and context
- Multiple sessions can run simultaneously within the same project
- Sessions persist until you explicitly end them

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

- **Interactive Login**: Authenticate directly from the projects page
- **OAuth Integration**: Secure login through Anthropic's authentication system
- **Persistent Credentials**: Authentication persists across container restarts
- **Error Handling**: Clear error messages and retry options

For detailed setup and troubleshooting, see the [**Claude Authentication Guide**](docs/claude-authentication.md).

**Note**: Claude integration requires the Claude CLI to be available in the container.

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

- Ensure directories have proper ownership: `sudo chown -R 10001:10001 ~/dispatch-config ~/dispatch-projects`
- Check that directories exist before mounting: `mkdir -p ~/dispatch-config ~/dispatch-projects`
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
