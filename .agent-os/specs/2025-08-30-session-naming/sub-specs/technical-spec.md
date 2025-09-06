# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-30-session-naming/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Technical Requirements

### Backend Changes

- **Session Storage**: Extend existing sessions.json structure to support custom name field with validation
- **Name Validation**: Implement 1-50 character length limit with alphanumeric, space, hyphen, underscore restrictions
- **Socket.IO Events**: Extend 'create' event to accept optional name parameter and add new 'rename' event
- **File System Management**: Create readable symlinks in PTY_ROOT/by-name/ pointing to UUID directories
- **Name Conflict Resolution**: Handle duplicate names with incremental suffixes (e.g., "My Session (2)")

### Frontend Changes

- **Session Creation UI**: Add optional name input field to new session creation flow
- **Session List Interface**: Implement inline editing capability for existing session names
- **Real-time Updates**: Update session names in UI when changed via Socket.IO broadcasts
- **Input Validation**: Client-side validation matching backend constraints with user feedback

### File System Architecture

- **Directory Structure**: Maintain UUID-based session directories for safety and uniqueness
- **Symbolic Links**: Create PTY_ROOT/by-name/{sanitized-name} → PTY_ROOT/{uuid} symlinks
- **Name Sanitization**: Convert session names to filesystem-safe format (replace spaces with hyphens, remove special chars)
- **Cleanup Management**: Remove orphaned symlinks when sessions are deleted

### Integration Points

- **TerminalManager**: Extend createSession() method to handle name parameter and symlink creation
- **SessionStore**: Add name validation utilities and symlink management functions
- **Socket Handler**: Update session creation and add rename event handlers
- **Svelte Components**: Modify session creation and list components for name input/editing

## Approach

### Implementation Strategy

1. **Phase 1**: Backend infrastructure - extend session storage, add validation, create symlink management
2. **Phase 2**: Socket.IO API updates - extend create event, add rename event, update broadcasts
3. **Phase 3**: Frontend integration - update session creation UI, add inline editing to session list
4. **Phase 4**: Testing and polish - validate edge cases, ensure cleanup works properly

### Data Flow

1. User creates session with optional name via frontend
2. Backend validates name, handles conflicts, creates session + symlink
3. Session metadata stored with name field in sessions.json
4. Frontend receives updated session list via Socket.IO broadcast
5. For renames: validate → update storage → update symlinks → broadcast changes

### Error Handling

- Invalid names return validation errors to client
- Duplicate names automatically get incremental suffixes
- Failed symlink creation logs warning but doesn't fail session creation
- Orphaned symlinks cleaned up during session list operations

## External Dependencies

### File System Requirements

- **Symlink Support**: Host system must support symbolic links (standard on Linux/Unix)
- **Write Permissions**: PTY_ROOT directory needs write access for by-name subdirectory
- **Path Length Limits**: Sanitized names must respect filesystem path length constraints

### No New Package Dependencies

- Utilizes existing Node.js fs module for symlink operations
- Leverages current Socket.IO infrastructure for new events
- Builds on existing session storage and validation patterns
