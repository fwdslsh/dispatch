# Dispatch Application Architecture and Design Patterns

## Introduction

Dispatch is a secure, local-first development environment that lets users work with shells, AI agents and a
file editor through a web UI. The Node.js + SvelteKit server persists state in SQLite and exposes both
Socket.IO events and REST-like endpoints under `src/routes/api`. A central feature is the ability to spin up
terminal (`pty`), AI assistant (Claude) and file editor sessions, then replay their history on demand. This
document analyses the current architecture, highlights the design patterns in use and calls out missing
patterns. It concludes with recommendations to improve maintainability, clarity and simplicity.

## High-Level Architecture Overview

### Core server services

- **Service initialization** – `initializeServices` in
  [`src/lib/server/shared/index.js`](../../src/lib/server/shared/index.js) constructs all server
  services at start-up. It now pulls runtime options from a dedicated
  [`ConfigService`](../../src/lib/server/shared/config/ConfigService.js), ensuring paths and ports are
  resolved consistently before creating a `DatabaseManager`, `AuthService`, `RunSessionFacade`, adapters
  for each session type (`PtyAdapter`, `ClaudeAdapter`, `FileEditorAdapter`), `TunnelManager`,
  `VSCodeTunnelManager` and a `MultiAuthManager`. The resulting services are stored in a global singleton
  (`globalServicesInstance`) and re-exported for API routes, effectively acting as a service locator.[^1][^18]
- **Database** – `DatabaseManager` now focuses on connection lifecycle, table creation and shared
  coordination primitives (`writeQueue`, transactions). Purpose-built repositories wrap the major tables:
  [`SessionRepository`](../../src/lib/server/shared/db/repositories/SessionRepository.js) for session
  metadata, an [`EventStore`](../../src/lib/server/shared/db/repositories/EventStore.js) for the append-only
  event log, [`SettingsRepository`](../../src/lib/server/shared/db/repositories/SettingsRepository.js) for
  JSON-based configuration categories and [`UserRepository`](../../src/lib/server/shared/db/repositories/UserRepository.js)
  for user preferences. Each repository depends on the manager for query helpers while enforcing single
  responsibility, and a lightweight [`UnitOfWork`](../../src/lib/server/shared/db/UnitOfWork.js) provides
  transactional coordination when multiple repositories must update together.[^2]
- **Run sessions** – `RunSessionFacade` orchestrates the lifetime and history of run sessions on top of a
  dedicated collaborator set: a [`RunSessionAdapterRegistry`](../../src/lib/server/shared/runtime/RunSessionAdapterRegistry.js)
  resolves adapters per session kind, a [`LiveRunSessionRegistry`](../../src/lib/server/shared/runtime/LiveRunSessionRegistry.js)
  tracks active processes and sequence counters, and a [`SessionEventRecorder`](../../src/lib/server/shared/runtime/SessionEventRecorder.js)
  persists events while emitting them through an internal event bus. When a session is created the service
  persists metadata, instantiates the appropriate adapter, buffers events during initialization and flushes
  them once the process is ready. Emitted events (terminal output, Claude deltas, file-editor operations)
  are appended to an event log with monotonically increasing sequence numbers and then raised on the event
  bus so Socket.IO and other subscribers can forward them to clients. This event-sourced model allows
  consumers to request events since a given sequence number and replay history on demand.[^3]
- **Authentication** – `AuthService` caches a terminal key and delegates OAuth/device pairing to
  `MultiAuthManager`. The multi-auth system defines an abstract `AuthProvider` interface with concrete
  providers for GitHub OAuth and device pairing.[^4] `AuthService` first compares a provided token against
  the terminal key; if that fails, it validates the token as an OAuth session via the `MultiAuthManager`.[^5]
- **Tunnels** – `TunnelManager` and `VSCodeTunnelManager` now extend a shared
  [`BaseTunnelManager`](../../src/lib/server/shared/BaseTunnelManager.js) that encapsulates logging, Socket.IO
  emission and persistence helpers. Each subclass spawns CLI processes to expose either the Dispatch HTTP
  server or a VS Code remote session, while the base class keeps the persistence logic consistent.[^6][^19]
- **History manager** – `HistoryManager` keeps an in-memory cache of socket-connection histories while
  persisting each event to the database. It updates session metadata based on event types and sanitizes
  sensitive data before logging.[^7]
- **Socket.IO integration** – [`socket-setup.js`](../../src/lib/server/shared/socket-setup.js) initializes a
  Socket.IO server and configures a [`SocketMediator`](../../src/lib/server/shared/socket/SocketMediator.js)
  that wires modular handler packages for authentication, run sessions, tunnels and VS Code connectivity.
  Shared middleware such as authentication checks and logging is centralized in the mediator while handler
  modules invoke the appropriate services.[^8]
