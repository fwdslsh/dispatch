# High-Level Architecture

This diagram shows the overall architecture of the Dispatch system, illustrating how the main components interact to provide containerized web-based terminal and AI sessions.

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        CLI[CLI Client]
    end

    subgraph "SvelteKit Application"
        subgraph "Frontend (Svelte 5)"
            Components[UI Components]
            ViewModels[ViewModels<br/>$state runes]
            Services[Client Services<br/>ServiceContainer]
        end

        subgraph "Backend (Node.js)"
            APIRoutes[REST API Routes<br/>/api/*]
            SocketIO[Socket.IO Server<br/>Real-time Events]
            Auth[Authentication<br/>Cookies + API Keys]
        end
    end

    subgraph "Runtime Layer"
        RunSessionMgr[RunSessionManager<br/>Event Sourcing]

        subgraph "Session Adapters"
            PtyAdapter[PtyAdapter<br/>Terminal Sessions]
            ClaudeAdapter[ClaudeAdapter<br/>Claude Code]
            FileAdapter[FileEditorAdapter<br/>File Editing]
        end
    end

    subgraph "External Services"
        NodePty[node-pty<br/>PTY Processes]
        ClaudeCode[@anthropic-ai/claude-code<br/>AI SDK]
        FileSystem[File System<br/>Workspace Files]
    end

    subgraph "Storage"
        SQLite[(SQLite Database<br/>Sessions, Events,<br/>Auth, Settings)]
    end

    Browser -->|HTTPS/WSS| Components
    CLI -->|HTTP + Bearer Token| APIRoutes

    Components <--> ViewModels
    ViewModels <--> Services
    Services <-->|REST API| APIRoutes
    Services <-->|WebSocket| SocketIO

    APIRoutes --> Auth
    SocketIO --> Auth

    APIRoutes --> RunSessionMgr
    SocketIO --> RunSessionMgr

    RunSessionMgr --> PtyAdapter
    RunSessionMgr --> ClaudeAdapter
    RunSessionMgr --> FileAdapter

    PtyAdapter --> NodePty
    ClaudeAdapter --> ClaudeCode
    FileAdapter --> FileSystem

    RunSessionMgr <--> SQLite
    APIRoutes <--> SQLite
    Auth <--> SQLite

    style Browser fill:#e1f5ff
    style CLI fill:#e1f5ff
    style RunSessionMgr fill:#fff3cd
    style SQLite fill:#d4edda
```

## Key Components

### Client Layer
- **Web Browser**: Primary UI interface using Svelte 5 components
- **CLI Client**: Programmatic access using API keys

### SvelteKit Application
- **Frontend**: MVVM architecture with reactive ViewModels and ServiceContainer for dependency injection
- **Backend**: REST API routes and Socket.IO for real-time bidirectional communication

### Runtime Layer
- **RunSessionManager**: Central session orchestrator using event sourcing pattern
- **Session Adapters**: Pluggable adapters for different session types (terminal, Claude, file editing)

### Storage
- **SQLite Database**: Persistent storage for sessions, events, authentication, and settings

### External Services
- **node-pty**: Terminal emulation and PTY process management
- **Claude Code SDK**: AI-powered coding assistant integration
- **File System**: Direct workspace file access

## Data Flow

1. **Session Creation**: Client requests session via REST API → RunSessionManager creates session → Adapter initializes external service
2. **Real-time Events**: Adapter emits events → RunSessionManager persists to database → Socket.IO broadcasts to connected clients
3. **Event Replay**: Client reconnects → Requests events from sequence number → Receives missed events for state synchronization
4. **Authentication**: All requests authenticated via session cookies (browser) or API keys (CLI/programmatic)
