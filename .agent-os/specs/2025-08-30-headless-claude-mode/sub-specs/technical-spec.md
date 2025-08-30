# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-30-headless-claude-mode/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Technical Requirements

### Claude CLI Integration

- **JSON Output Format**: Integrate Claude CLI with `--output-format=json` flag for structured responses
- **Resume Functionality**: Support `--resume` flag to continue conversations across API calls
- **Session Persistence**: Maintain conversation context between headless API requests
- **Command Execution**: Execute Claude commands programmatically without interactive terminal

### Session Manager Enhancements

- **Headless Mode Support**: Extend TerminalManager class to support non-interactive Claude sessions
- **Mode Detection**: Add `headless-claude` mode alongside existing `claude` and `shell` modes
- **Session State Tracking**: Track conversation state and context for resume functionality
- **Concurrent Sessions**: Support multiple headless Claude sessions running simultaneously

### Input/Output Buffer Management

- **JSON Response Parsing**: Parse Claude CLI JSON responses for structured data extraction
- **Buffer Accumulation**: Accumulate partial JSON responses until complete response received
- **Stream Processing**: Handle streaming responses from Claude CLI for real-time updates
- **Error Response Handling**: Parse and categorize JSON error responses from Claude CLI

### Error Handling and Timeout Management

- **Claude CLI Error Handling**: Catch and process Claude CLI exit codes and error messages
- **Timeout Configuration**: Implement configurable timeouts for Claude CLI operations
- **Retry Logic**: Add retry mechanisms for transient Claude CLI failures
- **Graceful Degradation**: Fall back to standard Claude mode if headless mode fails

### PTY and Socket.IO Integration

- **Socket Event Extensions**: Add new socket events for headless Claude operations
- **Non-TTY Process Spawning**: Spawn Claude CLI without PTY for headless operations
- **Response Streaming**: Stream JSON responses through Socket.IO to connected clients
- **Session Lifecycle Management**: Integrate headless sessions with existing session cleanup

## Approach

### Architecture Overview

```
Client Request → Socket.IO → Session Manager → Claude CLI (JSON) → Response Parser → Client
```

### Implementation Strategy

1. **TerminalManager Extension**: Add headless mode support to existing TerminalManager class
2. **JSON Response Handler**: Create dedicated handler for parsing Claude CLI JSON responses
3. **Buffer Management**: Implement streaming buffer for accumulating partial responses
4. **Socket Integration**: Extend existing socket event handlers for headless operations
5. **Error Mapping**: Map Claude CLI errors to appropriate HTTP status codes and messages

### Key Components

- **HeadlessClaudeSession**: New class extending base session for JSON-based interactions
- **JSONResponseParser**: Utility class for parsing and validating Claude CLI JSON output
- **BufferManager**: Stream processing utility for handling partial JSON responses
- **TimeoutManager**: Configurable timeout handling for Claude CLI operations

### Database Schema Changes

No database schema changes required. Session metadata will be stored in existing JSON-based session storage with additional fields:

- `mode`: Extended to include `headless-claude` option
- `conversationId`: Track Claude conversation context for resume functionality
- `lastActivity`: Timestamp for timeout management
- `bufferState`: Store partial response state for resume operations

## External Dependencies

### Required npm Packages

```json
{
  "express": "^4.18.0",
  "body-parser": "^1.20.0",
  "cors": "^2.8.5",
  "ajv": "^8.12.0"
}
```

### Package Justifications

- **body-parser**: Parse JSON request bodies for REST API endpoints
- **cors**: Handle cross-origin requests for headless API access
- **ajv**: JSON schema validation for Claude CLI response parsing
- **express** (already present): HTTP server for REST API endpoints

### System Dependencies

- **Claude CLI**: Must be installed with JSON output support (`@anthropic-ai/claude-cli@latest`)
- **Node.js**: Requires Node.js 18+ for enhanced JSON parsing features
- **Process Management**: Requires child_process spawn capabilities for non-TTY Claude execution

### Optional Enhancements

- **redis**: Session state caching for distributed deployments
- **winston**: Enhanced logging for headless operation debugging
- **joi**: Alternative to ajv for response validation
- **axios**: HTTP client for potential webhook integrations

### Configuration Requirements

New environment variables needed:

- `CLAUDE_HEADLESS_TIMEOUT`: Timeout for Claude CLI operations (default: 30000ms)
- `CLAUDE_MAX_BUFFER_SIZE`: Maximum buffer size for JSON responses (default: 1MB)
- `CLAUDE_RETRY_ATTEMPTS`: Number of retry attempts for failed operations (default: 3)
- `ENABLE_HEADLESS_API`: Enable REST API endpoints for headless access (default: false)

### Runtime Considerations

- **Memory Usage**: JSON buffer management may increase memory usage for large responses
- **Process Limits**: Each headless session spawns separate Claude CLI process
- **Network Dependencies**: Requires stable network connection for Claude API access
- **File System**: May require temporary file storage for large conversation contexts