# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-13-claude-commands-communication/spec.md

> Created: 2025-09-13
> Status: Ready for Implementation

## Tasks

- [ ] 1. Fix Socket.IO Session Routing in ClaudeSessionManager
  - [ ] 1.1 Write tests for session ID routing behavior
  - [ ] 1.2 Update _fetchAndEmitSupportedCommands() to use consistent session ID format
  - [ ] 1.3 Ensure both Claude session ID and app session ID are handled properly
  - [ ] 1.4 Test Socket.IO event emission with correct session identifiers
  - [ ] 1.5 Verify all tests pass

- [ ] 2. Enhance Socket.IO Session Status Handler
  - [ ] 2.1 Write tests for session.status handler with Claude commands
  - [ ] 2.2 Add Claude command lookup to existing session.status handler in socket-setup.js
  - [ ] 2.3 Include availableCommands field in session.status responses
  - [ ] 2.4 Handle Claude session identification and command retrieval
  - [ ] 2.5 Test session.status requests return proper command data
  - [ ] 2.6 Verify all tests pass

- [ ] 3. Add Reconnection Command Discovery Support
  - [ ] 3.1 Write tests for command discovery on reconnection scenarios
  - [ ] 3.2 Add refreshCommands() method to ClaudeSessionManager
  - [ ] 3.3 Trigger command discovery when clients reconnect to existing sessions
  - [ ] 3.4 Handle edge cases where commands may not be cached
  - [ ] 3.5 Test reconnection scenarios with command availability
  - [ ] 3.6 Verify all tests pass

- [ ] 4. Implement Client Session ID Normalization
  - [ ] 4.1 Write tests for session ID normalization logic
  - [ ] 4.2 Add normalizeSessionId() function in ClaudeCommands.svelte
  - [ ] 4.3 Update tools.list event handler to handle multiple ID formats
  - [ ] 4.4 Update session.status query to use normalized IDs
  - [ ] 4.5 Test client receives commands regardless of server ID format
  - [ ] 4.6 Verify all tests pass