---
title: "Connect VSCode to Running Dispatch Containers"
description: "Learn how to connect VSCode to running Dispatch containers, both locally and remotely, for secure AI-powered development."
tags: ["vscode", "devcontainer", "docker", "dispatch", "remote-development"]
series: "Dispatch DevContainer Guide"
published: false
draft: true
---

# Connect VSCode to Running Dispatch Containers

This guide shows you how to connect VSCode to already running Dispatch containers, whether they're running locally on your machine or remotely on a server. This approach gives you maximum flexibility and control over your Dispatch environment.

## Overview

Connecting VSCode to a running Dispatch container is ideal when:
- Dispatch is running on a remote server or cloud instance
- You want to manage the container lifecycle separately from VSCode
- You're sharing a Dispatch instance with team members
- You need to connect and disconnect from development sessions frequently

## Prerequisites

Before connecting to Dispatch containers, ensure you have:

- **Visual Studio Code** installed on your local machine
- **Docker Desktop** running (for local containers) or **Docker CLI** configured for remote access
- **Dev Containers extension** for VSCode (`ms-vscode-remote.remote-containers`)
- **SSH access** (for remote containers)
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

## Remote Container Connection

### Step 1: Set Up Remote Docker Access

For remote containers, you'll need SSH access to the remote machine. Configure your SSH connection:

```bash
# Add to ~/.ssh/config
Host dispatch-server
    HostName your-server-ip
    User your-username
    Port 22
    IdentityFile ~/.ssh/your-key
```

### Step 2: Configure Docker Context for Remote Access

Set up a Docker context to connect to the remote Docker daemon:

```bash
# Create a new Docker context for the remote server
docker context create dispatch-remote \
  --docker "host=ssh://dispatch-server"

# Use the remote context
docker context use dispatch-remote

# Verify connection
docker ps
```

### Step 3: Start Remote Dispatch Container

Start Dispatch on the remote server:

```bash
# SSH into remote server
ssh dispatch-server

# Create directories for persistent storage
mkdir -p ~/dispatch-home ~/dispatch-projects

# Start Dispatch container
docker run -d \
  --name dispatch-remote \
  -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/dispatch \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

### Step 4: Connect VSCode to Remote Container

#### Option A: Using Docker Context

1. On your local machine, use the remote Docker context:
   ```bash
   docker context use dispatch-remote
   ```

2. Open VSCode
3. Press `Ctrl+Shift+P` and type "Dev Containers: Attach to Running Container"
4. Select the `dispatch-remote` container
5. VSCode will connect through the SSH tunnel

#### Option B: Using SSH Tunnel

1. Create an SSH tunnel to forward the Docker socket:
   ```bash
   ssh -L /tmp/docker.sock:/var/run/docker.sock dispatch-server
   ```

2. In another terminal, set the Docker host:
   ```bash
   export DOCKER_HOST=unix:///tmp/docker.sock
   ```

3. Open VSCode and attach to the container as usual

### Step 5: Access Remote Dispatch Web Interface

To access the Dispatch web interface running on the remote server:

```bash
# Create SSH tunnel for web interface
ssh -L 3030:localhost:3030 dispatch-server
```

Then open `http://localhost:3030` in your local browser.

## Environment Variables

Configure these environment variables for your Dispatch container:

- `TERMINAL_KEY`: Authentication key for web interface (required)
- `PORT`: Port for web interface (default: 3030)
- `ENABLE_TUNNEL`: Enable public URL sharing (true/false)
- `LT_SUBDOMAIN`: Optional LocalTunnel subdomain
- `DISPATCH_CONFIG_DIR`: Configuration directory (default: /home/dispatch/.config/dispatch)
- `DISPATCH_PROJECTS_DIR`: Projects directory (default: /workspace)

## Troubleshooting

### Common Issues and Solutions

#### Cannot Connect to Remote Container

**Problem**: VSCode cannot find or connect to remote containers.

**Solutions**:
1. Verify Docker context is correct:
   ```bash
   docker context ls
   docker context use dispatch-remote
   ```
2. Test SSH connection:
   ```bash
   ssh dispatch-server "docker ps"
   ```
3. Check firewall settings on remote server
4. Ensure Docker daemon is running on remote server

