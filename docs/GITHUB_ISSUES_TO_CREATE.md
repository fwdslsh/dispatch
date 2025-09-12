# GitHub Issues to Create (Triaged from Documentation)

This file contains the GitHub issues that should be created based on the triage of `todos.md`, `refactoring-plan.md`, and `CODEBASE_INCONSISTENCIES_REPORT.md` files.

## Priority 1: Immediate Issues (Should be created first)

### 1. Verify Socket Reconnection Functionality After PR #38
**Labels**: `bug`, `testing`
**Priority**: High

#### Description
The `todos.md` file contains a BUG entry:
> BUG: Reconnect to an active socket with the appropriate session pane/component

This appears to have been addressed by PR #38 which fixed session management issues, but we need to verify that the socket reconnection functionality is working correctly.

#### Tasks
- [ ] Test socket reconnection after network interruption
- [ ] Verify proper session pane association after reconnection  
- [ ] Ensure UI state consistency during reconnection
- [ ] Test on both desktop and mobile views
- [ ] Add automated tests for reconnection scenarios if not already present

#### Acceptance Criteria
- Socket reconnection works seamlessly without user intervention
- Session panes maintain their association with the correct socket after reconnection
- UI shows appropriate loading/reconnecting states
- No data loss or duplication during reconnection
- Tests cover the reconnection scenarios

---

### 2. Implement get-public-url Socket Handler
**Labels**: `enhancement`, `backend`  
**Priority**: High

#### Description
The `PublicUrlDisplay.svelte` component emits a `get-public-url` event but there is no corresponding socket handler in `socket-setup.js`. This is identified as a "Quick Win" in the refactoring plan.

#### Current State
- `PublicUrlDisplay.svelte:17` emits `get-public-url` event
- No handler exists in `src/lib/server/socket-setup.js`
- App.js writes tunnel URL to `<configDir>/tunnel-url.txt` when `ENABLE_TUNNEL=true`

#### Implementation Details
Implement handler in `socket-setup.js` that:
- Reads the file written by `src/app.js` (`<configDir>/tunnel-url.txt`)  
- Returns `{ ok: true, url }` when file exists and contains URL
- Returns `{ ok: false }` when file doesn't exist or is empty
- Includes proper error handling

#### Acceptance Criteria
- [ ] `get-public-url` socket handler implemented
- [ ] Handler reads tunnel URL file correctly
- [ ] Returns proper response format
- [ ] PublicUrlDisplay shows URL when `ENABLE_TUNNEL=true`
- [ ] Error handling for missing/invalid files

---

### 3. Fix SessionSocketManager Type Errors  
**Labels**: `bug`, `typescript`
**Priority**: High

#### Description
Type checking shows multiple errors in `SessionSocketManager.js` due to custom properties being attached directly to Socket.IO socket instances.

#### Current Issues
- Missing type definition for `Socket` return type (line 17)
- Properties `sessionId` and `isActive` don't exist on Socket type (lines 49-50, 54, 59, 73)
- Using custom properties without proper type extensions

#### Solution
- Create proper type definitions for extended Socket properties
- Use WeakMap to store socket metadata instead of attaching properties directly
- Update JSDoc comments with correct types

#### Acceptance Criteria
- [ ] No type errors in SessionSocketManager.js
- [ ] Socket metadata stored in WeakMap instead of direct properties
- [ ] Proper TypeScript/JSDoc type definitions
- [ ] IDE support and type safety restored

---

### 4. Fix Broken Test Imports and Setup
**Labels**: `bug`, `testing`
**Priority**: High

#### Description
Multiple test files have broken imports and setup issues preventing the test suite from running properly.

#### Current Issues
- `tests/services/CommandService.test.js` - Module path incorrect
- `tests/services/DirectoryService.test.js` - Module doesn't exist  
- `tests/viewmodels/*.test.js` - Multiple missing modules
- Mock localStorage objects missing required Storage interface properties
- Mock functions incorrectly typed

#### Tasks
- [ ] Fix import paths in all test files
- [ ] Create missing modules or update imports
- [ ] Fix localStorage mock implementations
- [ ] Ensure test suite runs without errors
- [ ] Update mock functions with correct types

#### Acceptance Criteria
- [ ] All test imports resolve correctly
- [ ] Test suite runs without import errors
- [ ] Mocks implement required interfaces completely
- [ ] No type errors in test files

---

## Priority 2: Medium Priority Issues

### 5. Create ClaudeCommands Component for Slash Command Support
**Labels**: `enhancement`, `frontend`
**Priority**: Medium

