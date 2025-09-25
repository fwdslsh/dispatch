# Using Dispatch as a VSCode Devcontainer

This guide demonstrates how to use the Dispatch Docker image as a VSCode devcontainer, enabling you to work with AI agents safely without granting them access to your host machine.

## Overview

VSCode devcontainers allow you to run your development environment inside a Docker container, providing isolation and consistency. When combined with Dispatch, this creates a secure sandbox where AI agents can operate without risk to your host system.

## Prerequisites

Before setting up Dispatch as a devcontainer, ensure you have:

- **Visual Studio Code** installed on your host machine
- **Docker Desktop** running (Windows/Mac) or Docker Engine (Linux)
- **Dev Containers extension** for VSCode (`ms-vscode-remote.remote-containers`)
- **Basic familiarity** with Docker and containers

### Installing the Dev Containers Extension

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Dev Containers"
4. Install the extension by Microsoft

## Setup Methods

There are two primary ways to use Dispatch with VSCode devcontainers:

### Method 1: Connect to Running Dispatch Container (Recommended)

This method connects VSCode to an already running Dispatch container, which is useful when Dispatch is running on a remote server or when you want to manage the container lifecycle separately.

#### Step 1: Start Dispatch Container

First, start a Dispatch container with the necessary configurations:

```bash
# Create directories for persistent storage
mkdir -p ~/dispatch-home ~/dispatch-projects

# Start Dispatch container with proper volume mounts
docker run -d \
  --name dispatch-dev \
  -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/dispatch \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

#### Step 2: Connect VSCode to Container

1. Open VSCode
2. Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac) to open command palette
3. Type "Dev Containers: Attach to Running Container"
4. Select the `dispatch-dev` container from the list
5. VSCode will open a new window connected to the container

#### Step 3: Configure Workspace

Once connected, configure your workspace:

1. Open the `/workspace` directory in VSCode
2. Install any needed VSCode extensions inside the container
3. Configure your development environment

### Method 2: Use .devcontainer Configuration

This method uses a `.devcontainer` configuration to automatically build and manage the container.

#### Step 1: Create .devcontainer Directory

In your project root, create a `.devcontainer` directory:

```bash
mkdir .devcontainer
```

#### Step 2: Create devcontainer.json

Create `.devcontainer/devcontainer.json` (you can also use the [example configuration](examples/devcontainer/devcontainer.json)):

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
				"terminal.integrated.cwd": "/workspace"
			},
			"extensions": [
				"ms-vscode.vscode-typescript-next",
				"bradlc.vscode-tailwindcss",
				"svelte.svelte-vscode",
				"ms-vscode.vscode-json"
			]
		}
	},

	// Container lifecycle
	"postCreateCommand": "echo 'Dispatch devcontainer ready! Open http://localhost:3030 to access the web interface.'",

	// Features (optional)
	"features": {
		"ghcr.io/devcontainers/features/git:1": {},
		"ghcr.io/devcontainers/features/node:1": {
			"version": "22"
		}
	}
}
```

#### Step 3: Open in Container

1. Open your project folder in VSCode
2. VSCode should detect the `.devcontainer` configuration
3. Click "Reopen in Container" when prompted, or use `Ctrl+Shift+P` → "Dev Containers: Reopen in Container"

## Building and Running

### Building the Container

If you need to customize the Dispatch image:

```bash
# Clone the Dispatch repository
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# Build custom image
docker build -f docker/Dockerfile -t dispatch:custom .
```

Then update your devcontainer configuration to use `dispatch:custom` instead of `fwdslsh/dispatch:latest`.

### Development Workflow

Once your devcontainer is running:

1. **Access Dispatch Web Interface**: Open `http://localhost:3030` in your browser
2. **Terminal Access**: Use VSCode's integrated terminal or the Dispatch web interface
3. **File Editing**: Edit files using VSCode's editor
4. **AI Agent Interaction**: Use the Dispatch web interface to interact with AI agents safely

### Environment Variables

Configure these environment variables in your devcontainer:

- `TERMINAL_KEY`: Authentication key for web interface (required)
- `PORT`: Port for web interface (default: 3030)
- `ENABLE_TUNNEL`: Enable public URL sharing (true/false)
- `LT_SUBDOMAIN`: Optional LocalTunnel subdomain
- `DISPATCH_CONFIG_DIR`: Configuration directory (default: /home/dispatch/.config/dispatch)
- `DISPATCH_PROJECTS_DIR`: Projects directory (default: /workspace)

## Troubleshooting

### Common Issues and Solutions

#### Container Won't Start

**Problem**: Devcontainer fails to start or build.

**Solutions**:

1. Check Docker is running: `docker ps`
2. Verify image exists: `docker images | grep dispatch`
3. Check devcontainer.json syntax with a JSON validator
4. Review VSCode Dev Container logs: View → Output → Dev Containers

#### Permission Issues

**Problem**: Cannot write files or access directories.

**Solutions**:

