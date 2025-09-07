# Dispatch CLI

A command-line interface for launching and managing Dispatch web terminal containers.

## Installation

### Global Installation (Recommended)

```bash
npm install -g .
```

After installation, you can use the `dispatch` command from anywhere.

### Local Installation

```bash
npm install
node bin/dispatch-cli.js --help
```

## Quick Start

1. **Generate configuration file:**

   ```bash
   dispatch config
   ```

2. **Start Dispatch:**

   ```bash
   dispatch start --open
   ```

3. **Check status:**

   ```bash
   dispatch status
   ```

4. **Stop container:**
   ```bash
   dispatch stop
   ```

## Commands

### `dispatch start [options]`

Start the Dispatch container with various options:

```bash
# Basic start
dispatch start

# Start with custom port and open browser
dispatch start --port 8080 --open

# Start with tunnel enabled
dispatch start --tunnel --subdomain my-dev

# Start with Claude mode
dispatch start --mode claude

# Start with custom directories
dispatch start --projects ~/my-projects --ssh ~/.ssh

# Start with email notification
dispatch start --notify-email user@example.com --smtp-host smtp.gmail.com --smtp-user user@gmail.com --smtp-pass app-password

# Start with webhook notification (great for Slack, Discord, etc.)
dispatch start --notify-webhook https://hooks.slack.com/services/your-webhook-url

# Start with both notifications
dispatch start --notify-email user@example.com --notify-webhook https://hooks.slack.com/webhook --tunnel

# Build image and start
dispatch start --build
```

#### Options:

- `-p, --port <port>` - Port for web interface (default: 3030)
- `-k, --key <key>` - Terminal authentication key
- `--tunnel` - Enable public URL tunnel
- `--subdomain <subdomain>` - Custom tunnel subdomain
- `--mode <mode>` - PTY mode (shell|claude, default: shell)
- `--build` - Build Docker image before running
- `--open` - Open browser after container starts
- `--projects <path>` - Projects directory to mount
- `--home <path>` - Home directory to mount
- `--ssh <path>` - SSH directory to mount (read-only)
- `--claude <path>` - Claude config directory to mount
- `--config <path>` - Additional config directory to mount
- `--notify-email <email>` - Send email notification with access link
- `--notify-webhook <url>` - Send webhook notification with access link
- `--smtp-host <host>` - SMTP server host for email notifications
- `--smtp-port <port>` - SMTP server port (default: 587)
- `--smtp-user <user>` - SMTP username for email notifications
- `--smtp-pass <password>` - SMTP password for email notifications

### `dispatch stop`

Stop the running Dispatch container.

### `dispatch status`

Check if the Dispatch container is currently running.

### `dispatch config`

Generate an example configuration file at `~/.dispatch/config.yaml`.

## Configuration

The CLI reads configuration from `~/.dispatch/config.yaml`. Generate an example file with:

```bash
dispatch config
```

### Configuration Options

```yaml
# Docker image to use
image: fwdslsh/dispatch:latest

# Port for web interface
port: 3030

# Terminal authentication key (leave null to auto-generate)
terminalKey: null

# Enable public URL tunnel
enableTunnel: false

# Custom tunnel subdomain (optional)
ltSubdomain: null

# PTY mode: 'shell' or 'claude'
ptyMode: shell

# Volume mounts
volumes:
  # Projects workspace directory
  projects: ~/dispatch/projects

  # User home directory (for dotfiles, shell history, etc.)
  home: ~/dispatch/home

  # SSH directory (mounted read-only, optional)
  ssh: ~/.ssh

  # Claude configuration directory (optional)
  claude: ~/.claude

  # Additional config directory (optional)
  config: ~/.config

# Build Docker image before running
build: false

# Open browser automatically after starting
openBrowser: false

# Notification settings
notifications:
  # Enable notifications when container starts
  enabled: false

  # Email notification settings
  email:
    # Email address to send notifications to
    to: null

    # SMTP server configuration
    smtp:
      host: smtp.gmail.com
      port: 587
      secure: false # true for 465, false for other ports
      user: your-email@gmail.com
      pass: your-app-password

  # Webhook notification settings (great for Slack, Discord, etc.)
  webhook:
    # Webhook URL to send POST request to
    url: null

    # Optional custom headers
    headers:
      Content-Type: application/json
      # Authorization: Bearer your-token
```

Command-line options override configuration file settings.

## Volume Mounting

The CLI automatically creates the following directory structure:

```
~/dispatch/
├── home/          # Container home directory (user files, dotfiles)
└── projects/      # Workspace for your projects
```

Additional directories can be mounted:

- **SSH Keys**: Mount `~/.ssh` for Git access (read-only)
- **Claude Config**: Mount `~/.claude` for Claude CLI configuration
- **Additional Config**: Mount `~/.config` or other config directories

## Examples

### Basic Development Setup

```bash
# Generate config
dispatch config

# Edit config to enable browser opening
vim ~/.dispatch/config.yaml

# Start with browser
dispatch start
```

### Team Collaboration

```bash
# Start with public tunnel
dispatch start --tunnel --subdomain team-project --open
```

### Claude AI Development

```bash
# Start in Claude mode with appropriate mounts
dispatch start --mode claude --claude ~/.claude --open
```

### Custom Project Directory

```bash
# Use different project directory
dispatch start --projects ~/my-special-project --home ~/dispatch-custom
```

### Notifications

#### Email Notifications

Get notified via email when your container starts:

```bash
# Quick email notification
dispatch start --notify-email your-email@gmail.com --smtp-host smtp.gmail.com --smtp-user your-email@gmail.com --smtp-pass your-app-password

# Using configuration file (recommended for security)
dispatch config
# Edit ~/.dispatch/config.yaml to add your email settings
dispatch start
```

**Gmail Setup:**

1. Enable 2FA on your Gmail account
2. Generate an app password: https://myaccount.google.com/apppasswords
3. Use your Gmail address as `smtp-user` and the app password as `smtp-pass`

#### Webhook Notifications

Perfect for team notifications via Slack, Discord, or other services:

```bash
# Slack webhook
dispatch start --notify-webhook https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX

# Discord webhook
dispatch start --notify-webhook https://discord.com/api/webhooks/123456789/abcdefghijk

# Custom webhook with tunnel URL
dispatch start --tunnel --notify-webhook https://your-webhook.com/notifications
```

**Slack Setup:**

1. Go to your Slack app settings
2. Create a new webhook integration
3. Copy the webhook URL and use it with `--notify-webhook`

**Webhook Payload:**
The webhook receives a JSON payload:

```json
{
	"message": "Dispatch Container Started",
	"url": "http://localhost:3030",
	"terminalKey": "your-terminal-key",
	"timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Troubleshooting

### Container Not Starting

1. Check if Docker is running:

   ```bash
   docker version
   ```

2. Check container status:

   ```bash
   dispatch status
   ```

3. View Docker logs:
   ```bash
   docker logs dispatch
   ```

### Permission Issues

The CLI automatically maps your user ID to the container. If you encounter permission issues:

1. Ensure the mounted directories exist and are writable
2. Check that Docker has permission to access the mounted paths

### Port Already in Use

If port 3030 is already in use:

```bash
# Use different port
dispatch start --port 8080
```

Or update your config file to use a different default port.
