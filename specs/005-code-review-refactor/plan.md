# Implementation Plan: Code Review Refactor

**Branch**: `005-code-review-refactor` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/founder3/code/github/fwdslsh/dispatch/specs/005-code-review-refactor/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → ✅ Loaded from spec.md
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ All technical details resolved via clarifications
   → Project Type: web (SvelteKit frontend + Node.js backend)
   → Structure Decision: Existing monorepo structure preserved
3. Fill the Constitution Check section
   → ✅ Evaluated against Dispatch Constitution v1.3.0
4. Evaluate Constitution Check section
   → ✅ No violations - refactoring aligns with simplicity principles
   → Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → ✅ Research complete - Svelte 5 patterns documented
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, AGENTS.md
   → ✅ Design artifacts generated
7. Re-evaluate Constitution Check section
   → ✅ No new violations - design preserves architecture
   → Update Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Task generation approach described
9. ✅ STOP - Ready for /tasks command
```

## Summary

**Primary Requirement**: Modernize Dispatch codebase by eliminating legacy Svelte 4 syntax, modularizing large files, and documenting architectural patterns to improve developer experience and maintainability.

**Technical Approach**:

- Update 3 components from `export let` to Svelte 5 `$props()` syntax
- Split SessionApiClient.js (~970 lines) into domain-specific modules
- Extract ClaudePane.svelte (~1,800 lines) into focused subcomponents
- Document runes-in-classes MVVM pattern and adapter registration process
- Validate all changes via regression testing (existing test suite + manual spot-checks)

**Key Insight from Research**: This is a technical debt cleanup and modernization effort that strengthens existing architecture without introducing new complexity. Success measured by code consistency, maintainability improvements, and zero functional regressions.

## Technical Context

**Language/Version**: JavaScript ES2022+ (Node.js 22+, as specified in .nvmrc)
**Primary Dependencies**:

- Frontend: Svelte 5, SvelteKit 2.x, @battlefieldduck/xterm-svelte
- Backend: Socket.IO 4.8.x, node-pty, SQLite3 5.1.7
- Testing: Vitest (unit), Playwright (E2E)

**Storage**: SQLite (event-sourced session data, user preferences, workspace metadata)
**Testing**: Vitest for unit tests, Playwright for E2E regression validation
**Target Platform**: Docker containers (Linux), browser clients (modern Chrome/Firefox/Safari)
**Project Type**: Web application (SvelteKit frontend + Node.js backend in monorepo)
**Performance Goals**:

- Refactoring must not degrade session replay performance (<100ms)
- Module load times should remain comparable to current monolithic files

**Constraints**:

- Zero functional regressions (100% existing test pass rate)
- Preserve MVVM architecture and event-sourcing patterns
- No breaking changes to public APIs or component interfaces
- Must support existing Docker deployment workflow

**Scale/Scope**:

- 3 components for syntax updates (~300 lines total)
- 1 service module split (~970 lines → 3 modules)
- 1 large component extraction (~1,800 lines → 4+ subcomponents)
- 3 new documentation files (MVVM patterns, adapter guide, error handling guide)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### ✅ I. Simplicity & Maintainability

**Status**: PASS - Refactoring reduces complexity

This feature actively improves simplicity by:

- Eliminating mixed syntax patterns (legacy Svelte 4 + modern Svelte 5)
- Breaking large files into cohesive, single-purpose modules
- Documenting existing patterns to reduce cognitive load for new contributors

No new dependencies or abstractions introduced. Aligns with YAGNI and SOLID principles.

### ✅ II. Single-User, Developer-First Platform

**Status**: PASS - Enhances single-developer experience

Target users are developers working on Dispatch itself. Benefits:

- Faster onboarding for solo contributors (clear documentation)
- Easier code navigation and modification (smaller, focused modules)
- Reduced merge conflicts when solo developer switches contexts

No multi-user features introduced.

### ✅ III. Isolated, Remotely Accessible Development Environment

**Status**: PASS - No impact on isolation model

Refactoring does not affect container isolation, remote access, or security model. All changes are internal code organization.

### ✅ IV. Event-Sourced State Management

**Status**: PASS - Preserves event sourcing

No changes to event sourcing architecture. SessionApiClient modularization preserves existing event handling. All session state remains immutable and recoverable.

### ✅ V. Adapter Pattern for Extensibility

**Status**: PASS - Documents and reinforces adapter pattern

FR-006 explicitly documents adapter registration process, making pattern more accessible. No changes to adapter interface or registration mechanism. Strengthens adherence to this principle.

### ✅ VI. Progressive Enhancement

**Status**: PASS - No impact on progressive features

Refactoring does not affect SSL, tunnels, or optional features. Core functionality remains minimal and self-contained.

### ✅ Implementation Standards

**Status**: PASS - Follows all standards

- Simplicity First: ✅ Reduces complexity
- SOLID & YAGNI: ✅ Single-purpose modules, no premature abstraction
- Minimal Dependencies: ✅ Zero new dependencies
- Single-User Focus: ✅ Developer experience improvements only
- MVVM Frontend: ✅ Preserves and documents existing MVVM patterns
- Unified Session Protocol: ✅ No changes to Socket.IO events
- Testing Discipline: ✅ Regression testing before merge (FR-001)

**Initial Constitution Check**: ✅ PASS
**Post-Design Constitution Check**: ✅ PASS (re-validated after Phase 1)

## Project Structure

### Documentation (this feature)

```
specs/005-code-review-refactor/
├── plan.md              # This file (/plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (Svelte 5 best practices)
├── data-model.md        # Phase 1 output (refactored module structure)
├── quickstart.md        # Phase 1 output (validation steps)
├── contracts/           # Phase 1 output (module interfaces)
│   ├── SessionApiClient.contracts.md
│   ├── ClaudePane.contracts.md
│   └── SvelteComponents.contracts.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created yet)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── client/
│   │   ├── onboarding/
│   │   │   ├── AuthenticationStep.svelte           # FR-002: Props syntax update
│   │   │   └── WorkspaceCreationStep.svelte        # FR-002: Props syntax update
│   │   ├── claude/
│   │   │   ├── ClaudePane.svelte                   # FR-005: Extract subcomponents
│   │   │   ├── components/                         # FR-005: New subcomponents
│   │   │   │   ├── ToolPanel.svelte
│   │   │   │   ├── TracePanel.svelte
│   │   │   │   ├── MessageList.svelte
│   │   │   │   └── InputArea.svelte
│   │   │   └── viewmodels/                         # FR-005: Extracted logic
│   │   │       └── ClaudePaneViewModel.svelte.js
│   │   └── shared/
│   │       └── services/
│   │           ├── SessionApiClient.js             # FR-004: Split into modules
│   │           └── session-api/                    # FR-004: New module structure
│   │               ├── queries.js
│   │               ├── mutations.js
│   │               └── validation.js
│   └── server/
│       └── (no changes - documentation only)
├── routes/
│   └── testing/+page.svelte                        # FR-002: Props syntax update
└── docs/
    ├── architecture/
    │   ├── mvvm-patterns.md                        # FR-003: MVVM documentation
    │   └── adapter-guide.md                        # FR-006: Adapter documentation
    └── contributing/
        └── error-handling.md                       # FR-007: Async patterns doc

