# Socket.IO Architecture Analysis & Simplification Plan

> Created: 2025-09-06
> Analyst: Claude Code
> Version: 1.0.0

## Executive Summary

After thorough review of the Socket.IO architecture, I've identified significant complexity and inconsistencies in the server-client mapping. The current implementation has overlapping handlers, inconsistent patterns, and unclear separation between features. This analysis provides a simplified architecture with clear 1:1 mapping between server handlers and client code.

**Key Issues Found:**

- **Multiple Handler Patterns**: Both legacy `socket-handler.js` and new modular handlers exist simultaneously
- **Inconsistent Client-Server Mapping**: No clear 1:1 correspondence between client and server socket events
- **Feature Boundary Confusion**: Session types, project management, and authentication mixed together
- **Namespace Inconsistencies**: Some handlers use namespaces, others don't

## Current Architecture Analysis

### Server-Side Socket Handlers

#### 1. ModularSocketHandler.js (New System)

**Location**: `src/lib/server/handlers/ModularSocketHandler.js`
**Role**: Main orchestrator that combines feature handlers

**Events Registered:**

- `auth` - Authentication handler
- `disconnect` - Cleanup handler

**Features Integrated:**

- AuthSocketHandler (auth)
- ProjectSocketHandler (project operations)
- SessionSocketHandler (session management)
- UtilitySocketHandler (utilities)
- Claude handlers (Claude Code integration)

#### 2. AuthSocketHandler.js

**Location**: `src/lib/shared/server/AuthSocketHandler.js`
**Events Handled:**

- `auth` - Terminal key authentication

**Client Events Expected:**

```javascript
socket.emit('auth', key, callback)
```

#### 3. ProjectSocketHandler.js

**Location**: `src/lib/projects/server/ProjectSocketHandler.js`
**Events Handled:**

- `list-projects` - Get all projects
- `create-project` - Create new project
- `get-project` - Get specific project
- `update-project` - Update project metadata
- `delete-project` - Delete project

**Client Events Expected:**

```javascript
socket.emit('list-projects', callback)
socket.emit('create-project', {name, description}, callback)
socket.emit('get-project', {projectId}, callback)
socket.emit('update-project', {projectId, updates}, callback)
socket.emit('delete-project', {projectId}, callback)
```

#### 4. SessionSocketHandler.js

**Location**: `src/lib/sessions/server/SessionSocketHandler.js`
**Events Handled:**

- `create` - Create new session
- `attach` - Attach to existing session
- `list` - List all sessions
- `end` - End session
- `detach` - Detach from session
- `input` - Send input to session
- `resize` - Resize terminal

**Client Events Expected:**

```javascript
socket.emit('create', options, callback)
socket.emit('attach', {sessionId, cols, rows}, callback)
socket.emit('list', callback)
socket.emit('end', sessionId, callback)
socket.emit('detach', callback)
socket.emit('input', data)
socket.emit('resize', {cols, rows})
```

#### 5. Claude Socket Handler

**Location**: `src/lib/session-types/claude/server/claude-socket-handler.server.js`
**Events Handled:**

- `claude:check-auth` - Check Claude CLI authentication
- `claude:init-session` - Initialize Claude chat session
- `claude:send-message` - Send message to Claude
- `claude:get-history` - Get chat history

### Client-Side Socket Usage

#### 1. SocketClientService.js (Generic)

**Location**: `src/lib/shared/services/SocketClientService.js`
**Role**: Generic socket connection service
**Events Used:**

- `connect` - Connection event
- `connect_error` - Connection error
- Generic emit/on methods

#### 2. ProjectSocketClient.js

**Location**: `src/lib/projects/components/ProjectSocketClient.js`
**Events Emitted:**

- `auth` - Authentication (duplicated)
- `create-project` - Create project
- `get-project` - Get project
- `list-projects` - List projects
- `update-project` - Update project
- `delete-project` - Delete project

#### 3. ShellSessionViewModel.svelte.js

**Location**: `src/lib/session-types/shell/components/ShellSessionViewModel.svelte.js`
**Events Emitted:**

