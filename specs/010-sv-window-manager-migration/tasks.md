# Tasks: sv-window-manager Migration

**Input**: Design documents from `/specs/010-sv-window-manager-migration/`
**Prerequisites**: plan.md, spec.md, data-model.md, quickstart.md, research.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions
- SvelteKit full-stack web application
- Frontend: `src/lib/client/`, `src/routes/`
- Backend: `src/lib/server/`
- Tests: `tests/` (unit), `e2e/` (Playwright)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install sv-window-manager library and prepare workspace state

- [X] T001 Install sv-window-manager dependency with caret range (`npm install sv-window-manager` in package.json as `"sv-window-manager": "^0.0.2"`)
- [X] T001a Implement sv-window-manager load failure detection in `src/lib/client/shared/components/workspace/WorkspacePage.svelte` (wrap BwinHost import in try-catch, display blocking error UI if library fails to load or initialize, prevent workspace operations until resolved per FR-001a)
- [X] T002 [P] Add bwinHostRef to existing WorkspaceState in `src/lib/client/shared/state/WorkspaceState.svelte.js` (add `bwinHostRef = $state(null)` to windowManager object)
- [X] T003 [P] Verify existing E2E test infrastructure is ready for migration tests (check `e2e/helpers/` and `playwright.config.js`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema preparation for layout reset

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create database migration script to clear existing workspace_layout data in `src/lib/server/database/migrations/001-clear-window-layouts-for-migration.js` (DELETE FROM workspace_layout;)
- [X] T005 Add migration to detect empty workspace layouts and auto-create terminal session logic in `src/lib/client/shared/utils/workspace-init.js` (post-migration default behavior)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Existing Window Behavior Preserved (Priority: P1) 🎯 MVP

**Goal**: Replace custom window manager with sv-window-manager while maintaining all window operations (drag, resize, minimize, maximize, close)

**Independent Test**: Open multiple sessions (terminal, Claude, file editor), perform all window operations, verify behavior matches pre-migration

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] E2E test for creating multiple terminal sessions in panes in `e2e/window-manager-migration.spec.js` (test BwinHost renders panes)
- [X] T007 [P] [US1] E2E test for window drag/resize operations in `e2e/window-manager-migration.spec.js` (verify library drag/resize works)
- [X] T008 [P] [US1] E2E test for window close operation in `e2e/window-manager-migration.spec.js` (verify session terminates when pane closed)
- [X] T008a [P] [US1] E2E test for window controls (minimize, maximize, close buttons) in `e2e/window-manager-migration.spec.js` (verify library provides controls and they function correctly)

### Implementation for User Story 1

- [X] T009 [US1] Import BwinHost component in workspace route `src/lib/client/shared/components/workspace/WorkspacePage.svelte` (add `import BwinHost from 'sv-window-manager'`)
- [X] T010 [US1] Mount BwinHost component in workspace route `src/lib/client/shared/components/workspace/WorkspacePage.svelte` (add `<BwinHost bind:this={workspaceState.windowManager.bwinHostRef} config={{ fitContainer: true }} />` with error boundary checking bwinHostRef mounted successfully)
- [X] T011 [US1] Update session creation logic to call addPane() in session creation handlers (modify terminal, Claude, file-editor session creation functions to call `bwinHost.addPane(sessionId, {}, Component, { sessionId })`)
- [X] T012 [US1] Add component mapping for session types in `src/lib/client/shared/session-modules/index.js` (create getComponentForSessionType helper: `{ 'pty': TerminalComponent, 'claude': ClaudeComponent, 'file-editor': FileEditorComponent }`)
- [X] T013 [US1] Update session close logic to remove panes from BwinHost (add pane removal when session terminates)
- [X] T014 [US1] Remove old custom window manager component from `src/lib/client/shared/components/window-manager/` (delete entire directory - 30% code reduction target)
- [X] T015 [US1] Update workspace route to remove old window manager imports and usage in `src/lib/client/shared/components/workspace/WorkspacePage.svelte` (clean up old component references)

**Checkpoint**: ✅ User Story 1 COMPLETE - All window operations now work via sv-window-manager

---

## Phase 4: User Story 2 - Layout Persistence Maintained (Priority: P2)

**Goal**: Persist window layouts across browser sessions and page refreshes (deferred to manual implementation per spec clarification)

