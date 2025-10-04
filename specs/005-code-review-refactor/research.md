# Phase 0: Research - Code Review Refactor

**Date**: 2025-10-01
**Feature**: Code Review Refactor (005)

## Research Areas

### 1. Svelte 5 Migration Patterns

#### Decision: Use `$props()` destructuring for all component props

**Rationale**:

- Svelte 5's `$props()` provides better type inference and clearer component interfaces
- Destructuring with defaults maintains same DX as `export let` while being more explicit
- Aligns with Svelte 5 reactive primitives ($state, $derived, $effect)

**Pattern**:

```svelte
<!-- Legacy (Svelte 4) -->
<script>
  export let onComplete = () => {};
  export let title = 'Default Title';
  export let items;
</script>

<!-- Modern (Svelte 5) -->
<script>
  let { onComplete = () => {}, title = 'Default Title', items } = $props();
</script>
```

**Edge Cases Identified**:

- **Destructuring conflicts**: Props named same as local variables require renaming
- **Computed props**: Props used in computations should use $derived when needed
- **Dynamic props**: Props passed dynamically require validation before destructuring

**Handling Strategy** (from clarification #1):

- Consult Svelte 5 documentation for complex patterns
- Use best-effort conversion with Svelte best practices
- Flag ambiguous cases with `// TODO: Manual review needed` comments

**Alternatives Considered**:

- Keep `export let`: Rejected - perpetuates mixed syntax problem
- Full TypeScript conversion: Rejected - out of scope, adds complexity
- Gradual migration: Rejected - all 5 occurrences simple enough to convert at once

---

### 2. Module Splitting Strategies

#### Decision: Domain-driven module boundaries (queries, mutations, validation)

**Rationale**:

- Cohesion by operation type creates clear module responsibility
- Query/mutation separation mirrors CQRS pattern familiar to developers
- Validation module centralizes input sanitization logic

**Pattern for SessionApiClient**:

```
src/lib/client/shared/services/
├── SessionApiClient.js (facade/re-export)
└── session-api/
    ├── queries.js       (read operations: getAllSessions, getSession, getSessionEvents)
    ├── mutations.js     (write operations: createSession, updateSession, deleteSession)
    └── validation.js    (input validation: validateSessionData, sanitizeInput)
```

**Cohesion Metrics**:

- Single Responsibility: Each module handles one operation category
- Low Coupling: Modules share types but have no circular dependencies
- High Cohesion: Functions within module operate on similar data/concerns

**No Strict LOC Limits** (from clarification #4):

- Success measured by logical boundaries, not line counts
- Modules may be different sizes based on domain complexity
- Prefer clarity over artificial size targets

**Handling Tight Coupling** (from clarification #3):

- Attempt refactoring through interfaces if complexity reasonable
- Consult refactoring-specialist agent for guidance on complex coupling
- Flag overly complex dependencies for manual review
- Continue with next module if blocked (don't halt entire refactor)

**Alternatives Considered**:

- Feature-based split (sessions, workspaces, settings): Rejected - SessionApiClient only handles sessions
- Alphabetical split: Rejected - arbitrary boundaries, low cohesion
- Single file with sections: Rejected - doesn't address navigation/cognitive load issues

---

### 3. Component Extraction Patterns

#### Decision: Subcomponent extraction with shared ViewModel pattern

**Rationale**:

- ClaudePane has 4 distinct UI concerns (tools, trace, messages, input)
- Each subcomponent can be developed/tested independently
- Shared ViewModel (runes-in-classes) maintains state consistency
- Follows existing Dispatch MVVM architecture

**Pattern for ClaudePane**:

```
src/lib/client/claude/
├── ClaudePane.svelte (parent container)
├── components/
│   ├── ToolPanel.svelte      (tool selection UI)
│   ├── TracePanel.svelte     (trace/debug UI)
│   ├── MessageList.svelte    (message display)
│   └── InputArea.svelte      (user input)
└── viewmodels/
    └── ClaudePaneViewModel.svelte.js (shared state with $state runes)
```

**State Sharing Strategy**:

- ViewModel with $state runes: Reactive shared state
- Props: Immutable data passed down
- Callbacks: Event handlers bubbled up
- Context: NOT used (adds complexity, small component tree)

**Component Size Guidelines**:

- Target: Each subcomponent < 400 lines (guideline, not rule)
- Measure success by: Clear responsibility, easy testing, readable code
- No hard limits (per clarification #4)

**Alternatives Considered**:

- Keep monolithic file with `{#if}` blocks: Rejected - doesn't reduce cognitive load
- Use Svelte stores for state: Rejected - runes-in-classes is established pattern
- Extract to separate npm package: Rejected - overkill for internal refactor

---

### 4. Documentation Strategies

#### Decision: Markdown docs with code examples in `src/docs/`

**Rationale**:

- Markdown familiar to developers, easy to maintain
- Code examples demonstrate patterns better than prose
- Co-located with source code for discoverability

**Documentation Structure**:

```
src/docs/
├── architecture/
│   ├── mvvm-patterns.md      (FR-003: Runes-in-classes explanation)
│   └── adapter-guide.md      (FR-006: Adapter registration guide)
└── contributing/
    └── error-handling.md     (FR-007: Async error patterns)
```

**Documentation Content Requirements**:

- **Why chosen**: Rationale for pattern (e.g., runes-in-classes trade-offs)
- **When to use**: Decision criteria (e.g., runes in classes vs. functional)
- **How to apply**: Minimal working examples from real codebase
- **What to avoid**: Common pitfalls and anti-patterns

**Documentation Timing** (from clarification #2):

- Documentation pass occurs AFTER all code refactoring complete
- Ensures accuracy and consistency with final implementation
- Prevents doc/code drift during active refactoring

**Alternatives Considered**:

- JSDoc only: Rejected - doesn't explain architectural rationale
- Wiki/external docs: Rejected - increases maintenance burden, lower discoverability
- Inline comments: Rejected - insufficient for explaining system-wide patterns

---

## Key Decisions Summary

| Area                     | Decision                                     | Success Criteria                          |
| ------------------------ | -------------------------------------------- | ----------------------------------------- |
| **Props Syntax**         | `$props()` destructuring                     | No `export let` in codebase               |
| **Module Boundaries**    | Domain-driven (queries/mutations/validation) | Clear responsibilities, no circular deps  |
| **Component Extraction** | Subcomponents + shared ViewModel             | Each <400 lines, testable independently   |
| **Documentation**        | Markdown + code examples in `src/docs/`      | Post-refactor pass, WHY/WHEN/HOW answered |

## Risk Mitigation

**Identified Risks**:

1. **Breaking changes during modularization**: Mitigated by 100% test pass requirement (FR-001)
2. **Hidden coupling revealed**: Mitigated by incremental approach + refactoring-specialist consult (clarification #3)
3. **Documentation staleness**: Mitigated by post-refactor documentation pass (clarification #2)
4. **Performance regression**: Mitigated by session replay <100ms performance check

## Next Steps

✅ Research complete - all decisions documented
→ Proceed to Phase 1: Design & Contracts
