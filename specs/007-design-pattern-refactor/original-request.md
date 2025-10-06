# Dispatch Application Architecture and Design Patterns

Introduction

Dispatch is a secure, local‑first development environment that lets users interact with shells, AI agents and a file editor through a web UI. The server is built on Node.js and SvelteKit, with a SQLite database for persistence. A central feature of Dispatch is the ability to spin up different kinds of run sessions—either a terminal (pty), an AI assistant (Anthropic Claude) or a file editor—and to keep each session’s history so that it can be resumed later. The application exposes its functionality via Socket.IO events and REST‑like API endpoints under src/routes/api. This document analyses the current architecture, highlights the principal design patterns used and identifies areas where patterns are missing. It concludes with detailed recommendations to improve maintainability, clarity and simplicity.

High‑Level Architecture Overview
Core server services

Service initialization – A function in src/lib/server/shared/index.js constructs all server services at start‑up. It creates a DatabaseManager, AuthService, RunSessionManager, adapters for each session type (PtyAdapter, ClaudeAdapter, FileEditorAdapter), TunnelManager/VSCodeTunnelManager, and a MultiAuthManager. The services are stored in a global singleton (globalServicesInstance) and re‑exported for API routes, effectively acting as a service locator
raw.githubusercontent.com
.

Database – DatabaseManager encapsulates all SQLite interactions. It creates unified tables for sessions, session events, workspace layouts, settings, logs and user preferences
raw.githubusercontent.com
. A writeQueue ensures serial execution of database writes to prevent concurrency conflicts
raw.githubusercontent.com
.

Run sessions – RunSessionManager manages lifetime and event history of run sessions. It uses the adapter pattern to handle different session kinds. When a session is created, it persists metadata in the database, instantiates the appropriate adapter and buffers events during initialization
raw.githubusercontent.com
. Events emitted by a session (terminal output, Claude deltas, file‑editor operations) are appended to an event log with a monotonically increasing sequence number and then emitted via Socket.IO
raw.githubusercontent.com
. This event‑sourced model allows clients to catch up by requesting events since a given sequence number.

Authentication – AuthService caches a terminal key and delegates OAuth/device pairing to MultiAuthManager. The multi‑auth system defines an abstract AuthProvider interface with concrete providers for GitHub OAuth and device pairing
raw.githubusercontent.com
raw.githubusercontent.com
. The AuthService uses a two‑strategy validation: first it compares a provided token against the terminal key; if that fails and a MultiAuthManager is wired in, it validates the token as an OAuth session
raw.githubusercontent.com
.

Tunnels – TunnelManager and VSCodeTunnelManager spawn CLI processes to expose the local server and a VS Code remote session over secure tunnels. Both classes track process output, update state in the database and broadcast tunnel status events via Socket.IO. The implementations are similar yet not abstracted into a base class
raw.githubusercontent.com
raw.githubusercontent.com
.

History manager – HistoryManager keeps an in‑memory cache of socket‑connection histories and persists each event to the database. It updates session metadata based on event types and sanitizes sensitive data before logging
raw.githubusercontent.com
raw.githubusercontent.com
.

Socket.IO integration – socket-setup.js initializes a Socket.IO server and registers handlers for authentication, run session attachment, input, resizing, closing, tunnel control, etc. Each event handler validates authentication, calls into the appropriate service and emits responses
raw.githubusercontent.com
raw.githubusercontent.com
. The file also maintains a rotating buffer of recent events for admin debugging.

Utilities – Modules under src/lib/server/shared/utils contain helpers for error handling, method invocation, logging and environment building. error-handling.js defines wrappers that decorate async operations with standardized error logging and callback behaviour
raw.githubusercontent.com
. logger.js exposes a centralized logger with configurable log levels
raw.githubusercontent.com
.

Front‑end and API

Svelte front‑end – The web UI is built with SvelteKit. It uses reactive components to manage authentication, attach to run sessions and interact with terminals or Claude. UI components fetch data via the REST‑like API under /api and subscribe to Socket.IO events.

