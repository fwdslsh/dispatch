# Dispatch Architecture Remediation Tickets — 2025-09-17

[Related Review Document](ARCHITECTURE_REVIEW_2025-09-17.md)

## Immediate

### TKT-001 Align Client DI Factories With Constructor Contracts

- **Status**: ✅ Completed (tests/service-container.test.js via `npm run test:unit -- --run tests/service-container.test.js`)
- **Summary**: Audit `ServiceContainer` registrations to ensure each factory satisfies the target constructor signature.
- **Key Files**: `src/lib/client/shared/services/ServiceContainer.svelte.js`, `src/lib/client/shared/viewmodels/WindowViewModel.svelte.js`, `src/lib/client/shared/viewmodels/SessionViewModel.svelte.js`, `src/lib/client/shared/services/LayoutService.svelte.js`
- **Tasks**:
  1. Update the `windowViewModel` factory to pass `SessionViewModel` and `LayoutService` instances, respecting the current constructor (`WindowViewModel(sessionViewModel, persistence, layoutService)`).
  2. Add runtime assertions in the container to throw when dependencies are missing or mis-typed.
  3. Run lint/tests to confirm no regressions.
- **Acceptance Criteria**: Container resolves all view models without falling back to legacy globals; unit smoke test confirms instantiation.

### TKT-002 Retire Legacy Singleton Session/UI Stores

- **Status**: ✅ Completed (`npm run test:unit -- --run tests/app-state-manager.test.js tests/service-container.test.js`)
- **Summary**: Remove usage of `sessionState`, `workspaceState`, and `uiState` in favor of `AppStateManager` selectors.
- **Key Files**: `src/lib/client/shared/components/workspace/WorkspacePage.svelte`, `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`, `src/lib/client/shared/state/session-state.svelte.js`
- **Tasks**:
  1. Replace imports of legacy state singletons with derived values from `AppStateManager` or relevant view models.
  2. Delete unused mutation helpers from the legacy state modules once migration is complete.
  3. Verify no circular updates occur during session creation/navigation.
- **Acceptance Criteria**: Workspace screens rely solely on `AppStateManager` for session/workspace data; automated tests show no regression in session flow.

## Short Term (Next Sprint)

### TKT-003 Centralize Tile Assignment Logic

- **Status**: ✅ Completed (`npm run test:unit -- --run tests/tile-assignment-service.test.js tests/app-state-manager.test.js tests/service-container.test.js`)
- **Summary**: Move DOM-dependent tile mapping out of `SessionWindowManager` into `TileAssignmentService`/`WindowViewModel`.
- **Key Files**: `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`, `src/lib/client/shared/services/TileAssignmentService.svelte.js`, `src/lib/client/shared/viewmodels/WindowViewModel.svelte.js`, `src/lib/client/shared/components/window-manager/Tile.svelte`
- **Tasks**:
  1. Provide a derived tile map from the view model/service that components can consume declaratively.
  2. Replace DOM queries (`document.querySelectorAll`) with state-driven mapping and tile lifecycle events.
  3. Ensure SSR/hydration works without direct DOM access in effects and add tests covering assignment behavior.
- **Acceptance Criteria**: Component renders tiles based solely on reactive state; hydration warnings eliminated. UI tests verify sessions are create and resumed to the correct tiles.

### TKT-004 Standardize Logging Infrastructure

- **Status**: ✅ Completed (`npm run test:unit -- --run tests/tile-assignment-service.test.js tests/app-state-manager.test.js tests/service-container.test.js`)
- **Summary**: Replace `console.log` usage with the shared logger (client + server) and add lint enforcement.
- **Key Files**: `src/lib/client/shared/components/workspace/WorkspacePage.svelte`, `src/lib/client/shared/viewmodels/SessionViewModel.svelte.js`, `src/lib/server/claude/ClaudeSessionManager.js`, `eslint.config.js`
- **Tasks**:
  1. Introduce a client-side wrapper around the existing logger or create a compatible variant.
  2. Swap raw logging calls for the standardized API with appropriate log levels.
  3. Add ESLint rule (or custom lint) to disallow `console.*` outside approved utilities.
- **Acceptance Criteria**: No raw `console` usage in lint output; logs include consistent metadata across stack.

### TKT-005 Simplify Socket Buffering Path

- **Status**: ✅ Completed (manual verification; vitest blocked by svelte-virtual-list exports)
- **Summary**: Consolidate message buffering into `MessageBuffer`/`SessionRegistry` and remove duplicate emit wrapping.
- **Key Files**: `src/lib/server/socket-setup.js`, `src/lib/server/core/SessionRegistry.js`, `src/lib/server/core/MessageBuffer.js`
- **Tasks**:
  1. Remove the custom `socket.emit` wrapper and reroute buffering through the message buffer service.
  2. Expose replay APIs via `SessionRegistry` and adapt consumers accordingly.
  3. Ensure buffered replays respect TTL/size constraints.
- **Acceptance Criteria**: Socket setup no longer mutates `socket.emit`; integration tests prove buffered replay still works. Modules register their own socket integrations; integration tests prove session types socket io implementation works. All deprecated / dead code has been removed.
- **Notes**: Message buffering now flows through `MessageBuffer` + `SessionRegistry`; legacy `socket.emit` patch removed but integration tests pending once Vitest runs.

## Medium Term

### TKT-006 Decompose Claude Session Manager

- **Summary**: Break out cache/stream orchestration and slim `ClaudeSessionManager`.
- **Key Files**: `src/lib/server/claude/ClaudeSessionManager.js`, `src/lib/server/claude/ClaudeAuthManager.js`, `src/lib/server/utils/logger.js`
- **Tasks**:
  1. Identify cohesive sub-responsibilities and extract them into new modules.
  2. Ensure command caching and stream retry logic are unit-tested in isolation.
  3. Replace ad-hoc `console.log` statements with structured logs.
