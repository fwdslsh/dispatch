# Dispatch CLI

A native Bash command-line interface for launching and managing Dispatch web terminal containers.

## Installation

### Using the Installer (Recommended)

The easiest way to install the Dispatch CLI is using the provided installer:

```bash
# Clone the repository
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# Run the installer
./install.sh
```

The installer will automatically:

- Find a suitable installation directory (`~/bin`, `~/.local/bin`, or `/usr/local/bin`)
- Copy the script and make it executable
- Add the directory to your PATH if needed

### Manual Installation

```bash
# Copy the script to a directory in your PATH
cp bin/dispatch ~/bin/dispatch
chmod +x ~/bin/dispatch
```

## Quick Start

1. **Initialize environment (creates directories and .env file):**

   ```bash
   dispatch init
   ```

2. **Start Dispatch:**

   ```bash
   dispatch start
   ```

3. **Check status:**

   ```bash
   dispatch status
   ```

4. **Stop container:**

   ```bash
   dispatch stop
   ```

5. **List available versions:**

   ```bash
   dispatch versions
   ```

6. **Update to latest version:**

   ```bash
   dispatch update                     # Update both CLI and container
   dispatch update --cli-only          # Update only CLI script
   dispatch update --container-only    # Update only container
   ```

## Commands

### `dispatch init`

Initialize the Dispatch environment by creating directories and configuration files:

```bash
# Initialize with defaults
dispatch init
```

**What it does:**

- Creates `~/.dispatch` directory for configuration
- Creates `~/workspace` directory for projects
- Generates `~/.dispatch/.env` file with default settings including a secure `TERMINAL_KEY`

### `dispatch start [options]`

Start the Dispatch container:

```bash
# Basic start (uses ~/.dispatch/.env for configuration)
dispatch start

# Start with custom port
dispatch start --port 8080

# Start with specific version
dispatch start --version v1.2.3
dispatch start -v stable

# Start with custom directories
dispatch start --home ~/my-dispatch --workspace ~/my-workspace
```

#### Options

- `-p, --port <port>` - Port for web interface (default: 3030)
- `-v, --version <tag>` - Docker image version/tag (default: latest)
- `--env-file <path>` - Path to .env file (default: ~/.dispatch/.env)
- `--home <path>` - Dispatch home directory (default: ~/.dispatch)
- `--workspace <path>` - Workspace directory (default: ~/workspace)

### `dispatch stop`

Stop the running Dispatch container:

```bash
dispatch stop
```

**What it does:**

- Stops the running container
- Removes the stopped container
- Preserves all data in mounted directories

### `dispatch versions [options]`

List available Docker image versions from Docker Hub:

```bash
# Show 25 most recent versions (default)
dispatch versions

# Show 50 most recent versions
dispatch versions --limit 50
dispatch versions -l 50

# Show up to 100 versions
dispatch versions --all
dispatch versions -a
```

#### Options

- `-l, --limit <N>` - Number of versions to show (default: 25)
- `-a, --all` - Show more versions (sets limit to 100)

**Output includes:**

- Version tag name (e.g., latest, v1.2.3, stable)
- Last updated timestamp

### `dispatch version`

Show both CLI and Docker container versions:

```bash
dispatch version
```

**Output includes:**

- CLI version number
- Docker container image and tag
- Resolved version if using "latest" tag
- Container creation date
- Container status (running/stopped)

### `dispatch update [options]`

Update CLI script and/or Docker image:

```bash
# Update both CLI and container (default)
dispatch update

# Update only the CLI script
dispatch update --cli-only

# Update only the Docker container
dispatch update --container-only
```

#### Options

- `--cli-only` - Update only the dispatch CLI script from GitHub
- `--container-only` - Update only the Docker container image
- (default: updates both CLI and container)

**What `dispatch update` does (default):**

1. Updates the CLI script from GitHub
2. Stops the current container if running
3. Pulls the latest `fwdslsh/dispatch:latest` image
4. Restarts the container if it was previously running

**What `dispatch update --cli-only` does:**