API endpoints – Each file under src/routes/api defines a SvelteKit +server.js module for a specific route. Many endpoints wrap service calls in try/catch and return JSON responses. Some endpoints directly execute command‑line tools (e.g., Claude CLI) or read files. The error‑handling utilities are not consistently used across endpoints; some replicate similar validation and logging logic.

Design Patterns in Use

This section identifies the main design patterns currently employed in Dispatch and highlights their implementation.

Event‑sourced architecture and CQRS

The core of Dispatch is its event‑sourced session model. Each run session records every piece of output (terminal stdout, AI deltas, editor operations) into a session_events table with a sequence number
raw.githubusercontent.com
. Clients never directly query the process; instead they receive events over Socket.IO and can request a backlog of events since a given sequence number
raw.githubusercontent.com
. Commands (input, resize, close, operations) are handled by RunSessionManager and written back to the event log. This approach cleanly separates writes from reads (the CQRS principle), facilitates resuming sessions and ensures a complete audit trail.

Adapter pattern

Dispatch supports multiple session types without duplicating session logic. RunSessionManager holds a map of adapters keyed by session kind and delegates session creation to the appropriate adapter
raw.githubusercontent.com
. Each adapter exposes a common interface (create(), input.write(), resize(), close() and status methods). Concrete adapters include:

PtyAdapter – Spawns a pseudo‑terminal via node-pty and emits stdout chunks and exit events. The returned object implements methods for input, resizing and clearing the terminal (not shown here).

ClaudeAdapter – Wraps the Anthropic Claude Code SDK and streams assistant deltas as events. It handles timeouts and error states.

FileEditorAdapter – Implements a minimal file editor using an EventEmitter based process. The adapter returns an object exposing the same methods as other adapters and emits initialization, content, result and error events
raw.githubusercontent.com
.

This pattern allows RunSessionManager to treat sessions uniformly, improving extensibility and testability.

Service locator / Singleton

The initializeServices function builds all server services once and stores them in a module‑level variable (globalServicesInstance). API endpoints import \_\_API_SERVICES to access the AuthService, RunSessionManager, DatabaseManager and tunnel managers
raw.githubusercontent.com
. This global state acts as a service locator, simplifying access but coupling modules to concrete implementations and hindering testability.

Strategy pattern

Authentication supports multiple strategies. The abstract AuthProvider class defines methods for initializing, authenticating, getting OAuth URLs, handling callbacks, refreshing tokens and revoking sessions
raw.githubusercontent.com
. GitHubAuthProvider implements GitHub OAuth by constructing authorization URLs, exchanging codes for tokens and fetching user data
raw.githubusercontent.com
. DevicePairingProvider implements device pairing by generating one‑time codes and storing device info in a database
raw.githubusercontent.com
. MultiAuthManager registers providers, tracks active sessions, persists sessions in the database and authenticates credentials by delegating to the selected provider
raw.githubusercontent.com
. The AuthService then selects between terminal‑key authentication and OAuth session validation
raw.githubusercontent.com
. This strategy pattern makes adding new authentication methods straightforward.

Data Access Object (DAO)

DatabaseManager encapsulates all database interactions. It creates tables, runs migrations, ensures concurrency via the writeQueue and exposes methods such as createRunSession(), appendSessionEvent(), getSessionEventsSince(), createSession(), addSessionEvent() and others
raw.githubusercontent.com
raw.githubusercontent.com
. Higher‑level services treat it as a repository rather than writing SQL directly. This centralization simplifies schema changes and enforces serial writes.

Decorator / Proxy for error handling

To avoid repetitive try/catch logic, error-handling.js provides factory functions that wrap asynchronous operations. createErrorHandler returns a function that logs errors and returns a fallback value or rethrows, while createSocketErrorHandler and createServiceHandler specialize the wrapper for Socket.IO callbacks and service methods
raw.githubusercontent.com
raw.githubusercontent.com
. wrapManagerMethod can replace a method on a manager with its decorated version
raw.githubusercontent.com
. This pattern reduces boilerplate and enforces consistent logging.

Observer / Pub‑Sub