1. Ensure proper user mapping in devcontainer.json:
   ```json
   "remoteUser": "dispatch",
   "containerUser": "dispatch"
   ```
2. For existing containers, fix permissions:
   ```bash
   docker exec -it dispatch-dev chown -R dispatch:dispatch /workspace
   ```

#### Web Interface Not Accessible

**Problem**: Cannot access Dispatch at `http://localhost:3030`.

**Solutions**:

1. Verify port forwarding in devcontainer.json
2. Check container is running: `docker ps`
3. Test port binding: `curl http://localhost:3030`
4. Check firewall settings

#### Extensions Not Working

**Problem**: VSCode extensions don't work inside container.

**Solutions**:

1. Install extensions inside the container, not on host
2. Add extensions to devcontainer.json:
   ```json
   "extensions": ["extension.id"]
   ```
3. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"

#### Volume Mount Issues

**Problem**: Files not persisting or not visible.

**Solutions**:

1. Check volume mount syntax in devcontainer.json
2. Use named volumes for better persistence:
   ```json
   "mounts": ["source=myvolume,target=/workspace,type=volume"]
   ```
3. Verify mount points: `docker exec -it container-name mount | grep workspace`

#### Memory/Performance Issues

**Problem**: Container runs slowly or out of memory.

**Solutions**:

1. Increase Docker Desktop memory allocation
2. Add resource limits to devcontainer.json:
   ```json
   "runArgs": ["--memory=4g", "--cpus=2"]
   ```
3. Close unnecessary VSCode extensions

### Advanced Troubleshooting

#### Inspecting Container

```bash
# View container logs
docker logs dispatch-dev

# Access container shell
docker exec -it dispatch-dev /bin/bash

# Check container configuration
docker inspect dispatch-dev
```

#### Debugging Devcontainer Configuration

1. Enable verbose logging in VSCode settings:
   ```json
   "dev.containers.logLevel": "debug"
   ```
2. Check the Dev Containers output panel for detailed logs
3. Test devcontainer.json syntax: `Ctrl+Shift+P` → "Dev Containers: Rebuild Container"

## Example Workflows

### Web Development with AI Assistance

1. Start devcontainer with Dispatch
2. Open web interface at `http://localhost:3030`
3. Create a new terminal session in Dispatch
4. Clone your project: `git clone https://github.com/user/project.git`
5. Use AI agents through Dispatch for code assistance
6. Edit files in VSCode
7. Test and debug in the isolated environment

### Secure AI Code Review

1. Set up devcontainer with your codebase
2. Use Dispatch web interface to start Claude session
3. Ask AI to review code files
4. AI can read, analyze, and suggest changes without host access
5. Review AI suggestions in VSCode
6. Apply changes as needed

### Team Development

1. Share devcontainer configuration in your repository
2. Team members clone and open in devcontainer
3. Consistent environment across all developers
4. Safe AI agent usage for the entire team

## Security Considerations

### Container Isolation

- Dispatch container is isolated from host system
- AI agents can only access mounted directories
- No direct access to host networking or filesystem
- Use volume mounts to control what's accessible

### Authentication

- Always set a strong `TERMINAL_KEY`
- Don't commit secrets to devcontainer.json
- Use environment files for sensitive data:
  ```json
  "containerEnv": {
    "TERMINAL_KEY": "${localEnv:DISPATCH_KEY}"
  }
  ```

### Network Security

- Disable tunnel mode in development: `"ENABLE_TUNNEL": "false"`
- Use port forwarding instead of exposing ports
- Consider using a VPN for remote access

## Best Practices

### Development

1. **Use named volumes** for persistent data
2. **Pin image versions** to avoid breaking changes
3. **Include necessary extensions** in devcontainer.json
4. **Set up proper user permissions** to avoid file ownership issues
5. **Use environment files** for configuration

### Performance

1. **Limit resource usage** with Docker settings
2. **Use .dockerignore** to exclude unnecessary files
3. **Consider multi-stage builds** for custom images
4. **Close unused terminals** in Dispatch to save memory

### Collaboration

1. **Version control devcontainer.json** with your project
2. **Document custom setup steps** in README
3. **Use consistent naming** for containers and volumes
4. **Share environment configurations** through the team

## Next Steps

After setting up your Dispatch devcontainer:

1. **Explore Dispatch features**: Terminal sessions, AI agents, file management
2. **Customize the environment**: Add your favorite tools and extensions
3. **Set up CI/CD**: Use the same container for development and testing
4. **Scale to team**: Share configurations and best practices
5. **Advanced features**: Custom adapters, webhooks, integrations

## Additional Resources

- [Example Devcontainer Configurations](examples/devcontainer/)
- [Dispatch Documentation](../../README.md)
- [Docker Documentation](../../docker/README.md)
- [VSCode Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Dispatch GitHub Repository](https://github.com/fwdslsh/dispatch)

Happy coding with your secure, AI-powered development environment! 🚀