tests/
├── client/
│   ├── onboarding/                                 # Existing tests
│   ├── claude/                                     # Updated tests for new structure
│   └── shared/services/                            # Updated tests for modularized API
└── (no new test files - regression validates existing tests pass)
```

**Structure Decision**: Monorepo structure preserved. All refactoring occurs within existing `src/lib/client/` hierarchy. New documentation added to `src/docs/` (or repository root if preferred). No changes to backend structure. Follows existing Dispatch conventions for ViewModels (`.svelte.js`), components (`.svelte`), and service modules (`.js`).

## Phase 0: Outline & Research

### Research Tasks Executed

1. **Svelte 5 Migration Patterns**
   - Task: Research best practices for `export let` → `$props()` conversion
   - Task: Understand edge cases (destructuring, defaults, computed props)

2. **Module Splitting Strategies**
   - Task: Find patterns for breaking large JavaScript modules (SessionApiClient)
   - Task: Research cohesion metrics and module boundaries

3. **Component Extraction Patterns**
   - Task: Best practices for extracting Svelte subcomponents
   - Task: Props vs. context vs. stores for shared state

4. **Documentation Strategies**
   - Task: Effective technical documentation formats for architectural patterns

### Consolidation

All research findings documented in `research.md` with:

- Decision: Chosen approach
- Rationale: Why selected
- Alternatives considered: Trade-offs evaluated

**Output**: ✅ research.md generated (see artifact)

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

### 1. Data Model (`data-model.md`)

**Entities Extracted from Spec**:

- **Svelte Component Modules** (FR-002)
  - Files: AuthenticationStep.svelte, WorkspaceCreationStep.svelte, testing/+page.svelte
  - Current: `export let propName = defaultValue`
  - Target: `let { propName = defaultValue } = $props()`
  - Validation: Props must remain functionally identical

- **SessionApiClient Module** (FR-004)
  - Current: Single 970-line file
  - Target: 3 cohesive modules (queries, mutations, validation)
  - Relationships: Shared types/interfaces, no circular dependencies
  - State: No state transitions (stateless service modules)

- **ClaudePane Component** (FR-005)
  - Current: Single 1,800-line component
  - Target: 4+ focused subcomponents + viewmodel
  - Relationships: Parent-child component tree, shared viewmodel state
  - State transitions: Tool panel states, message flow states

- **Documentation Artifacts** (FR-003, FR-006, FR-007)
  - MVVM patterns document: Explain runes-in-classes rationale
  - Adapter guide: Registration steps, file paths, minimal example
  - Error handling guide: Standardized async return shapes

### 2. API Contracts (`/contracts/`)

**Module Interfaces** (for FR-004: SessionApiClient split):

```javascript
// contracts/SessionApiClient.contracts.md