- **Utilities** – Modules under `src/lib/server/shared/utils` contain helpers for error handling, method
  invocation, logging and environment building. [`error-handling.js`](../../src/lib/server/shared/utils/error-handling.js)
  defines wrappers that decorate async operations with standardized error logging, while
  [`logger.js`](../../src/lib/server/shared/utils/logger.js) exposes a centralized logger with configurable
  log levels. The `ConfigService` centralizes environment lookups so modules can consume typed
  configuration without querying `process.env` directly.[^9][^18]

### Front end and API

- **Svelte front end** – The web UI is built with SvelteKit. It manages authentication, attaches to run
  sessions and interacts with terminals or Claude through reactive components that call REST endpoints and
  subscribe to Socket.IO events.
- **API endpoints** – Files under `src/routes/api` define SvelteKit `+server.js` modules for each REST-like
  route. A new controller layer lives under
  [`src/lib/server/shared/api`](../../src/lib/server/shared/api) with a reusable `BaseController`,
  schema helpers and a `createControllerRoute` factory. Controllers now power the settings and user
  preferences APIs, centralizing authentication checks, schema validation and JSON formatting while
  delegating business logic to services. Legacy endpoints still rely on manual `try/catch` wrappers, so
  the controller layer will continue to expand across the remaining routes.

## Design Patterns in Use

### Event-sourced architecture and CQRS

Every run session records output into a `session_events` table with a sequence number.[^10] Clients never
query the process directly; they subscribe to the `RunSessionFacade` event bus, typically via Socket.IO,
and can request a backlog since a sequence number.[^11] Commands (input, resize, close, operations) are
handled by the facade, which routes them through the `LiveRunSessionRegistry` and persists them with the
`SessionEventRecorder`. This separates writes from reads (CQRS), enables resumable sessions and ensures a complete
audit trail.

### Adapter pattern

A `RunSessionAdapterRegistry` keeps a map of adapters keyed by session kind so `RunSessionFacade` can
delegate session creation while treating all kinds uniformly.[^12] Concrete adapters include:

- **`PtyAdapter`** – Spawns a pseudo-terminal via `node-pty` and emits stdout chunks and exit events.
- **`ClaudeAdapter`** – Wraps the Anthropic Claude Code SDK, streaming assistant deltas while handling
  timeouts and errors.
- **`FileEditorAdapter`** – Implements a minimal file editor using an `EventEmitter`-based process. It
  exposes the same methods as other adapters and emits initialization, content, result and error events.[^13]

### Service locator / singleton

[`initializeServices`](../../src/lib/server/shared/index.js) stores server services in
`globalServicesInstance`. API endpoints import `__API_SERVICES` to access concrete services, effectively
using a service locator.[^1] This simplifies access at the cost of coupling and difficult testing.

### Strategy pattern

Authentication supports multiple strategies through the `AuthProvider` abstraction. `GitHubAuthProvider`
constructs authorization URLs, exchanges codes for tokens and fetches user data, while
`DevicePairingProvider` generates one-time codes and persists device info.[^4][^14] `MultiAuthManager`
registers providers, tracks active sessions, persists sessions and authenticates credentials by delegating to
providers. `AuthService` then combines terminal-key and OAuth validation.

### Data access object (DAO)

`DatabaseManager` now composes dedicated repositories that act as DAOs: `SessionRepository` handles
session metadata, `EventStore` appends and replays session events, `SettingsRepository` manages JSON
configuration and `UserRepository` persists user preferences. Each repository builds on the manager's
`run`/`get`/`all` helpers and `writeQueue`, so higher-level services depend on cohesive, testable DAO-style
objects instead of issuing ad-hoc SQL.[^2]

### Decorator / proxy for error handling

To avoid repetitive `try/catch` logic, `error-handling.js` exports factories that wrap asynchronous
operations. `createErrorHandler` logs errors and returns fallback values, while
`createSocketErrorHandler` and `createServiceHandler` specialize the wrapper for Socket.IO callbacks and
service methods.[^9][^15] `wrapManagerMethod` can replace a manager method with its decorated version to
enforce consistent logging.

### Observer / pub-sub

Socket.IO implements the observer pattern. Producers emit events to channels and clients subscribe.
`RunSessionFacade` emits domain events (`runSession:started`, `runSession:event`, etc.) through an
`EventEmitter`; `socket-setup.js` subscribes to that bus and forwards each payload to both `runSession:<id>`
and the legacy `run:<id>` rooms so clients can transition gradually.[^8][^11] Handlers for
`runSession:attach`/`run:attach`, `runSession:input`, `runSession:resize`, `runSession:close` and
additional events remain modular inside the mediator.
inside the mediator. Tunnel managers and the history manager also broadcast status and admin events,
decoupling producers from consumers.

