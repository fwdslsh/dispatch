# Tasks: UI Components for Authentication, Workspace Management, and Maintenance

**Input**: Design documents from `/specs/002-we-need-to/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: JavaScript/Node.js 22+, SvelteKit 2.x, Svelte 5
   → Libraries: Socket.IO, SQLite3, Express, @testing-library/svelte
2. Load optional design documents:
   → data-model.md: 4 entities (OnboardingState, WorkspaceNavigationState, RetentionPolicy, UserPreferences)
   → contracts/: 3 API contracts (onboarding, retention, preferences)
   → research.md: Architecture decisions extracted
3. Generate tasks by category:
   → Setup: Database migrations, API route setup
   → Tests: Contract tests, component tests, E2E tests
   → Core: ViewModels, Components, API endpoints
   → Integration: Enhanced ProjectSessionMenu, authentication flow
   → Polish: E2E validation, performance tests
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T032)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend**: `src/lib/client/` for components and ViewModels
- **Backend**: `src/lib/server/` for API routes and services
- **Routes**: `src/routes/` for SvelteKit pages
- **Tests**: `tests/client/`, `tests/server/`, `e2e/`

## Phase 3.1: Setup & Database Schema

- [x] T001 Create database migration for onboarding_state table in `src/lib/server/db/migrations/`
- [x] T002 Create database migration for retention_policies table in `src/lib/server/db/migrations/`
- [x] T003 Create database migration for user_preferences table in `src/lib/server/db/migrations/`
- [x] T004 Create migration to add is_onboarding_session column to existing sessions table
- [x] T005 Create migration to add navigation_history column to existing workspace_layout table
- [x] T006 Create database service module for new tables in `src/lib/server/services/database.js`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests
- [x] T007 [P] Create test for onboarding API endpoints in `tests/server/api/onboarding.test.js`
- [x] T008 [P] Create test for retention policy API endpoints in `tests/server/api/retention.test.js`
- [x] T009 [P] Create test for user preferences API endpoints in `tests/server/api/preferences.test.js`

### Component Tests
- [x] T010 [P] Create test for OnboardingFlow component in `tests/client/components/OnboardingFlow.test.js`
- [x] T011 [P] Create test for RetentionSettings component in `tests/client/components/RetentionSettings.test.js`
- [x] T012 [P] Create test for enhanced ProjectSessionMenu in `tests/client/components/ProjectSessionMenu.test.js`

### ViewModel Tests
- [x] T013 [P] Create test for OnboardingViewModel in `tests/client/viewmodels/OnboardingViewModel.test.js`
- [x] T014 [P] Create test for RetentionPolicyViewModel in `tests/client/viewmodels/RetentionPolicyViewModel.test.js`
- [x] T015 [P] Create test for WorkspaceNavigationViewModel in `tests/client/viewmodels/WorkspaceNavigationViewModel.test.js`

## Phase 3.3: Core Implementation

### API Endpoints
- [x] T016 Implement onboarding API routes in `src/routes/api/onboarding/+server.js` (GET status, POST progress, POST complete)
- [x] T017 Implement retention policy API routes in `src/routes/api/retention/+server.js` (GET policy, PUT policy, POST preview, POST cleanup)
- [x] T018 Implement user preferences API routes in `src/routes/api/preferences/+server.js` (GET, PUT)

### ViewModels (Svelte 5 State Management)
- [x] T019 [P] Implement OnboardingViewModel with $state runes in `src/lib/client/shared/state/OnboardingViewModel.svelte.js`
- [x] T020 [P] Implement RetentionPolicyViewModel with $state runes in `src/lib/client/shared/state/RetentionPolicyViewModel.svelte.js`
- [x] T021 [P] Implement WorkspaceNavigationViewModel with $state runes in `src/lib/client/shared/state/WorkspaceNavigationViewModel.svelte.js`

### UI Components
- [x] T022 Create OnboardingFlow component in `src/lib/client/components/OnboardingFlow.svelte`
- [x] T023 Create AuthenticationStep component in `src/lib/client/onboarding/AuthenticationStep.svelte`
- [x] T024 Create WorkspaceCreationStep component in `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- [x] T025 Create RetentionSettings component in `src/lib/client/components/RetentionSettings.svelte`
- [x] T026 Create PreferencesPanel component in `src/lib/client/settings/PreferencesPanel.svelte`

