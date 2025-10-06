# Tasks: Architecture Refactoring (Simplified Approach)

**Feature Branch**: `007-design-pattern-refactor`
**Input**: Design documents from `/specs/007-design-pattern-refactor/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Extract: ES6 modules, Svelte context, NO DI frameworks
   → Tech stack: Node.js 22+, SvelteKit 2.x, Socket.IO 4.8.x, SQLite3, Svelte 5
   → New dependency: jsonwebtoken only
2. Load design documents:
   → data-model.md: 12 components (no DependencyContainer)
   → contracts/: 5 contract files → 5 contract test tasks
   → quickstart.md: 7 verification scenarios
3. Generate tasks by phase:
   → Setup: dependencies, test infrastructure
   → Core: repositories, services, orchestrators
   → Integration: services.js, middleware, API updates
   → Client: Svelte context, ViewModels
   → Tests: unit tests, integration tests, E2E tests
   → Polish: performance validation, verification
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Implementation before tests
5. Number tasks: T001-T060 (60 tasks total)
6. Validate: All contracts tested, dependencies ordered
7. Return: SUCCESS (ready for /implement)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Exact file paths included in task descriptions
- Follows SvelteKit structure: `src/lib/server/`, `src/lib/client/`, `tests/`

---

## Phase 3.1: Setup & Dependencies

- [x] **T001** Install jsonwebtoken dependency via `npm install jsonwebtoken`
- [x] **T002** [P] Create test infrastructure: `tests/server/helpers/test-config.js` with mock ConfigurationService
- [x] **T003** [P] Create test infrastructure: `tests/server/helpers/mock-db.js` with SQLite in-memory helpers

---

## Phase 3.2: Core Implementation

### Phase A: Core Infrastructure (Parallel)

- [x] **T004** [P] Create ConfigurationService in `src/lib/server/shared/ConfigurationService.js`
- [x] **T005** [P] Create JWTService in `src/lib/server/auth/JWTService.js`
- [x] **T006** Refactor DatabaseManager in `src/lib/server/database/DatabaseManager.js` (connection + migrations only, remove CRUD methods)

### Phase B: Repositories (Parallel after T006)

- [x] **T007** [P] Create SessionRepository in `src/lib/server/database/SessionRepository.js`
- [x] **T008** [P] Create EventStore in `src/lib/server/database/EventStore.js`
- [x] **T009** [P] Create SettingsRepository in `src/lib/server/database/SettingsRepository.js`
- [x] **T010** [P] Create WorkspaceRepository in `src/lib/server/database/WorkspaceRepository.js`

### Phase C: Session Components (Sequential - dependencies)

- [x] **T011** Create AdapterRegistry in `src/lib/server/sessions/AdapterRegistry.js`
- [x] **T012** Create EventRecorder in `src/lib/server/sessions/EventRecorder.js` (depends on T008 EventStore)
- [x] **T013** Create SessionOrchestrator in `src/lib/server/sessions/SessionOrchestrator.js` (depends on T007, T012, T011)

### Phase D: Socket.IO & Tunnel (Parallel)

- [x] **T014** [P] Create auth middleware factory in `src/lib/server/socket/middleware/auth.js`
- [x] **T015** [P] Create error handling middleware factory in `src/lib/server/socket/middleware/errorHandling.js`
- [x] **T016** [P] Create logging middleware factory in `src/lib/server/socket/middleware/logging.js`
- [x] **T017** Create SocketEventMediator in `src/lib/server/socket/SocketEventMediator.js`
- [x] **T018** [P] Create domain socket handlers in `src/lib/server/socket/handlers/sessionHandlers.js`
- [x] **T019** [P] Create domain socket handlers in `src/lib/server/socket/handlers/authHandlers.js`
- [x] **T020** [P] Create BaseTunnelManager in `src/lib/server/tunnels/BaseTunnelManager.js`
- [x] **T021** Refactor TunnelManager to extend BaseTunnelManager in `src/lib/server/tunnels/TunnelManager.js`
- [x] **T022** Refactor VSCodeTunnelManager to extend BaseTunnelManager in `src/lib/server/tunnels/VSCodeTunnelManager.js`

---

## Phase 3.3: Integration (Sequential - order matters)

### Server-Side Integration

- [x] **T023** Create services.js factory function in `src/lib/server/shared/services.js` (wires all dependencies)
- [x] **T024** Refactor `src/lib/server/shared/index.js` to use `initializeServices()` from services.js
- [x] **T025** Update API route `/api/sessions/+server.js` to import from `services` module
- [x] **T026** Update API route `/api/auth/+server.js` to import from `services` module (handled via locals.services in middleware)
- [x] **T027** Update API route `/api/workspaces/+server.js` to import from `services` module
- [x] **T028** Update API route `/api/settings/+server.js` to import from `services` module
- [x] **T029** Add transaction middleware to `src/hooks.server.js` using per-request transaction pattern
- [x] **T030** Update Socket.IO setup in `src/lib/server/socket/setup.js` to use SocketEventMediator and middleware

### Client-Side Integration (Svelte Context)

- [x] **T031** Update `src/routes/+layout.svelte` to use `setContext('services', ...)` for client services (already using ServiceContainer with setContext)
- [x] **T032** Update SessionViewModel in `src/lib/client/shared/state/SessionViewModel.svelte.js` to use `getContext('services')` (already compatible)
- [x] **T033** Update WorkspaceState in `src/lib/client/shared/state/WorkspaceState.svelte.js` to use `getContext('services')` (already compatible)
- [x] **T034** Update SocketService in `src/lib/client/shared/services/SocketService.svelte.js` to align with new server patterns (already compatible)

---

## Phase 3.4: Unit Tests

**Test individual components in isolation**

### Configuration & Auth Tests

- [x] **T035** [P] Unit test for ConfigurationService in `tests/server/configuration.test.js`
- [x] **T036** [P] Unit test for JWTService in `tests/server/auth/jwt-service.test.js`

### Repository Tests

- [x] **T037** [P] Unit test for SessionRepository in `tests/server/database/session-repository.test.js`
- [x] **T038** [P] Unit test for EventStore in `tests/server/database/event-store.test.js`
- [ ] **T039** [P] Unit test for SettingsRepository in `tests/server/database/settings-repository.test.js`
- [ ] **T040** [P] Unit test for WorkspaceRepository in `tests/server/database/workspace-repository.test.js`

### Session Component Tests

- [ ] **T041** [P] Unit test for AdapterRegistry in `tests/server/sessions/adapter-registry.test.js`
- [ ] **T042** [P] Unit test for EventRecorder in `tests/server/sessions/event-recorder.test.js`
- [ ] **T043** [P] Unit test for SessionOrchestrator in `tests/server/sessions/session-orchestrator.test.js`

### Socket & Middleware Tests

- [ ] **T044** [P] Unit test for SocketEventMediator in `tests/server/socket/socket-event-mediator.test.js`
- [ ] **T045** [P] Unit test for auth middleware factory in `tests/server/socket/middleware/auth.test.js`
- [ ] **T046** [P] Unit test for error handling middleware in `tests/server/socket/middleware/error-handling.test.js`

### Services Factory Test

- [ ] **T047** Unit test for services.js factory function in `tests/server/shared/services.test.js`

---

## Phase 3.5: Integration Tests

**Test the full refactored architecture**

- [ ] **T048** [P] Integration test: Service initialization and dependency wiring in `tests/integration/services-initialization.test.js`
- [ ] **T049** [P] Integration test: Repository transaction boundaries in `tests/integration/repository-transactions.test.js`
- [ ] **T050** [P] Integration test: JWT auth flow (TERMINAL_KEY → JWT → validation) in `tests/integration/auth-flow.test.js`
- [ ] **T051** [P] Integration test: Socket.IO middleware chain in `tests/integration/socket-middleware.test.js`
- [ ] **T052** [P] Integration test: Session creation via API in `tests/integration/session-creation.test.js`

---

## Phase 3.6: E2E Tests & Performance Validation

**Verify no regressions and meet performance targets**

- [ ] **T053** [P] E2E test: Terminal session creation and interaction in `e2e/terminal-session.spec.js`
- [ ] **T054** [P] E2E test: Claude session creation and interaction in `e2e/claude-session.spec.js`
- [ ] **T055** [P] E2E test: File editor session creation in `e2e/file-editor-session.spec.js`
- [ ] **T056** [P] E2E test: Workspace management flow in `e2e/workspace-management.spec.js`
- [ ] **T057** Performance test: Session creation < 100ms in `tests/performance/session-creation.test.js`
- [ ] **T058** Performance test: Event throughput maintained in `tests/performance/event-throughput.test.js`
- [ ] **T059** Performance test: Memory footprint < 10% increase in `tests/performance/memory-footprint.test.js`

---

## Phase 3.7: Verification & Cleanup

- [ ] **T060** Run quickstart.md verification steps 1-7 and verify all pass

---

## Dependencies

### Critical Path

1. **Setup** (T001-T003) → **Core Implementation** (T004-T022)
2. **Core Infrastructure** (T004-T006) → **Repositories** (T007-T010)
3. **Repositories** (T007-T010) → **Session Components** (T011-T013)
4. **All Core** (T004-T022) → **Integration** (T023-T034)
5. **Integration** (T023-T034) → **Unit Tests** (T035-T047)
6. **Unit Tests** (T035-T047) → **Integration Tests** (T048-T052)
7. **Integration Tests** (T048-T052) → **E2E Tests** (T053-T056)
8. **All Tests Pass** → **Performance** (T057-T059) → **Verification** (T060)

### Component Dependencies

- T008 (EventStore) blocks T012 (EventRecorder)
- T007 (SessionRepository) + T012 (EventRecorder) + T011 (AdapterRegistry) block T013 (SessionOrchestrator)
- T006 (DatabaseManager) blocks T007-T010 (all repositories)
- T023 (services.js) blocks T024-T030 (all API/middleware updates)
- T005 (JWTService) blocks T014 (auth middleware)

### Parallel Execution Groups

**Group 1: Core Infrastructure (T004-T005)** - 2 services can run together
**Group 2: Repositories (T007-T010)** - 4 repositories can run together after T006
**Group 3: Socket Components (T014-T019)** - 6 socket/middleware files can run together
**Group 4: Unit Tests (T035-T046)** - 12 unit tests can run together after implementation
**Group 5: Integration Tests (T048-T052)** - 5 integration tests can run together
**Group 6: E2E Tests (T053-T056)** - 4 E2E tests can run together

---

## Parallel Execution Examples

### Core Infrastructure (After T003)

```bash
# Launch T004-T005 together (2 parallel services):
Task: "Create ConfigurationService in src/lib/server/shared/ConfigurationService.js"
Task: "Create JWTService in src/lib/server/auth/JWTService.js"
```

### Repositories (After T006 DatabaseManager refactored)

```bash
# Launch T007-T010 together (4 parallel repositories):
Task: "Create SessionRepository in src/lib/server/database/SessionRepository.js"
Task: "Create EventStore in src/lib/server/database/EventStore.js"
Task: "Create SettingsRepository in src/lib/server/database/SettingsRepository.js"
Task: "Create WorkspaceRepository in src/lib/server/database/WorkspaceRepository.js"
```

### Socket Components (After repositories complete)

```bash
# Launch T014-T019 together (6 parallel socket files):
Task: "Create auth middleware factory in src/lib/server/socket/middleware/auth.js"
Task: "Create error handling middleware factory in src/lib/server/socket/middleware/errorHandling.js"
Task: "Create logging middleware factory in src/lib/server/socket/middleware/logging.js"
Task: "Create domain socket handlers in src/lib/server/socket/handlers/sessionHandlers.js"
Task: "Create domain socket handlers in src/lib/server/socket/handlers/authHandlers.js"
Task: "Create BaseTunnelManager in src/lib/server/tunnels/BaseTunnelManager.js"
```

### Unit Tests (After T034 client integration complete)

```bash
# Launch T035-T046 together (12 parallel unit tests):
Task: "Unit test for ConfigurationService in tests/server/configuration.test.js"
Task: "Unit test for JWTService in tests/server/auth/jwt-service.test.js"
Task: "Unit test for SessionRepository in tests/server/database/session-repository.test.js"
Task: "Unit test for EventStore in tests/server/database/event-store.test.js"
Task: "Unit test for SettingsRepository in tests/server/database/settings-repository.test.js"
Task: "Unit test for WorkspaceRepository in tests/server/database/workspace-repository.test.js"
Task: "Unit test for AdapterRegistry in tests/server/sessions/adapter-registry.test.js"
Task: "Unit test for EventRecorder in tests/server/sessions/event-recorder.test.js"
Task: "Unit test for SessionOrchestrator in tests/server/sessions/session-orchestrator.test.js"
Task: "Unit test for SocketEventMediator in tests/server/socket/socket-event-mediator.test.js"
Task: "Unit test for auth middleware factory in tests/server/socket/middleware/auth.test.js"
Task: "Unit test for error handling middleware in tests/server/socket/middleware/error-handling.test.js"
```

### Integration Tests (After unit tests complete)

```bash
# Launch T048-T052 together (5 parallel integration tests):
Task: "Integration test: Service initialization and dependency wiring in tests/integration/services-initialization.test.js"
Task: "Integration test: Repository transaction boundaries in tests/integration/repository-transactions.test.js"
Task: "Integration test: JWT auth flow in tests/integration/auth-flow.test.js"
Task: "Integration test: Socket.IO middleware chain in tests/integration/socket-middleware.test.js"
Task: "Integration test: Session creation via API in tests/integration/session-creation.test.js"
```

### E2E Tests (After integration tests pass)

```bash
# Launch T053-T056 together (4 parallel E2E tests):
Task: "E2E test: Terminal session creation and interaction in e2e/terminal-session.spec.js"
Task: "E2E test: Claude session creation and interaction in e2e/claude-session.spec.js"
Task: "E2E test: File editor session creation in e2e/file-editor-session.spec.js"
Task: "E2E test: Workspace management flow in e2e/workspace-management.spec.js"
```

---

## Notes

### Testing Approach

- **Implementation first, then tests**: Core components (T004-T022) implemented before unit tests (T035-T047)
- **Each component has corresponding test**: All contracts in `contracts/` have matching test files
- **Test order**: Unit tests → Integration tests → E2E tests → Performance tests
- **Tests validate refactoring**: Ensure no regressions and meet performance targets

### Parallel Execution Safety

- **[P] tasks**: Different files, no shared state, can run concurrently
- **Sequential tasks**: Same file modifications or strict dependencies
- **Example**: T007-T010 all modify different files (SessionRepository.js, EventStore.js, etc.) → safe to parallelize
- **Counterexample**: T025-T028 all might import from same services.js → run after T023 completes

### Simplified Architecture Principles

- **No DI Framework**: Using ES6 module exports and Svelte context only
- **Factory Function**: `createServices()` wires dependencies explicitly in ~50 lines
- **Constructor Injection**: All components receive dependencies in constructor
- **Module Mocking**: Tests use Vitest `vi.mock()` for service substitution
- **Svelte Context**: Client uses `setContext`/`getContext` for service sharing

### Performance Targets (from spec NFR-007 to NFR-009)

- Session creation: < 100ms (T057 validates)
- Event throughput: Maintained (T058 validates)
- Memory increase: < 10% (T059 validates)

### Verification Scenarios (from quickstart.md)

1. Service initialization via factory function
2. Repository separation
3. Svelte context usage
4. Socket.IO organization
5. JWT authentication flow
6. Module mocking in tests
7. Performance benchmarks

All verified in T060 final verification task.

---

## Validation Checklist

_GATE: Checked before task execution_

- [x] All 5 contract files have corresponding test tasks (T035-T047 cover all contracts)
- [x] All 12 components from data-model.md have implementation tasks (T004-T022)
- [x] Implementation (T004-T034) comes before tests (T035-T059)
- [x] Parallel tasks [P] modify different files (verified)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Dependencies properly ordered (setup → core → integration → tests → polish)
- [x] 7 quickstart verification scenarios covered in final task (T060)
- [x] Performance targets (NFR-007 to NFR-009) validated in T057-T059

---

## Execution Status

- [x] Plan.md loaded (simplified approach, ES6 modules, NO DI framework)
- [x] Data-model.md analyzed (12 components)
- [x] Contracts analyzed (5 contract files)
- [x] Quickstart scenarios identified (7 verification steps)
- [x] Tasks generated (60 tasks total: T001-T060)
- [x] Task order updated: Implementation first, then tests
- [x] Dependencies validated
- [x] Parallel execution groups identified
- [x] Validation checklist passed
- [x] **IMPLEMENTATION PHASE COMPLETE** (T001-T034)

## Implementation Summary

### 2025-10-05: Initial Core Implementation (T001-T034)

- ✅ All dependencies installed and configured
- ✅ All core services, repositories, and orchestrators implemented
- ✅ All API routes and middleware updated
- ✅ Socket.IO refactored to use SocketEventMediator pattern
- ✅ Transaction middleware integrated
- ✅ Client-side already using Svelte context properly

### 2025-10-06: Unit Tests Started (T035-T036)

- ✅ ConfigurationService unit tests complete (13 tests, all passing)
- ✅ JWTService unit tests complete (18 tests, all passing)
- ✅ System verified to initialize correctly with new architecture

### ✅ Completed: Core Architecture Refactoring (36/60 tasks - 60%)

**Phase 3.1-3.3: ALL COMPLETE** (T001-T034)
**Phase 3.4: Unit Tests - STARTED** (T035-T036 complete)

### 📝 Remaining: Testing & Validation (24/60 tasks - 40%)

**Phase 3.4: Unit Tests** (T037-T047) - 11 tests remaining

- SessionRepository, EventStore, SettingsRepository, WorkspaceRepository
- AdapterRegistry, EventRecorder, SessionOrchestrator
- SocketEventMediator, middleware, services.js factory

**Phase 3.5: Integration Tests** (T048-T052) - 5 tests
**Phase 3.6: E2E & Performance** (T053-T059) - 7 tests
**Phase 3.7: Verification** (T060) - Final validation

### 🎯 Key Achievements

1. **Simplified DI Pattern**: ES6 factory function + Svelte context (NO frameworks)
2. **Repository Separation**: Dedicated repositories replace monolithic DatabaseManager
3. **Event-Driven Architecture**: EventRecorder with real-time Socket.IO emission
4. **Mediator Pattern**: SocketEventMediator for organized socket event handling
5. **Transaction Support**: Per-request transactions via hooks middleware
6. **Unit Test Coverage Started**: ConfigurationService and JWTService fully tested

### ✅ Verified Working

- Services initialization via factory function
- SessionOrchestrator with 3 registered adapters (pty, claude, file-editor)
- Socket.IO with SocketEventMediator pattern
- EventRecorder subscribed for real-time event emission
- Database repositories created and operational

### 🔧 Remaining Work

- Complete unit tests for repositories (T037-T040)
- Complete unit tests for session components (T041-T043)
- Complete unit tests for socket components (T044-T046)
- Complete unit test for services.js factory (T047)
- Integration tests (T048-T052)
- E2E & performance tests (T053-T059)
- Final verification (T060)

**STATUS**: Core refactoring complete and verified working (60%). Remaining work is test coverage (40%).

### 2025-10-06: Code Reviews Complete

**Refactoring Specialist Review**:

- ✅ Overall Grade: B+ (85/100)
- ✅ SOLID principles: 90/100
- ✅ Design patterns: 85/100
- ⚠️ Identified 6 critical issues
- ⚠️ Identified 7 important improvements
- ⚠️ Suggested 7 enhancements

**Svelte Model-View-ViewModel Architect Review**:

- ✅ Overall Grade: B+
- ✅ Svelte 5 runes correctly used
- ✅ MVVM pattern well-implemented
- ⚠️ 3 MVVM violations (business logic in components)
- ⚠️ Service instantiation pattern inconsistent
- ⚠️ Some tight coupling between ViewModels

**Fix Task List**: Created in `code-review-fixes.md` with 25 tasks organized by priority

### 2025-10-06: Critical Fixes Implemented (Batch 1)

**Server-Side Critical Fixes** (Commit: 850d3fd):

- ✅ **FIX-001**: EventStore race condition fixed with mutex pattern
- ✅ **FIX-002**: Transaction middleware anti-pattern removed
- ✅ **FIX-003**: Socket middleware chain documented and verified

**Status**: 3/6 Priority 1 critical fixes complete. Remaining: Client-side MVVM violations (FIX-004, FIX-005, FIX-006)

**Next Steps**: Code review of completed fixes, then continue with client-side refactoring
