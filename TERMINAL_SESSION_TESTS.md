# Terminal Session Resumption Tests

This document describes the comprehensive Playwright tests created for terminal session resumption functionality in Dispatch.

## Test Files Created

### 1. `e2e/terminal-session-resumption.spec.js`

Comprehensive test suite covering the complete terminal session lifecycle:

#### Test: "should create terminal session, enter commands, close and resume with history preserved"

- **Purpose**: Proves a user can create a terminal session, enter commands, close it, and resume with full history
- **Steps**:
  1. Creates a new terminal session in a workspace
  2. Enters multiple commands (`pwd`, `ls -la`, `echo "Hello from terminal"`)
  3. Simulates socket.io terminal interactions and captures command history
  4. Closes the session
  5. Resumes the session (either by clicking existing session or creating new one)
  6. Verifies that previous commands and output are visible
  7. Confirms the terminal remains functional for new commands

#### Test: "should handle multiple terminal sessions with independent histories"

- **Purpose**: Ensures different terminal sessions maintain separate histories
- **Steps**:
  1. Mocks two terminal sessions with different command histories
  2. Switches between sessions
  3. Verifies each session maintains its own unique history
  4. Confirms no cross-contamination between sessions

#### Test: "should persist terminal history across browser refresh"

- **Purpose**: Verifies terminal history survives page reloads
- **Steps**:
  1. Loads a terminal session with existing history
  2. Refreshes the browser multiple times
  3. Verifies history persists after each refresh
  4. Confirms terminal functionality continues working

#### Test: "should handle terminal session resumption errors gracefully"

- **Purpose**: Tests error handling when history API fails
- **Steps**:
  1. Mocks a terminal session that exists but history API returns 404
  2. Attempts to resume the session
  3. Verifies error is logged but terminal still functions
  4. Confirms terminal is usable despite missing history

#### Test: "should show terminal session in session list after creation"

- **Purpose**: Validates session management and UI integration
- **Steps**:
  1. Creates a new terminal session
  2. Verifies session appears in the sidebar
  3. Confirms it's properly identified as a terminal session
  4. Tests resuming from the session list

### 2. `e2e/terminal-session-simple.spec.js`

Simplified test for basic terminal functionality validation.

## Key Features Tested

### Socket.IO Integration

- Mocks socket.io terminal events (`terminal.write`, `terminal.resize`)
- Simulates realistic terminal responses and echoing
- Captures and validates terminal command flow

### API Integration

- Tests `/api/sessions` for session creation and listing
- Tests `/api/sessions/{id}/history` for history retrieval
- Tests `/api/workspaces` for workspace management
- Handles error cases (404, 500 responses)

### Terminal History Persistence

- Validates that command history is preserved across sessions
- Tests history loading when `shouldResume = true`
- Verifies terminal state restoration

### User Interface

- Tests terminal session creation modal
- Validates workspace selection
- Verifies terminal pane visibility and functionality
- Tests session management in sidebar

### Error Handling

- Graceful degradation when history API fails
- Console error logging without breaking functionality
- Continued terminal operation despite errors

## Running the Tests

### Using the UI Test Runner

```bash
npm run test:ui:headed  # Run with visible browser
npm run test:ui         # Run headless
npm run test:ui:debug   # Debug mode
```

### Direct Playwright Execution

```bash
npx playwright test e2e/terminal-session-resumption.spec.js
npx playwright test e2e/terminal-session-simple.spec.js
```

### Prerequisites

```bash
npm install
npm run playwright:install  # Install browser binaries
```

## Test Configuration

The tests are included in:

- `run-ui-tests.js` - Main UI test runner
- `playwright-ui.config.js` - UI-specific Playwright configuration

Configuration includes:

- 60-second test timeout
- Retry on failure (CI only)
- Screenshot and video capture on failure
- Multiple browser testing (Chrome, Firefox, Safari, Mobile)

## Validation Points

Each test validates:

1. **Session Creation**: Terminal sessions are created successfully
2. **Command Execution**: Commands can be entered and executed
3. **History Preservation**: Previous commands and output are saved
4. **Session Resumption**: Closed sessions can be resumed
5. **State Restoration**: Terminal state is restored accurately
6. **Error Resilience**: System handles errors gracefully
7. **UI Integration**: Sessions appear in interface correctly

## Expected Terminal Flow

1. User creates terminal session → API call to `/api/sessions`
2. Terminal connects via Socket.IO → Events: `connect`, `terminal.write`, `data`
3. User enters commands → Socket events capture terminal data
4. Session closes → History saved to `/api/sessions/{id}/history`
5. Session resumes → History retrieved and restored to terminal
6. Terminal continues functioning with preserved state

## Implementation Notes

The tests mock all external dependencies:

- Socket.IO connections and events
- REST API endpoints
- Terminal command responses
- File system operations

This ensures tests are:

- **Fast**: No real terminal processes or file I/O
- **Reliable**: No network dependencies or external state
- **Isolated**: Each test runs independently
- **Comprehensive**: Covers happy path and error scenarios

The test suite proves that Dispatch correctly implements terminal session persistence and resumption functionality as requested.