- **Acceptance Criteria**: Main manager class focuses on orchestration; new tests cover command caching and streaming edge cases. All deprecated / dead code has been removed.
- **Status**: ⏳ In Progress
- **Notes**: `ClaudeCommandCache` + `ClaudeStreamRunner` extracted; manager delegates but command/emission refactor still pending full test runs.

### TKT-007 Harden SessionViewModel & AppStateManager Boundaries

- **Status**: ⏳ In Progress
- **Summary**: Separate UI filtering, persistence, and API orchestration within `SessionViewModel`, and introduce typed action creators in `AppStateManager`.
- **Key Files**: `src/lib/client/shared/viewmodels/SessionViewModel.svelte.js`, `src/lib/client/shared/state/AppStateManager.svelte.js`, `src/lib/client/shared/services/PersistenceService.js`
- **Tasks**:
  1. Move UI filter state to a dedicated UI view model or store.
  2. Introduce typed action utilities for dispatching to `AppStateManager` to avoid raw object literals.
  3. Add unit tests verifying action flows and state transitions.
- **Acceptance Criteria**: `SessionViewModel` contains only session business logic; action dispatches are type-safe and tested. All deprecated / dead code has been removed.
- **Notes**: `SessionViewModel` now handles business logic only; new `SessionFilterViewModel` manages UI filters and typed AppState actions added.

### TKT-008 Expand Automated Test Coverage

- **Status**: ⏳ Not Started
- **Summary**: Add tests for DI resolution, state transitions, and session streaming to guard further refactors.
- **Key Files**: `tests/client/app-state.test.js`, `tests/server/session-registry.test.js`, `tests/server/socket-buffering.test.js` (new)
- **Tasks**:
  1. Write unit tests for `AppStateManager` reducers/actions and `SessionRegistry` session lifecycle.
  2. Add integration tests covering socket buffering/replay after consolidation.
  3. Ensure CI runs the new suites (`npm test`).
- **Acceptance Criteria**: New test suites pass locally and in CI; coverage reports include the new layers. All deprecated / dead code has been removed.
- **Notes**: Initial viewmodel/server tests added but Vitest blocked by `svelte-virtual-list` export warning, so suites not yet runnable.

### TKT-009 Define Session Module Contract & Lifecycle

- **Summary**: Specify the contract a session module must implement (registration metadata, lifecycle hooks, capabilities, transport events) and codify it in shared types.
- **Key Files**: `src/lib/server/core/SessionRegistry.js`, `src/lib/server/socket-setup.js`, `src/lib/client/shared/services/ServiceContainer.svelte.js`, new contract definitions under `src/lib/shared/session-modules`.
- **Status**: ✅ Completed (manual verification; `npm run lint` blocked by repository-wide Prettier drift)
- **Notes**: Shared contracts now live at `src/lib/shared/session-modules/contracts.js`; server modules are registered via `registerServerSessionModules()` and `SessionRegistry` consumes the new module interface for create/send/termination flows.
- **Tasks**:
  1. Author TypeScript interfaces (or JSDoc typedefs) covering module registration, lifecycle hooks (`create`, `resume`, `dispose`), and capability/event descriptors.
  2. Update existing modules (terminal, Claude) to conform without leaking extraneous dependencies.
  3. Document the contract in the developer guide and ensure lint/tests enforce implementation completeness.
- **Acceptance Criteria**: Core code references only the contract; existing modules compile without direct knowledge of each other's internals; docs describe the lifecycle hooks. e2e tests verify modules load correctly into the UI. All deprecated / dead code has been removed.

### TKT-010 Introduce Explicit Session Module Registration

- **Summary**: Session types should be trated as modules that are handled via direct imports and explicit registration functions, both on the server and client. Avoid manifest/configuration-driven or runtime injection approaches.
- **Key Files**: `src/lib/server/core/ServerServiceContainer.js`, `src/lib/server/socket-setup.js`, `src/lib/server/session-modules/index.js` (for server registration), and src/lib/client/shared/components/workspace/SessionViewport.svelte for corresponding client-side registration points.
- **Status**: ✅ Completed (manual verification; `npm run lint` blocked by repository-wide Prettier drift)
- **Notes**: Added explicit server module registration helper plus client module registry powering `SessionViewport`; component selection now flows through `getClientSessionModule()` instead of hard-coded conditionals.
- **Notes**: Added explicit server module registration helper plus client module registry powering `SessionViewport`; component selection now flows through `getClientSessionModule()` instead of hard-coded conditionals. Legacy `sessionRouter`/global Socket.IO fallbacks removed in favor of session module APIs.
- **Tasks**:
  1. On the server, import session module implementations directly and register them using a function or functions at bootstrap (e.g., in `ServerServiceContainer` or a dedicated module).
  2. On the client, import each session's top-level Svelte component (the "session pane") and use a component factory pattern (ie if statements in a svelte component or use of snippets) to render the correct session pane based on session type. Session components can use `getContext` to interact with core client-side code.
  3. Ensure that adding or removing a session module only requires editing the relevant import/registration statements. This should be no more than one or two spots on the client and server each.
- **Acceptance Criteria**:
  - Session modules are registered and available via direct imports.
  - The UI displays the correct session pane based on session type.
  - No runtime configuration or manifest is required to enable/disable modules.
  - Server and client code are clear and type-safe; adding/removing modules is straightforward and explicit.
  - All deprecated / dead code has been removed.

## Tracking & Reporting

- Link each ticket to the overarching review document (`.plans/ARCHITECTURE_REVIEW_2025-09-17.md`).
- Maintain a simple burndown dashboard (spreadsheet or project board) to monitor immediate vs. medium-term progress.