- `auth` - Authentication (duplicated)
- `create` - Create session
- `attach` - Attach to session
- `input` - Send input
- `resize` - Resize terminal
- `end` - End session

**Events Listened:**

- `output` - Terminal output
- `ended` - Session ended
- `sessions-updated` - Session list updated

## Architectural Issues Identified

### 1. Authentication Duplication

**Problem**: Authentication logic is repeated in multiple client services

- ProjectSocketClient has its own auth logic
- ShellSessionViewModel has its own auth logic  
- SocketClientService doesn't handle auth at all

**Impact**: Inconsistent authentication, potential security issues, code duplication

### 2. Missing 1:1 Server-Client Mapping

**Problem**: No clear correspondence between server handlers and client services

**Current Mismatches:**

- Server has `UtilitySocketHandler` but no corresponding client
- Server has Claude handlers but no dedicated client
- Client services duplicate connection logic
- No clear namespace separation

### 3. Event Name Inconsistencies

**Problem**: Events use different naming patterns

- Some use kebab-case (`list-projects`)
- Some use camelCase (`listProjects`)
- Some use namespaced (`claude:check-auth`)
- Some use simple names (`create`, `auth`)

### 4. Feature Boundary Confusion

**Problem**: Unclear separation between features

- Session management mixed with project management
- Authentication scattered across multiple clients
- Terminal I/O mixed with session lifecycle

### 5. Namespace Underutilization

**Problem**: Socket.IO namespaces not consistently used

- Most handlers operate on default namespace
- Only Claude handlers use some namespacing
- No isolation between features

## Proposed Simplified Architecture

### Design Principles

1. **Clear Feature Separation**: Each feature gets its own namespace and handler pair
2. **1:1 Server-Client Mapping**: Each server handler has exactly one client counterpart
3. **Consistent Event Naming**: Use kebab-case for all events
4. **Single Authentication Point**: Centralized auth with delegation to features
5. **Namespace Isolation**: Features operate in separate namespaces

### Simplified Architecture Design

```
/auth/io              - Authentication namespace
├── AuthHandler    - Server: authentication only
└── AuthClient     - Client: authentication only

/projects/io          - Project management namespace  
├── ProjectHandler - Server: project CRUD operations
└── ProjectClient  - Client: project service

/sessions/io          - Session management namespace
├── SessionHandler - Server: session lifecycle
└── SessionClient  - Client: session operations

/terminals/io         - Terminal I/O namespace
├── TerminalHandler- Server: terminal input/output
└── TerminalClient - Client: terminal communication

/claude/io            - Claude Code namespace
├── ClaudeHandler  - Server: Claude integration
└── ClaudeClient   - Client: Claude service

/shell/io             - Shell session type namespace
├── ShellHandler   - Server: shell-specific logic
└── ShellClient    - Client: shell operations
```

### Event Naming Standard

All events follow kebab-case pattern with feature prefix, prefer one word event names when possible:

```javascript
// Authentication
auth:login
auth:logout
auth:check

// Projects  
projects:list
projects:create
projects:get
projects:update
projects:delete

// Sessions
sessions:create
sessions:attach
sessions:detach
sessions:end
sessions:list

// Terminals
terminals:input
terminals:output
terminals:resize
terminals:status

// Claude
claude:auth
claude:create
claude:send
claude:history

// Shell
shell:create
shell:connect
shell:execute
```

### Server Handler Structure

Each server handler follows this pattern:

```javascript
// /src/lib/{feature}/io/{Feature}Handler.js
export class FeatureHandler {
    constructor(io, service1, service2) {
        this.namespace = io.of("/feature");
        this.service1 = service1;
        this.service2 = service2;
        this.register();
    }

    register() {
        this.namespace.on('connection', (socket) => {
            console.log('A client connected to the feature namespace');

            socket.on('action', handleAction);

            socket.on('disconnect', () => {
                console.log('A client disconnected from the feature namespace');
            });
        });
    }

    async handleAction(data, callback) {
        // Handler implementation
      console.log('Received action with data:', data);

      if(callback)
         callback({success: true, message: "Action completed", data});


      // Handle the event and emit a response if needed
      socket.emit('completed', { message: 'Event completed', data });

            
    }
}
```

