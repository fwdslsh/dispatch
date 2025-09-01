# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-directory-management-update/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

- [ ] 1. Core Directory Management Implementation
  - [ ] 1.1 Write tests for directory manager functionality
  - [ ] 1.2 Create src/lib/server/directory-manager.js with project/session creation
  - [ ] 1.3 Implement path validation and sanitization functions
  - [ ] 1.4 Add millisecond timestamp generation for sessions
  - [ ] 1.5 Update src/lib/server/terminal.js to use new directory structure
  - [ ] 1.6 Modify src/lib/server/session-store.js for new metadata format
  - [ ] 1.7 Add environment variable support in src/app.js
  - [ ] 1.8 Verify all tests pass

- [ ] 2. Socket API and Backend Integration
  - [ ] 2.1 Write tests for socket handler project operations
  - [ ] 2.2 Update src/lib/server/socket-handler.js with project parameter
  - [ ] 2.3 Add listProjects event handler
  - [ ] 2.4 Implement project filtering for session listing
  - [ ] 2.5 Add project validation to attach event
  - [ ] 2.6 Verify all tests pass

- [ ] 3. Frontend Updates
  - [ ] 3.1 Write tests for frontend project context
  - [ ] 3.2 Update src/lib/components/Terminal.svelte for project support
  - [ ] 3.3 Modify src/routes/+page.svelte with project selector
  - [ ] 3.4 Update session pages to show project association
  - [ ] 3.5 Verify all tests pass

- [ ] 4. Docker and Deployment Configuration
  - [ ] 4.1 Write deployment validation tests
  - [ ] 4.2 Update Dockerfile with new directory structure
  - [ ] 4.3 Create or update docker-compose.yml with volume mounts
  - [ ] 4.4 Modify start.sh script for directory initialization
  - [ ] 4.5 Test container build and runtime permissions
  - [ ] 4.6 Verify all tests pass

- [ ] 5. Documentation and Migration
  - [ ] 5.1 Update README.md with new directory structure
  - [ ] 5.2 Modify CLAUDE.md to reflect project/session changes
  - [ ] 5.3 Update package.json scripts if needed
  - [ ] 5.4 Test migration procedures
  - [ ] 5.5 Verify documentation accuracy