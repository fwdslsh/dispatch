# Dispatch Architecture Review — 2025-09-17

## Scope
- Full-stack assessment spanning server services, Socket.IO integration, shared state, and client MVVM layers.
- Focus on maintainability, clarity of flow, and alignment with stated refactoring goals (DI container, AppStateManager, MVVM separation).

## Architectural Strengths
- **Dependency setup**: `ServerServiceContainer` cleanly initializes core managers without global mutable state.
- **Session registry**: Plugin-based `SessionRegistry` reduces indirection and clarifies type-specific session handling.
- **Frontend DI**: The service container centralizes client-side dependencies and promotes lazy instantiation.
- **Runes adoption**: Core view models leverage Svelte 5 runes for readable reactive logic.

## Key Findings & Risks

### 1. Fragmented State Management
- Client components still consume legacy singleton stores (`sessionState`, `workspaceState`, `uiState`) alongside the new `AppStateManager`.
- Dual mutation paths (e.g., `sessionState.setDisplayedSessions`) reintroduce race conditions and dilute the single-source-of-truth goal.
- Reintroduces the same loop hazards that initiated the MVVM refactor, complicating debugging.

### 2. DI Contract Drift
- `ServiceContainer` instantiates `WindowViewModel` with `AppStateManager`, but the constructor signature expects a `SessionViewModel` and `LayoutService`.
- Similar mismatches likely exist where factories are updated incrementally.
- Breaks inversion-of-control guarantees, leading to runtime errors or hidden reliance on globals.

### 3. Leaky MVVM Boundaries
- `SessionViewModel` mixes API orchestration, UI filter state, persistence, and verbose console logging.
- `WorkspacePage` handles authentication, DOM event listeners, and service wiring, undermining the “thin View” aspiration.
- Testing these layers in isolation remains difficult; business rules stay coupled to presentation concerns.

### 4. Window Manager State Duplication
- Both `WindowViewModel` and `SessionWindowManager` maintain their own `tile ↔ session` maps.
- The Svelte component reads DOM (`document.querySelectorAll`) inside `$effect` to allocate tiles, making SSR/hydration fragile.
- Logic for assignment belongs in the view model or a service, not the DOM layer.

### 5. Real-time Pipeline Inconsistency
- Socket initialization still depends on `globalThis.__DISPATCH_SOCKET_IO` even with the DI container in place.
- Message buffering lives in multiple layers (socket emit wrapper, `MessageBuffer`, remnants of `SessionRouter`).
- Delivery semantics are unclear; future transports or tests must navigate redundant buffering.

### 6. Overgrown Claude Session Manager
- `ClaudeSessionManager` combines CLI orchestration, stream handling, retries, DB persistence, and OAuth glue.
- Mixed logging (`logger` vs. raw `console.log`), large method bodies (>100 lines), and fire-emojis remain from debug sessions.
- Refactoring into smaller collaborators is required before meaningful test coverage can be added.

### 7. Observability & Logging Drift
- Client code uses direct `console.log` for control flow insight; server code mixes `logger` and `console`.
- Lacks log-level discipline, structured metadata, and consistent sinks, complicating production diagnostics.

### 8. Testing Gaps
- No unit/integration tests cover the new dispatcher layers (`AppStateManager`, DI container, `SessionRegistry`).
- Socket and tiling refactors lack regression harnesses, increasing risk during further cleanup.

### 9. Session Module Boundaries Not Codified
- Session types still rely on ad-hoc knowledge of shared services (e.g. direct access to Socket.IO, WorkspaceManager, database helpers).
- There is no published contract describing lifecycle hooks, event wiring, or capability advertisement for a session module.
- Adding or removing a session implementation requires editing core orchestration (`socket-setup.js`, API handlers, view-model logic), breaking the goal of plug-in style extensibility.

## Recommendations

### Immediate (Blockers)
1. Align `ServiceContainer` factories with constructor signatures; add assertions during instantiation.
2. Remove legacy singleton store usage from `WorkspacePage` and related components; surface all state via `AppStateManager` and derived selectors.

### Short Term (Next Sprint)
1. Centralize tile assignment in `WindowViewModel`/`TileAssignmentService`; stop scraping DOM for IDs.
2. Replace raw `console.log` with the shared logger (client and server), and add linting to enforce it.
3. Collapse Socket.IO buffering to `MessageBuffer`; expose replay via the registry instead of patched `socket.emit`.

### Medium Term
1. Formalize a session-module contract that covers registration metadata, lifecycle hooks (create, resume, dispose), capability discovery, and event publishing. Document how modules register with both the server and client containers.
2. Decompose `ClaudeSessionManager` into focused services (command catalogue, stream driver, auth bridge) with tests.
3. Split `SessionViewModel` responsibilities: isolate UI filters, persistence, and API orchestration; while exposing typed state transitions in `AppStateManager`.
4. Add targeted unit/integration tests for session creation, streaming, and tile assignment flows, including a fixture module that exercises the module contract.

### Strategic
1. Introduce a module registry abstraction shared by both API routes and Socket.IO so that new session types can be mounted by configuration alone.
2. Ship developer documentation and scaffolding (template repository or generator script) that demonstrates how to implement and register a custom session type end-to-end.
3. Establish automated regression tests that spin up the app with only a subset of modules enabled to guarantee graceful enable/disable behavior.

## Suggested Follow-Up
- Track remediation via a dedicated programme (see accompanying ticket plan).
- Revisit architecture docs after short-term actions land to confirm the MVVM and DI goals hold under real workloads.