### Client Service Structure

Each client service follows this pattern:

```javascript
// /src/lib/{feature}/client/{Feature}Client.js
export class FeatureClient {
    constructor(io, config) {
        this.#socket = io(`${config.baseUrl}/feature`);
        this.register();
    }

    async register() {
      socket.on("completed", handleCompleted);
    }

    async performAction(data) {
         socket.emit('exampleEvent', data);
    }
}
```

## Implementation Plan

### Phase 1: Namespace Infrastructure (1-2 days)

1. **Create Namespace Factory**
   - Create Handler/Client base classes to ensure they require io and config (for the client)
   - create abstract register function in the base classes 

2. **Update Server Entry Point**
   - Modify app.js/socket setup to use namespaces
   - Remove old ModularSocketHandler
   - Ensure all handlers are registered with the proper namespace

### Phase 2: Authentication Refactor (1 day)

1. **Centralized Auth Service**
   - Create `/auth` namespace
   - Build AuthHandler and AuthClient pair
   - Implement auth token delegation to other namespaces
   - NOTE: ensure we keep claude code auth isolated

2. **Remove Auth Duplication**
   - Remove auth logic from ProjectSocketClient
   - Remove auth logic from ShellSessionViewModel
   - Update all clients to use centralized auth

### Phase 3: Feature Extraction (2-3 days)

1. **Projects Namespace**
   - Extract project handlers to `/projects` namespace
   - Create dedicated ProjectClient
   - Update UI components to use new client

2. **Sessions Namespace**
   - Extract session handlers to `/sessions` namespace
   - Create dedicated SessionClient  
   - Update UI components to use new client

3. **Terminals Namespace**
   - Extract terminal I/O to `/terminals` namespace
   - Create dedicated TerminalClient
   - Separate terminal communication from session management

### Phase 4: Session Type Cleanup (2 days)

1. **Claude Namespace**
   - Move Claude handlers to `/claude` namespace
   - Create dedicated ClaudeClient
   - Update Claude components to use new client

2. **Shell Namespace**
   - Move shell logic to `/shell` namespace  
   - Create dedicated ShellClient
   - Update shell components to use new client

### Phase 5: Testing & Validation (1 day)

1. **Integration Testing**
   - Test all namespace connections
   - Validate authentication flow
   - Test feature isolation

2. **Performance Testing**
   - Verify namespace overhead is minimal
   - Test concurrent connections
   - Validate connection cleanup

## Benefits of Simplified Architecture

### 1. Clear Separation of Concerns

- Each feature operates independently
- No cross-feature dependencies
- Easier to debug and maintain

### 2. 1:1 Server-Client Mapping  

- Every server handler has one client counterpart
- Easy to trace request/response flow
- Clear ownership of functionality

### 3. Namespace Isolation

- Features can't interfere with each other
- Independent authentication per feature
- Better security boundaries

### 4. Consistent Patterns

- All handlers follow same structure
- All clients follow same structure  
- Predictable event naming

### 5. Improved Testability

- Each handler/client can be tested in isolation
- Mock dependencies easily
- Clear test boundaries

### 6. Better Scalability

- Features can be independently scaled
- Easy to add new features
- Clear performance boundaries

## Migration Strategy

- We do not need to worry about migration, backwards compatibility etc. Treat as beta code that has not been released.
- Be sure and remove all deprecated/replaced code to keep the code base clean.

## Conclusion

The current Socket.IO architecture has grown organically and shows signs of technical debt. The proposed simplified architecture provides:

- **Clear 1:1 mapping** between server handlers and client services
- **Feature isolation** through namespace separation
- **Consistent patterns** across all socket communication
- **Improved maintainability** and testability

This refactoring will significantly improve code quality, reduce complexity, and provide a solid foundation for future feature development. The namespace-based approach ensures features remain isolated while maintaining the flexibility to add new functionality.

The implementation can be done incrementally with minimal disruption to existing functionality, making it a low-risk, high-value improvement to the codebase architecture.
