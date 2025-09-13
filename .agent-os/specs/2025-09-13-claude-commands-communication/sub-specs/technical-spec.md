# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-13-claude-commands-communication/spec.md

## Current Implementation Analysis

### Existing Command Discovery System

The system **already has a command discovery implementation** that is currently working:

**Server-Side (ClaudeSessionManager.js:445-551)**:
- `_fetchAndEmitSupportedCommands()` method fires when Claude sessions are created (line 150)
- Uses Claude Code SDK's `query.supportedCommands()` API to fetch available commands
- Emits two Socket.IO events: `tools.list` and `session.status` with command data
- Has caching mechanism with 5-minute TTL to avoid repeated CLI calls
- Emits to both Claude session ID and app session ID if available

**Client-Side (ClaudeCommands.svelte:138-310)**:
- Listens for `tools.list` Socket.IO event to receive commands
- Queries `session.status` on mount to get existing commands
- Caches commands in localStorage per workspace
- Has sophisticated command parsing from Claude message responses
- Renders commands in dropdown menu with `/` button trigger

### Socket.IO Events Already Implemented

1. **`tools.list`** - Server → Client command list broadcast
2. **`session.status`** - Client ↔ Server session state with `availableCommands` field

## Identified Issues

### Issue 1: Socket.IO Event Routing Mismatch
**Problem**: Session ID routing between server and client is inconsistent.

**Technical Details**:
- Server emits with `claudeSessionId` (numeric: "1", "2", etc.) from `ClaudeSessionManager.js:454`
- Server also emits with `appSessionId` if available from `ClaudeSessionManager.js:461`
- Client expects `sessionId` matching its session identifier in `ClaudeCommands.svelte:148-160`
- Session ID format mismatches cause client to ignore server events

### Issue 2: Missing Socket.IO Handler Registration
**Problem**: No server-side handler for client `session.status` requests in Socket.IO setup.

**Technical Details**:
- Client emits `session.status` in `ClaudeCommands.svelte:262`
- Server `socket-setup.js:243` has `session.status` handler but missing `availableCommands` field
- Handler doesn't query Claude sessions for command data - only returns basic session info

### Issue 3: Commands Not Persisting Across Reconnects
**Problem**: Commands are not reliably available when clients reconnect to existing sessions.

**Technical Details**:
- `_fetchAndEmitSupportedCommands()` only fires on session creation
- Reconnecting clients don't trigger command discovery
- localStorage cache may be stale or empty

## Required Technical Changes

### 1. Fix Socket.IO Session Routing
**File**: `src/lib/server/claude/ClaudeSessionManager.js:454-470`
```javascript
// Ensure consistent session ID format in emit calls
this.io.emit('tools.list', {
  sessionId: sessionData.appSessionId || claudeSessionId,
  commands: cached.commands
});
```

### 2. Enhance Socket.IO Session Status Handler
**File**: `src/lib/server/socket-setup.js:243-286`
```javascript
// Add Claude commands lookup to session.status handler
const { sessionManager, sessions, claude } = getServices();
const session = sessionManager.getSession(data.sessionId);
if (session && session.type === 'claude') {
  const commands = claude.getCachedCommands(data.sessionId);
  callback({
    success: true,
    activityState,
    hasPendingMessages,
    availableCommands: commands || [],
    sessionInfo: session
  });
}
```

### 3. Add Reconnection Command Discovery
**File**: `src/lib/server/claude/ClaudeSessionManager.js`
```javascript
// Add method to refresh commands for existing sessions
async refreshCommands(sessionId) {
  const session = this.sessions.get(sessionId);
  if (session) {
    return this._fetchAndEmitSupportedCommands(sessionId, session);
  }
}
```

### 4. Client Session ID Normalization
**File**: `src/lib/components/ClaudeCommands.svelte:148-160`
```javascript
// Handle multiple session ID formats from server
const normalizeSessionId = (id) => String(id).replace(/^claude_/, '');
const payloadId = normalizeSessionId(payload.sessionId);
const ourId = normalizeSessionId(sessionId);
```

## Integration Points

- **ClaudeSessionManager**: Commands discovery and caching (lines 445-551)
- **socket-setup.js**: Socket.IO event handling (line 243)
- **ClaudeCommands.svelte**: Client-side command management (lines 138-310)
- **SessionSocketManager.js**: Session lifecycle management (line 230)

## Testing Strategy

1. **Session Creation**: Verify commands are emitted on new Claude sessions
2. **Reconnection**: Test commands available when reconnecting to existing sessions
3. **Session ID Matching**: Verify client receives commands with correct session ID routing
4. **Cache Behavior**: Test command caching and TTL expiration
5. **Multi-Session**: Verify commands are session-specific, not global