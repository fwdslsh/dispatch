# Dispatch Devcontainer Examples

This directory contains example `.devcontainer` configurations for using Dispatch with VSCode devcontainers.

## Files

- **`devcontainer.json`** - Basic devcontainer configuration using the Dispatch Docker image directly
- **`docker-compose.yml`** - Docker Compose configuration for more complex setups
- **`devcontainer-compose.json`** - Devcontainer configuration that uses the Docker Compose file

## Usage

### Basic Setup

1. Copy `devcontainer.json` to your project's `.devcontainer/` directory
2. Modify the `TERMINAL_KEY` and other environment variables as needed
3. Open your project in VSCode and select "Reopen in Container"

### Docker Compose Setup

1. Copy both `docker-compose.yml` and `devcontainer-compose.json` to your project's `.devcontainer/` directory
2. Rename `devcontainer-compose.json` to `devcontainer.json`
3. Modify configurations as needed
4. Open your project in VSCode and select "Reopen in Container"

## Customization

### Environment Variables

Update the `containerEnv` section in `devcontainer.json` or the `environment` section in `docker-compose.yml`:

```json
"containerEnv": {
  "TERMINAL_KEY": "your-secure-key",
  "ENABLE_TUNNEL": "true",
  "LT_SUBDOMAIN": "your-subdomain"
}
```

### Volume Mounts

For persistent storage, volumes are automatically created. To mount host directories instead:

```json
"mounts": [
  "source=${localWorkspaceFolder}/projects,target=/workspace,type=bind"
]
```

### Extensions

Add your preferred VSCode extensions:

```json
"extensions": [
  "ms-vscode.vscode-typescript-next",
  "svelte.svelte-vscode",
  "your-extension-id"
]
```

## Security Notes

- Change the default `TERMINAL_KEY` before use
- Don't commit sensitive configuration to version control
- Use environment files for secrets in production setups

For more detailed information, see the [VSCode Devcontainer Guide](../vscode-devcontainer.md).