Socket.IO implements the observer pattern: clients subscribe to events on channels and the server emits events when something happens. RunSessionManager emits events through the Socket.IO room run:<id> whenever a session event is recorded
raw.githubusercontent.com
. socket-setup.js registers listeners for run:attach, run:input, run:resize, run:close and other events and forwards them to the appropriate services
raw.githubusercontent.com
. Tunnel managers and the history manager also broadcast status and admin events. This decouples event producers from consumers and enables real‑time updates.

Caching

ClaudeCommandCache implements a simple TTL‑based cache for storing command metadata keyed by workspace and Claude executable path. It defines get(), set() and getOrFetch() methods with expiration logic
raw.githubusercontent.com
. This reduces redundant calls to expensive operations.

Factory and Utility Patterns

Some modules use simple factories. createHistoryManager() returns a new HistoryManager instance given a DatabaseManager
raw.githubusercontent.com
. Environment building functions (buildExecEnv, buildClaudeOptions, buildTerminalOptions) encapsulate common construction logic for process options
raw.githubusercontent.com
raw.githubusercontent.com
raw.githubusercontent.com
. These functions follow the Builder pattern, providing sensible defaults and merging environment variables.

Areas Lacking Clear Design Patterns

Despite the thoughtful use of patterns above, several parts of the codebase lack a cohesive design or replicate logic. These areas offer opportunities for refactoring.

Monolithic classes and high coupling

DatabaseManager – The class handles connection initialization, schema creation, migrations, session management, event logging, workspace management and settings retrieval. It violates the Single Responsibility Principle and mixes multiple concerns. Splitting it into repositories (e.g., SessionRepository, EventStore, SettingsRepository) would improve cohesion.

RunSessionManager – Responsible for session creation, event buffering, event persistence, adapter management, sequence numbering, input forwarding and resume logic
raw.githubusercontent.com
raw.githubusercontent.com
. Decomposing responsibilities (e.g., separate EventStore, SessionRegistry, InputDispatcher) would simplify reasoning and testing.

socket-setup.js – Contains hundreds of lines of event handler code for various domains (authentication, run sessions, tunnels, admin events, workspace events). All handlers live in a single module, making it hard to navigate and maintain
raw.githubusercontent.com
.

Global state and service locator

Using a module‑level singleton for services ties the application to concrete implementations and prevents injecting mock dependencies during tests. API handlers call \_\_API_SERVICES directly instead of receiving dependencies. This coupling also hides the order of initialization and can lead to subtle bugs if services are reconfigured at runtime.

Duplication in tunnel managers

TunnelManager and VSCodeTunnelManager both spawn a process, parse its output, update state, expose commands to start/stop and broadcast status events
raw.githubusercontent.com
raw.githubusercontent.com
. The two classes share similar fields (proc, status, listeners, authStatus), command‑building logic and event handling but do not share a base class or common interface. Changes to one must be manually ported to the other.

Inconsistent API design

Some API endpoints directly execute CLI commands via exec() and write files; others call into services. Error handling and logging are ad‑hoc; many endpoints do not use the createServiceHandler utilities and thus have inconsistent error responses.

src/routes/api has multiple subfolders with similar behaviour (e.g., listing sessions, controlling tunnels, managing settings) but no common abstraction. The repeated try/catch patterns and manual request parsing could be encapsulated in a router or controller layer.

Missing abstractions for events

Socket event types are represented as plain strings defined in socket-events.js. While this centralizes constants, the handlers are not organized into cohesive modules. A high‑level event bus or mediator object could allow each domain (sessions, auth, tunnels) to register its own handlers. Currently, all events are processed in a single function, making cross‑cutting concerns (authentication, logging) difficult to enforce consistently.

Hard‑coded environment and configuration

Adapters and tunnel managers often read directly from process.env and require certain environment variables to be set. The configuration retrieval logic is scattered across modules rather than centralized in a configuration service. This makes it difficult to understand all required settings and to override them in different environments.

Recommendations for Improvement

To enhance maintainability, clarity and simplicity, the following recommendations use established design patterns and best practices.

Introduce dependency injection

