# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-02-server-architecture-refactoring/spec.md

## Technical Requirements

- **Socket Handler Decomposition**: Refactor socket-handler.js (1,138 lines) into a router pattern with dedicated handlers: AuthHandler (~150 lines), SessionHandler (~200 lines), ProjectHandler (~150 lines), ClaudeAuthHandler (~100 lines), and TerminalIOHandler (~100 lines). Each handler must implement a consistent interface with execute() and validate() methods.

- **Storage System Unification**: Remove legacy session store (sessions.json), project-based storage (projects.json + directories), and DirectoryManager storage (.dispatch/ structure). Implement unified StorageService with atomic operations, transaction-like consistency, and proper error recovery. Migration script must handle existing data without loss.

- **Authentication Middleware**: Extract 15+ repeated authentication checks into centralized AuthenticationMiddleware class. Implement consistent error responses, rate limiting integration, and support for multiple auth types (terminal key, Claude OAuth). All socket events must use this middleware before processing.

- **Dependency Injection Framework**: Implement constructor-based dependency injection for all services and handlers. Create ServiceContainer class for dependency resolution and lifecycle management. All dependencies must be injected rather than directly imported, enabling comprehensive unit testing with mock objects.

- **Service Layer Architecture**: Create dedicated service classes following single responsibility: SessionService (session CRUD, lifecycle), ProjectService (project management, validation), AuthService (authentication logic, token management), StorageService (unified data access). Each service must have clearly defined interfaces and error handling.

- **Router Pattern Implementation**: Create SocketRouter class to dispatch events to appropriate handlers based on event type. Router must handle authentication checks, input validation, error responses, and event registration. Support for middleware chains and consistent response formatting.

- **Path Validation Consolidation**: Replace scattered path validation logic across directory-manager.js, terminal.js, and socket-handler.js with centralized PathValidator utility. Implement consistent security checks for path traversal prevention using path.resolve() and proper validation patterns.

- **Error Handling Standardization**: Replace inconsistent error handling (ErrorHandler.handle(), direct throws, error objects, callbacks) with unified ErrorHandler class. Implement consistent error response format, proper logging, and error categorization (validation, authentication, system).

- **Testing Infrastructure**: Implement comprehensive unit testing with Jest framework. Create mock factories for all dependencies, test utilities for socket event simulation, and integration test helpers. Target >80% code coverage for all business logic components.

- **Code Organization Structure**: Reorganize server files into logical directories: handlers/ (socket event handlers), services/ (business logic), middleware/ (cross-cutting concerns), repositories/ (data access), utils/ (shared utilities). Each directory must have clear responsibilities and minimal cross-dependencies.

## External Dependencies

**No new external dependencies required.** This refactoring uses existing dependencies (Socket.IO, node-pty, fs, path) and focuses on internal code organization and architectural improvements. All functionality will be preserved while improving maintainability and testability.