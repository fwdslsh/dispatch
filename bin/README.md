# Dispatch CLI

This directory contains the Dispatch CLI tools.

## Files

- **`dispatch`** - New Bash-based CLI script (recommended)
- **`cli.js`** - Legacy Node.js CLI script (deprecated)

## Migration

The Dispatch CLI has been converted from Node.js to a native Bash script for improved usability and reduced dependencies.

### New Bash CLI (`dispatch`)

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

### Legacy CLI (Deprecated)

The `cli.js` file is kept for backward compatibility but is no longer maintained. Users should migrate to the new `dispatch` script.

To run the legacy CLI:

```bash
node bin/cli.js <command>
```

## Configuration

The new CLI uses a standardized configuration approach:

- **Configuration directory**: `~/.dispatch/`
- **Environment file**: `~/.dispatch/.env`
- **Workspace directory**: `~/workspace`
- **Docker image**: `fwdslsh/dispatch:latest`

Run `dispatch init` to create the default configuration structure.