Replace the service locator with a lightweight Dependency Injection (DI) container. Each service (database, run session manager, auth, tunnel managers) would be registered in the container and injected into API handlers and socket handlers. This decouples components, makes dependencies explicit and allows tests to substitute mocks. Libraries like Awilix, InversifyJS or even a minimal custom container could be used.

Decompose monolithic classes

Refactor DatabaseManager into repositories – Create separate repositories such as SessionRepository for CRUD operations on the sessions table, EventStore for append‑only logs, SettingsRepository and UserRepository. Each repository would expose only the methods relevant to its data model. This follows the Repository pattern and respects single responsibility. A UnitOfWork could coordinate transactions when multiple repositories need to be updated atomically.

Split RunSessionManager – Separate responsibilities into smaller classes: an AdapterRegistry for registering and retrieving adapters, an EventRecorder for serializing events, a LiveRunRegistry for tracking live runs and a RunSessionService that orchestrates creation, input forwarding and resumption. Use an EventEmitter or an Observable for emitting session events rather than directly calling Socket.IO, allowing other consumers (e.g., logging, metrics) to subscribe. This transformation aligns with the Facade pattern, providing a simplified API over the underlying components.

Modularize socket handlers – Adopt a Mediator pattern or an event bus. Instead of one socket-setup.js file containing all handlers, define separate modules: runSessionSocketHandlers, authSocketHandlers, tunnelSocketHandlers, settingsSocketHandlers. Each module registers its events against a mediator that performs common middleware tasks (e.g., authentication, error handling). The mediator can be created with injected services and passed to Socket.IO. This structure improves readability and makes adding new events straightforward.

Abstract tunnel management

Create an abstract BaseTunnelManager encapsulating common logic: spawning a process, parsing its output, broadcasting status, updating settings and cleaning up. Both TunnelManager and VSCodeTunnelManager would extend this base class and implement the specifics of constructing command arguments and interpreting outputs. This follows the Template Method pattern, ensuring shared steps are executed consistently while allowing specialisation.

Unify API request handling

Introduce a Controller layer that wraps API endpoints. Each controller method would accept a request, call into services, handle errors and return standardized responses. Use the existing createServiceHandler decorator to wrap controller methods, ensuring uniform logging and error handling. Parameter validation could be centralized using a schema validation library. This reduces boilerplate and clarifies the responsibilities of each endpoint.

Centralize configuration

Define a ConfigService that reads environment variables, CLI flags and configuration files and exposes typed configuration objects. All modules would depend on ConfigService instead of reading process.env directly. This approach uses the Builder or Factory pattern to assemble configuration, improves testability and documents required settings in one place.

Improve typing and documentation

Adopting TypeScript or adding JSDoc annotations consistently across modules would improve type safety and developer experience. For example, declaring interfaces for adapters, repositories and services helps ensure implementations respect contracts. Documentation could be generated automatically from these types.

Adopt domain‑driven nomenclature

Rename modules and variables to reflect domain concepts: RunSession instead of generic run, SessionEvent instead of event log entries, Workspace for groups of files, AuthenticationSession for OAuth sessions. Clear naming is a simple yet effective pattern to improve clarity.

Consider event store or message bus

For scalability, the event log could be abstracted behind an Event Store interface. This would allow swapping SQLite for other durable stores and integrate with a message queue (e.g., Redis, NATS) so multiple workers can consume events. Introducing a message bus would also enable event‑driven architecture patterns: other services could react to session events without coupling to RunSessionManager.

Conclusion

Dispatch demonstrates thoughtful use of several design patterns: event sourcing, adapters, strategy for authentication, a DAO for database access, decorators for error handling and observer patterns via Socket.IO. These choices enable resumable sessions, modular session types and flexible authentication. However, the codebase also contains monolithic classes, duplicated logic and heavy reliance on global state. By introducing dependency injection, decomposing responsibilities, abstracting repeated code, unifying API handling and centralizing configuration, the project can become more maintainable, clearer and simpler. Implementing these refactorings will make it easier for new contributors to understand the system and for the application to grow sustainably.