## Queries Module Interface
export interface SessionApiQueries {
  getAllSessions(filters?: SessionFilters): Promise<Session[]>
  getSession(id: string): Promise<Session>
  getSessionEvents(id: string, fromSeq?: number): Promise<Event[]>
}

## Mutations Module Interface
export interface SessionApiMutations {
  createSession(data: CreateSessionData): Promise<Session>
  updateSession(id: string, updates: Partial<Session>): Promise<Session>
  deleteSession(id: string): Promise<void>
  sendInput(id: string, input: string): Promise<void>
}

## Validation Module Interface
export interface SessionApiValidation {
  validateSessionData(data: unknown): ValidationResult<CreateSessionData>
  validateSessionId(id: unknown): ValidationResult<string>
  sanitizeInput(input: string): string
}
```

**Component Contracts** (for FR-005: ClaudePane extraction):

```javascript
// contracts/ClaudePane.contracts.md

## ToolPanel.svelte Props
interface ToolPanelProps {
  tools: Tool[]
  selectedTool: string | null
  onToolSelect: (toolId: string) => void
}

## TracePanel.svelte Props
interface TracePanelProps {
  traces: TraceEntry[]
  expanded: boolean
  onToggle: () => void
}

## MessageList.svelte Props
interface MessageListProps {
  messages: Message[]
  onMessageAction: (messageId: string, action: string) => void
}

