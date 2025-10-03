# Implementation Plan: Theme Support System

**Branch**: `006-theme-support-feature` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/founder3/code/github/fwdslsh/dispatch/specs/006-theme-support-feature/spec.md`
**Technical Context Note**: Some design artifacts are missing

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

Implement a unified theme support system for Dispatch that allows users to customize the visual appearance through xterm theme files. The system provides preset themes (Phosphor Green default, Light, Dark), supports custom theme uploads with validation, and enables both global defaults and per-workspace theme overrides. The implementation uses simple file-based storage, class-based parsers for extensibility, and automatic fallback to a hardcoded Phosphor Green theme when issues arise.

## Technical Context

**Language/Version**: JavaScript (Node.js >=22, ES modules)
**Primary Dependencies**: SvelteKit 2.x, Svelte 5 (runes), Socket.IO 4.8.x, better-sqlite3 12.4.1, @xterm/xterm 5.5.0
**Storage**: File-based JSON themes in `~/.dispatch/themes/`, SQLite for user preferences and workspace overrides
**Testing**: Vitest (unit tests), Playwright (E2E tests)
**Target Platform**: Web application (containerized Linux, browser-based UI)
**Project Type**: Web (SvelteKit frontend + Node.js backend with Socket.IO)
**Performance Goals**: Theme activation < 500ms, upload validation < 200ms, file I/O < 50ms
**Constraints**: Single-user application, 5MB max theme file size, automatic page refresh on theme change
**Scale/Scope**: ~10-20 custom themes per user, 3 preset themes, simple CSS variable mapping

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**I. Simplicity & Maintainability**: ✅ PASS
- Uses simple file-based storage with JSON themes
- Minimal abstraction: single ThemeParser abstract class
- Reuses existing database for preferences (no new tables needed beyond user_preferences)
- No unnecessary dependencies (leverages existing file system APIs)

**II. Single-User, Developer-First Platform**: ✅ PASS
- Explicitly designed for single-user (FR-032: no sharing/export/multi-user)
- Serves individual developer customizing their environment
- No team collaboration features

**III. Isolated, Remotely Accessible Development Environment**: ✅ PASS
- Themes stored in user's isolated data directory (`~/.dispatch/themes/`)
- No external dependencies or cloud services
- Works within containerized environment

**IV. Event-Sourced State Management**: ✅ PASS (Not Applicable)
- Theme changes trigger page refresh (FR-011) - no events needed
- Theme state is preference data, not session activity
- No session history replay required for theming

**V. Adapter Pattern for Extensibility**: ✅ PASS
- ThemeParser follows adapter pattern with abstract base class
- XtermThemeParser is first concrete implementation
- New formats can be added without modifying core code (FR-002)

**VI. Progressive Enhancement**: ✅ PASS
- Core functionality: hardcoded Phosphor Green fallback (FR-029, FR-030)
- Enhanced: preset themes copied during onboarding (FR-005)
- Advanced: custom theme uploads (optional feature)
- Graceful degradation when themes missing or corrupted

**Post-Design Re-Evaluation (Phase 1 Complete)**: ✅ ALL PRINCIPLES PASS

After completing design artifacts (data-model.md, contracts/, quickstart.md):
- No new constitutional violations introduced
- Design maintains simplicity: file-based storage, single abstract class, reuses existing DB tables
- Schema update via existing ensureWorkspaceSchema() pattern (adds theme_override column)
- No unnecessary complexity or over-engineering
- All constitutional principles remain satisfied

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── server/
│   │   ├── themes/                  # NEW: Theme management backend
│   │   │   ├── ThemeManager.js      # Theme CRUD operations
│   │   │   ├── ThemeParser.js       # Abstract parser class
│   │   │   └── XtermThemeParser.js  # xterm format parser with validation
│   │   ├── settings/                # EXISTING: User preferences
│   │   └── shared/
│   │       └── db/                  # EXISTING: Database management
│   └── client/
│       ├── settings/                # EXISTING: Settings UI
│       │   └── ThemeSettings.svelte # NEW: Theme management UI
│       └── shared/
│           ├── state/               # EXISTING: ViewModels
│           │   └── ThemeState.svelte.js  # NEW: Theme state
│           └── services/            # EXISTING: API clients
│               └── ThemeService.js  # NEW: Theme API client
├── routes/
│   └── api/
│       └── themes/                  # NEW: Theme REST endpoints
│           └── +server.js
└── app.html                         # EXISTING: Add CSS var imports

static/themes/                       # NEW: Preset theme files
├── phosphor-green.json
├── light.json
└── dark.json

tests/
├── server/
│   └── themes/                      # NEW: Backend tests
│       ├── ThemeManager.test.js
│       └── XtermThemeParser.test.js
├── client/
│   └── settings/                    # NEW: Component tests
│       └── ThemeSettings.test.js
└── e2e/
    └── theme-management.spec.js     # NEW: E2E tests
```

