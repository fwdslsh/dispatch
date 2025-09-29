---
title: 'Connect VSCode to Remote Dispatch Containers'
description: 'Learn how to connect VSCode to Dispatch containers running on remote servers with SSH tunneling, Docker contexts, and secure remote access.'
tags: ['vscode', 'devcontainer', 'docker', 'dispatch', 'remote-development', 'ssh']
series: 'Dispatch DevContainer Guide'
published: false
draft: true
---

# Connect VSCode to Remote Dispatch Containers

This guide shows you how to connect VSCode to Dispatch containers running on remote servers. This approach is ideal for team development, cloud-based development environments, and when you need more computational resources than your local machine provides.

## Overview

Connecting VSCode to remote Dispatch containers is ideal when:

- Dispatch is running on a remote server or cloud instance
- You need more computational resources than your local machine provides
- You're sharing a Dispatch instance with team members
- You want to develop from multiple devices while maintaining state
- You need to work with large codebases or datasets that don't fit locally

## Prerequisites

Before connecting to remote Dispatch containers, ensure you have:

- **Visual Studio Code** installed on your local machine
- **SSH access** to the remote server running Dispatch
- **Docker CLI** configured for remote access (optional)
- **Dev Containers extension** for VSCode (`ms-vscode-remote.remote-containers`)
- **Basic familiarity** with SSH, Docker, and remote server administration

### Installing the Dev Containers Extension

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Dev Containers"
4. Install the extension by Microsoft

## Set Up Remote Docker Access

### Step 1: Configure SSH Connection

Set up SSH access to your remote server. Add configuration to `~/.ssh/config`:

```bash
# Add to ~/.ssh/config
Host dispatch-server
    HostName your-server-ip-or-domain
    User your-username
    Port 22
    IdentityFile ~/.ssh/your-private-key
    ServerAliveInterval 60
    ServerAliveCountMax 3
    ControlMaster auto
    ControlPath ~/.ssh/control-%r@%h:%p
    ControlPersist 600
```

Test your SSH connection:

```bash
ssh dispatch-server
```

### Step 2: Configure Docker Context for Remote Access

Set up a Docker context to connect to the remote Docker daemon:

```bash
# Create a new Docker context for the remote server
docker context create dispatch-remote \
  --docker "host=ssh://dispatch-server"

# Use the remote context
docker context use dispatch-remote

# Verify connection to remote Docker
docker ps

# Switch back to local context when needed
docker context use default
```

### Step 3: Start Remote Dispatch Container

Connect to your remote server and start the Dispatch container:

```bash
# SSH into remote server
ssh dispatch-server

# Create directories for persistent storage
mkdir -p ~/dispatch-home ~/dispatch-projects

# Start Dispatch container with proper configuration
docker run -d \
  --name dispatch-remote \
  -p 3030:3030 \
  -e TERMINAL_KEY=your-secure-password \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/dispatch \
  -v ~/dispatch-projects:/workspace \
  --restart unless-stopped \
  fwdslsh/dispatch:latest

# Verify container is running
docker ps | grep dispatch-remote
```

## Connect VSCode to Remote Container

### Option A: Using Docker Context (Recommended)

This method uses Docker contexts for clean remote connection management:

1. **Switch to remote context** on your local machine:

   ```bash
   docker context use dispatch-remote
   ```

2. **Verify remote connection**:

   ```bash
   docker ps
   ```

3. **Open VSCode** and connect:
   - Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac)
   - Type "Dev Containers: Attach to Running Container"
   - Select the `dispatch-remote` container from the list
   - VSCode will connect through the SSH tunnel

4. **Switch back to local context** when done:
   ```bash
   docker context use default
   ```

### Option B: Using SSH Tunnel

This method creates an SSH tunnel to forward the Docker socket:

1. **Create SSH tunnel** to forward Docker socket:

   ```bash
   ssh -nNT -L /var/run/docker.sock:/var/run/docker.sock dispatch-server
   ```

2. **In another terminal**, set the Docker host:

   ```bash
   export DOCKER_HOST=unix:///var/run/docker.sock
   ```

3. **Open VSCode** and attach to container as usual:
   - Press `Ctrl+Shift+P`
   - Type "Dev Containers: Attach to Running Container"
   - Select the container from the list

### Option C: Using VSCode Remote-SSH Extension

This method connects to the remote server first, then to the container:

1. **Install Remote-SSH extension** in VSCode

2. **Connect to remote server**:
   - Press `Ctrl+Shift+P`
   - Type "Remote-SSH: Connect to Host"
   - Select your `dispatch-server`

3. **Once connected to remote server**, open a new VSCode window on the remote server

4. **Attach to container** from the remote VSCode instance:
   - Press `Ctrl+Shift+P`
   - Type "Dev Containers: Attach to Running Container"
   - Select the `dispatch-remote` container