### Caching

[`ClaudeCommandCache`](../../src/lib/server/claude/ClaudeCommandCache.js) implements a TTL-based cache
for storing command metadata keyed by workspace and Claude executable path. `get`, `set` and
`getOrFetch` provide simple expiration logic that reduces redundant calls.[^16]

### Factory and utility patterns

Modules such as [`history-manager.js`](../../src/lib/server/shared/history-manager.js) and
[`env.js`](../../src/lib/server/shared/utils/env.js) expose factory-style helpers for building environment
configurations (`buildExecEnv`, `buildClaudeOptions`, `buildTerminalOptions`). These functions follow a
builder-like pattern by providing sensible defaults and merging environment variables.[^7][^17]

## Areas Lacking Clear Design Patterns

Despite the thoughtful use of patterns, several parts of the codebase lack cohesive structure or replicate
logic, presenting opportunities for refactoring.

### Monolithic classes and high coupling

- **Database layer** – `DatabaseManager` now delegates session, event, settings and user persistence to
  repositories, reducing the previous single-class bottleneck. Workspace layout utilities and logging
  helpers still live on the manager; extracting additional repositories for those domains would further
  improve cohesion.
- **Run session runtime** – The previous monolithic `RunSessionManager` has been decomposed into
  `RunSessionFacade`, `RunSessionAdapterRegistry`, `LiveRunSessionRegistry` and `SessionEventRecorder`, which greatly clarifies
  responsibilities. Future iterations could expose higher-level domain services (e.g. metrics collectors or
  policy engines) by subscribing to the event bus rather than embedding that logic directly in the runtime.
- **`socket-setup.js`** previously concentrated every Socket.IO handler. The mediator split alleviates the
  worst coupling, though auxiliary admin helpers and socket-event utilities could still be further
  decomposed for clarity.[^8]

### Global state and service locator

The module-level singleton couples the application to concrete implementations and prevents dependency
injection. API handlers call `__API_SERVICES` directly rather than receiving dependencies, hiding the order of
initialization and complicating runtime reconfiguration.

### Inconsistent API design

- The new controller layer unifies the settings and preferences APIs, applying shared schema validation and
  error handling through `createServiceHandler`. Many other endpoints still execute CLI commands or parse
  requests manually, so expanding controller coverage remains a priority.
- `src/routes/api` retains several legacy handlers (e.g. sessions, git, tunnel management) that duplicate
  request parsing and authentication checks. Migrating them to controllers will eliminate the remaining
  boilerplate.

### Missing abstractions for events

Socket event types are plain strings defined in `socket-events.js`. The mediator now coordinates cohesive
handler modules, but structured event typing and schema validation would further ease cross-cutting
concerns such as logging, metrics and authorization scopes.

### Hard-coded environment and configuration

`ConfigService` now resolves database paths, server ports, tunnel flags and the terminal key. Core adapters
(`PtyAdapter`, `FileEditorAdapter`) and authentication cache lookups consume the service instead of reading
`process.env` directly. Several legacy helpers still access environment variables ad hoc, so continuing the
migration will further improve testability and clarity.

## Recommendations for Improvement

### Introduce dependency injection

Replace the service locator with a lightweight dependency injection container. Register services (database,
run session manager, auth, tunnel managers) in the container and inject them into API and socket handlers.
This decouples components, makes dependencies explicit and simplifies testing. Libraries like Awilix or
InversifyJS—or even a minimal custom container—would suffice.

### Decompose monolithic classes

- **Extend the repository split** – With `SessionRepository`, `EventStore`, `SettingsRepository` and
  `UserRepository` in place, continue moving workspace-layout and logging concerns into dedicated
  repositories/services so the manager remains focused on coordination. Adopt the shared `UnitOfWork`
  helper wherever multi-table updates still appear in feature code.
- **Leverage the run session facade** – With `RunSessionFacade`, `RunSessionAdapterRegistry`, `LiveRunSessionRegistry` and
  `EventRecorder` in place, start extracting cross-cutting observers (e.g. logging, metrics, auditing)
  that subscribe to the event bus instead of embedding those behaviours in adapters. This keeps the core
  runtime slim while enabling richer instrumentation through dedicated services.
- **Extend the socket mediator** – Continue evolving the mediator by adding per-event schema validation,
  richer telemetry hooks and coverage for additional domains (e.g. workspace management). This keeps new
  events easy to add while ensuring consistent middleware and observability.

