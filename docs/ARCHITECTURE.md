# Dispatch Architecture Overview

## Executive Summary

Dispatch is a containerized web application that provides browser-based terminal and Claude AI sessions. Built with SvelteKit and Socket.IO, it enables real-time, interactive development environments accessible through any web browser. The application supports multiple concurrent sessions, workspace management, and seamless integration with Claude Code for AI-assisted development.

## Core Architecture

### System Components

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[SvelteKit UI]
        XTERM[xterm.js Terminal]
        SOCKET_CLIENT[Socket.IO Client]
    end
    
    subgraph "Server"
        VITE[Vite Dev Server]
        EXPRESS[Express Server]
        SOCKET_SERVER[Socket.IO Server]
        
        subgraph "Service Layer"
            WM[WorkspaceManager]
            SR[SessionRouter]
            TM[TerminalManager]
            CSM[ClaudeSessionManager]
        end
        
        subgraph "Persistence"
            FS[File System]
            INDEX[Workspace Index]
        end
    end
    
    subgraph "External"
        PTY[node-pty]
        CLAUDE[Claude API]
        LT[LocalTunnel]
    end
    
    UI <--> SOCKET_CLIENT
    XTERM <--> SOCKET_CLIENT
    SOCKET_CLIENT <--> SOCKET_SERVER
    SOCKET_SERVER --> WM
    SOCKET_SERVER --> SR
    SOCKET_SERVER --> TM
    SOCKET_SERVER --> CSM
    
    TM --> PTY
    CSM --> CLAUDE
    WM --> FS
    WM --> INDEX
    EXPRESS --> LT
    
    VITE --> EXPRESS
```

### Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant SocketIO
    participant SessionRouter
    participant TerminalManager
    participant PTY
    
    User->>Browser: Type command
    Browser->>SocketIO: terminal.write event
    SocketIO->>SessionRouter: Route to session
    SessionRouter->>TerminalManager: Write to terminal
    TerminalManager->>PTY: Send input
    PTY-->>TerminalManager: Output data
    TerminalManager-->>SocketIO: data event
    SocketIO-->>Browser: Update terminal
    Browser-->>User: Display output
```

## Component Architecture

### Frontend Architecture

```mermaid
graph LR
    subgraph "SvelteKit Frontend"
        ROUTES[Routes]
        COMPONENTS[Components]
        STORES[State Management]
        
        subgraph "Pages"
            HOME[/ - Main Terminal]
            PROJECTS[/projects - Session Grid]
        end
        
        subgraph "Core Components"
            TERM_PANE[TerminalPane]
            CLAUDE_PANE[ClaudePane]
            SESSION_MGR[SessionSocketManager]
        end
    end
    
    ROUTES --> HOME
    ROUTES --> PROJECTS
    HOME --> TERM_PANE
    PROJECTS --> TERM_PANE
    PROJECTS --> CLAUDE_PANE
    TERM_PANE --> SESSION_MGR
    CLAUDE_PANE --> SESSION_MGR
```

### Backend Service Architecture

```mermaid
classDiagram
    class WorkspaceManager {
        +init()
        +list()
        +open(dir)
        +create(dir)
        +clone(from, to)
        +rememberSession(dir, descriptor)
        -indexPath
        -workspaces
    }
    
    class SessionRouter {
        +bind(sessionId, descriptor)
        +get(sessionId)
        +unbind(sessionId)
        +all()
        +byWorkspace(path)
        -sessions Map
    }
    
    class TerminalManager {
        +start(options)
        +write(id, data)
        +resize(id, cols, rows)
        +stop(id)
        +setSocketIO(socket)
        -terminals Map
        -socketIO
    }
    
    class ClaudeSessionManager {
        +create(options)
        +list(workspacePath)
        +send(id, input)
        +setSocketIO(socket)
        -sessions Map
        -socketIO
    }
    
    class SessionSocketManager {
        +connect(sessionId, socket)
        +disconnect(sessionId)
        +handleSessionFocus(sessionId)
        -activeSockets Map
        -managers Object
    }
    
    WorkspaceManager --> SessionRouter : notifies
    SessionRouter --> TerminalManager : routes
    SessionRouter --> ClaudeSessionManager : routes
    SessionSocketManager --> TerminalManager : manages
    SessionSocketManager --> ClaudeSessionManager : manages
```

## Session Lifecycle

