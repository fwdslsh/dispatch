# Research: Secure, resumable multi-session AI development environment

**Date**: 2025-09-27  
**Context**: Technical research for implementing containerized AI development environment

## Key Technology Decisions

### Event Sourcing Architecture

**Decision**: SQLite with append-only event tables using monotonic sequence numbers  
**Rationale**:

- Provides complete session recovery and replay capability
- SQLite suitable for single-user local-first model
- Monotonic sequences ensure deterministic event ordering
- Existing codebase already implements this pattern

**Alternatives considered**:

- Redis Streams: Rejected due to memory-only persistence concerns
- PostgreSQL: Rejected as overkill for single-user scenario
- JSON files: Rejected due to concurrency and atomicity issues

### Session Management Architecture

**Decision**: Adapter pattern with unified Socket.IO protocol  
**Rationale**:

- Already implemented in codebase (Terminal, Claude, FileEditor adapters)
- Enables adding new session types without core changes
- Socket.IO provides real-time bidirectional communication
- Unified `run:*` event structure simplifies client implementation

**Alternatives considered**:

- REST API: Rejected due to lack of real-time capabilities
- WebRTC: Rejected as unnecessarily complex for single-user scenario
- gRPC: Rejected due to browser compatibility requirements

### Container Isolation Strategy

**Decision**: Docker containers with non-root execution and volume mounts  
**Rationale**:

- Strong isolation boundary between host and session execution
- Portable across platforms (Linux, macOS, Windows)
- Existing infrastructure already supports Docker deployment
- Volume mounts enable workspace access while maintaining isolation

**Alternatives considered**:

- VM isolation: Rejected due to resource overhead and complexity
- chroot jails: Rejected due to limited security and portability
- WASM sandboxing: Rejected due to limited toolchain support

### Authentication & Session Resume

**Decision**: Multi-method auth with configurable defaults (shared key, OAuth, device pairing, WebAuthn)  
**Rationale**:

- Supports different user preferences and security requirements
- Shared key suitable for local development scenarios
- OAuth/WebAuthn for remote access scenarios
- Device pairing for trusted device workflows

**Alternatives considered**:

- Single auth method: Rejected due to varying user needs
- No authentication: Rejected due to security requirements
- Certificate-based: Considered but deferred due to complexity

### State Synchronization

**Decision**: Event sourcing with client-side buffering and conflict resolution  
**Rationale**:

- Event history provides single source of truth
- Client buffering handles network interruptions gracefully
- Read-only reattach mode prevents state corruption during uncertainty
- Supports multi-device session access

**Alternatives considered**:

- Optimistic locking: Rejected due to complexity with multiple session types
- Last-writer-wins: Rejected due to data loss potential
- Manual merge resolution: Rejected due to user experience impact

### Performance & Scalability

**Decision**: Best-effort responsiveness with sub-100ms session replay target  
**Rationale**:

- Single-user model reduces scaling requirements
- Event replay performance critical for user experience
- SQLite performance adequate for expected session volumes
- Best-effort approach allows for future optimization

**Alternatives considered**:

- Strict SLA targets: Rejected due to varying hardware capabilities
- No performance targets: Rejected due to user experience requirements
- Caching layers: Deferred as premature optimization

## Integration Patterns

### VS Code Remote Tunnel

**Decision**: Optional integration using VS Code CLI with secure tunneling  
**Rationale**:

- Provides familiar IDE experience for users
- Secure tunnel prevents unauthorized access
- Optional nature maintains core functionality independence
- CLI approach simpler than extension development

**Alternatives considered**:

- VS Code extension: Rejected due to development complexity
- Other IDEs: Considered for future expansion
- Web-based editor: Already provided via File Editor adapter

### File System Access

**Decision**: Workspace-scoped volume mounts with explicit user authorization  
**Rationale**:

- Maintains security boundary while enabling file access
- Workspace concept provides logical grouping
- Explicit authorization prevents accidental host access
- Volume mounts provide native performance

**Alternatives considered**:

- FUSE filesystem: Rejected due to complexity and platform limitations
- API-based file access: Rejected due to performance concerns
- Full host access: Rejected due to security requirements

## Risk Assessment

### Security Risks

- **Container escape**: Mitigated by non-root execution and security profiles
- **Volume mount abuse**: Mitigated by workspace-scoped mounts and user authorization
- **Network exposure**: Mitigated by configurable authentication and HTTPS support

### Performance Risks

- **Event table growth**: Mitigated by user-configurable retention policies
- **Concurrent session limits**: Acceptable due to single-user model
- **Network latency**: Mitigated by client-side buffering and reconnection logic

### Operational Risks

- **Docker dependency**: Acceptable tradeoff for isolation benefits
- **SQLite corruption**: Mitigated by WAL mode and backup strategies
- **Session state complexity**: Mitigated by event sourcing and replay capability

## Implementation Readiness

All key technology decisions are based on existing codebase patterns and proven technologies. No experimental or bleeding-edge dependencies required. Current architecture already demonstrates the core patterns needed for full implementation.
