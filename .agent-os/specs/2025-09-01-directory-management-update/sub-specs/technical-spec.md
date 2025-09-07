# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-directory-management-update/spec.md

## Technical Requirements

### Directory Structure Implementation

- Modify `src/lib/server/terminal.js` to create project and session directories according to the new structure
- Update session creation to use millisecond timestamps: `YYYY-MM-DD-HHMMSS-SSS`
- Create `.dispatch` metadata directory within each project with `project.json`, `sessions.json`, and `metadata.json`
- Implement `workspace/` directory for persistent files and `sessions/` for temporary workspaces
- Update HOME directory assignment to use project root instead of session directory

### Path Validation System

- Implement path sanitization function to normalize project names (lowercase, alphanumeric with hyphens)
- Add boundary validation to ensure all paths remain within DISPATCH_PROJECTS_DIR
- Create reserved names list blocking system directories like `.dispatch`, `CON`, `PRN`, etc.
- Enforce character restrictions allowing only alphanumeric, hyphens, and underscores
- Implement path length limits (255 chars for names, 4096 for full paths)

### Environment Variable Support

- Add DISPATCH_CONFIG_DIR support with default `~/.config/dispatch` or `/etc/dispatch`
- Add DISPATCH_PROJECTS_DIR support with default `~/dispatch-projects` or `/var/lib/dispatch/projects`
- Update `src/app.js` to respect these environment variables
- Modify session store to save configuration in DISPATCH_CONFIG_DIR
- Update Docker entrypoint scripts to pass through these variables

### Session Management Updates

- Modify `src/lib/server/session-store.js` to implement the new metadata structure
- Add project registry management in `${DISPATCH_CONFIG_DIR}/projects.json`
- Update session metadata to include project association
- Implement session discovery with chronological listing and status filtering
- Add project metadata including id, name, displayName, description, owner, created, modified, tags

### Docker Configuration

- Update Dockerfile to create default directories at `/etc/dispatch` and `/var/lib/dispatch/projects`
- Modify docker-compose.yml to include volume mounts for both config and projects directories
- Update container user permissions to allow writing to designated directories
- Add environment variable defaults in Docker configuration

### API and Socket Updates

- Update Socket.IO `create` event to accept project parameter
- Modify `attach` event to validate project context
- Add new `listProjects` event for project discovery
- Update `list` event to optionally filter by project
- Implement project metadata CRUD operations

### Frontend Updates

- Update Terminal.svelte to handle project-based session creation

### Documentation Updates

- Update README.md with new directory structure and environment variables
- Modify CLAUDE.md to reflect new session and project management
- Update Docker documentation with volume mount examples
- Add migration guide for existing deployments

## Performance Criteria

- Project creation must complete within 100ms
- Session creation with millisecond timestamps must prevent collisions under high concurrency
- Path validation must not add more than 5ms latency to operations
- Metadata operations must handle 10,000+ sessions efficiently