### Session Creation Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Creating: User requests session
    Creating --> Validating: Check authentication
    Validating --> WorkspaceSetup: Valid auth
    Validating --> Error: Invalid auth
    WorkspaceSetup --> SessionInit: Workspace ready
    SessionInit --> Active: Session started
    Active --> Suspended: User navigates away
    Suspended --> Active: User returns
    Active --> Terminating: User closes
    Terminating --> Cleanup: Stop processes
    Cleanup --> [*]
    Error --> [*]
```

### Socket.IO Connection Management

```mermaid
graph TD
    A[Client Connects] --> B{Authenticated?}
    B -->|Yes| C[Create Socket Handler]
    B -->|No| D[Reject Connection]
    C --> E[Register Event Listeners]
    E --> F[Session Ready]
    F --> G{Event Type}
    G -->|terminal.start| H[Create PTY Session]
    G -->|claude.send| I[Send to Claude]
    G -->|terminal.write| J[Write to Terminal]
    G -->|terminal.resize| K[Resize Terminal]
    H --> L[Bind to SessionRouter]
    I --> M[Process with AI]
    J --> N[Forward to PTY]
    K --> O[Update Terminal Size]
```

## Workspace Management

```mermaid
graph TB
    subgraph "Workspace Structure"
        ROOT[WORKSPACES_ROOT]
        ROOT --> WS1[workspace-1/]
        ROOT --> WS2[workspace-2/]
        ROOT --> WSN[workspace-n/]
        
        WS1 --> FILES1[Project Files]
        WS1 --> SESSION1[Session Data]
        
        INDEX[workspaces.json]
        INDEX -.-> WS1
        INDEX -.-> WS2
        INDEX -.-> WSN
    end
    
    subgraph "Session Types"
        PTY[Terminal Session]
        CLAUDE[Claude Session]
    end
    
    WS1 --> PTY
    WS1 --> CLAUDE
```

## Security Architecture

```mermaid
graph TD
    subgraph "Security Layers"
        AUTH[TERMINAL_KEY Authentication]
        SOCKET_AUTH[Socket.IO Auth Middleware]
        SESSION_ISO[Session Isolation]
        PATH_VAL[Path Validation]
        CONTAINER[Container Security]
    end
    
    subgraph "Container Security"
        NONROOT[Non-root User: appuser]
        READONLY[Read-only Root FS]
        LIMITED[Limited Capabilities]
    end
    
    AUTH --> SOCKET_AUTH
    SOCKET_AUTH --> SESSION_ISO
    SESSION_ISO --> PATH_VAL
    
    CONTAINER --> NONROOT
    CONTAINER --> READONLY
    CONTAINER --> LIMITED
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Docker Container"
        subgraph "Build Stage"
            NODE_BUILD[Node.js Builder]
            DEPS[Dependencies]
            SVELTE_BUILD[SvelteKit Build]
        end
        
        subgraph "Runtime Stage"
            NODE_SLIM[Node.js Slim]
            APP[Application]
            USER[appuser:10001]
        end
    end
    
    subgraph "Volumes"
        WORKSPACE_VOL[Workspace Volume]
        CONFIG_VOL[Config Volume]
    end
    
    subgraph "Network"
        PORT[Port 3030]
        TUNNEL[LocalTunnel Optional]
    end
    
    NODE_BUILD --> NODE_SLIM
    APP --> USER
    APP --> WORKSPACE_VOL
    APP --> CONFIG_VOL
    APP --> PORT
    PORT --> TUNNEL
```

## State Management

```mermaid
graph LR
    subgraph "Client State"
        SESSIONS[Session List]
        LAYOUT[Layout Config]
        AUTH_KEY[Auth Token]
        SOCKET_STATE[Socket Status]
    end
    
    subgraph "Server State"
        WORKSPACE_INDEX[Workspace Index]
        SESSION_MAP[Active Sessions]
        TERMINAL_MAP[Terminal Instances]
        CLAUDE_MAP[Claude Instances]
    end
    
    subgraph "Persistence"
        LOCAL_STORAGE[LocalStorage]
        FS_INDEX[File System Index]
        SESSION_HISTORY[Session History]
    end
    
    SESSIONS --> LOCAL_STORAGE
    LAYOUT --> LOCAL_STORAGE
    AUTH_KEY --> LOCAL_STORAGE
    
    WORKSPACE_INDEX --> FS_INDEX
    SESSION_MAP --> SESSION_HISTORY
