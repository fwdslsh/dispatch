---
title: 'Connect VSCode to Local Dispatch Containers'
description: 'Learn how to connect VSCode to Dispatch containers running locally on your machine for secure AI-powered development.'
tags: ['vscode', 'devcontainer', 'docker', 'dispatch', 'local-development']
series: 'Dispatch DevContainer Guide'
published: false
draft: true
---

# Connect VSCode to Local Dispatch Containers

This guide shows you how to connect VSCode to Dispatch containers running locally on your machine. This approach gives you maximum flexibility and control over your local development environment.

## Overview

Connecting VSCode to a local Dispatch container is ideal when:

- You want to manage the container lifecycle separately from VSCode
- You need to connect and disconnect from development sessions frequently
- You're developing and testing Dispatch configurations locally
- You want full control over the container environment and resources

## Prerequisites

Before connecting to local Dispatch containers, ensure you have:

- **Visual Studio Code** installed on your local machine
- **Docker Desktop** running (Windows/Mac) or Docker Engine (Linux)
- **Dev Containers extension** for VSCode (`ms-vscode-remote.remote-containers`)
- **Basic familiarity** with Docker and containers

### Installing the Dev Containers Extension

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Dev Containers"
4. Install the extension by Microsoft

## Local Container Connection

### Step 1: Start Dispatch Container Locally

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

### Step 2: Connect VSCode to Local Container

1. Open VSCode
2. Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac) to open command palette
3. Type "Dev Containers: Attach to Running Container"
4. Select the `dispatch-dev` container from the list
5. VSCode will open a new window connected to the container

### Step 3: Configure Workspace

Once connected, configure your workspace:

1. Open the `/workspace` directory in VSCode
2. Install any needed VSCode extensions inside the container
3. Configure your development environment
4. Access the Dispatch web interface at `http://localhost:3030`

## Environment Variables

Configure these environment variables for your Dispatch container:

- `TERMINAL_KEY`: Authentication key for web interface (required)
- `PORT`: Port for web interface (default: 3030)
- `ENABLE_TUNNEL`: Enable public URL sharing (true/false)
- `LT_SUBDOMAIN`: Optional LocalTunnel subdomain
- `DISPATCH_CONFIG_DIR`: Configuration directory (default: /home/dispatch/.config/dispatch)
- `WORKSPACES_ROOT`: Projects directory (default: /workspace)

## Troubleshooting

### Common Issues and Solutions

#### Cannot Connect to Local Container

**Problem**: VSCode cannot find or connect to local containers.

**Solutions**:

1. Verify Docker is running:
   ```bash
   docker ps
   ```
2. Check container is running:
   ```bash
   docker ps | grep dispatch-dev
   ```
3. Restart Docker Desktop if on Windows/Mac
4. Check VSCode Dev Containers extension is installed and enabled

#### Permission Issues with Local Containers

**Problem**: Cannot write files or access directories in local container.

**Solutions**:

1. Ensure proper user mapping when starting container:
   ```bash
   docker run --user $(id -u):$(id -g) ...
   ```
2. Fix ownership of mounted volumes:
   ```bash
   sudo chown -R $(id -u):$(id -g) ~/dispatch-home ~/dispatch-projects
   ```
3. Check directory permissions:
   ```bash
   ls -la ~/dispatch-home ~/dispatch-projects
   ```

#### Container Won't Start

**Problem**: Dispatch container fails to start.

**Solutions**:

1. Check Docker logs:
   ```bash
   docker logs dispatch-dev
   ```
2. Verify port 3030 is not already in use:
   ```bash
   lsof -i :3030
   ```
3. Check available disk space and memory
4. Remove existing container and try again:
   ```bash
   docker rm dispatch-dev
   ```

#### Web Interface Not Accessible

**Problem**: Cannot access Dispatch web interface at `http://localhost:3030`.

**Solutions**:

1. Verify container port binding:
   ```bash
   docker port dispatch-dev
   ```
2. Check container is running:
   ```bash
   docker ps | grep dispatch-dev
   ```
3. Test with curl:
   ```bash
   curl http://localhost:3030
   ```
4. Check firewall settings on your local machine

## Example Workflows

### Local Development with AI Assistance

1. **Start Container**: Launch Dispatch container with your project mounted
2. **Connect VSCode**: Attach VSCode to the running container
3. **Access Web Interface**: Open `http://localhost:3030` for AI assistance
4. **Develop**: Edit code in VSCode while using AI agents in Dispatch
5. **Test**: Run tests and debug in the isolated container environment

### Container Lifecycle Management

1. **Development Sessions**: Start container when beginning work, stop when done
2. **Persistent Storage**: Keep project files and configuration between sessions
3. **Resource Control**: Manage container resources based on project needs
4. **Quick Switching**: Easily switch between different project containers

## Security Considerations

### Container Isolation

- Dispatch containers are isolated from host system
- Use volume mounts to control what's accessible to AI agents
- AI agents can only access mounted directories
- No direct access to host networking or filesystem outside container

### Authentication

- Always set a strong `TERMINAL_KEY` for web interface access
- Don't commit secrets to version control
- Use environment files for sensitive data
- Rotate authentication keys regularly

### Local Network Security

- Dispatch web interface is only accessible from localhost by default
- Container ports are bound to localhost interface
- Use firewall rules if additional protection is needed

## Best Practices

### Container Management

1. **Use named containers** for easy identification and connection
2. **Set resource limits** to prevent excessive resource usage
3. **Use volume mounts** for persistent data storage
4. **Clean up unused containers** regularly to free up disk space

### Development Workflow

1. **Start containers when needed** to conserve system resources
2. **Use consistent naming** for containers across projects
3. **Document setup procedures** for team members
4. **Monitor container performance** and adjust resources as needed

### Local Environment

1. **Keep Docker Desktop updated** for latest features and security fixes
2. **Monitor disk usage** as containers and volumes can consume significant space
3. **Use .dockerignore** files to exclude unnecessary files from builds
4. **Backup important development data** stored in container volumes

## Next Steps

After connecting to your Dispatch container:

1. **Explore Dispatch features**: Terminal sessions, AI agents, file management
2. **Install VSCode extensions**: Add your development tools inside the container
3. **Configure your workspace**: Set up your preferred development environment
4. **Set up CI/CD**: Use the same container setup for testing and deployment
5. **Advanced remote setups**: Explore container orchestration for team environments

## Additional Resources

- [Connect to Remote Containers](dispatch-devcontainer-remote.md)
- [Using .devcontainer Configuration](dispatch-devcontainer-config.md)
- [Example Devcontainer Configurations](examples/devcontainer/)
- [Dispatch Docker Documentation](../../docker/README.md)
- [VSCode Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker Desktop Documentation](https://docs.docker.com/desktop/)

Happy local development with your secure, AI-powered environment! 🚀
