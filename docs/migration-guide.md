# Migration Guide

Guide for migrating existing Dispatch deployments to the new directory management structure.

## Pre-Migration Checklist

- [ ] Backup existing sessions and data
- [ ] Document current TERMINAL_KEY and configuration
- [ ] Note any custom volume mounts or paths
- [ ] Identify active sessions that need preservation

## Migration Path

### Option 1: Fresh Deployment (Recommended)

For deployments where session history is not critical:

1. **Stop existing container**
   ```bash
   docker stop dispatch-container
   ```

2. **Update to new image**
   ```bash
   docker pull dispatch:latest
   ```

3. **Start with new volume structure**
   ```bash
   docker run -d \
     --name dispatch-new \
     -e TERMINAL_KEY=your-key \
     -v dispatch-config:/etc/dispatch \
     -v dispatch-projects:/var/lib/dispatch/projects \
     -p 3030:3030 \
     dispatch:latest
   ```

### Option 2: Manual Migration

For deployments requiring session preservation:

1. **Export existing sessions**
   ```bash
   docker cp dispatch-container:/tmp/dispatch-sessions/sessions.json ./backup-sessions.json
   ```

2. **Stop and remove old container**
   ```bash
   docker stop dispatch-container
   docker rm dispatch-container
   ```

3. **Create new directory structure locally**
   ```bash
   mkdir -p ./dispatch-migration/config
   mkdir -p ./dispatch-migration/projects/default/sessions
   mkdir -p ./dispatch-migration/projects/default/workspace
   mkdir -p ./dispatch-migration/projects/default/.dispatch
   ```

4. **Create default project metadata**
   ```json
   # ./dispatch-migration/projects/default/.dispatch/metadata.json
   {
     "id": "default-project",
     "name": "default",
     "displayName": "Default Project",
     "description": "Migrated sessions from previous deployment",
     "created": "2025-09-01T00:00:00.000Z",
     "modified": "2025-09-01T00:00:00.000Z",
     "tags": ["migrated"],
     "settings": {
       "defaultShell": "/bin/bash"
     }
   }
   ```

5. **Migrate sessions metadata**
   - Copy backup-sessions.json to `./dispatch-migration/config/projects.json`
   - Update session paths to reference new structure

6. **Start new container with migrated data**
   ```bash
   docker run -d \
     --name dispatch \
     -e TERMINAL_KEY=your-key \
     -v $(pwd)/dispatch-migration/config:/etc/dispatch \
     -v $(pwd)/dispatch-migration/projects:/var/lib/dispatch/projects \
     -p 3030:3030 \
     dispatch:latest
   ```

## Environment Variable Migration

### Old Configuration
```bash
# Previous environment variables
PTY_ROOT=/tmp/dispatch-sessions
TERMINAL_KEY=your-secret-key
```

### New Configuration
```bash
# New environment variables
DISPATCH_CONFIG_DIR=/etc/dispatch          # or ~/.config/dispatch
DISPATCH_PROJECTS_DIR=/var/lib/dispatch/projects  # or ~/dispatch-projects
TERMINAL_KEY=your-secret-key               # unchanged
PTY_MODE=claude                            # unchanged if using Claude
```

## Docker Compose Migration

### Old docker-compose.yml
```yaml
version: '3'
services:
  dispatch:
    image: dispatch
    environment:
      - TERMINAL_KEY=secret
      - PTY_ROOT=/sessions
    volumes:
      - ./sessions:/sessions
```

### New docker-compose.yml
```yaml
version: '3'
services:
  dispatch:
    image: dispatch:latest
    environment:
      - TERMINAL_KEY=secret
      - DISPATCH_CONFIG_DIR=/etc/dispatch
      - DISPATCH_PROJECTS_DIR=/var/lib/dispatch/projects
    volumes:
      - dispatch-config:/etc/dispatch
      - dispatch-projects:/var/lib/dispatch/projects
    ports:
      - "3030:3030"

volumes:
  dispatch-config:
  dispatch-projects:
```

## Verification Steps

After migration, verify the deployment:

1. **Check directory structure**
   ```bash
   docker exec dispatch ls -la /etc/dispatch
   docker exec dispatch ls -la /var/lib/dispatch/projects
   ```

2. **Test project creation**
   - Connect to web interface
   - Create a new session
   - Verify it appears in correct project directory

3. **Validate metadata files**
   ```bash
   docker exec dispatch cat /etc/dispatch/projects.json
   ```

4. **Test session isolation**
   - Create sessions in different projects
   - Verify they have separate working directories

## Rollback Plan

If migration fails:

1. **Keep old container image**
   ```bash
   docker tag dispatch:latest dispatch:backup
   ```

2. **Restore from backup**
   ```bash
   docker run -d \
     --name dispatch-rollback \
     -e TERMINAL_KEY=your-key \
     -v ./backup-sessions:/tmp/dispatch-sessions \
     dispatch:backup
   ```

## Common Issues

### Permission Denied Errors
- Ensure appuser (uid 10001) has write permissions to mounted volumes
- Fix: `chown -R 10001:10001 /path/to/volumes`

### Sessions Not Appearing
- Check DISPATCH_CONFIG_DIR is correctly set
- Verify projects.json exists and is valid JSON

### Path Traversal Blocked
- New validation prevents `../` in paths
- Update any scripts using relative paths

## Support

For migration assistance:
- Review logs: `docker logs dispatch`
- Check diagnostics: `docker exec dispatch ls -la /var/lib/dispatch/projects`
- Enable debug mode: Set `DISPATCH_LOG_LEVEL=debug`