## Access Remote Dispatch Web Interface

To access the Dispatch web interface running on the remote server:

### Method 1: SSH Port Forwarding

```bash
# Create SSH tunnel for web interface
ssh -L 3030:localhost:3030 dispatch-server
```

Then open `http://localhost:3030` in your local browser.

### Method 2: Direct Access (if firewall allows)

If your remote server allows direct access to port 3030:

```bash
# Open in browser (replace with your server's IP/domain)
http://your-server-ip:3030
```

### Method 3: Using VSCode Port Forwarding

When connected to the remote container in VSCode:

1. Open the **Ports** panel in VSCode
2. Click **Forward Port**
3. Enter `3030`
4. VSCode will automatically forward the port and provide a local URL

## Environment Variables for Remote Setup

Configure these environment variables for your remote Dispatch container:

```bash
# Required
TERMINAL_KEY=your-secure-password

# Server configuration
PORT=3030
HOST=0.0.0.0  # Allow connections from any IP

# Optional features
ENABLE_TUNNEL=false  # Usually disabled for remote setups
LT_SUBDOMAIN=your-subdomain

# Directory configuration
DISPATCH_CONFIG_DIR=/home/dispatch/.config/dispatch
WORKSPACES_ROOT=$HOME/workspaces

# Performance tuning for remote access
NODE_OPTIONS=--max-old-space-size=4096
```

## Troubleshooting Remote Connections

### Cannot Connect to Remote Container

**Problem**: VSCode cannot find or connect to remote containers.

**Solutions**:

1. **Verify Docker context**:

   ```bash
   docker context ls
   docker context use dispatch-remote
   docker ps
   ```

2. **Test SSH connection**:

   ```bash
   ssh dispatch-server "docker ps"
   ```

3. **Check Docker daemon** on remote server:

   ```bash
   ssh dispatch-server "sudo systemctl status docker"
   ```

4. **Verify firewall settings** on remote server:
   ```bash
   # Check if Docker daemon port is accessible
   ssh dispatch-server "sudo netstat -tlnp | grep :2376"
   ```

### Permission Issues with Remote Containers

**Problem**: Cannot write files or access directories in remote container.

**Solutions**:

1. **Match user IDs** between local and remote:

   ```bash
   # Check local user ID
   id

   # Check remote user ID
   ssh dispatch-server "id"

   # Start container with correct UID/GID
   docker run --user $(id -u):$(id -g) ...
   ```

2. **Fix ownership** of mounted volumes:

   ```bash
   ssh dispatch-server "sudo chown -R \$(id -u):\$(id -g) ~/dispatch-home ~/dispatch-projects"
   ```

3. **Check directory permissions**:
   ```bash
   ssh dispatch-server "ls -la ~/dispatch-home ~/dispatch-projects"
   ```

### SSH Connection Drops

**Problem**: SSH connection to remote server drops frequently.

**Solutions**:

1. **Configure SSH keep-alive** in `~/.ssh/config`:

   ```
   Host dispatch-server
       ServerAliveInterval 60
       ServerAliveCountMax 3
       TCPKeepAlive yes
   ```

2. **Use SSH multiplexing** for stable connections:

   ```
   Host dispatch-server
       ControlMaster auto
       ControlPath ~/.ssh/control-%r@%h:%p
       ControlPersist 600
   ```

3. **Use persistent SSH connection**:
   ```bash
   # Start persistent connection in background
   ssh -fN dispatch-server
   ```

### Web Interface Not Accessible

**Problem**: Cannot access Dispatch web interface on remote server.

**Solutions**:

1. **Create SSH tunnel**:

   ```bash
   ssh -L 3030:localhost:3030 dispatch-server
   ```

2. **Check container port binding**:

   ```bash
   ssh dispatch-server "docker port dispatch-remote"
   ```

3. **Verify container is running**:

   ```bash
   ssh dispatch-server "docker ps | grep dispatch"
   ```

4. **Check firewall rules**:
   ```bash
   ssh dispatch-server "sudo ufw status"
   # or
   ssh dispatch-server "sudo iptables -L"
   ```

### Slow Performance

**Problem**: Remote container feels slow or unresponsive.

**Solutions**:

1. **Check network latency**:

   ```bash
   ping your-server-ip
   ```

2. **Use SSH compression**:

   ```
   Host dispatch-server
       Compression yes
       CompressionLevel 6
   ```

3. **Optimize Docker for remote access**:

   ```bash
   # Start container with performance optimizations
   docker run -d \
     --name dispatch-remote \
     --memory=2g \
     --cpus=2 \
     --shm-size=512m \
     fwdslsh/dispatch:latest
   ```

4. **Use local caching** for frequently accessed files

## Example Remote Workflows

### Team Development Setup