#### Description
Create a component that handles parsing and displaying available slash commands for Claude sessions.

#### Features
- Parse available slash commands from JSONL files or WebSocket messages
- Provide toolbar button above message and send controls
- Allow users to select commands and add additional text
- Insert selected command at beginning of message input

#### Acceptance Criteria
- [ ] Component parses slash commands from appropriate sources
- [ ] Toolbar integration above message controls
- [ ] Command selection interface
- [ ] Text insertion functionality
- [ ] Works with existing Claude session flow

---

### 6. Add Quick Launch Terminal Button to Claude Toolbar
**Labels**: `enhancement`, `frontend`
**Priority**: Medium

#### Description
Add a button to the Claude toolbar that opens a PTY terminal session in the current Claude working directory.

#### Requirements
- Button integrated into Claude toolbar UI
- Opens PTY terminal in Claude's current working directory
- Automatically becomes active session on mobile view
- Proper session management integration

#### Acceptance Criteria
- [ ] Button added to Claude toolbar
- [ ] Opens terminal in correct working directory
- [ ] Mobile view handling
- [ ] Session switching works correctly

---

### 7. Replace Socket Event Magic Strings with Constants
**Labels**: `refactor`, `maintenance`
**Priority**: Medium

#### Description
Create a constants file for socket event names to replace magic strings throughout the codebase.

#### Current State
- Event names are hardcoded strings throughout components
- No central definition of socket events
- Risk of typos and inconsistencies

#### Implementation
- Create `src/lib/shared/utils/socket-events.js` with canonical event names
- Replace string literals in all components
- Export constants for both client and server use

#### Acceptance Criteria
- [ ] Constants file created with all socket events
- [ ] All components updated to use constants
- [ ] No remaining magic strings for socket events
- [ ] Server and client use same constants

---

### 8. Add clickOutside Action for Better Event Handling
**Labels**: `enhancement`, `frontend`
**Priority**: Medium  

#### Description
Create a Svelte action for handling clicks outside elements to replace document-level event listeners.

#### Current Issues
- Components use `document.addEventListener('click', ...)` directly
- Potential memory leaks and cleanup issues
- Hard to test document-level listeners

#### Implementation
- Create `src/lib/shared/actions/clickOutside.js`
- Replace document listeners in CommandMenu and other components
- Proper cleanup and testing support

#### Acceptance Criteria
- [ ] clickOutside action implemented
- [ ] CommandMenu updated to use action
- [ ] Other components updated where applicable
- [ ] No remaining document-level click listeners
- [ ] Action is testable

---

## Priority 3: Lower Priority Issues

### 9. Integrate ~/.bash_sessions for Terminal Session Persistence
**Labels**: `enhancement`, `terminal`
**Priority**: Low

#### Description
Add support for resuming previous terminal sessions using ~/.bash_sessions integration.

#### Requirements
- Update terminal sessions to use screen, tmux, or tee for session capture
- Allow browsing and restoring previous sessions
- Session history based on logging tool content

#### Implementation Details
- Integrate with existing session management
- UI for browsing previous sessions
- Session restoration functionality

---

### 10. Add Custom Layout Option for Desktop
**Labels**: `enhancement`, `frontend`, `desktop-only`
**Priority**: Low

#### Description
Add a custom layout option for desktop users to resize and position session viewports.

#### Requirements
- Desktop-only feature
- Resizable session viewports
- Drag-and-drop positioning in session grid
- Layout configuration saved to localStorage

#### Acceptance Criteria
- [ ] Layout option available on desktop only
- [ ] Viewport resizing functionality
- [ ] Drag-and-drop positioning
- [ ] localStorage persistence
- [ ] Responsive design maintained

---

### 11. Add DISPATCH_LOG_LEVEL Environment Variable Gating
**Labels**: `enhancement`, `logging`
**Priority**: Low

#### Description
Reduce console log noise in production by implementing log level gating.

#### Implementation
- Add `DISPATCH_LOG_LEVEL` environment variable support
- Gate existing console.log statements behind log level checks
- Configurable log levels (DEBUG, INFO, WARN, ERROR)

#### Acceptance Criteria
- [ ] Environment variable support added
- [ ] Existing logs gated appropriately
- [ ] Production logs reduced
- [ ] Development logs maintained

---

## Related Documentation
- Source: `docs/todos.md`, `docs/refactoring-plan.md`, `docs/CODEBASE_INCONSISTENCIES_REPORT.md`
- Triage completed as part of issue #44
- All actionable items from documentation have been processed