### Unify API request handling

Add a controller layer that wraps API endpoints. Each controller method accepts a request, calls services,
handles errors and returns standardized responses. Wrap controller methods with `createServiceHandler` to
ensure uniform logging and error handling. Centralize parameter validation with a schema validation library
(e.g. Zod) to reduce boilerplate.

### Expand configuration usage

Continue broadening adoption of `ConfigService` across remaining modules (e.g. git and tunnel helpers). The
service now exposes resolved paths, tunnel flags, the terminal key and a shared environment snapshot, so
documenting additional keys within the service keeps the configuration surface easy to audit while avoiding
direct `process.env` reads.

### Improve typing and documentation

Adopt TypeScript or add comprehensive JSDoc annotations for server modules. Declare interfaces for
adapters, repositories and services to ensure implementations respect contracts. Generate documentation
from these types where possible.

### Adopt domain-driven nomenclature

Use names that reflect domain concepts—`RunSession`, `SessionEvent`, `Workspace`,
`AuthenticationSession`—to improve clarity.

### Consider an event store or message bus

Abstract the event log behind an `EventStore` interface to allow swapping SQLite for another durable store
or integrating a message queue (e.g. Redis, NATS). A message bus would support an event-driven
architecture where services react to session events without coupling to `RunSessionFacade`.

## Conclusion

Dispatch demonstrates thoughtful use of event sourcing, adapters, the strategy pattern for authentication,
a DAO for database access, decorators for error handling and observer patterns via Socket.IO. These
choices enable resumable sessions, modular session types and flexible authentication. However, monolithic
classes, duplicated logic and heavy reliance on global state hinder maintainability. By introducing
dependency injection, decomposing responsibilities, abstracting repeated code, unifying API handling and
centralizing configuration, Dispatch can become easier to understand and evolve sustainably.

[^1]: [`src/lib/server/shared/index.js`](../../src/lib/server/shared/index.js)

[^2]: [`src/lib/server/shared/db/DatabaseManager.js`](../../src/lib/server/shared/db/DatabaseManager.js)

[^3]: [`src/lib/server/shared/runtime/RunSessionFacade.js`](../../src/lib/server/shared/runtime/RunSessionFacade.js)

[^4]: [`src/lib/server/shared/auth/oauth.js`](../../src/lib/server/shared/auth/oauth.js)

[^5]: [`src/lib/server/shared/auth.js`](../../src/lib/server/shared/auth.js)

[^6]: [`src/lib/server/shared/TunnelManager.js`](../../src/lib/server/shared/TunnelManager.js), [`src/lib/server/shared/VSCodeTunnelManager.js`](../../src/lib/server/shared/VSCodeTunnelManager.js)

[^7]: [`src/lib/server/shared/history-manager.js`](../../src/lib/server/shared/history-manager.js)

[^8]: [`src/lib/server/shared/socket-setup.js`](../../src/lib/server/shared/socket-setup.js)

[^9]: [`src/lib/server/shared/utils/error-handling.js`](../../src/lib/server/shared/utils/error-handling.js), [`src/lib/server/shared/utils/logger.js`](../../src/lib/server/shared/utils/logger.js)

[^10]: [`src/lib/server/shared/db/repositories/EventStore.js`](../../src/lib/server/shared/db/repositories/EventStore.js) – event append/replay helpers

[^11]: [`src/lib/server/shared/runtime/RunSessionFacade.js`](../../src/lib/server/shared/runtime/RunSessionFacade.js) – session event bus

[^12]: [`src/lib/server/shared/runtime/RunSessionAdapterRegistry.js`](../../src/lib/server/shared/runtime/RunSessionAdapterRegistry.js) – adapter registry

[^13]: [`src/lib/server/file-editor/FileEditorAdapter.js`](../../src/lib/server/file-editor/FileEditorAdapter.js)

[^14]: [`src/lib/server/shared/auth/oauth.js`](../../src/lib/server/shared/auth/oauth.js) – provider implementations

[^15]: [`src/lib/server/shared/utils/error-handling.js`](../../src/lib/server/shared/utils/error-handling.js) – `createServiceHandler`

[^16]: [`src/lib/server/claude/ClaudeCommandCache.js`](../../src/lib/server/claude/ClaudeCommandCache.js)

[^17]: [`src/lib/server/shared/utils/env.js`](../../src/lib/server/shared/utils/env.js)

[^18]: [`src/lib/server/shared/config/ConfigService.js`](../../src/lib/server/shared/config/ConfigService.js)

[^19]: [`src/lib/server/shared/BaseTunnelManager.js`](../../src/lib/server/shared/BaseTunnelManager.js)