#### Permission Issues with Remote Containers

**Problem**: Cannot write files or access directories in remote container.

**Solutions**:
1. Ensure user IDs match between local and remote:
   ```bash
   # On remote server, check user ID
   id
   
   # Use matching UID/GID when starting container
   docker run --user $(id -u):$(id -g) ...
   ```
2. Fix ownership of mounted volumes:
   ```bash
   sudo chown -R $(id -u):$(id -g) ~/dispatch-home ~/dispatch-projects
   ```

#### SSH Connection Drops

**Problem**: SSH connection to remote server drops frequently.

**Solutions**:
1. Configure SSH keep-alive in `~/.ssh/config`:
   ```
   Host dispatch-server
       ServerAliveInterval 60
       ServerAliveCountMax 3
   ```
2. Use SSH multiplexing for stable connections:
   ```
   Host dispatch-server
       ControlMaster auto
       ControlPath ~/.ssh/control-%r@%h:%p
       ControlPersist 600
   ```

#### Web Interface Not Accessible

**Problem**: Cannot access Dispatch web interface on remote server.

**Solutions**:
1. Create SSH tunnel:
   ```bash
   ssh -L 3030:localhost:3030 dispatch-server
   ```
2. Check container port binding:
   ```bash
   docker port dispatch-remote
   ```
3. Verify firewall allows port 3030
4. Check if container is running:
   ```bash
   docker ps | grep dispatch
   ```

## Example Workflows

### Remote Development with Team

1. **Server Setup**: Set up Dispatch on a shared development server
2. **Team Access**: Each team member connects their local VSCode to the remote container
3. **Shared Environment**: Everyone works in the same consistent environment
4. **AI Assistance**: Use Dispatch's AI agents safely in the isolated container
5. **Collaboration**: Share terminal sessions and development workflows

### Hybrid Local/Remote Development

1. **Local Development**: Use local Dispatch for quick testing and prototyping
2. **Remote Testing**: Connect to remote Dispatch for integration testing
3. **Context Switching**: Easily switch between local and remote environments
4. **Resource Management**: Use remote servers for resource-intensive tasks

## Security Considerations

### SSH Security

- Use SSH key authentication instead of passwords
- Configure SSH keys with passphrases
- Use SSH agent for key management
- Limit SSH access with proper firewall rules

### Container Isolation

- Dispatch containers are isolated from host system
- Use volume mounts to control what's accessible
- AI agents can only access mounted directories
- No direct access to host networking or filesystem

### Network Security

- Use SSH tunnels for secure remote access
- Consider VPN for additional security
- Disable tunnel mode in production: `ENABLE_TUNNEL=false`
- Use strong authentication keys for Dispatch web interface

## Best Practices

### Connection Management

1. **Use Docker contexts** for clean remote connection management
2. **Set up SSH multiplexing** to avoid repeated authentication
3. **Use named containers** for easy identification and connection
4. **Document connection procedures** for team members

### Performance Optimization

1. **Use local Docker contexts** when possible for faster connections
2. **Configure SSH compression** for slow network connections
3. **Close unused connections** to free up resources
4. **Monitor network usage** when working with large files

### Team Collaboration

1. **Standardize container names** across team environments
2. **Share Docker context configurations** through team documentation
3. **Use consistent volume mount paths** for project compatibility
4. **Document remote server access procedures**

## Next Steps

After connecting to your Dispatch container:

1. **Explore Dispatch features**: Terminal sessions, AI agents, file management
2. **Install VSCode extensions**: Add your development tools inside the container
3. **Configure your workspace**: Set up your preferred development environment
4. **Set up CI/CD**: Use the same container setup for testing and deployment
5. **Advanced remote setups**: Explore container orchestration for team environments

## Additional Resources

- [Example Devcontainer Configurations](examples/devcontainer/)
- [Using .devcontainer Configuration](dispatch-devcontainer-config.md)
- [Dispatch Docker Documentation](../../docker/README.md)
- [VSCode Remote Development Documentation](https://code.visualstudio.com/docs/remote/remote-overview)
- [Docker Context Documentation](https://docs.docker.com/engine/context/working-with-contexts/)

Happy remote coding with your secure, AI-powered development environment! 🚀