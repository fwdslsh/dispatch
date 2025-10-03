# Phase 1: Data Model - Code Review Refactor

**Date**: 2025-10-01
**Feature**: Code Review Refactor (005)

## Overview

This document defines the structure of refactored modules and components. Since this is a refactoring feature (not new data storage), "data model" refers to module organization, component interfaces, and code structure.

## Module Structure

### 1. Svelte Component Props (FR-002)

**Entity**: Svelte Component with Props
**Purpose**: Convert legacy Svelte 4 `export let` syntax to Svelte 5 `$props()`

#### AuthenticationStep.svelte

**Current Props**:
```svelte
<script>
  export let onComplete = () => {};
  export let error = '';
</script>
```

**Target Props**:
```svelte
<script>
  let { onComplete = () => {}, error = '' } = $props();
</script>
```

**Validation Rules**:
- `onComplete` must be callable function
- `error` must be string type
- Default values preserved exactly

#### WorkspaceCreationStep.svelte

**Current Props**:
```svelte
<script>
  export let onComplete = () => {};
  export let initialPath = '';
</script>
```

**Target Props**:
```svelte
<script>
  let { onComplete = () => {}, initialPath = '' } = $props();
</script>
```

**Validation Rules**:
- `onComplete` must be callable function
- `initialPath` must be string type
- Default values preserved exactly

#### testing/+page.svelte

**Current Props**:
```svelte
<script>
  export let data;
</script>
```

**Target Props**:
```svelte
<script>
  let { data } = $props();
</script>
```

**Validation Rules**:
- `data` is required prop (no default)
- SvelteKit page data structure maintained

---

### 2. SessionApiClient Module (FR-004)

**Entity**: Service Module Collection
**Purpose**: Split 970-line monolithic file into cohesive domain modules

#### Module Hierarchy

```
session-api/
├── queries.js       (~300 lines estimated)
├── mutations.js     (~400 lines estimated)
└── validation.js    (~200 lines estimated)
```