**Structure Decision**: Web application (SvelteKit). Theme management follows existing patterns:
- Backend services in `src/lib/server/themes/`
- Frontend components in `src/lib/client/settings/`
- State management using Svelte 5 runes in `src/lib/client/shared/state/`
- REST API routes in `src/routes/api/themes/`
- Preset themes bundled in `static/themes/`
- User themes stored at runtime in `~/.dispatch/themes/`

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

The /tasks command will generate implementation tasks based on design artifacts:

1. **Backend Tasks** (from data-model.md and contracts/):
   - Database schema update: Add `theme_override` column to `workspaces` table
   - ThemeParser abstract class + XtermThemeParser implementation with validation [P]
   - ThemeManager with caching and CRUD operations
   - API routes: GET/POST/DELETE /api/themes, GET /api/themes/active
   - Contract tests for each API endpoint (validate request/response schemas)

2. **Frontend Tasks** (from data-model.md and quickstart.md):
   - ThemeState ViewModel with Svelte 5 runes [P]
   - ThemeService API client integration [P]
   - ThemeSettings component (theme grid, upload UI)
   - ThemePreviewCard component (live color preview)
   - CSS variable application on page load
   - Onboarding theme selection step integration

3. **Integration Tasks** (from contracts/ and spec.md acceptance scenarios):
   - E2E test: Theme upload and validation workflow
   - E2E test: Theme activation triggers page reload
   - E2E test: Workspace-specific theme override
   - E2E test: Deletion prevention (theme in use)
   - E2E test: Hardcoded fallback when themes missing

4. **Preset Theme Tasks**:
   - Create 3 preset theme JSON files (phosphor-green, dark, light)
   - Onboarding preset copy logic
   - Hardcoded FALLBACK_THEME constant in ThemeManager

**Ordering Strategy**:

1. **Foundation** (parallel where possible):
   - Database schema update [1]
   - Preset theme files [P]
   - Abstract ThemeParser class [2]

2. **Core Backend** (sequential dependencies):
   - XtermThemeParser with validation (depends on ThemeParser) [3]
   - ThemeManager (depends on parser) [4]
   - API routes (depend on ThemeManager) [5-10]

3. **Contract Tests** (parallel with implementation):
   - One test per API endpoint [P] [11-15]

4. **Frontend Foundation** (parallel):
   - ThemeState ViewModel [P] [16]
   - ThemeService API client [P] [17]

5. **UI Components** (sequential for shared components):
   - ThemePreviewCard [18]
   - ThemeSettings main component [19]
   - CSS application logic [20]
   - Onboarding integration [21]

6. **Integration Testing** (after core features complete):
   - E2E tests [22-26]

**Parallelization Markers**:

- [P] = Can execute in parallel with other [P] tasks in same phase
- Sequential numbers indicate dependency order

**Estimated Task Breakdown**:

- Database & Setup: 3 tasks
- Backend (Parsers, Manager, APIs): 8 tasks
- Contract Tests: 5 tasks
- Frontend (State, Services, UI): 6 tasks
- Integration Tests: 5 tasks
- **Total**: ~27 tasks

**Task Template Fields** (from tasks-template.md):

Each task will include:
- Task number and description
- Dependencies (which tasks must complete first)
- Acceptance criteria (testable outcomes)
- File paths to create/modify
- Parallelization marker [P] where applicable

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) - ✅ research.md generated
- [x] Phase 1: Design complete (/plan command) - ✅ data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - ✅ Task generation strategy documented (~27 tasks)
- [x] Phase 3: Tasks generated (/tasks command) - ✅ tasks.md created with 41 detailed tasks
- [ ] Phase 4: Implementation complete - Ready to execute tasks in order
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS - All principles satisfied before research
- [x] Post-Design Constitution Check: PASS - All principles maintained after design
- [x] All NEEDS CLARIFICATION resolved - Spec has complete Clarifications section (Session 2025-10-02)
- [x] Complexity deviations documented - None required (design follows all constitutional principles)

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
