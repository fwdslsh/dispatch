# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-directory-management-update/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

- [X] 1. Core Directory Management Implementation
  - [X] 1.1 Write tests for directory manager functionality
  - [X] 1.2 Create src/lib/server/directory-manager.js with project/session creation
  - [X] 1.3 Implement path validation and sanitization functions
  - [X] 1.4 Add millisecond timestamp generation for sessions
  - [X] 1.5 Update src/lib/server/terminal.js to use new directory structure
  - [X] 1.6 Modify src/lib/server/session-store.js for new metadata format
  - [X] 1.7 Add environment variable support in src/app.js
  - [X] 1.8 Verify all tests pass

- [X] 2. Socket API and Backend Integration
  - [X] 2.1 Write tests for socket handler project operations
  - [X] 2.2 Update src/lib/server/socket-handler.js with project parameter
  - [X] 2.3 Add listProjects event handler
  - [X] 2.4 Implement project filtering for session listing
  - [X] 2.5 Add project validation to attach event
  - [X] 2.6 Verify all tests pass

- [X] 3. Frontend Updates
  - [X] 3.1 Write tests for frontend project context
  - [X] 3.2 Update src/lib/components/Terminal.svelte for project support
  - [X] 3.3 Modify src/routes/+page.svelte with project selector
  - [X] 3.4 Update session pages to show project association
  - [X] 3.5 Verify all tests pass

- [X] 4. Docker and Deployment Configuration
  - [X] 4.1 Write deployment validation tests
  - [X] 4.2 Update Dockerfile with new directory structure
  - [X] 4.3 Create or update docker-compose.yml with volume mounts
  - [X] 4.4 Modify start.sh script for directory initialization
  - [X] 4.5 Test container build and runtime permissions
  - [X] 4.6 Verify all tests pass

- [X] 5. Documentation and Migration
  - [X] 5.1 Update README.md with new directory structure
  - [X] 5.2 Modify CLAUDE.md to reflect project/session changes
  - [X] 5.3 Update package.json scripts if needed
  - [X] 5.4 Test migration procedures
  - [X] 5.5 Verify documentation accuracy