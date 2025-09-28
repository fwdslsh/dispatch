# Dispatch CLI

This directory contains the Dispatch CLI tool.

## File

- **`dispatch`** - Bash-based CLI script

## Migration

The Dispatch CLI has been converted from Node.js to a native Bash script for improved usability and reduced dependencies.

### Bash CLI (`dispatch`)

- **Simpler installation**: No Node.js dependencies required
- **Native shell integration**: Works with standard Unix tools
- **Standardized configuration**: Uses `.env` files and standard directory structure
- **Better Docker integration**: Optimized for container management

### Commands

```bash
dispatch init      # Create directories and default .env file
dispatch start     # Start the Docker container
dispatch stop      # Stop the Docker container
dispatch update    # Update to latest Docker image
dispatch status    # Show container status
dispatch attach    # Attach interactive shell to running container
dispatch connect   # Connect to remote dispatch instance via SSH
dispatch help      # Show help information
```

### Installation

Use the installer script from the repository root:

```bash
./install.sh
```

Or install manually:

```bash
cp bin/dispatch ~/bin/dispatch
chmod +x ~/bin/dispatch
```

## Configuration

The CLI uses a standardized configuration approach:

- **Configuration directory**: `~/.dispatch/`
- **Environment file**: `~/.dispatch/.env`
- **Workspace directory**: `~/workspace`
- **Docker image**: `fwdslsh/dispatch:latest`

Run `dispatch init` to create the default configuration structure.