## InputArea.svelte Props
interface InputAreaProps {
  value: string
  disabled: boolean
  onSubmit: (text: string) => void
  onCancel: () => void
}
```

### 3. Contract Tests

**Test Strategy**: Since this is refactoring (not new features), contract tests validate interface preservation:

```javascript
// tests/client/shared/services/session-api/queries.test.js
describe('SessionApiQueries', () => {
	it('should export getAllSessions function', () => {
		expect(typeof queries.getAllSessions).toBe('function');
	});

	it('should return promise from getAllSessions', async () => {
		const result = queries.getAllSessions();
		expect(result).toBeInstanceOf(Promise);
	});

	// Additional interface validation tests
});
```

**Note**: Existing tests remain primary validation. Contract tests ensure refactored modules export expected interfaces.

### 4. Test Scenarios from User Stories

**From Spec Acceptance Scenarios**:

1. **Scenario 1**: Props syntax consistency

   ```javascript
   // tests/client/onboarding/props-syntax.test.js
   it('should use $props() in AuthenticationStep', () => {
   	const component = render(AuthenticationStep);
   	// Verify no export let syntax in compiled output
   });
   ```

2. **Scenario 3**: SessionApiClient modularity

   ```javascript
   // tests/client/shared/services/session-api/integration.test.js
   it('should load queries module independently', async () => {
   	const { getAllSessions } = await import('$lib/client/shared/services/session-api/queries.js');
   	expect(getAllSessions).toBeDefined();
   });
   ```

3. **Scenario 4**: ClaudePane subcomponent location

   ```javascript
   // tests/client/claude/component-structure.test.js
   it('should have ToolPanel as separate component', async () => {
   	const module = await import('$lib/client/claude/components/ToolPanel.svelte');
   	expect(module.default).toBeDefined();
   });
   ```

4. **Scenario 6**: Regression validation
   ```bash
   # Manual validation checklist in quickstart.md
   - npm run test (all unit tests pass)
   - npm run test:e2e (all E2E tests pass)
   - Manual: Create terminal session
   - Manual: Create Claude session
   - Manual: Switch workspaces
   ```

### 5. Update AGENTS.md

Executed via script:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

**Updates Applied**:

- Added "Svelte 5 $props() syntax" to tech stack
- Added "Runes-in-classes MVVM pattern" to architecture patterns
- Added "Module cohesion and separation of concerns" to code standards
- Updated recent changes (keep last 3): "Code review refactor: syntax modernization, modularization"

**Output**: ✅ All Phase 1 artifacts generated:

- data-model.md
- contracts/SessionApiClient.contracts.md
- contracts/ClaudePane.contracts.md
- contracts/SvelteComponents.contracts.md
- quickstart.md
- AGENTS.md updated

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

1. **Load Template**: `.specify/templates/tasks-template.md` as base
2. **Generate from Design Docs**:
   - Each contract → contract test task [P] (can run in parallel)
   - Each component → syntax update task [P]
   - SessionApiClient → module creation tasks (sequential: queries → mutations → validation)
   - ClaudePane → subcomponent extraction tasks (sequential: ToolPanel → TracePanel → MessageList → InputArea)
   - Documentation → writing tasks [P]

3. **Task Categories**:
   - **Testing Setup**: Contract test creation (Phase 1 validation)
   - **Syntax Modernization**: Props syntax updates (FR-002)
   - **Module Splitting**: SessionApiClient refactor (FR-004)
   - **Component Extraction**: ClaudePane refactor (FR-005)
   - **Documentation**: MVVM patterns, adapter guide, error handling (FR-003, FR-006, FR-007)
   - **Regression Validation**: Full test suite execution + manual checks (FR-001)

**Ordering Strategy**:

1. **Contract tests first**: Validate interfaces before implementation
2. **Low-risk changes** (props syntax): Quick wins, build confidence
3. **Module splitting** (SessionApiClient): Medium complexity, clear boundaries
4. **Component extraction** (ClaudePane): Highest complexity, most dependencies
5. **Documentation pass**: After code changes complete (per clarification #2)
6. **Regression validation**: Final gate before completion

**Parallelization**:

- [P] marks for: Props syntax updates (independent files), contract tests (no dependencies), documentation writing
- Sequential for: Module creation (shared types), component extraction (parent-child relationships)

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**Task Template Structure**:

```markdown
## Task N: [Category] - [Brief Description]

**Depends On**: Task M (if sequential)
**Can Run in Parallel**: [P] (if independent)

**Objective**: [What to accomplish]

**Acceptance Criteria**:

- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**Implementation Notes**:

- [Specific guidance from design docs]
- [Edge cases from clarifications]
```

**IMPORTANT**: Phase 2 execution happens via `/tasks` command, NOT during `/plan`.

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution

- `/tasks` command generates tasks.md
- Tasks provide step-by-step implementation guide

**Phase 4**: Implementation

- Execute tasks in order (respect dependencies)
- Follow constitutional principles (simplicity, single-user focus)
- Use Svelte 5 best practices from research.md
- Consult svelte-llm MCP tool for edge cases (per clarification #1)
- Flag complex coupling for manual review (per clarification #3)

**Phase 5**: Validation

- Run `npm run test` (100% pass rate per FR-001)
- Run `npm run test:e2e` (all E2E tests pass)
- Execute quickstart.md manual validation steps
- Performance check: Session replay <100ms maintained
- Documentation review pass (per clarification #2)

## Complexity Tracking

_No constitutional violations - this section intentionally empty._

**Rationale**: Refactoring reduces complexity and aligns with all constitutional principles. No justifications required.

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (via /clarify session)
- [x] Complexity deviations documented (none - no violations)

---

_Based on Dispatch Constitution v1.3.0 - See `.specify/memory/constitution.md`_