**Note**: Line counts are estimates; actual size determined by cohesion, not targets (clarification #4)

#### queries.js - Read Operations

**Responsibility**: Retrieve session data from API

**Functions**:
- `getAllSessions(filters?: SessionFilters): Promise<Session[]>`
- `getSession(id: string): Promise<Session>`
- `getSessionEvents(id: string, fromSeq?: number): Promise<Event[]>`
- `getWorkspaceSessions(workspaceId: string): Promise<Session[]>`

**Dependencies**:
- Shared types (Session, SessionFilters, Event)
- Validation module (for filter validation)
- HTTP client (fetch wrapper)

**State**: Stateless (pure functions)

#### mutations.js - Write Operations

**Responsibility**: Modify session data via API

**Functions**:
- `createSession(data: CreateSessionData): Promise<Session>`
- `updateSession(id: string, updates: Partial<Session>): Promise<Session>`
- `deleteSession(id: string): Promise<void>`
- `sendInput(id: string, input: string): Promise<void>`
- `closeSession(id: string): Promise<void>`

**Dependencies**:
- Shared types (Session, CreateSessionData)
- Validation module (for input validation)
- HTTP client (fetch wrapper)

**State**: Stateless (pure functions)

#### validation.js - Input Validation & Sanitization

**Responsibility**: Validate and sanitize all API inputs

**Functions**:
- `validateSessionData(data: unknown): ValidationResult<CreateSessionData>`
- `validateSessionId(id: unknown): ValidationResult<string>`
- `validateSessionFilters(filters: unknown): ValidationResult<SessionFilters>`
- `sanitizeInput(input: string): string`

**Types**:
```typescript
interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

**Dependencies**: None (pure validation logic)
**State**: Stateless (pure functions)

#### SessionApiClient.js - Facade (Optional)

**Purpose**: Backward compatibility during transition

**Pattern**:
```javascript
// Re-export all functions from modules
export * from './session-api/queries.js'
export * from './session-api/mutations.js'
export * from './session-api/validation.js'
```

**Migration Strategy**:
- Keep facade during refactor for existing imports
- Update imports gradually to specific modules
- Remove facade after all consumers updated

---

### 3. ClaudePane Component (FR-005)

**Entity**: Component Tree with Shared ViewModel
**Purpose**: Extract 1,800-line monolithic component into focused subcomponents

#### Component Hierarchy

```
ClaudePane.svelte (parent container ~200 lines)
├── components/
│   ├── ToolPanel.svelte       (~300 lines)
│   ├── TracePanel.svelte      (~250 lines)
│   ├── MessageList.svelte     (~400 lines)
│   └── InputArea.svelte       (~200 lines)
└── viewmodels/
    └── ClaudePaneViewModel.svelte.js (~400 lines)
```

#### ClaudePane.svelte - Parent Container

**Responsibility**: Layout orchestration and ViewModel initialization

**Props**:
```typescript
interface ClaudePaneProps {
  sessionId: string
  workspacePath: string
}
```

**Structure**:
- Instantiate ClaudePaneViewModel
- Pass ViewModel to child components via props
- Handle layout (grid/flex)
- No business logic (delegated to ViewModel)

#### ToolPanel.svelte - Tool Selection UI

**Responsibility**: Display available tools and handle selection

**Props**:
```typescript
interface ToolPanelProps {
  viewModel: ClaudePaneViewModel  // Shared state
}
```

**State Access** (via ViewModel):
- `viewModel.tools` ($state array)
- `viewModel.selectedTool` ($state string | null)
- `viewModel.selectTool(toolId)` (method)

**Rendering**:
- List of tools with icons
- Active tool highlighting
- Tool description tooltip

#### TracePanel.svelte - Trace/Debug UI

**Responsibility**: Display execution traces and debug information

**Props**:
```typescript
interface TracePanelProps {
  viewModel: ClaudePaneViewModel
}
```

**State Access** (via ViewModel):
- `viewModel.traces` ($state array)
- `viewModel.tracePanelExpanded` ($state boolean)
- `viewModel.toggleTracePanel()` (method)

**Rendering**:
- Collapsible trace list
- Syntax highlighting for trace data
- Expand/collapse controls

#### MessageList.svelte - Message Display

**Responsibility**: Render conversation messages

**Props**:
```typescript
interface MessageListProps {
  viewModel: ClaudePaneViewModel
}
```

**State Access** (via ViewModel):
- `viewModel.messages` ($state array)
- `viewModel.handleMessageAction(messageId, action)` (method)

**Rendering**:
- Scrollable message list
- Message formatting (user vs. assistant)
- Action buttons (copy, retry, etc.)

#### InputArea.svelte - User Input

**Responsibility**: Handle user text input and submission

**Props**:
```typescript
interface InputAreaProps {
  viewModel: ClaudePaneViewModel
}
```

**State Access** (via ViewModel):
- `viewModel.inputText` ($state string)
- `viewModel.isProcessing` ($state boolean)
- `viewModel.submitInput()` (method)
- `viewModel.cancelProcessing()` (method)

**Rendering**:
- Textarea with auto-resize
- Submit/cancel buttons
- Disabled state during processing

#### ClaudePaneViewModel.svelte.js - Shared State

**Responsibility**: Centralize ClaudePane state and logic

**State** (using $state runes):
```javascript
class ClaudePaneViewModel {
  sessionId = $state('')
  workspacePath = $state('')

  // Tool state
  tools = $state([])
  selectedTool = $state(null)

  // Trace state
  traces = $state([])
  tracePanelExpanded = $state(false)

  // Message state
  messages = $state([])

  // Input state
  inputText = $state('')
  isProcessing = $state(false)

  // Derived state
  hasActiveSession = $derived.by(() => !!this.sessionId)
  canSubmit = $derived.by(() => !this.isProcessing && this.inputText.trim().length > 0)

  // Methods
  selectTool(toolId) { /* ... */ }
  toggleTracePanel() { /* ... */ }
  handleMessageAction(messageId, action) { /* ... */ }
  submitInput() { /* ... */ }
  cancelProcessing() { /* ... */ }
}
```

**Pattern**: Runes-in-classes MVVM (documented in FR-003)

---

### 4. Documentation Artifacts (FR-003, FR-006, FR-007)

**Entity**: Markdown Documentation Files
**Purpose**: Explain architectural patterns and conventions

#### mvvm-patterns.md

**Content Structure**:
1. **What is runes-in-classes pattern**: Definition and example
2. **Why we use it**: Trade-offs (MVVM ergonomics vs. functional purity)
3. **When to use**: Class-based ViewModels vs. module-based services
4. **How to implement**: Step-by-step guide with ClaudePane example
5. **Common pitfalls**: Reactivity issues, lifecycle misuse

**Target Audience**: New contributors, developers unfamiliar with pattern

#### adapter-guide.md

**Content Structure**:
1. **Adapter pattern overview**: Purpose and benefits
2. **File locations**: Exact paths for adapters and registration
3. **Minimal working example**: Complete PtyAdapter-style example
4. **Registration steps**: How to register during server startup
5. **Client wiring**: How to create UI pane for new session type

**Target Audience**: Contributors adding new session types

#### error-handling.md

**Content Structure**:
1. **Standard async return shape**: `{ success, data?, error? }`
2. **Loading state management**: Using $state for loading flags
3. **Error display patterns**: Toast vs. inline vs. boundary
4. **Example implementation**: createSession with full error handling

**Target Audience**: All contributors writing async operations

---

## Relationships & Dependencies

### Module Dependencies

```
SessionApiClient.js (facade)
  ├─> queries.js
  ├─> mutations.js
  └─> validation.js
      (no circular dependencies)
```

### Component Dependencies

```
ClaudePane.svelte
  ├─> ClaudePaneViewModel.svelte.js (instantiation)
  ├─> ToolPanel.svelte (prop: viewModel)
  ├─> TracePanel.svelte (prop: viewModel)
  ├─> MessageList.svelte (prop: viewModel)
  └─> InputArea.svelte (prop: viewModel)
```

**Key Principle**: One-way data flow (parent → child via props, child → parent via callbacks)

---

## Validation & Constraints

### General Constraints (All Modules)

- ✅ Zero functional regressions
- ✅ 100% existing test pass rate
- ✅ No breaking changes to public APIs
- ✅ Performance: Session replay <100ms maintained

### Module-Specific Constraints

**SessionApiClient**:
- All existing function signatures preserved
- Return types unchanged
- Error handling behavior identical

**ClaudePane**:
- Props interface preserved (sessionId, workspacePath)
- Event emissions unchanged
- Visual rendering identical

### Success Metrics (from clarifications)

- **Modularization**: Cohesion and separation of concerns, not LOC (clarification #4)
- **Testing**: Regression suite + manual spot-checks (clarification #5)
- **Documentation**: Post-refactor review pass (clarification #2)

---

## State Transitions

### ClaudePane State Machine

```
[IDLE]
  → (user types input) → [INPUT_PENDING]
  → (user submits) → [PROCESSING]
  → (response received) → [IDLE]
  → (user cancels) → [IDLE]

[PROCESSING]
  → (tool selected) → [TOOL_ACTIVE]
  → (tool completes) → [PROCESSING]

[TOOL_ACTIVE]
  → (trace generated) → [TOOL_ACTIVE] (trace added to list)
```

**Note**: No new state machines introduced; existing ClaudePane state preserved in ViewModel

---

## Migration Path

### Phase 1: Props Syntax (Low Risk)
1. Update AuthenticationStep.svelte
2. Update WorkspaceCreationStep.svelte
3. Update testing/+page.svelte
4. Run tests

### Phase 2: SessionApiClient Split (Medium Risk)
1. Create session-api/ directory
2. Extract queries.js
3. Extract mutations.js
4. Extract validation.js
5. Update imports in SessionApiClient.js (facade)
6. Run tests

### Phase 3: ClaudePane Extraction (Higher Risk)
1. Create ClaudePaneViewModel.svelte.js
2. Extract ToolPanel.svelte
3. Extract TracePanel.svelte
4. Extract MessageList.svelte
5. Extract InputArea.svelte
6. Update ClaudePane.svelte (orchestrator)
7. Run tests after each extraction

### Phase 4: Documentation (No Risk)
1. Write mvvm-patterns.md
2. Write adapter-guide.md
3. Write error-handling.md
4. Review for accuracy

---

## Summary

**Total Entities**:
- 3 components with props updates
- 3 service modules (queries, mutations, validation)
- 5 UI components (ClaudePane + 4 subcomponents)
- 1 ViewModel
- 3 documentation files

**Total Files Modified**: 3
**Total Files Created**: 12

**Success Criteria**: All changes preserve existing behavior while improving code organization and developer experience.
