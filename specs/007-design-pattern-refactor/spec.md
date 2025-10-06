# Feature Specification: Architecture Refactoring for Improved Maintainability

**Feature Branch**: `007-design-pattern-refactor`
**Created**: 2025-10-05
**Status**: Draft
**Input**: User description: "design-pattern-refactor create a set of changes that properly resolve the recommendations provided in the @specs/.pending/design-pattern-refactor.md document"

## Execution Flow (main)

```text
1. Parse user description from Input
   → References existing architectural analysis document
2. Extract key concepts from description
   → Actors: Developers, maintainers, contributors
   → Actions: Refactor, decompose, abstract, centralize
   → Data: Services, sessions, configuration, events
   → Constraints: Maintain existing functionality, improve testability
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → Developer workflow improvements identified
5. Generate Functional Requirements
   → Each requirement maps to architectural recommendation
6. Identify Key Entities
   → Services, repositories, managers, adapters
7. Run Review Checklist
   → Verify no implementation leakage
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT the refactored architecture should provide and WHY
- ❌ Avoid HOW to implement specific patterns (detailed class hierarchies, exact method signatures)
- 👥 Written for technical stakeholders who understand software architecture but not this codebase

---

## Clarifications

### Session 2025-10-05

- Q: How should this refactoring be deployed to minimize risk and maintain system stability? → A: Big Bang deployment - complete all refactoring, test comprehensively, deploy in single release
- Q: When the dependency injection system detects a circular dependency during service initialization, what should happen? → A: Design constraint prohibiting circular dependencies via constructor injection (primary), with fail-fast error at startup as failsafe
- Q: What should happen to the existing TERMINAL_KEY authentication mechanism? → A: Use TERMINAL_KEY as the JWT signing secret - validate key then issue token
- Q: What defines the boundary of a single transaction when coordinating across SessionRepository, EventStore, WorkspaceRepository, etc.? → A: Per-Request transaction boundary - each API/Socket request is one transaction, all repository operations atomic
- Q: When a required service fails to initialize during application startup, what should the system do? → A: Crash immediately on initialization failure - log error and exit with non-zero code for process manager restart

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a **developer working on the Dispatch codebase**, I need the architecture to be organized with clear separation of concerns and explicit dependencies, so that I can:
- Understand which components are responsible for specific functionality
- Add new features without modifying unrelated code
- Write unit tests with mockable dependencies
- Navigate the codebase efficiently
- Onboard new contributors quickly

### Acceptance Scenarios

1. **Given** a new developer wants to add a session type, **When** they review the codebase structure, **Then** they can identify the single location where adapters are registered and follow a clear pattern
2. **Given** a developer needs to modify database operations, **When** they locate the data access code, **Then** they find focused repository classes instead of a monolithic database manager
3. **Given** a developer wants to test a service, **When** they write unit tests, **Then** they can inject mock dependencies without relying on global state
4. **Given** a developer needs to add a new Socket.IO event handler, **When** they review the socket handling code, **Then** they find domain-specific handler modules instead of a single large file
5. **Given** a developer needs to understand service initialization, **When** they review the startup code, **Then** they see explicit dependency injection instead of hidden service locator patterns
6. **Given** a developer wants to add authentication methods, **When** they review the auth code, **Then** they find a clear strategy pattern with documented provider interface
7. **Given** a developer needs to modify tunnel management, **When** they review tunnel code, **Then** they find shared base class logic instead of duplicated implementations
8. **Given** a developer wants to understand required configuration, **When** they review environment variable usage, **Then** they find centralized configuration service documentation

### Edge Cases

- **Service Initialization Failure**: System MUST crash immediately with logged error and non-zero exit code, allowing process manager to restart
- **Circular Dependencies**: System MUST prevent circular dependencies through constructor injection design constraints; if detected at startup, fail-fast with clear error message
- **Mock Dependency Substitution**: Test environment MUST support dependency injection of mocks through module mocking (Vitest vi.mock()) and context overrides
- **New Session Type Event Patterns**: Adapter pattern MUST accommodate different event handling patterns through adapter-specific event emission
- **Socket.IO Event Contract Changes**: Client-side code MUST be updated in coordination with server changes; deployment is Big Bang (all changes together)
- **JWT Token Validation Failures**: System MUST return 401 Unauthorized with specific error codes (expired, invalid signature, missing claims) via consistent error response format

## Requirements _(mandatory)_

### Functional Requirements

**Dependency Management**
- **FR-001**: System MUST eliminate reliance on global service locator pattern through explicit module exports/imports and Svelte context API
- **FR-002**: System MUST make service dependencies visible at component boundaries (ES6 module imports, Svelte setContext/getContext)
- **FR-003**: System MUST support test environment with mock dependency substitution via module mocking and context overrides
- **FR-004**: System MUST document service initialization order and dependency graph
- **FR-005**: System SHOULD use simple dependency patterns (organized imports, Svelte context) rather than complex DI frameworks
- **FR-006**: System MUST fail-fast at startup if circular dependencies are detected (JavaScript will throw naturally), logging clear error message

**Database Access Layer**
- **FR-007**: System MUST separate database operations into domain-specific repositories (sessions, events, settings, workspaces)
- **FR-008**: System MUST maintain single responsibility principle for each repository (focused on one data model)
- **FR-009**: System MUST define per-request transaction boundaries where each API/Socket request is one atomic transaction encompassing all repository operations
- **FR-010**: System MUST continue to enforce serial write operations to prevent concurrency conflicts

**Session Management**
- **FR-011**: System MUST decompose RunSessionManager into focused components (adapter registry, event recorder, session registry, orchestration service)
- **FR-012**: System MUST separate session event emission from Socket.IO to enable multiple event consumers
- **FR-013**: System MUST maintain event sourcing architecture with sequence-numbered events
- **FR-014**: System MUST preserve session persistence and resumption capabilities
- **FR-015**: System MUST continue to support multi-client session synchronization

**Socket Event Handling**
- **FR-016**: System MUST organize socket event handlers into domain-specific modules (run sessions, auth, tunnels, settings, workspaces)
- **FR-017**: System MUST provide common middleware for cross-cutting concerns (authentication, error handling, logging)
- **FR-018**: System MUST maintain event-driven architecture with Socket.IO
- **FR-019**: System MAY update socket event contracts (run:attach, run:input, run:close, etc.) if needed, but client-side code MUST be updated accordingly to maintain compatibility

**Tunnel Management**
- **FR-020**: System MUST abstract shared tunnel management logic into reusable base class
- **FR-021**: System MUST eliminate code duplication between TunnelManager and VSCodeTunnelManager
- **FR-022**: System MUST preserve tunnel lifecycle operations (start, stop, status monitoring)
- **FR-023**: System MUST continue broadcasting tunnel status events via Socket.IO

**API Request Handling**
- **FR-024**: System MUST provide uniform error handling across all API endpoints
- **FR-025**: System MUST centralize authentication checks using JWT tokens for all authentication types
- **FR-026**: System MUST maintain consistent response format across endpoints
- **FR-027**: System MUST preserve all existing API contracts and endpoint URLs

**Configuration Management**
- **FR-028**: System MUST centralize environment variable reading and configuration assembly
- **FR-029**: System MUST document all required and optional configuration parameters
- **FR-030**: System MUST provide typed configuration objects to components
- **FR-031**: System MUST support configuration override for testing environments

**Adapter Pattern**
- **FR-032**: System MUST maintain adapter pattern for session types (terminal, Claude, file editor)
- **FR-033**: System MUST preserve adapter interface contract (create, input.write, resize, close, status)
- **FR-034**: System MUST continue supporting extensibility for new session types
- **FR-035**: System MUST maintain adapter registration mechanism

**Initialization & Error Handling**
- **FR-036**: System MUST crash immediately with non-zero exit code when required service initialization fails (DatabaseManager, AuthService, etc.)
- **FR-037**: System MUST log detailed initialization failure messages including service name, error reason, and stack trace before exiting

### Non-Functional Requirements

**Maintainability**
- **NFR-001**: Refactored code MUST reduce cognitive load by limiting class responsibilities
- **NFR-002**: Refactored code MUST improve navigability with clear file organization
- **NFR-003**: Refactored code MUST reduce coupling between components

**Testability**
- **NFR-004**: Refactored architecture MUST enable unit testing with isolated components
- **NFR-005**: Refactored architecture MUST support integration testing with controlled dependencies
- **NFR-006**: Refactored architecture MUST allow test doubles (mocks, stubs) for external dependencies

**Performance**
- **NFR-007**: Refactoring MUST NOT degrade session creation performance (maintain < 100ms baseline)
- **NFR-008**: Refactoring MUST NOT degrade event processing throughput
- **NFR-009**: Refactoring MUST NOT increase memory footprint significantly (< 10% increase acceptable)

**Compatibility**
- **NFR-010**: Refactoring MUST preserve all existing API contracts
- **NFR-011**: Refactoring MUST maintain Socket.IO event protocol compatibility
- **NFR-012**: Refactoring MAY require client-side changes to align with server refactoring, and client-side code SHOULD be updated as needed to work with the refactored architecture

**Deployment**
- **NFR-013**: Refactoring MUST be deployed as Big Bang (single release) after comprehensive testing, not incrementally
- **NFR-014**: All server-side and client-side changes MUST be deployed together in coordinated release

### Key Entities _(architecture components)_

- **ServiceRegistry Module**: Simple module organizing service exports (no complex DI container - just clean ES6 exports/imports)
- **SessionRepository**: Handles CRUD operations for session metadata table
- **EventStore**: Manages append-only session event log with sequence numbers
- **SettingsRepository**: Handles application settings and user preferences
- **WorkspaceRepository**: Manages workspace metadata and relationships
- **AdapterRegistry**: Registers and retrieves session type adapters
- **EventRecorder**: Serializes and persists session events
- **SessionOrchestrator**: Coordinates session creation, input, and lifecycle
- **SocketEventMediator**: Routes socket events to domain-specific handlers with middleware
- **BaseTunnelManager**: Abstract class encapsulating shared tunnel process management logic
- **ConfigurationService**: Centralizes environment variable reading and configuration assembly
- **AuthenticationMiddleware**: Validates requests before delegating to handlers
- **ErrorHandlingMiddleware**: Standardizes error responses across socket and API handlers

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (performance targets, compatibility requirements)
- [x] Scope is clearly bounded (refactoring existing code, not adding features)
- [x] Dependencies and assumptions identified (backward compatibility, existing contracts)

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted (refactoring recommendations from analysis document)
- [x] Ambiguities marked (none - analysis document provides clear recommendations)
- [x] User scenarios defined (developer experience improvements)
- [x] Requirements generated (37 functional + 14 non-functional requirements)
- [x] Entities identified (13 architectural components)
- [x] Review checklist passed
- [x] Clarifications completed (5 questions answered on 2025-10-05)

---

## Notes

This specification translates the architectural analysis document's recommendations into testable requirements. The refactoring focuses on improving developer experience through:

1. **Explicit dependencies** replacing hidden global state
2. **Focused responsibilities** replacing monolithic classes
3. **Reusable abstractions** replacing duplicated code
4. **Organized modules** replacing sprawling files
5. **Centralized concerns** replacing scattered configuration

### Architectural Patterns

**Server-Side (Node.js/SvelteKit)**:

- **Prefer ES6 Classes** for services, repositories, managers, and adapters
  - Classes provide clear constructor-based dependency injection
  - Instance methods encapsulate behavior with explicit state
  - Inheritance/composition patterns are clearer with class hierarchies
  - Examples: `SessionRepository`, `EventStore`, `ConfigurationService`, `BaseTunnelManager`

- **Use Modules** for utility functions, constants, and stateless operations
  - Pure functions without internal state
  - Configuration constants and enums
  - Helper utilities that don't need instances

- **SvelteKit Patterns**:
  - Server-side logic in `src/lib/server/` (not exposed to client)
  - API routes as `+server.js` files with typed handlers
  - Hooks for authentication and request preprocessing
  - Clear separation between server and shared (`src/lib/shared/`) code

**Client-Side (Svelte 5)**:

- **Svelte 5 Runes in Classes** for ViewModels and state management
  - Use `$state()` rune for reactive instance properties in classes
  - Use `$derived.by()` for computed values in classes
  - Use `$effect()` for side effects in class methods
  - Examples: `SessionViewModel`, `WorkspaceState`, `ThemeState`

- **MVVM Architecture**:
  - **Models**: TypeScript interfaces/types for data structures (`src/lib/shared/types/`)
  - **Views**: Svelte components with minimal logic (`src/lib/client/*/components/`)
  - **ViewModels**: Classes with `$state` runes for reactive state (`src/lib/client/shared/state/`)
  - **Services**: Business logic and API integration (`src/lib/client/shared/services/`)

- **Dependency Injection**:
  - **SIMPLE APPROACH**: Use Svelte's `setContext`/`getContext` API for sharing services in components
  - **Server-side**: Use clean ES6 module exports/imports (no DI framework needed)
  - **Pattern**: `import { sessionRepository } from '$lib/server/database'` instead of global singletons
  - **Testing**: Module mocking (Vitest `vi.mock()`) and context overrides for tests

- **Socket.IO Integration**:
  - Reactive state updates from socket events via ViewModels
  - `SocketService` with `$state` for connection status
  - Event handlers update ViewModel state, triggering UI reactivity
  - Clear separation: Socket.IO client → Service → ViewModel → View

**Authentication Patterns**:

- **JWT Tokens Required**: All authentication MUST use JWT tokens
  - TERMINAL_KEY serves as JWT signing secret (not replaced, but repurposed)
  - Authentication flow: validate TERMINAL_KEY → issue JWT → use JWT for all subsequent requests
  - Consistent token validation across API and WebSocket
  - Token refresh and expiration handling
  - Secure token storage in client (localStorage with security considerations)
  - 401 Unauthorized responses with specific error codes (expired, invalid signature, missing claims)

**Testing Strategy**:

- **Server**: Unit tests with dependency injection, mock repositories
- **Client**: Component tests with mock services, isolated ViewModel tests
- **Integration**: E2E tests with Playwright, full stack validation
- **Deployment**: Big Bang deployment after comprehensive testing of all refactored components together

**Dependency & Transaction Management**:

- **Circular Dependency Prevention**: ES6 modules naturally prevent circular imports, fail-fast at startup if violations detected
- **Dependency Pattern**: Simple module exports (`export const repository = new Repository()`) or factory functions for initialization
- **Transaction Boundaries**: Per-request atomicity - each API/Socket request is one transaction across all repositories
- **Initialization Failure Handling**: Crash immediately with logged error and non-zero exit code for process manager restart

**Simplicity Principle**:

- **No Complex DI Frameworks**: Avoid Awilix, InversifyJS, or custom DI containers - use native JavaScript/Svelte patterns
- **Pattern**: Organize service initialization in `src/lib/server/shared/services.js` with clear exports
- **Client Pattern**: Use Svelte context API (`setContext('services', services)`) in root layout for component access

Success will be measured by:

- Developer ability to navigate codebase efficiently
- Reduced time to add new session types or features
- Improved test coverage with isolated unit tests
- No regression in existing functionality
- No performance degradation
- Clear alignment with Svelte 5 reactive patterns and MVVM architecture
- Successful Big Bang deployment with comprehensive test coverage
