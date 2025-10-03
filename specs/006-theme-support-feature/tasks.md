# Tasks: Theme Support System

**Feature**: Theme Support System
**Branch**: `006-theme-support-feature`
**Input**: Design documents from `/home/founder3/code/github/fwdslsh/dispatch/specs/006-theme-support-feature/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Repository root: `/home/founder3/code/github/fwdslsh/dispatch`

## Phase 3.1: Setup & Preset Themes

- [ ] **T001** Create preset theme files in `static/themes/`
  - Create `static/themes/phosphor-green.json` with complete xterm ITheme definition
  - Create `static/themes/dark.json` with professional dark theme colors
  - Create `static/themes/light.json` with professional light theme colors
  - Validate all JSON files parse correctly
  - Ensure all required fields (background, foreground, 16 ANSI colors) present

- [ ] **T002** Add theme_override column to workspaces table
  - File: `src/lib/server/shared/db/DatabaseManager.js`
  - Update `ensureWorkspaceSchema()` method to check for and add `theme_override` column
  - Add `ALTER TABLE workspaces ADD COLUMN theme_override TEXT DEFAULT NULL` if column doesn't exist
  - Follow existing pattern used for `name` column
  - Test column is created on database initialization

- [ ] **T003** [P] Configure theme directory structure
  - Create `.testing-home/themes/` directory in dev environment
  - Add logic to create `~/.dispatch/themes/` on first run
  - Verify directory permissions are correct

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Parallel)

- [ ] **T004** [P] Contract test GET /api/themes
  - File: `tests/server/api/themes-list.test.js`
  - Test returns array of themes with correct schema (id, name, source, cssVariables)
  - Test requires authentication (401 without authKey)
  - Test includes both preset and custom themes
  - **MUST FAIL** - endpoint not implemented yet

- [ ] **T005** [P] Contract test POST /api/themes (upload)
  - File: `tests/server/api/themes-upload.test.js`
  - Test validates file size (reject > 5MB)
  - Test validates JSON structure
  - Test returns ValidationResult with errors/warnings
  - Test saves file to ~/.dispatch/themes/
  - **MUST FAIL** - endpoint not implemented yet

- [ ] **T006** [P] Contract test GET /api/themes/{themeId}
  - File: `tests/server/api/themes-get-single.test.js`
  - Test returns single theme by ID
  - Test returns 404 for non-existent theme
  - **MUST FAIL** - endpoint not implemented yet

- [ ] **T007** [P] Contract test DELETE /api/themes/{themeId}
  - File: `tests/server/api/themes-delete.test.js`
  - Test deletes custom theme successfully
  - Test prevents deletion if theme in use (400 with reason)
  - Test prevents deletion of preset themes
  - **MUST FAIL** - endpoint not implemented yet

- [ ] **T008** [P] Contract test GET /api/themes/{themeId}/can-delete
  - File: `tests/server/api/themes-can-delete.test.js`
  - Test returns canDelete: false with reason for in-use themes
  - Test returns canDelete: true for unused custom themes
  - **MUST FAIL** - endpoint not implemented yet

- [ ] **T009** [P] Contract test GET /api/themes/active
  - File: `tests/server/api/themes-active.test.js`
  - Test resolves theme hierarchy (workspace → global → fallback)
  - Test returns cssVariables object
  - Test includes source field (workspace/global/fallback)
  - **MUST FAIL** - endpoint not implemented yet

### Parser & Validation Tests (Parallel)

- [ ] **T010** [P] Unit tests for ThemeParser abstract class
  - File: `tests/server/themes/ThemeParser.test.js`
  - Test parse() throws error (abstract method)
  - Test validate() throws error (abstract method)
  - Test toCssVariables() throws error (abstract method)
  - **MUST FAIL** - class not implemented yet

- [ ] **T011** [P] Unit tests for XtermThemeParser
  - File: `tests/server/themes/XtermThemeParser.test.js`
  - Test parses valid xterm theme successfully
  - Test validation catches missing required fields
  - Test validation catches invalid color formats
  - Test toCssVariables() creates correct CSS property mappings
  - Test warnings for missing optional fields (cursor, name)
  - **MUST FAIL** - parser not implemented yet

- [ ] **T012** [P] Unit tests for ThemeManager
  - File: `tests/server/themes/ThemeManager.test.js`
  - Test initializes and loads themes from both directories
  - Test caching with 5-minute TTL
  - Test uploadTheme validates and saves file
  - Test deleteTheme removes file and invalidates cache
  - Test ensurePresetsExist copies from static/themes/
  - Test recreateFallbackTheme creates phosphor-green.json from hardcoded constant
  - **MUST FAIL** - manager not implemented yet

### Integration Tests (Parallel)

- [ ] **T013** [P] Integration test: Theme upload and validation workflow
  - File: `tests/integration/theme-upload.test.js`
  - Test upload valid theme → saved to filesystem → appears in list
  - Test upload invalid theme → validation errors returned → not saved
  - Test upload with warnings → saved but warnings shown
  - **MUST FAIL** - full workflow not implemented yet

- [ ] **T014** [P] Integration test: Theme activation and page refresh
  - File: `tests/integration/theme-activation.test.js`
  - Test set global default via /api/preferences
  - Test workspace override via /api/workspaces/{id}
  - Test theme resolution hierarchy works correctly
  - **MUST FAIL** - activation workflow not implemented yet

- [ ] **T015** [P] Integration test: Deletion prevention
  - File: `tests/integration/theme-deletion.test.js`
  - Test cannot delete theme set as global default
  - Test cannot delete theme used by workspace
  - Test can delete unused custom theme
  - Test cannot delete preset theme
  - **MUST FAIL** - deletion logic not implemented yet

- [ ] **T016** [P] Integration test: Hardcoded fallback recovery
  - File: `tests/integration/theme-fallback.test.js`
  - Test deletes all themes → recreates phosphor-green from hardcoded
  - Test missing themes directory → recreates directory and default theme
  - Test corrupted theme file → falls back to hardcoded theme
  - **MUST FAIL** - fallback logic not implemented yet

- [ ] **T016b** [P] Integration test: Manual theme file placement (FR-027)
  - File: `tests/integration/theme-manual-placement.test.js`
  - Manually create valid theme JSON in ~/.dispatch/themes/custom-manual.json
  - Restart ThemeManager or trigger cache refresh
  - Verify theme appears in GET /api/themes response
  - Verify theme can be activated via UI
  - **MUST FAIL** - ThemeManager not implemented yet
  - **Depends on**: T021 (ThemeManager)

### Frontend Unit Tests (Parallel)

- [ ] **T017** [P] Unit tests for ThemeState ViewModel
  - File: `tests/client/shared/state/ThemeState.test.js`
  - Test loadThemes populates themes array
  - Test presetThemes derived state filters correctly
  - Test customThemes derived state filters correctly
  - Test activateTheme calls API and triggers reload
  - **MUST FAIL** - ViewModel not implemented yet

- [ ] **T018** [P] Component tests for ThemeSettings
  - File: `tests/client/settings/ThemeSettings.test.js`
  - Test renders theme grid with preset themes
  - Test renders custom themes section
  - Test upload button triggers file input
  - Test activate button calls activateTheme
  - **MUST FAIL** - component not implemented yet

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Backend - Parsers & Validators

- [ ] **T019** [P] Implement ThemeParser abstract class
  - File: `src/lib/server/themes/ThemeParser.js`
  - Define abstract parse(fileContent) method
  - Define abstract validate(theme) method
  - Define abstract toCssVariables(theme) method
  - Export as ES module
  - **Acceptance**: T010 tests pass

- [ ] **T020** Implement XtermThemeParser
  - File: `src/lib/server/themes/XtermThemeParser.js`
  - Extend ThemeParser abstract class
  - Implement parse() with JSON.parse and validation
  - Implement validate() checking required fields and color formats
  - Implement toCssVariables() mapping xterm colors to CSS variables
  - Handle optional fields with intelligent defaults (cursor = foreground, etc.)
  - **Depends on**: T019
  - **Acceptance**: T011 tests pass

### Backend - Theme Manager

- [ ] **T021** Implement ThemeManager class
  - File: `src/lib/server/themes/ThemeManager.js`
  - Constructor: initialize paths (dataDir, themesDir, staticThemesDir)
  - Hardcoded FALLBACK_THEME constant with complete phosphor-green definition
  - initialize() method: ensure dirs exist, copy presets, load themes
  - loadThemes() method: read both directories, parse themes, populate cache
  - getTheme(themeId) method: return from cache, reload if expired (5 min TTL)
  - getAllThemes() method: return all cached themes
  - uploadTheme(filename, fileContent) method: validate, save, invalidate cache
  - deleteTheme(themeId) method: remove file, invalidate cache
  - ensurePresetsExist() method: copy from static/themes/ if missing
  - recreateFallbackTheme() method: write FALLBACK_THEME to phosphor-green.json
  - **Depends on**: T020
  - **Acceptance**: T012 tests pass

### Backend - API Routes

- [ ] **T022** Implement GET /api/themes endpoint
  - File: `src/routes/api/themes/+server.js` (GET handler)
  - Validate authKey
  - Initialize ThemeManager
  - Call getAllThemes()
  - Return { themes: [...] }
  - **Depends on**: T021
  - **Acceptance**: T004 tests pass

- [ ] **T023** Implement POST /api/themes endpoint (upload)
  - File: `src/routes/api/themes/+server.js` (POST handler)
  - Validate authKey
  - Parse multipart/form-data to get file
  - Check file size < 5MB
  - Call themeManager.uploadTheme()
  - Return theme metadata + validation result
  - Handle validation errors (400)
  - **Depends on**: T021
  - **Acceptance**: T005 tests pass

- [ ] **T024** Implement GET /api/themes/{themeId} endpoint
  - File: `src/routes/api/themes/[themeId]/+server.js` (GET handler)
  - Validate authKey
  - Call themeManager.getTheme(themeId)
  - Return theme or 404
  - **Depends on**: T021
  - **Acceptance**: T006 tests pass

- [ ] **T025** Implement DELETE /api/themes/{themeId} endpoint
  - File: `src/routes/api/themes/[themeId]/+server.js` (DELETE handler)
  - Validate authKey
  - Check if theme can be deleted (not preset, not in use)
  - Call themeManager.deleteTheme(themeId)
  - Return success or 400 with reason
  - **Depends on**: T021
  - **Acceptance**: T007 tests pass

- [ ] **T026** Implement GET /api/themes/{themeId}/can-delete endpoint
  - File: `src/routes/api/themes/[themeId]/can-delete/+server.js` (GET handler)
  - Validate authKey
  - Check if theme is global default (query user_preferences)
  - Check if theme used by any workspace (query workspaces)
  - Check if theme is preset
  - Return { canDelete, reason, workspaces }
  - **Depends on**: T021
  - **Acceptance**: T008 tests pass

- [ ] **T027** Implement GET /api/themes/active endpoint
  - File: `src/routes/api/themes/active/+server.js` (GET handler)
  - Validate authKey
  - Get optional workspaceId from query params
  - Resolve theme hierarchy:
    1. Check workspace.theme_override if workspaceId provided
    2. Check user_preferences.themes.globalDefault
    3. Use hardcoded fallback
  - Load resolved theme
  - Transform to CSS variables
  - Return { themeName, cssVariables, source }
  - **Depends on**: T021
  - **Acceptance**: T009 tests pass

### Frontend - State & Services

- [ ] **T028** [P] Implement ThemeState ViewModel
  - File: `src/lib/client/shared/state/ThemeState.svelte.js`
  - Use Svelte 5 $state runes for reactive properties
  - Properties: themes, globalDefault, workspaceOverrides, loading, error
  - Derived: presetThemes, customThemes, activeTheme
  - Methods: loadThemes(apiClient), activateTheme(apiClient, themeId)
  - **Acceptance**: T017 tests pass

- [ ] **T029** [P] Implement ThemeService API client
  - File: `src/lib/client/shared/services/ThemeService.js`
  - Methods:
    - listThemes(authKey)
    - getTheme(themeId, authKey)
    - uploadTheme(file, authKey)
    - deleteTheme(themeId, authKey)
    - canDeleteTheme(themeId, authKey)
    - getActiveTheme(workspaceId, authKey)
  - All methods return promises
  - Handle fetch errors gracefully

### Frontend - UI Components

- [ ] **T030** Implement ThemePreviewCard component
  - File: `src/lib/client/settings/ThemePreviewCard.svelte`
  - Props: theme (ThemeMetadata), selected (boolean), onclick (function)
  - Display theme name and description
  - Show terminal-style window chrome with theme colors
  - Display background/foreground color samples
  - Show ANSI color palette preview
  - Highlight if selected
  - **Depends on**: T028

- [ ] **T031** Implement ThemeSettings component
  - File: `src/lib/client/settings/ThemeSettings.svelte`
  - Import ThemeState ViewModel
  - Section: Preset Themes (grid of ThemePreviewCard)
  - Section: Custom Themes (grid + upload button)
  - File upload via drag-and-drop or click
  - Display validation errors/warnings on upload
  - Activate button triggers activateTheme()
  - Delete button with confirmation (check canDelete first)
  - Loading states and error handling
  - Show toast/notification on successful upload or activation (visual feedback)
  - **Depends on**: T028, T029, T030
  - **Acceptance**: T018 tests pass

- [ ] **T032** Implement CSS variable application on page load
  - File: `src/routes/+layout.svelte` (or new theme utility)
  - On mount: fetch active theme via GET /api/themes/active
  - Apply cssVariables to document.documentElement.style.setProperty()
  - Store theme in localStorage for immediate application on next load
  - **Depends on**: T029

- [ ] **T033** Integrate theme selection into onboarding flow
  - File: `src/lib/client/onboarding/ThemeSelectionStep.svelte` (create new)
  - Display grid of preset themes only
  - Allow selection (store in local state)
  - On completion: save to user_preferences.themes.globalDefault
  - Insert into onboarding flow after authentication, before workspace setup
  - **Depends on**: T028, T030

## Phase 3.4: Integration & Polish

### Integration Verification

- [ ] **T034** Verify database schema update
  - Restart application to trigger DatabaseManager.init()
  - Verify workspaces table has theme_override column via PRAGMA table_info
  - Test column can store theme filenames (e.g., 'dracula.json')
  - Test NULL values work correctly (no workspace override)
  - **Depends on**: T002

- [ ] **T035** Verify all integration tests pass
  - Run T013 (upload workflow) - should pass
  - Run T014 (activation) - should pass
  - Run T015 (deletion prevention) - should pass
  - Run T016 (fallback recovery) - should pass
  - **Depends on**: T022-T027, T031-T033

### E2E Tests

- [ ] **T036** [P] E2E test: Complete theme management workflow
  - File: `e2e/theme-management.spec.js`
  - Navigate to settings → themes
  - Verify 3 preset themes visible
  - Activate dark theme
  - Verify page refreshes and colors change
  - Upload custom theme
  - Verify custom theme appears in list
  - Delete custom theme
  - Verify theme removed from list
  - **Depends on**: T031

- [ ] **T037** [P] E2E test: Workspace-specific themes
  - File: `e2e/workspace-themes.spec.js`
  - Create two workspaces
  - Set workspace 1 to dark theme
  - Set workspace 2 to light theme
  - Switch between workspaces
  - Verify each workspace shows correct theme
  - Clear workspace override
  - Verify reverts to global default
  - **Depends on**: T031

- [ ] **T038** [P] E2E test: Onboarding theme selection
  - File: `e2e/onboarding-theme.spec.js`
  - Complete authentication step
  - Reach theme selection step
  - Select dark theme
  - Complete onboarding
  - Verify dark theme is active globally
  - **Depends on**: T033

### Performance & Validation

- [ ] **T039** Performance testing
  - Measure theme activation time (target < 500ms)
  - Measure upload validation time (target < 200ms)
  - Measure file I/O time (target < 50ms)
  - Measure theme list fetch (target < 100ms)
  - Document results in performance-benchmarks.md
  - **Depends on**: T022-T027

- [ ] **T040** Code quality review
  - Run ESLint on all new files
  - Run Prettier formatting
  - Verify no console.log statements in production code
  - Check error handling is comprehensive
  - Verify all async operations have proper try/catch
  - **Depends on**: All implementation tasks

- [ ] **T041** Documentation updates
  - Update CLAUDE.md with any implementation deviations
  - Add theme management section to user docs (if exists)
  - Document any known limitations or future enhancements
  - **Depends on**: T040

## Dependencies Graph

```
Setup (T001-T003) → Tests (T004-T018) → Implementation (T019-T033) → Integration (T034-T038) → Polish (T039-T041)

