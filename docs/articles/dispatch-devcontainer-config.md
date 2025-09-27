---
title: "Using Dispatch with .devcontainer Configuration"
description: "Learn how to set up Dispatch using VSCode .devcontainer configuration files for automated container management and consistent development environments."
tags: ["vscode", "devcontainer", "docker", "dispatch", "configuration"]
series: "Dispatch DevContainer Guide"
published: false
draft: true
---

# Using Dispatch with .devcontainer Configuration

This guide shows you how to use VSCode's `.devcontainer` configuration to automatically manage Dispatch containers. This approach provides a consistent, reproducible development environment that can be easily shared with your team.

## Overview

Using `.devcontainer` configuration is ideal when:
- You want automated container lifecycle management
- You need consistent development environments across team members
- You're working on projects that require specific Dispatch configurations
- You want to version control your development environment setup

## Prerequisites

Before setting up Dispatch with devcontainer configuration, ensure you have:

- **Visual Studio Code** installed on your host machine
- **Docker Desktop** running (Windows/Mac) or Docker Engine (Linux)
- **Dev Containers extension** for VSCode (`ms-vscode-remote.remote-containers`)
- **Basic familiarity** with Docker and containers

### Installing the Dev Containers Extension

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Dev Containers"
4. Install the extension by Microsoft

## Basic .devcontainer Setup

### Step 1: Create .devcontainer Directory

In your project root, create a `.devcontainer` directory:

```bash
mkdir .devcontainer
```

### Step 2: Create devcontainer.json

Create `.devcontainer/devcontainer.json` (you can also use our [example configuration](examples/devcontainer/devcontainer.json)):

```json
{
	"name": "Dispatch Development Environment",
	"image": "fwdslsh/dispatch:latest",
	
	// Container configuration
	"containerEnv": {
		"TERMINAL_KEY": "devcontainer-key-12345",
		"PORT": "3030",
		"ENABLE_TUNNEL": "false"
	},
	
	// Port forwarding
	"forwardPorts": [3030],
	"portsAttributes": {
		"3030": {
			"label": "Dispatch Web Interface",
			"onAutoForward": "notify"
		}
	},
	
	// Volume mounts for persistence
	"mounts": [
		"source=dispatch-home,target=/home/dispatch,type=volume",
		"source=dispatch-workspace,target=/workspace,type=volume"
	],
	
	// Run as non-root user
	"remoteUser": "dispatch",
	"containerUser": "dispatch",
	
	// VSCode settings
	"customizations": {
		"vscode": {
			"settings": {
				"terminal.integrated.shell.linux": "/bin/bash",
				"terminal.integrated.cwd": "/workspace",
				"files.watcherExclude": {
					"**/node_modules/**": true,
					"**/.git/**": true,
					"**/.svelte-kit/**": true,
					"**/build/**": true
				}
			},
			"extensions": [
				"ms-vscode.vscode-typescript-next",
				"bradlc.vscode-tailwindcss",
				"svelte.svelte-vscode",
				"ms-vscode.vscode-json",
				"esbenp.prettier-vscode",
				"ms-vscode.vscode-eslint"
			]
		}
	},
	
	// Container lifecycle
	"postCreateCommand": "echo 'Dispatch devcontainer ready! Open http://localhost:3030 to access the web interface.'",
	
	// Features (optional additional tools)
	"features": {
		"ghcr.io/devcontainers/features/git:1": {
			"version": "latest"
		},
		"ghcr.io/devcontainers/features/node:1": {
			"version": "22"
		}
	},
	
	// Resource limits (optional)
	"runArgs": ["--memory=2g", "--cpus=2"],
	
	// Shutdown action
	"shutdownAction": "stopContainer"
}
```

### Step 3: Open in Container

1. Open your project folder in VSCode
2. VSCode should detect the `.devcontainer` configuration
3. Click "Reopen in Container" when prompted, or use `Ctrl+Shift+P` → "Dev Containers: Reopen in Container"

## Advanced Configuration Options

### Using Docker Compose

For more complex setups, you can use Docker Compose with your devcontainer:

Create `.devcontainer/docker-compose.yml`:

```yaml
version: '3.8'

services:
  dispatch:
    image: fwdslsh/dispatch:latest
    ports:
      - "3030:3030"
    environment:
      - TERMINAL_KEY=devcontainer-key-12345
      - PORT=3030
      - ENABLE_TUNNEL=false
      - DISPATCH_CONFIG_DIR=/home/dispatch/.config/dispatch
      - DISPATCH_PROJECTS_DIR=/workspace
    volumes:
      - dispatch-home:/home/dispatch
      - dispatch-workspace:/workspace
      - ../:/workspace/project
    user: "1000:1000"
    restart: unless-stopped

volumes:
  dispatch-home:
  dispatch-workspace:
```

