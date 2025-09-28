# Implementation Plan: Settings Normalization and Unification

**Branch**: `003-settings-normalization-should` | **Date**: September 28, 2025 | **Spec**: /specs/003-settings-normalization-should/spec.md
**Input**: Feature specification from `/specs/003-settings-normalization-should/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

This feature unifies all settings-related UI and logic into a single, maintainable directory and implements a modern settings page with a left-side tab menu. The approach is to refactor the settings page to use the tabbed navigation pattern from the modal, consolidate all settings components, and ensure accessibility, usability, and test coverage. The technical approach follows Svelte 5 MVVM conventions and project constitution requirements.

## Technical Context

**Language/Version**: JavaScript (Node.js 22+), Svelte 5
**Primary Dependencies**: SvelteKit, Socket.IO, Prettier, ESLint, Playwright, Vitest
**Storage**: N/A (settings persisted in local storage or backend as per existing flows)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (Linux server, browser)
**Project Type**: web (frontend + backend)
**Performance Goals**: UI loads in <200ms, settings save in <500ms
**Constraints**: Must follow Svelte 5 runes, MVVM, and accessibility best practices
**Scale/Scope**: All user-facing settings, extensible for future sections

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

All core principles are satisfied:

- Security-First: No new code execution or privilege escalation; UI only.
- Event-Sourced: No change to event model; settings UI only.
- Adapter Pattern: No new adapters; UI refactor only.
- TDD: All changes require new/updated unit and E2E tests.
- Progressive Enhancement: UI degrades gracefully if settings sections are missing.

Implementation standards, quality assurance, and governance are all met. No violations or complexity deviations expected.

## Project Structure

specs/[###-feature]/

### Documentation (this feature)

```
specs/003-settings-normalization-should/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

src/
tests/
ios/ or android/

### Source Code (repository root)

```
src/
└── lib/
   └── client/
      └── settings/           # All settings-related components (new unified location)
      └── shared/             # Shared components (unchanged)
      └── terminal/           # Terminal UI (unchanged)
      └── claude/             # Claude UI (unchanged)
      └── file-editor/        # File editor UI (unchanged)
routes/
   └── settings/+page.svelte   # Main settings page (refactored)
tests/
   └── unit/
   └── integration/
   └── contract/
   └── e2e/
```

**Structure Decision**: Use a unified `src/lib/client/settings/` directory for all settings components. Refactor `src/routes/settings/+page.svelte` to use the new tabbed UI. All other feature directories remain unchanged.

## Phase 0: Outline & Research

All unknowns resolved. See `research.md` for best practices, decisions, rationale, and alternatives considered. No open clarifications remain.

## Phase 1: Design & Contracts

Entities, relationships, and validation rules are defined in `data-model.md`. No new API contracts are required (UI-only feature). Test scenarios are covered in the quickstart and will be implemented in unit and E2E tests. Agent context file updated for Copilot.

## Phase 2: Task Planning Approach

The /tasks command will generate tasks from the data model, quickstart, and user stories. Tasks will include: moving and refactoring settings components, updating the settings page, implementing the tabbed UI, ensuring accessibility, and adding/adjusting tests. TDD and dependency order will be followed. See quickstart.md for step-by-step implementation guidance.

## Phase 3+: Future Implementation

Phases 3-5 will be executed after task generation. Implementation will follow constitutional principles, and validation will include running all tests and verifying the new settings UI.

## Complexity Tracking

No complexity deviations or constitution violations expected for this feature.

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