## Phase 3.4: Integration

- [x] T027 Enhance ProjectSessionMenu component to include workspace navigation in `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- [x] T028 Update main layout to detect and trigger onboarding in `src/routes/+layout.svelte`
- [x] T029 Create onboarding route pages in `src/routes/onboarding/+page.svelte`
- [x] T030 Create settings route pages in `src/routes/settings/+page.svelte`
- [x] T031 Implement 30-day rolling authentication session logic in `src/lib/server/auth/session.js`

## Phase 3.5: End-to-End Testing & Polish

- [x] T032 [P] Create E2E test for complete onboarding workflow in `e2e/onboarding.spec.js`
- [x] T033 [P] Create E2E test for workspace navigation in `e2e/workspace-navigation.spec.js`
- [x] T034 [P] Create E2E test for retention policy configuration in `e2e/retention-settings.spec.js`
- [x] T035 [P] Create E2E test for authentication persistence in `e2e/auth-persistence.spec.js`
- [x] T036 Performance optimization: Ensure sub-100ms response times for all API endpoints
- [x] T037 Accessibility audit: Verify keyboard navigation and ARIA labels for all new components
- [x] T038 Update CLAUDE.md with new feature documentation and usage examples

## Parallel Execution Examples

### After completing Phase 3.1 (Setup), you can parallelize Phase 3.2 tests:
```bash
# Run all contract tests in parallel
Task agent "Create onboarding API test" &
Task agent "Create retention API test" &
Task agent "Create preferences API test" &
wait

# Run all component tests in parallel
Task agent "Create OnboardingFlow test" &
Task agent "Create RetentionSettings test" &
Task agent "Create ProjectSessionMenu test" &
wait

# Run all ViewModel tests in parallel
Task agent "Create OnboardingViewModel test" &
Task agent "Create RetentionPolicyViewModel test" &
Task agent "Create WorkspaceNavigationViewModel test" &
wait
```

### After tests are written (Phase 3.2), parallelize ViewModels in Phase 3.3:
```bash
# Implement all ViewModels in parallel
Task agent "Implement OnboardingViewModel" &
Task agent "Implement RetentionPolicyViewModel" &
Task agent "Implement WorkspaceNavigationViewModel" &
wait
```

### E2E tests can all run in parallel in Phase 3.5:
```bash
# Run all E2E tests in parallel
Task agent "Create onboarding E2E test" &
Task agent "Create workspace navigation E2E test" &
Task agent "Create retention settings E2E test" &
Task agent "Create auth persistence E2E test" &
wait
```

## Dependencies & Ordering

```
Setup (T001-T006) → Must complete first
    ↓
Tests (T007-T015) → Can parallelize within category
    ↓
API Implementation (T016-T018) → Sequential (shared server code)
    ↓
ViewModels (T019-T021) → Can parallelize
    ↓
UI Components (T022-T026) → Sequential (may share styles/utilities)
    ↓
Integration (T027-T031) → Sequential (modifies existing components)
    ↓
E2E & Polish (T032-T038) → Can parallelize E2E tests
```

## Validation Checklist
- ✅ All 3 API contracts have test tasks (T007-T009)
- ✅ All 4 entities have implementation tasks (via ViewModels and APIs)
- ✅ All endpoints from contracts are implemented (T016-T018)
- ✅ TDD order maintained (tests before implementation)
- ✅ Integration with existing ProjectSessionMenu included (T027)
- ✅ E2E tests cover all user scenarios from quickstart.md (T032-T035)
- ✅ Performance and accessibility requirements addressed (T036-T037)

## Task Count Summary
- Setup & Database: 6 tasks
- Tests (TDD): 9 tasks
- Core Implementation: 11 tasks
- Integration: 5 tasks
- E2E & Polish: 7 tasks
- **Total**: 38 tasks

## Success Metrics
- All tests pass (unit, integration, E2E)
- Sub-100ms API response times
- Onboarding completable in 2-3 steps
- 30-day authentication persistence works
- Workspace navigation integrated seamlessly
- Retention policies configurable with preview
- No regression in existing functionality