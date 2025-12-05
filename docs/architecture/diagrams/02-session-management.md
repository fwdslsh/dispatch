# Session Management Architecture

This diagram illustrates the unified session management system built on event sourcing principles, showing how RunSessionManager coordinates different session types through adapters.

```mermaid
graph TB
    subgraph "Client"
        WebUI[Web UI]
        APIClient[API Client]
    end

    subgraph "RunSessionManager - Event Sourcing Core"
        SessionRegistry[Session Registry<br/>runId → Adapter]
        EventEmitter[Event Emitter<br/>Real-time Broadcast]
        EventLogger[Event Logger<br/>Monotonic Sequences]

        SessionRegistry --- EventLogger
        EventLogger --- EventEmitter
    end

    subgraph "Adapter Interface"
        direction LR
        AdapterAPI[start<br/>input<br/>close<br/>emit event]
    end

    subgraph "Concrete Adapters"
        PtyAdapter[PtyAdapter<br/>Terminal Sessions]
        ClaudeAdapter[ClaudeAdapter<br/>Claude Code Sessions]
        FileAdapter[FileEditorAdapter<br/>File Editing]
        CustomAdapter[Custom Adapter<br/>Extensible]
    end

    subgraph "External Resources"
        PTY[node-pty<br/>Shell Process]
        Claude[Claude Code SDK<br/>AI Agent]
        Files[File System<br/>Text Files]
    end

    subgraph "Database Persistence"
        SessionsTable[(sessions table<br/>runId, kind, status)]
        EventsTable[(session_events table<br/>runId, seq, channel, type, payload)]
    end

    WebUI -->|POST /api/sessions| SessionRegistry
    APIClient -->|Socket.IO: run:attach| SessionRegistry

    SessionRegistry -->|Instantiate| AdapterAPI

    AdapterAPI -.implements.- PtyAdapter
    AdapterAPI -.implements.- ClaudeAdapter
    AdapterAPI -.implements.- FileAdapter
    AdapterAPI -.implements.- CustomAdapter

    PtyAdapter --> PTY
    ClaudeAdapter --> Claude
    FileAdapter --> Files

    PtyAdapter -->|emit| EventLogger
    ClaudeAdapter -->|emit| EventLogger
    FileAdapter -->|emit| EventLogger

    EventLogger -->|Persist| EventsTable
    SessionRegistry -->|Create/Update| SessionsTable

    EventEmitter -->|Broadcast| WebUI
    EventEmitter -->|Broadcast| APIClient

    style SessionRegistry fill:#fff3cd
    style EventLogger fill:#fff3cd
    style EventEmitter fill:#fff3cd
    style AdapterAPI fill:#e7f3ff
    style SessionsTable fill:#d4edda
    style EventsTable fill:#d4edda
```

## Core Concepts

### RunSessionManager Responsibilities
1. **Session Registry**: Maps runId to adapter instances, manages session lifecycle
2. **Event Sourcing**: All session activity logged as immutable events with sequence numbers
3. **Event Replay**: Clients can rebuild state from any (runId, seq) cursor
4. **Multi-Client Support**: Multiple tabs/clients attach to same session with synchronized state

### Adapter Pattern
- **Interface Contract**: All adapters implement `start()`, `input()`, `close()`, and emit events
- **Isolation**: Each session type encapsulated in its own adapter
- **Registration**: Adapters registered at startup via `RunSessionManager.registerAdapter(kind, AdapterClass)`
- **Extensibility**: New session types added by creating new adapter classes

### Event Sourcing Benefits
- **Auditability**: Complete history of all session interactions
- **Replay**: Reconstruct session state at any point in time
- **Debugging**: Trace exact sequence of events that led to any state
- **Multi-Client Sync**: Late-joining clients catch up by replaying missed events

## Session Lifecycle

1. **Creation**: Client requests session → RunSessionManager creates record in database → Instantiates adapter
2. **Attachment**: Client attaches via Socket.IO → Receives events from specified sequence number
3. **Interaction**: Client sends input → Adapter processes → Emits events → Logged and broadcast
4. **Persistence**: All events stored with monotonic sequence numbers for replay
5. **Termination**: Client closes session → Adapter cleanup → Session marked as closed in database

## Event Structure

All events follow a consistent structure:
- **runId**: Session identifier
- **seq**: Monotonic sequence number (1, 2, 3, ...)
- **channel**: Event category (e.g., 'stdout', 'stderr', 'status')
- **type**: Event type within channel (e.g., 'data', 'error', 'exit')
- **payload**: Event-specific data
- **timestamp**: Event creation time

This structure enables:
- Deterministic replay
- Channel-based filtering
- Ordered event processing
- Time-based analysis
