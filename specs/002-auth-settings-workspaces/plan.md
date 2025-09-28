
# Implementation Plan: UI Components for Authentication, Workspace Management, and Maintenance

**Branch**: `002-we-need-to` | **Date**: 2025-09-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-we-need-to/spec.md`

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
Create UI components and workflows for authentication, workspace management, and maintenance features. This includes a progressive onboarding workflow (authentication + first workspace creation), enhanced ProjectSessionMenu for workspace navigation, and settings interfaces for retention policies covering sessions and logs.

## Technical Context
**Language/Version**: JavaScript/Node.js 22+ with SvelteKit 2.x and Svelte 5
**Primary Dependencies**: SvelteKit, Svelte 5 runes, Socket.IO, SQLite3, Express, @anthropic-ai/claude-code
**Storage**: SQLite database with event-sourced session architecture
**Testing**: Vitest (unit), Playwright (E2E), @testing-library/svelte (component)
**Target Platform**: Containerized web application (Docker) with browser frontend
**Project Type**: web - SvelteKit frontend with Node.js backend, unified session management
**Performance Goals**: Sub-100ms session replay, real-time Socket.IO communication, responsive UI
**Constraints**: Event-sourced architecture, adapter pattern for session types, MVVM frontend pattern
**Scale/Scope**: Single-user per instance, multiple workspaces, session persistence and multi-client support

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Security-First Architecture**: ✅ PASS
- Authentication via existing terminal key mechanism (rolling 30-day sessions)
- No new security boundaries introduced - leveraging existing auth infrastructure
- UI components respect existing isolation patterns

**II. Event-Sourced State Management**: ✅ PASS
- Onboarding state and preferences will use existing database schema
- Workspace navigation integrates with existing session management
- No changes to core event sourcing architecture

**III. Adapter Pattern for Extensibility**: ✅ PASS
- Enhancing existing ProjectSessionMenu component (no new adapters needed)
- Settings interface follows existing component patterns
- Workspace management leverages existing API endpoints

**IV. Test-Driven Development**: ✅ PASS
- Will follow TDD cycle for all new components
- Component tests using @testing-library/svelte
- E2E tests for onboarding workflow using Playwright
- Integration tests for workspace management

**V. Progressive Enhancement**: ✅ PASS
- Progressive onboarding (minimal first, advanced later)
- Settings interface optional/accessible after basic setup
- Core functionality works without advanced features

**MVVM Frontend Architecture**: ✅ PASS
- Using Svelte 5 runes for reactive state management
- Following existing ViewModel patterns in codebase
- ServiceContainer dependency injection

**Unified Session Protocol**: ✅ PASS
- No changes to Socket.IO event structure
- Workspace switching uses existing session management

**Constitutional Compliance**: ✅ PASS - No violations detected

**Post-Design Constitutional Re-check**:
- Security boundaries maintained ✅
- Event-sourced architecture preserved ✅
- Adapter pattern respected ✅
- Test-driven approach planned ✅
- Progressive enhancement implemented ✅
- MVVM patterns followed ✅
- No new complexity violations ✅

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
│   ├── client/
│   │   ├── shared/
│   │   │   ├── components/          # UI components (existing + new onboarding/settings)
│   │   │   ├── services/            # ServiceContainer, API clients
│   │   │   └── state/               # ViewModels with $state runes
│   │   ├── onboarding/              # NEW: Onboarding workflow components
│   │   └── settings/                # NEW: Settings/maintenance components
│   ├── server/
│   │   ├── shared/                  # Existing session management
│   │   └── api/                     # Express routes (workspaces API exists)
│   └── shared/                      # Common types and utilities
├── routes/                          # SvelteKit pages
│   ├── +layout.svelte               # Enhanced with onboarding detection
│   ├── onboarding/                  # NEW: Onboarding pages
│   └── settings/                    # NEW: Settings pages
└── app.html                         # Main HTML template

tests/
├── client/                          # Frontend component tests
├── server/                          # Backend API tests
├── e2e/                            # End-to-end Playwright tests
└── helpers/                        # Test utilities
```

**Structure Decision**: Web application with unified SvelteKit frontend/backend. New components will extend existing architecture patterns in `src/lib/client/shared/components/` and add new feature-specific directories for onboarding and settings workflows.

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
*Prerequisites: research.md complete*

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

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Database schema tasks: SQLite migrations for new tables [P]
- Contract test tasks: API endpoint testing for onboarding, retention, preferences [P]
- Component test tasks: Svelte component tests using @testing-library/svelte [P]
- Integration test tasks: Complete user workflow validation
- Implementation tasks: Following TDD to make tests pass

**Component Implementation Order**:
1. Database extensions (onboarding_state, retention_policies, user_preferences tables)
2. API endpoints (onboarding, retention, preferences APIs)
3. ViewModels with Svelte 5 runes (OnboardingViewModel, RetentionPolicyViewModel)
4. UI Components (onboarding workflow, settings interface)
5. Enhanced ProjectSessionMenu (workspace navigation integration)
6. E2E workflow tests (complete user journeys)

**Ordering Strategy**:
- TDD order: Tests before implementation for each component
- Dependency order: Database → API → ViewModels → Components → Integration
- Mark [P] for parallel execution within same layer
- Mark dependencies explicitly for sequential tasks

**Estimated Breakdown**:
- Database/API tasks: 8-10 tasks
- Component/ViewModel tasks: 12-15 tasks
- Integration/E2E tasks: 5-7 tasks
- **Total estimated**: 25-32 numbered, ordered tasks in tasks.md
- **Actual generated**: 38 tasks (includes additional polish and accessibility tasks)

**Key Integration Points**:
- Enhanced ProjectSessionMenu extends existing component
- Authentication integrates with existing terminal key system
- Workspace management leverages existing workspace API
- Settings follow existing component patterns

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

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
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