Then create `.devcontainer/devcontainer.json` for Docker Compose:

```json
{
	"name": "Dispatch with Docker Compose",
	"dockerComposeFile": "docker-compose.yml",
	"service": "dispatch",
	"workspaceFolder": "/workspace",

	// Port forwarding
	"forwardPorts": [3030],
	"portsAttributes": {
		"3030": {
			"label": "Dispatch Web Interface",
			"onAutoForward": "notify"
		}
	},

	// Run as non-root user
	"remoteUser": "dispatch",

	// VSCode settings
	"customizations": {
		"vscode": {
			"settings": {
				"terminal.integrated.shell.linux": "/bin/bash",
				"terminal.integrated.cwd": "/workspace"
			},
			"extensions": [
				"ms-vscode.vscode-typescript-next",
				"svelte.svelte-vscode",
				"esbenp.prettier-vscode"
			]
		}
	},

	// Container lifecycle
	"postCreateCommand": "echo 'Dispatch devcontainer ready! Access at http://localhost:3030'",

	// Shutdown action
	"shutdownAction": "stopCompose"
}
```

### Custom Dockerfile

If you need to customize the Dispatch image, create a custom Dockerfile:

Create `.devcontainer/Dockerfile`:

```dockerfile
FROM fwdslsh/dispatch:latest

# Install additional tools
RUN apt-get update && apt-get install -y \
    vim \
    htop \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install additional Node.js packages globally
RUN npm install -g @anthropic-ai/claude-cli typescript

# Set up custom configuration
COPY custom-config.json /home/dispatch/.config/dispatch/

USER dispatch
```

Then reference it in your `devcontainer.json`:

```json
{
	"name": "Custom Dispatch Environment",
	"build": {
		"dockerfile": "Dockerfile"
	},
	// ... rest of configuration
}
```

## Environment Configuration

### Environment Variables

Configure environment variables in your `devcontainer.json`:

```json
{
	"containerEnv": {
		"TERMINAL_KEY": "${localEnv:DISPATCH_KEY}",
		"ENABLE_TUNNEL": "false",
		"NODE_ENV": "development",
		"DEBUG": "dispatch:*"
	}
}
```

### Using Environment Files

For sensitive data, use environment files that are not committed to version control:

Create `.env` (add to `.gitignore`):
```bash
TERMINAL_KEY=your-secure-key
CLAUDE_API_KEY=your-claude-key
```

Reference in `devcontainer.json`:
```json
{
	"containerEnv": {
		"TERMINAL_KEY": "${localEnv:TERMINAL_KEY}",
		"CLAUDE_API_KEY": "${localEnv:CLAUDE_API_KEY}"
	}
}
```

### Volume Mount Strategies

#### Named Volumes (Recommended)
```json
{
	"mounts": [
		"source=dispatch-home,target=/home/dispatch,type=volume",
		"source=dispatch-workspace,target=/workspace,type=volume"
	]
}
```

#### Bind Mounts
```json
{
	"mounts": [
		"source=${localWorkspaceFolder}/data,target=/workspace,type=bind",
		"source=${localEnv:HOME}/.ssh,target=/home/dispatch/.ssh,type=bind,readonly"
	]
}
```

## Development Workflow

### Building and Running

Once your devcontainer is configured:

1. **Automatic Setup**: VSCode handles container creation and configuration
2. **Development**: Edit code using VSCode's full feature set
3. **AI Interaction**: Access Dispatch web interface at `http://localhost:3030`
4. **Terminal Access**: Use both VSCode integrated terminal and Dispatch web terminal
5. **Extension Support**: All configured extensions are automatically installed

### Container Lifecycle Management

- **Start**: Open project in VSCode, container starts automatically
- **Stop**: Close VSCode window or use command palette
- **Rebuild**: Use "Dev Containers: Rebuild Container" when configuration changes
- **Clean Up**: Use "Dev Containers: Clean Up Dev Containers" to remove unused containers

## Troubleshooting

### Common Issues and Solutions

#### Container Build Failures

**Problem**: Devcontainer fails to build or start.

**Solutions**:
1. Check `devcontainer.json` syntax:
   ```bash
   # Use online JSON validator or VSCode JSON validation
   ```
2. Verify base image availability:
   ```bash
   docker pull fwdslsh/dispatch:latest
   ```
3. Review build logs in VSCode output panel
4. Try rebuilding container: `Ctrl+Shift+P` → "Dev Containers: Rebuild Container"