**Independent Test**: Arrange windows, refresh browser, verify layout is NOT restored (post-migration reset behavior)

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] E2E test for workspace load with no layout in `e2e/window-manager-migration.spec.js` (verify auto-creates one terminal session per clarification)
- [X] T017 [P] [US2] E2E test for empty workspace behavior in `e2e/window-manager-migration.spec.js` (verify no migration notification displayed)

### Implementation for User Story 2

- [X] T018 [US2] Implement auto-create terminal session logic for empty workspaces in `src/lib/client/shared/components/workspace/WorkspacePage.svelte` (check if no saved layout exists, create one terminal session automatically)
- [X] T019 [US2] Add workspace layout detection in `src/lib/client/shared/components/workspace/WorkspacePage.svelte` via autoInitializeWorkspace (detect empty layout state post-migration)
- [X] T020 [US2] Ensure no migration notification is displayed when layouts are reset (silent reset per clarification - no UI prompts added, verified via E2E test T017)

**Checkpoint**: ✅ User Stories 1 AND 2 COMPLETE - Empty workspaces auto-create terminal, no migration prompts shown

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T021 [P] Verify zero regressions in existing E2E tests (run full E2E suite: `npm run test:e2e`)
- [ ] T022 [P] Measure code reduction in window management implementation (compare LOC before/after, verify ≥30% reduction)
- [ ] T023 [P] Performance validation for 60fps window operations using Chrome DevTools Performance profiler: (1) Record 10-second continuous drag session, (2) Analyze frame timing - verify no frames exceed 16ms, (3) Record 10-second resize session, (4) Verify main thread not blocked >16ms during interactions, (5) Document results showing ≥95% frames meet 60fps target
- [ ] T024 [P] Update CLAUDE.md if needed (document sv-window-manager integration patterns)
- [ ] T025 Verify library version uses caret range in package.json (ensure `"sv-window-manager": "^X.Y.Z"` format)
- [ ] T026 Run quickstart.md validation (follow quickstart steps to verify accuracy)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for context but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component integration before old component removal
- Session lifecycle updates before cleanup
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003)
- All tests for a user story marked [P] can run in parallel (T006, T007, T008 together)
- All Polish tasks marked [P] can run in parallel (T021-T024 together)
- US1 and US2 can be worked on in parallel by different team members after Foundational phase

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all E2E tests for User Story 1 together:
# These can run concurrently in Playwright headed mode
npm run test:e2e -- window-manager-migration.spec.js
```

---

## Parallel Example: Setup Phase

```bash
# T002 and T003 can run in parallel (different files):
# Developer A: Add bwinHostRef to WorkspaceState.svelte.js
# Developer B: Verify E2E test infrastructure
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005) - CRITICAL
3. Complete Phase 3: User Story 1 (T006-T015)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Run existing E2E suite to verify zero regressions
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: Basic window operations work!)
3. Add User Story 2 → Test independently → Deploy/Demo (Enhancement: Auto-create terminal on empty workspace)
4. Polish phase → Final validation → Production release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T005)
2. Once Foundational is done:
   - Developer A: User Story 1 tests (T006-T008)
   - Developer B: User Story 1 implementation (T009-T015)
   - Developer C: User Story 2 prep
3. Stories complete and integrate independently

---

## Critical Migration Notes

### Minimal Integration Approach

Per design documents, this migration follows a **minimal integration** strategy:

- **Application responsibilities**: Mount BwinHost, store reference, call addPane()
- **Library responsibilities**: All layout management, resizing, window state, keyboard shortcuts, interactions
- **No custom wrappers**: Delegate everything to sv-window-manager library
- **Layout persistence**: Deferred to future manual implementation (out of scope)

### Layout Reset Strategy

Per spec clarification:

- Existing workspace layouts will be **reset on migration** (DELETE FROM workspace_layout)
- Users see **empty workspace** or **one auto-created terminal** (silent reset, no notification)
- No backward compatibility for old layout data

### Version Management

Per spec clarification:

- Use **caret range** in package.json: `"sv-window-manager": "^X.Y.Z"`
- Auto-accept minor/patch updates
- Block major version upgrades (manual review required)

### Code Reduction Target

- Goal: **≥30% reduction** in window management code
- Achieved by: Removing `src/lib/client/shared/components/window-manager/` directory
- Measurement: Compare LOC before/after (T022)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- This migration prioritizes **simplicity** - leverage library fully, avoid custom complexity
