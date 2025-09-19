# Unified Session Implementation Tasks

This document outlines the detailed tasks required to implement the unified session pattern from the UNIFIED_SESSION_IMPLEMENTATION_GUIDE.md.

## Overview

The refactor will replace the current complex session management architecture with a unified pattern that:
- Uses single `runId` for all session operations
- Implements event-sourced history with append-only logging
- Unifies Socket.IO messaging around run sessions with typed channels
- Eliminates backward compatibility concerns (POC allows breaking changes)
- Dramatically reduces code complexity by removing multiple abstraction layers

## Current Architecture Analysis

### Files to be REPLACED/DELETED:
- `src/lib/server/core/SessionRegistry.js` (doesn't exist yet)
- Current complex database schema in `DatabaseManager.js`
- Multiple Socket.IO event handlers in `socket-setup.js`
- `src/lib/server/terminals/TerminalManager.js` (replace with adapter)
- `src/lib/server/claude/ClaudeSessionManager.js` (replace with adapter)

### Current Problems:
1. **Multiple session identifiers**: appSessionId, typeSpecificId, socketId
2. **Scattered session state**: spread across multiple tables and in-memory maps
3. **Complex routing**: Multiple managers handling different session types
4. **Inconsistent event handling**: different patterns for terminal vs Claude events
5. **History fragmentation**: separate storage for terminal history, Claude messages, socket events

## Implementation Tasks

### Task 1: Replace Database Schema (Step 1)
**Status**: Pending
**Description**: Drop existing session-related tables and create new unified schema

**Details**:
- Drop tables: `sessions`, `session_layout`, `terminal_history`, `claude_sessions`, `socket_sessions`, `session_history`
- Create new tables:
  - `sessions` (run_id, kind, status, meta_json)
  - `session_events` (run_id, seq, channel, type, payload, ts)
  - `workspace_layout` (client_id specific layouts)
- Update `DatabaseManager.js` createTables() method
- Add new methods for unified session management

**Files**:
- `src/lib/server/db/DatabaseManager.js`

### Task 2: Create RunSessionManager Class (Step 2)
**Status**: Pending
**Description**: Create unified session management class that replaces current managers

**Details**:
- Replace SessionManager + SessionRouter pattern with single RunSessionManager
- Implement adapter pattern for different session types (pty, claude)
- Handle event-sourced session history with monotonic sequence numbers
- Provide unified API for session creation, event recording, and retrieval
- Real-time event emission to Socket.IO clients

**Files**:
- `src/lib/server/runtime/RunSessionManager.js` (new)

### Task 3: Create PtyAdapter (Step 2)
**Status**: Pending
**Description**: Create PTY adapter for terminal sessions

**Details**:
- Simple adapter interface that wraps node-pty
- Support all node-pty options (cols, rows, env, shell, etc.)
- Emit events through onEvent callback with proper channels (pty:stdout, pty:resize, system:status)
- Handle terminal lifecycle (create, input, resize, close)
- Unix/Windows compatibility

**Files**:
- `src/lib/server/adapters/PtyAdapter.js` (new)

### Task 4: Create ClaudeAdapter (Step 2)
**Status**: Pending
**Description**: Create Claude adapter for Claude Code sessions

**Details**:
- Simple adapter interface that wraps Claude Code SDK
- Support all Claude Code SDK options (model, permissionMode, maxTurns, etc.)
- Emit events through onEvent callback with proper channels (claude:delta, claude:message, claude:result)
- Handle Claude session lifecycle (create, input, close)
- Streaming message support

**Files**:
- `src/lib/server/adapters/ClaudeAdapter.js` (new)

### Task 5: Replace Socket.IO Setup (Step 3)
**Status**: Pending
**Description**: Replace current socket-setup.js with unified event handlers

**Details**:
- Replace 20+ scattered event types with 4 core events:
  - `client:hello` - Client identification with clientId
  - `run:attach` - Attach to run session with backlog
  - `run:input` - Send input to run session
  - `run:close` - Close run session
- Remove complex session routing logic
- Implement simple authentication and session management
- Real-time event streaming to attached clients

**Files**:
- `src/lib/server/socket-setup.js` (replace)

### Task 6: Update Service Initialization (Step 4)
**Status**: Pending
**Description**: Update app.js to use new unified services

**Details**:
- Initialize RunSessionManager with database and Socket.IO
- Register PtyAdapter and ClaudeAdapter with RunSessionManager
- Update services object passed to Socket.IO setup
- Remove old service initialization (WorkspaceManager, SessionRegistry, etc.)

**Files**:
- `src/app.js`
- `src/hooks.server.js`

### Task 7: Update API Routes (Step 5)
**Status**: Pending
**Description**: Simplify session API endpoints for unified pattern

**Details**:
- Simplify `POST /api/sessions` to create run sessions with kind and options
- Support both PTY and Claude session creation with full options
- Update session management APIs for runId-based operations
- Layout management API for client-specific layouts

**Files**:
- `src/routes/api/sessions/+server.js`

### Task 8: Create Client-Side RunSessionClient (Step 6)
**Status**: Pending
**Description**: Create unified client for run session management

**Details**:
- Replace multiple session management classes with single RunSessionClient
- Implement clientId management in localStorage
- Handle run session attachment with event backlog
- Unified event handling for both PTY and Claude sessions
- Connection management and reconnection

**Files**:
- `src/lib/client/RunSessionClient.js` (new)

### Task 9: Update Client Components (Step 6)
**Status**: Pending
**Description**: Update Svelte components for unified session pattern

**Details**:
- Update TerminalPane.svelte to use RunSessionClient
- Update ClaudePane.svelte to use RunSessionClient
- Handle unified event streams with proper channel filtering
- Cursor-based event replay for reliable resume
- Remove complex session state management

**Files**:
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/lib/client/claude/ClaudePane.svelte`
- Other session-related components

### Task 10: Run Tests and Verify (Final)
**Status**: Pending
**Description**: Test the implementation and verify all functionality works

**Details**:
- Run existing test suites
- Test terminal session creation and interaction
- Test Claude session creation and interaction
- Test multi-client session attachment
- Test session resume after disconnect
- Verify event-sourced history works correctly

**Commands**:
- `npm run test`
- `npm run test:e2e`
- Manual testing of key workflows

## Benefits of New Architecture

1. **Stateless UI Recovery**: All UI state can be rebuilt from (runId, seq) cursor
2. **Multi-Client Support**: Multiple tabs can attach to same runId with synchronized events
3. **Reliable Resume**: After disconnect, clients request events since last seen sequence
4. **Extensible Event Types**: Easy to add new channels without changing core architecture
5. **Simplified Testing**: Event-driven architecture with clear input/output
6. **Better Observability**: All session activity logged in queryable event stream

## Implementation Notes

- This is a direct refactor approach suitable for POC - no gradual migration needed
- Breaking changes are acceptable since this is not production
- Focus on simplicity and maintainability over backwards compatibility
- Event-sourced design enables powerful debugging and replay capabilities
- Unified pattern reduces cognitive load and maintenance burden

## Estimated Timeline

- **Database Schema**: 1-2 hours
- **Core Managers**: 3-4 hours
- **Socket.IO Integration**: 2-3 hours
- **API Updates**: 1-2 hours
- **Client Integration**: 2-3 hours
- **Testing & Debugging**: 2-4 hours

**Total**: ~13 hours of focused development