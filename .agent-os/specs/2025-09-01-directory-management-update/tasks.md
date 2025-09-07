# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-directory-management-update/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

- [x] 1. Core Directory Management Implementation
  - [x] 1.1 Write tests for directory manager functionality
  - [x] 1.2 Create src/lib/server/directory-manager.js with project/session creation
  - [x] 1.3 Implement path validation and sanitization functions
  - [x] 1.4 Add millisecond timestamp generation for sessions
  - [x] 1.5 Update src/lib/server/terminal.js to use new directory structure
  - [x] 1.6 Modify src/lib/server/session-store.js for new metadata format
  - [x] 1.7 Add environment variable support in src/app.js
  - [x] 1.8 Verify all tests pass

- [x] 2. Socket API and Backend Integration
  - [x] 2.1 Write tests for socket handler project operations
  - [x] 2.2 Update src/lib/server/socket-handler.js with project parameter
  - [x] 2.3 Add listProjects event handler
  - [x] 2.4 Implement project filtering for session listing
  - [x] 2.5 Add project validation to attach event
  - [x] 2.6 Verify all tests pass

- [x] 3. Frontend Updates
  - [x] 3.1 Write tests for frontend project context
  - [x] 3.2 Update src/lib/components/Terminal.svelte for project support
  - [x] 3.3 Modify src/routes/+page.svelte with project selector
  - [x] 3.4 Update session pages to show project association
  - [x] 3.5 Verify all tests pass

- [x] 4. Docker and Deployment Configuration
  - [x] 4.1 Write deployment validation tests
  - [x] 4.2 Update Dockerfile with new directory structure
  - [x] 4.3 Create or update docker-compose.yml with volume mounts
  - [x] 4.4 Modify start.sh script for directory initialization
  - [x] 4.5 Test container build and runtime permissions
  - [x] 4.6 Verify all tests pass

- [x] 5. Documentation and Migration
  - [x] 5.1 Update README.md with new directory structure
  - [x] 5.2 Modify CLAUDE.md to reflect project/session changes
  - [x] 5.3 Update package.json scripts if needed
  - [x] 5.4 Test migration procedures
  - [x] 5.5 Verify documentation accuracy
