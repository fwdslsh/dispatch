# Tasks: Settings Normalization and Unification

## Overview

This tasks.md provides a dependency-ordered, parallelizable task list for unifying the settings UI and logic in Dispatch. Each task is specific and actionable for LLM or human agents.

---

### Legend

- [P]: Can be executed in parallel with other [P] tasks
- File paths are absolute from repo root

---

## Task List

### Setup

- [x] **T001**: Ensure you are on the feature branch `003-settings-normalization-should` and dependencies are installed
  - `git checkout 003-settings-normalization-should`
  - `npm install`

### Test-First (TDD)

- [x] **T002 [P]**: Add/adjust unit tests for all new and changed settings flows, including error handling and edge cases (before refactor)
  - `tests/unit/` and `tests/integration/`
- [x] **T003 [P]**: Add/adjust E2E tests for settings navigation, tab switching, save flows, and all edge cases (component load failure, missing/corrupt preferences, section not found)
  - `e2e/`

### Core Refactor & Implementation

- [x] **T004**: Move all settings-related components to `src/lib/client/settings/` (consolidate from scattered locations)
  - Update all imports and references project-wide
- [x] **T005**: Refactor `src/routes/settings/+page.svelte` to use a left-side tab menu (modeled after `SettingsModal.svelte`)
  - Import and register all settings sections as tabs
- [x] **T006**: Update each settings section to use the new unified structure and directory
  - Preferences, Retention, Auth, Workspace, etc.
- [x] **T007**: Remove or update any references to old settings component locations and Settings Modal

### Accessibility & Usability

- [x] **T008 [P]**: Add ARIA roles, keyboard navigation, and focus states for all tabs and panels in the settings page
- [x] **T009 [P]**: Ensure all settings sections provide clear error handling and user feedback

### Polish & Validation

- [ ] **T010 [P]**: Update or add documentation for the new settings structure, extensibility guidance (how to add new settings sections), and usage
  - `README.md`, `AGENTS.md`, or feature docs as needed
- [ ] **T011 [P]**: Re-run all unit and E2E tests to validate the new settings UI, including all edge cases and non-functional requirements (performance, accessibility)
  - `npm test`, `npm run test:e2e`
- [ ] **T012**: Commit and push all changes
  - `git add . && git commit -m "feat(settings): unify settings UI and components" && git push origin 003-settings-normalization-should`

---

## Parallel Execution Guidance

- T002, T003, T008, T009, T010, and T011 can be run in parallel where dependencies allow ([P] marked)
- T004–T007 must be done sequentially (refactor and migration)
- T012 (commit/push) is last

---

## Example Agent Commands

- To run all [P] tasks in parallel:
  - `agent run T002 T003 T008 T009 T010 T011`
- To run sequential core refactor:
  - `agent run T004 && agent run T005 && agent run T006 && agent run T007`

---

This tasks.md is immediately executable and covers all requirements from the design artifacts.
