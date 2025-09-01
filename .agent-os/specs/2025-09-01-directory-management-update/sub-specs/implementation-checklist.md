# Implementation Checklist

This checklist details the specific files to modify and create for the directory management update.

## Backend Implementation

### Core Directory Management
- [ ] Create `src/lib/server/directory-manager.js` - New file for centralized directory operations
  - [ ] Implement `createProject(name, metadata)`
  - [ ] Implement `createSession(projectId, metadata)` with millisecond timestamps
  - [ ] Implement `validatePath(path, boundary)`
  - [ ] Implement `sanitizeProjectName(name)`
  - [ ] Add reserved names validation

### Terminal Manager Updates
- [ ] Update `src/lib/server/terminal.js`
  - [ ] Modify session directory creation to use new structure
  - [ ] Update HOME directory to project root
  - [ ] Add project context to session creation
  - [ ] Implement millisecond timestamp generation

### Session Store Updates  
- [ ] Update `src/lib/server/session-store.js`
  - [ ] Move sessions.json to DISPATCH_CONFIG_DIR
  - [ ] Add project registry management
  - [ ] Update session metadata structure
  - [ ] Add project association to sessions

### Socket Handler Updates
- [ ] Update `src/lib/server/socket-handler.js`
  - [ ] Add project parameter to create event
  - [ ] Add listProjects event handler
  - [ ] Update session listing to support project filtering
  - [ ] Add project validation to attach event

### Application Entry Point
- [ ] Update `src/app.js`
  - [ ] Add DISPATCH_CONFIG_DIR environment variable support
  - [ ] Add DISPATCH_PROJECTS_DIR environment variable support
  - [ ] Initialize directory structure on startup
  - [ ] Add directory existence validation

## Frontend Implementation

### Main Interface
- [ ] Update `src/routes/+page.svelte`
  - [ ] Add project selector component
  - [ ] Display current project context
  - [ ] Update session creation to include project

### Terminal Component
- [ ] Update `src/lib/components/Terminal.svelte`
  - [ ] Pass project context to socket events
  - [ ] Display project information in terminal header

## Docker Configuration

### Dockerfile
- [ ] Update `Dockerfile`
  - [ ] Create /etc/dispatch directory
  - [ ] Create /var/lib/dispatch/projects directory
  - [ ] Set appropriate permissions for appuser
  - [ ] Add environment variable defaults

### Docker Compose
- [ ] Update `docker-compose.yml` (if exists, otherwise create)
  - [ ] Add volume mount for config directory
  - [ ] Add volume mount for projects directory
  - [ ] Set environment variables
  - [ ] Document volume persistence

### Scripts
- [ ] Update `start.sh`
  - [ ] Add directory initialization logic
  - [ ] Support environment variables
  - [ ] Add validation checks

## Documentation Updates

### Core Documentation
- [ ] Update `README.md`
  - [ ] Document new directory structure
  - [ ] Add environment variable documentation
  - [ ] Include Docker volume examples
  - [ ] Add quick start with projects

### Claude Integration
- [ ] Update `CLAUDE.md`
  - [ ] Document project and session structure
  - [ ] Update development commands
  - [ ] Add project management section
  - [ ] Update file structure diagram

### Package Configuration
- [ ] Update `package.json`
  - [ ] Update scripts if directory initialization needed

## Testing Considerations

### Manual Testing Checklist
- [ ] Test project creation with various names
- [ ] Verify session creation with millisecond timestamps
- [ ] Test concurrent session creation for collision prevention
- [ ] Verify path traversal prevention
- [ ] Test reserved name blocking
- [ ] Verify Docker volume persistence
- [ ] Test environment variable configuration
- [ ] Verify metadata file creation and updates

### Edge Cases to Verify
- [ ] Project names with special characters are sanitized
- [ ] Long project names are truncated appropriately
- [ ] Sessions in different projects are isolated
- [ ] Configuration persists across container restarts
- [ ] Proper error messages for invalid operations