1. **Shared Server**: Set up Dispatch on a shared development server
2. **Team Access**: Each team member connects their local VSCode to the remote container
3. **Shared Environment**: Everyone works in the same consistent environment
4. **AI Assistance**: Use Dispatch's AI agents safely in the isolated remote container
5. **Collaboration**: Share terminal sessions and development workflows

### Multi-Device Development

1. **Primary Setup**: Connect from your main development machine
2. **Secondary Access**: Connect from laptop, tablet, or other devices
3. **State Persistence**: All work is saved on the remote server
4. **Seamless Switching**: Switch between devices without losing context

### Cloud Development Environment

1. **Cloud Instance**: Set up Dispatch on AWS, Google Cloud, or Azure
2. **Scalable Resources**: Use cloud resources for compute-intensive tasks
3. **Global Access**: Access your development environment from anywhere
4. **Cost Optimization**: Scale resources up/down based on needs

## Security Considerations for Remote Access

### SSH Security

- **Use SSH keys** instead of passwords for authentication
- **Configure SSH keys with passphrases** for additional security
- **Use SSH agent** for secure key management
- **Limit SSH access** with proper firewall rules and fail2ban
- **Use non-standard SSH ports** to reduce automated attacks

### Network Security

- **Use VPN** for additional network security when possible
- **Configure firewall rules** to limit access to necessary ports only
- **Use SSH tunneling** instead of exposing Dispatch ports directly
- **Monitor access logs** for suspicious activity

### Container Security

- **Run containers as non-root user** with proper UID/GID mapping
- **Use volume mounts** to control what's accessible to AI agents
- **Regularly update** the Dispatch container image
- **Monitor resource usage** to prevent abuse

### Access Control

- **Use strong authentication keys** for Dispatch web interface
- **Implement proper user management** on the remote server
- **Use SSH certificate authentication** for team environments
- **Regularly rotate credentials** and access keys

## Best Practices for Remote Development

### Connection Management

1. **Use Docker contexts** for clean remote connection management
2. **Document connection procedures** for team members
3. **Set up SSH multiplexing** to avoid repeated authentication
4. **Use named containers** for easy identification and connection
5. **Monitor connection health** and implement reconnection logic

### Performance Optimization

1. **Use local Docker contexts** when possible for faster operations
2. **Configure SSH compression** for slow network connections
3. **Close unused connections** to free up server resources
4. **Monitor network usage** when working with large files
5. **Use incremental syncing** for large project files

### Team Collaboration

1. **Standardize container names** across team environments
2. **Share Docker context configurations** through team documentation
3. **Use consistent volume mount paths** for project compatibility
4. **Document remote server access procedures** and troubleshooting steps
5. **Implement proper backup strategies** for remote development environments

### Resource Management

1. **Monitor server resources** (CPU, memory, disk space)
2. **Set container resource limits** to prevent one user from consuming all resources
3. **Implement cleanup procedures** for unused containers and volumes
4. **Scale server resources** based on team size and usage patterns

## Advanced Remote Setups

### Load Balancing Multiple Servers

For large teams, consider load balancing across multiple Dispatch servers:

```bash
# Set up multiple Docker contexts
docker context create dispatch-server-1 --docker "host=ssh://server1"
docker context create dispatch-server-2 --docker "host=ssh://server2"

# Use different contexts for different team members or projects
```

### Container Orchestration

For production environments, consider using container orchestration:

```yaml
# docker-compose.yml for remote deployment
version: '3.8'
services:
  dispatch:
    image: fwdslsh/dispatch:latest
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    networks:
      - dispatch-network
```

### Monitoring and Logging

Set up monitoring for your remote Dispatch instances:

```bash
# Monitor container health
docker stats dispatch-remote

# View container logs
docker logs -f dispatch-remote

# Set up log rotation
docker run --log-driver=json-file --log-opt max-size=10m --log-opt max-file=3
```

## Next Steps

After setting up remote Dispatch container access:

1. **Explore advanced SSH configurations** for better security and performance
2. **Set up monitoring and alerting** for your remote development environment
3. **Implement backup strategies** for important development data
4. **Consider container orchestration** for team environments
5. **Optimize for your specific network and security requirements**

## Additional Resources

- [Connect to Local Containers](dispatch-devcontainer-attach.md)
- [Using .devcontainer Configuration](dispatch-devcontainer-config.md)
- [Example Devcontainer Configurations](examples/devcontainer/)
- [VSCode Remote Development Documentation](https://code.visualstudio.com/docs/remote/remote-overview)
- [Docker Context Documentation](https://docs.docker.com/engine/context/working-with-contexts/)
- [SSH Configuration Best Practices](https://wiki.mozilla.org/Security/Guidelines/OpenSSH)

Happy remote development with your secure, AI-powered environment! 🌐🚀
