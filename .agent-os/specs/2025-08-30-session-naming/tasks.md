# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-30-session-naming/spec.md

> Created: 2025-08-30
> Status: Ready for Implementation

## Tasks

- [ ] 1. Backend Session Naming Infrastructure
  - [ ] 1.1 Write tests for name validation utilities
  - [ ] 1.2 Implement name validation function (length, characters, sanitization)
  - [ ] 1.3 Write tests for session storage with names
  - [ ] 1.4 Extend session-store.js to handle custom names and conflict resolution
  - [ ] 1.5 Write tests for symlink management
  - [ ] 1.6 Implement symlink creation/cleanup in TerminalManager
  - [ ] 1.7 Verify all backend tests pass

- [ ] 2. Socket.IO API Extensions
  - [ ] 2.1 Write tests for extended 'create' event with name parameter
  - [ ] 2.2 Update socket-handler.js to accept name in create event
  - [ ] 2.3 Write tests for new 'rename' event
  - [ ] 2.4 Implement rename event handler with validation
  - [ ] 2.5 Write tests for sessions-updated broadcast with names
  - [ ] 2.6 Update session broadcasts to include names
  - [ ] 2.7 Verify all Socket.IO tests pass

- [ ] 3. Frontend Session Creation UI
  - [ ] 3.1 Write tests for session creation form with name input
  - [ ] 3.2 Add name input field to session creation component
  - [ ] 3.3 Write tests for name validation on frontend
  - [ ] 3.4 Implement client-side name validation with user feedback
  - [ ] 3.5 Write tests for session creation with custom names
  - [ ] 3.6 Update session creation flow to send names to backend
  - [ ] 3.7 Verify all session creation tests pass

- [ ] 4. Session List Management UI
  - [ ] 4.1 Write tests for session list with name display
  - [ ] 4.2 Update session list component to show custom names
  - [ ] 4.3 Write tests for inline name editing functionality
  - [ ] 4.4 Implement inline editing UI with save/cancel actions
  - [ ] 4.5 Write tests for rename Socket.IO integration
  - [ ] 4.6 Connect rename UI to Socket.IO rename event
  - [ ] 4.7 Verify all session list tests pass

- [ ] 5. Integration and Polish
  - [ ] 5.1 Write end-to-end tests for complete naming workflow
  - [ ] 5.2 Test session naming with both Claude and shell modes
  - [ ] 5.3 Test file system symlink creation and cleanup
  - [ ] 5.4 Test name conflict resolution and user feedback
  - [ ] 5.5 Verify session persistence across server restarts
  - [ ] 5.6 Test mobile responsiveness of naming UI
  - [ ] 5.7 Verify all integration tests pass

The tasks are ordered to build foundational backend infrastructure first, then extend the API, followed by frontend implementation, and finally integration testing.