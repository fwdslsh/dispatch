# Data Model: Enhanced Workspace Management for Dispatch

**Date**: 2025-09-27
**Context**: Data model for workspace management API additions to existing event-sourced architecture

## Implementation Context

**Existing Database Schema**: Dispatch already has a mature database implementation with:

- ✅ `sessions` table - Complete session management with event sourcing
- ✅ `session_events` table - Event log with sequence numbers for replay
- ✅ `workspaces` table - Basic workspace tracking (id, path, timestamp)
- ✅ `workspace_layout` table - Client-specific UI layouts
- ✅ `settings` table - Configuration management

**This data model describes enhancements to the existing workspace functionality.**

## Enhanced Entities

### User (Single-User Design)

**Implementation**: No explicit User entity needed - Dispatch is designed for single-user deployment.

**Current Approach**:

- Authentication handled by key-based system in `auth.js`
- User preferences stored in `settings` table with category-based JSON
- Single-user assumption eliminates need for user management complexity

**Note**: Multi-user support would require dedicated User entity but is not in current scope.

### Workspace (Enhanced)

**Purpose**: Isolated working area containing files and sessions

**Current Implementation**: Basic workspace tracking exists in `workspaces` table.

**Enhanced Fields for API**:

- `id`: UUID - Unique workspace identifier ✅ **Exists**
- `name`: String - User-friendly workspace name (**Needs API support**)
- `path`: String - Absolute path to workspace directory ✅ **Exists**
- `created`: Timestamp - Creation time ✅ **Exists**
- `lastAccessed`: Timestamp - Most recent access (**Enhancement needed**)
- `status`: Enum - active, archived, error (**New field needed**)
- `metadata`: JSON - Workspace-specific configuration (**New field needed**)

**Implementation Status**:

- ✅ Database table exists with basic fields
- 🔄 Missing dedicated CRUD API endpoints
- 🔄 Missing status and metadata management
- ✅ Path validation logic exists in session creation

**API Enhancement Requirements**:

- Add workspace management endpoints (`/api/workspaces/`)
- Implement status tracking (active, archived, error)
- Add metadata field for workspace-specific settings
- Track last accessed timestamp

### Session (Fully Implemented)

**Purpose**: Interactive execution context within a workspace

**Implementation Status**: ✅ **Complete** - Handled by RunSessionManager and `sessions` table.

**Existing Fields**:

- `run_id`: UUID - Session identifier ✅ **Implemented**
- `workspace_id`: UUID - Parent workspace reference ✅ **Implemented**
- `kind`: Enum - terminal, claude, fileEditor ✅ **Implemented**
- `status`: Enum - starting, active, stopped, error ✅ **Implemented**
- `created_at`: Timestamp - Creation time ✅ **Implemented**
- `meta_json`: JSON - Session configuration and state ✅ **Implemented**

**Existing Functionality**:

- ✅ Complete session lifecycle management via RunSessionManager
- ✅ Event sourcing with sequence numbers
- ✅ Multi-device attachment support
- ✅ Real-time synchronization via Socket.IO
- ✅ Session persistence and resume across restarts
- ✅ Three working adapters (Terminal, Claude, FileEditor)

**API Coverage**:

- ✅ `/api/sessions/` - Session CRUD operations
- ✅ `/api/sessions/[id]/history/` - Event history retrieval
- ✅ Socket.IO handlers for real-time interaction

**No changes needed** - Session management is mature and production-ready.

### SessionEvent (Fully Implemented)

**Purpose**: Immutable record of session activity for event sourcing

**Implementation Status**: ✅ **Complete** - Full event sourcing implemented in `session_events` table.

**Existing Fields**:

- `id`: UUID - Event identifier ✅ **Implemented**
- `run_id`: UUID - Parent session reference ✅ **Implemented**
- `sequence`: Integer - Monotonic sequence within session ✅ **Implemented**
- `timestamp`: Timestamp - Event occurrence time ✅ **Implemented**
- `channel`: String - Event channel (stdin, stdout, stderr, system) ✅ **Implemented**
- `type`: String - Event type ✅ **Implemented**
- `data`: JSON - Event payload ✅ **Implemented**

**Existing Functionality**:

- ✅ Immutable event storage with atomic sequence allocation
- ✅ Event replay for session resumption (<100ms performance)
- ✅ Real-time event streaming via Socket.IO
- ✅ Complete event type support (input, output, resize, attach, detach, error)
- ✅ Database indexes for fast querying by (run_id, sequence)

**No changes needed** - Event sourcing is production-ready and performant.

### Configuration (Fully Implemented)

**Purpose**: Environment and user settings

**Implementation Status**: ✅ **Complete** - Handled by `settings` table and environment configuration.

**Existing Implementation**:

- ✅ Settings table with category-based JSON storage
- ✅ Environment variable configuration system
- ✅ Per-workspace settings support via workspace_layout table
- ✅ Runtime configuration management

**No changes needed** - Configuration system is working and extensible.

## Relationships Diagram (Current Implementation)

```
Single User Environment
    │
    ├── Workspaces (workspaces table)
    │       └── Sessions (sessions table)
    │               └── SessionEvents (session_events table)
    │
    ├── Settings (settings table)
    │
    └── WorkspaceLayouts (workspace_layout table)
```

## Implementation Summary

### ✅ **What Already Works**

- **Event Sourcing**: Complete with session_events table and sequence numbers
- **Session Management**: Full lifecycle via RunSessionManager
- **Multi-Device Support**: Socket.IO with real-time synchronization
- **Database Schema**: All core tables exist with proper indexes
- **API Layer**: Session management endpoints functional
- **Authentication**: Key-based auth system working
- **Frontend**: Svelte 5 with ViewModels and state management

### 🔄 **What Needs Enhancement**

- **Workspace API**: Missing dedicated CRUD endpoints for workspace management
- **Workspace Metadata**: Status tracking and enhanced metadata fields
- **Service Organization**: Optional refactoring for better code organization

### 🚫 **What's Not Needed**

- User entity (single-user system)
- AttachmentSession entity (Socket.IO handles this)
- New database tables for sessions/events (already exist)
- New authentication system (current system sufficient)

This data model reflects the actual implementation state and focuses enhancement efforts on the genuine gaps in workspace management.