Detailed:
T001, T002, T003 (parallel) ──┐
                              ├──> T004-T018 (all tests, parallel)
                              │
T019 (ThemeParser) ───────────┤
                              │
T020 (XtermThemeParser) ◄─────┤
                              │
T021 (ThemeManager) ◄─────────┤
                              │
T022-T027 (API routes) ◄──────┤
                              │
T028, T029 (parallel) ◄───────┤
                              │
T030 (ThemePreviewCard) ◄─────┤
                              │
T031 (ThemeSettings) ◄────────┤
                              │
T032, T033 (parallel) ◄───────┤
                              │
T034, T035 ◄──────────────────┤
                              │
T036-T038 (parallel E2E) ◄────┤
                              │
T039-T041 (sequential) ◄──────┘
```

## Parallel Execution Examples

**Example 1: Setup Phase**
```bash
# T001 and T003 can run in parallel
Task: "Create preset theme files in static/themes/"
Task: "Configure theme directory structure"
# T002 runs separately (database schema update)
```

**Example 2: Contract Tests**
```bash
# All contract tests run in parallel
Task: "Contract test GET /api/themes in tests/server/api/themes-list.test.js"
Task: "Contract test POST /api/themes in tests/server/api/themes-upload.test.js"
Task: "Contract test GET /api/themes/{themeId} in tests/server/api/themes-get-single.test.js"
Task: "Contract test DELETE /api/themes/{themeId} in tests/server/api/themes-delete.test.js"
Task: "Contract test GET /api/themes/active in tests/server/api/themes-active.test.js"
```

**Example 3: Frontend State & Services**
```bash
# T028 and T029 run in parallel
Task: "Implement ThemeState ViewModel in src/lib/client/shared/state/ThemeState.svelte.js"
Task: "Implement ThemeService API client in src/lib/client/shared/services/ThemeService.js"
```

**Example 4: E2E Tests**
```bash
# All E2E tests run in parallel
Task: "E2E test: Complete theme management workflow in e2e/theme-management.spec.js"
Task: "E2E test: Workspace-specific themes in e2e/workspace-themes.spec.js"
Task: "E2E test: Onboarding theme selection in e2e/onboarding-theme.spec.js"
```

## Notes

- **TDD Enforcement**: All T004-T018 tests MUST be written and failing before any T019+ implementation tasks
- **[P] markers**: Only applied to tasks that modify different files and have no data dependencies
- **File paths**: All paths are absolute or relative to repository root `/home/founder3/code/github/fwdslsh/dispatch`
- **Test-first order**: Contract tests → Unit tests → Integration tests → Implementation → E2E tests
- **Commit strategy**: Commit after each completed task with message referencing task ID (e.g., "T019: Implement ThemeParser abstract class")

## Validation Checklist

_Verified before task execution_

- [x] All API endpoints from contracts/ have corresponding tests (T004-T009)
- [x] All entities from data-model.md have implementation tasks (ThemeParser, XtermThemeParser, ThemeManager)
- [x] All acceptance scenarios from spec.md have integration/E2E tests (T013-T016, T036-T038)
- [x] All tests come before implementation (T004-T018 before T019-T033)
- [x] Parallel tasks modify different files (verified for all [P] markers)
- [x] Each task specifies exact file path
- [x] Dependencies are clearly documented in graph

## Task Summary

- **Setup**: 3 tasks (T001-T003)
- **Contract Tests**: 6 tasks (T004-T009)
- **Unit Tests**: 6 tasks (T010-T012, T017-T018) + parser tests
- **Integration Tests**: 4 tasks (T013-T016)
- **Backend Implementation**: 9 tasks (T019-T027)
- **Frontend Implementation**: 6 tasks (T028-T033)
- **Integration & E2E**: 5 tasks (T034-T038)
- **Polish**: 3 tasks (T039-T041)
- **Total**: 41 tasks

**Estimated Effort**: ~15-20 hours for experienced developer
**Critical Path**: T001 → T019 → T020 → T021 → T022-T027 → T031 → T036