```

## Potential Issues and Concerns

### 1. **Session State Synchronization**
- **Issue**: Socket.IO connections can be lost, causing state desynchronization between client and server
- **Impact**: Terminal output may be lost, Claude conversations interrupted
- **Mitigation**: Implement session replay buffers and automatic reconnection with state recovery

### 2. **Memory Leaks in Long-Running Sessions**
- **Issue**: PTY processes and Claude sessions may accumulate memory over time
- **Impact**: Server performance degradation, potential crashes
- **Mitigation**: Implement session timeouts, memory monitoring, and automatic cleanup of idle sessions

### 3. **Concurrent Session Limits**
- **Issue**: No apparent limits on concurrent terminal/Claude sessions per user
- **Impact**: Resource exhaustion, DoS vulnerability
- **Mitigation**: Implement per-user session limits and resource quotas

### 4. **File System Security**
- **Issue**: Path traversal vulnerabilities in workspace management
- **Current Protection**: Path validation exists but needs thorough testing
- **Risk**: Unauthorized file system access outside workspace boundaries
- **Mitigation**: Strengthen path sanitization, use chroot/containers for isolation

### 5. **Authentication Weakness**
- **Issue**: Single shared TERMINAL_KEY for all users
- **Impact**: No user isolation, shared access to all sessions
- **Mitigation**: Implement proper user authentication, JWT tokens, session-based auth

### 6. **Socket.IO Scaling**
- **Issue**: Single Socket.IO server instance, no clustering support
- **Impact**: Limited concurrent connections, single point of failure
- **Mitigation**: Implement Socket.IO Redis adapter for horizontal scaling

### 7. **Claude API Rate Limiting**
- **Issue**: No apparent rate limiting or quota management for Claude API calls
- **Impact**: Potential API quota exhaustion, unexpected costs
- **Mitigation**: Implement rate limiting, usage tracking, and quota management

### 8. **Session Persistence Reliability**
- **Issue**: Session state stored only in memory and local file system
- **Impact**: Data loss on server restart or crash
- **Mitigation**: Implement proper database backend for session state

### 9. **LocalTunnel Security**
- **Issue**: When enabled, exposes application to public internet
- **Impact**: Potential unauthorized access, security vulnerabilities
- **Mitigation**: Implement additional authentication layers, IP whitelisting

### 10. **WebSocket Message Validation**
- **Issue**: Limited validation of Socket.IO message payloads
- **Impact**: Potential for malformed data causing crashes or exploits
- **Mitigation**: Implement comprehensive input validation and sanitization

### 11. **Container Escape Risks**
- **Issue**: PTY sessions run with container user privileges
- **Impact**: Potential container escape through PTY exploits
- **Mitigation**: Use additional sandboxing, security profiles, capability dropping

### 12. **Cross-Session Data Leakage**
- **Issue**: Shared service managers across all sessions
- **Impact**: Potential for data leakage between user sessions
- **Mitigation**: Implement proper session isolation at service layer

### 13. **Performance Bottlenecks**
- **Issue**: All operations are synchronous in service managers
- **Impact**: One slow operation blocks all other sessions
- **Mitigation**: Implement async/queue-based processing

### 14. **Error Recovery**
- **Issue**: Limited error handling and recovery mechanisms
- **Impact**: Single error can crash entire application
- **Mitigation**: Implement comprehensive error boundaries and recovery strategies

### 15. **Monitoring and Observability**
- **Issue**: Minimal logging and monitoring capabilities
- **Impact**: Difficult to debug issues in production
- **Mitigation**: Implement structured logging, metrics, and tracing

## Recommendations

### High Priority
1. Implement proper user authentication and authorization
2. Add session and resource limits
3. Strengthen input validation and sanitization
4. Implement comprehensive error handling
5. Add monitoring and observability

### Medium Priority
1. Implement session state persistence in database
2. Add horizontal scaling support
3. Implement rate limiting for API calls
4. Add comprehensive audit logging
5. Implement automated testing suite

### Low Priority
1. Add support for custom workspace templates
2. Implement session sharing capabilities
3. Add plugin architecture for extensions
4. Implement advanced terminal features (tabs, splits)
5. Add support for multiple AI providers

## Conclusion

Dispatch provides a powerful web-based development environment with terminal and AI assistance. While the architecture is well-structured with clear separation of concerns, several security and scalability concerns need to be addressed before production deployment. The modular design allows for incremental improvements and the addition of enterprise features like proper authentication, monitoring, and scaling capabilities.