#### Volume Mount Issues

**Problem**: Files not persisting or not visible in container.

**Solutions**:
1. Check volume mount syntax in `devcontainer.json`
2. Use named volumes for better persistence:
   ```json
   "mounts": ["source=myvolume,target=/workspace,type=volume"]
   ```
3. Verify mount points exist:
   ```bash
   docker exec -it container-name ls -la /workspace
   ```

#### Extension Installation Problems

**Problem**: VSCode extensions don't install or work properly.

**Solutions**:
1. Check extension IDs in `devcontainer.json`:
   ```json
   "extensions": ["ms-vscode.vscode-typescript-next"]
   ```
2. Install extensions manually inside container
3. Rebuild container to refresh extension installation
4. Check extension compatibility with container environment

#### Performance Issues

**Problem**: Container runs slowly or uses too much memory.

**Solutions**:
1. Add resource limits:
   ```json
   "runArgs": ["--memory=4g", "--cpus=2"]
   ```
2. Exclude unnecessary files from watchers:
   ```json
   "settings": {
     "files.watcherExclude": {
       "**/node_modules/**": true,
       "**/.git/**": true
     }
   }
   ```
3. Use `.dockerignore` to exclude large directories from build context

## Example Project Setups

### Web Development Project

```json
{
	"name": "Web Development with Dispatch",
	"image": "fwdslsh/dispatch:latest",
	"containerEnv": {
		"TERMINAL_KEY": "web-dev-key",
		"NODE_ENV": "development"
	},
	"forwardPorts": [3030, 3000, 8080],
	"customizations": {
		"vscode": {
			"extensions": [
				"ms-vscode.vscode-typescript-next",
				"esbenp.prettier-vscode",
				"bradlc.vscode-tailwindcss",
				"ms-vscode.vscode-eslint"
			]
		}
	},
	"postCreateCommand": "npm install && echo 'Ready for web development!'"
}
```

### Python Development Project

```json
{
	"name": "Python Development with Dispatch",
	"image": "fwdslsh/dispatch:latest",
	"containerEnv": {
		"TERMINAL_KEY": "python-dev-key"
	},
	"features": {
		"ghcr.io/devcontainers/features/python:1": {
			"version": "3.11"
		}
	},
	"customizations": {
		"vscode": {
			"extensions": [
				"ms-python.python",
				"ms-python.pylint",
				"ms-python.black-formatter"
			]
		}
	},
	"postCreateCommand": "pip install -r requirements.txt"
}
```

## Security Considerations

### Container Isolation

- Dispatch containers are isolated from host system
- Use volume mounts to control accessible directories
- AI agents can only access mounted paths
- No direct access to host networking or filesystem

### Secret Management

- Never commit secrets to `devcontainer.json`
- Use environment variables from host system
- Consider using Docker secrets for sensitive data
- Use `.env` files that are excluded from version control

### Network Security

- Disable tunnel mode in development: `"ENABLE_TUNNEL": "false"`
- Use port forwarding instead of exposing ports
- Consider using a VPN for remote access
- Set strong authentication keys

## Best Practices

### Configuration Management

1. **Version control** your `devcontainer.json` with your project
2. **Use environment variables** for configuration that varies between developers
3. **Document custom setup steps** in project README
4. **Pin image versions** to avoid breaking changes

### Performance Optimization

1. **Use multi-stage builds** for custom Dockerfiles
2. **Leverage Docker build cache** by ordering commands optimally
3. **Exclude unnecessary files** with `.dockerignore`
4. **Use named volumes** for better performance than bind mounts

### Team Collaboration

1. **Standardize configurations** across team projects
2. **Share common extensions** through devcontainer configuration
3. **Document environment requirements** for new team members
4. **Use consistent naming** for containers and volumes

## Next Steps

After setting up your Dispatch devcontainer:

1. **Customize your environment**: Add your preferred tools and extensions
2. **Explore Dispatch features**: Terminal sessions, AI agents, file management
3. **Set up CI/CD**: Use the same container configuration for testing
4. **Scale to team**: Share configurations and best practices
5. **Advanced features**: Custom adapters, webhooks, integrations

## Additional Resources

- [Connect to Local Containers](dispatch-devcontainer-attach.md)
- [Connect to Remote Containers](dispatch-devcontainer-remote.md)
- [Example Devcontainer Configurations](examples/devcontainer/)
- [Dispatch Docker Documentation](../../docker/README.md)
- [VSCode Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Dev Container Features](https://containers.dev/features)

Happy coding with your automated, AI-powered development environment! 🚀