- Downloads and runs the latest install script from GitHub
- Updates the dispatch CLI script in place
- Does not touch the Docker container
- Preserves your existing configuration

**What `dispatch update --container-only` does:**

- Stops the current container if running
- Pulls the latest Docker image
- Restarts the container if it was previously running
- Does not update the CLI script

### `dispatch status`

Show the current status of the Dispatch container:

```bash
dispatch status
```

**Output includes:**

- Container running status
- Port mappings
- Web interface URL

## Configuration

The new CLI uses a standardized `.env` file approach for configuration.

### Environment File (`~/.dispatch/.env`)

Created automatically by `dispatch init`, this file contains all configuration options:

```bash
# Required: Authentication key for web interface
TERMINAL_KEY=your-generated-key

# Optional: Server configuration
PORT=3030

# Optional: Features
ENABLE_TUNNEL=false
#LT_SUBDOMAIN=my-dispatch

# Optional: Directory paths (uncomment to override defaults)
#DISPATCH_CONFIG_DIR=/config
#WORKSPACES_ROOT=$HOME/workspaces
```

### Directory Structure

- `~/.dispatch/` - Main configuration directory
- `~/.dispatch/.env` - Environment configuration
- `~/workspace/` - Default workspace for projects and files

## Configuration

The CLI reads configuration from `~/.dispatch/config.json`. Generate an example file with:

```bash
dispatch config
```

### Configuration Options

```json
{
	// Docker image to use
	"image": "fwdslsh/dispatch:latest",

	// Port for web interface
	"port": 3030,

	// Terminal authentication key (leave null to auto-generate)
	"terminalKey": null,

	// Enable public URL tunnel
	"enableTunnel": false,

	// Custom tunnel subdomain (optional)
	"ltSubdomain": null,

	// PTY mode: 'terminal' or 'ai'
	"ptyMode": "shell",

	// Volume mounts
	"volumes": {
		// Projects workspace directory
		"projects": "~/dispatch/projects",

		// User home directory (for dotfiles, shell history, etc.)
		"home": "~/dispatch/home",

		// SSH directory (mounted read-only, optional)
		"ssh": "~/.ssh",

		// Claude configuration directory (optional)
		"claude": "~/.claude",

		// Additional config directory (optional)
		"config": "~/.config"
	},

	// Build Docker image before running
	"build": false,

	// Open browser automatically after starting
	"openBrowser": false,

	// Notification settings
	"notifications": {
		// Enable notifications when container starts
		"enabled": false,

		// Webhook notification settings (great for Slack, Discord, etc.)
		"webhook": {
			// Webhook URL to send POST request to
			"url": null,

			// Optional custom headers
			"headers": {
				"Content-Type": "application/json"
				// "Authorization": "Bearer your-token"
			}
		}
	}
}
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

### First-Time Setup

```bash
# Initialize environment with automatic setup
dispatch init

# Start Dispatch with all configurations applied
dispatch start --open
```

### Basic Development Setup

```bash
# Generate config manually
dispatch config

# Edit config to enable browser opening
vim ~/.dispatch/config.json

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

### Custom Initialization

```bash
# Initialize with custom directories
dispatch init --dispatch-home ~/my-dispatch --projects-dir ~/my-projects

# Initialize without Docker pull and CLI setup
dispatch init --skip-docker --skip-cli

# Initialize with specific paths non-interactively
dispatch init --dispatch-home /opt/dispatch --projects-dir /opt/dispatch/workspace --non-interactive

# Quick non-interactive setup for CI/automation
dispatch init --non-interactive
```

### Notifications

#### Email Notifications

Get notified via email when your container starts:

```bash
# Quick email notification
dispatch start --notify-email your-email@gmail.com --smtp-host smtp.gmail.com --smtp-user your-email@gmail.com --smtp-pass your-app-password

# Using configuration file (recommended for security)
dispatch config
# Edit ~/.dispatch/config.json to add your webhook settings
dispatch start
```

**Gmail Setup:**

1. Enable 2FA on your Gmail account
2. Generate an app password: <https://myaccount.google.com/apppasswords>
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
