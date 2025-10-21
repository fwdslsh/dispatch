# Implementation Plan: sv-window-manager Migration

**Branch**: `010-sv-window-manager-migration` | **Date**: 2025-10-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-sv-window-manager-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace the custom window manager component located at `src/lib/client/shared/components/window-manager/` with the third-party sv-window-manager library from https://github.com/itlackey/sv-window-manager. The migration uses a minimal integration approach: the application only needs to mount the BwinHost component, store a reference to it in existing `workspaceState.windowManager`, and call `addPane()` when creating sessions. All window management features (layout, resizing, minimize/maximize/close, keyboard shortcuts, state transitions) are delegated to the sv-window-manager library. Existing window layouts will be reset during migration. Layout persistence will be handled manually in the future as an enhancement.

## Technical Context

**Language/Version**: JavaScript/Node.js 22+ (per project .nvmrc), Svelte 5 (frontend framework)
**Primary Dependencies**:
- sv-window-manager (NEEDS CLARIFICATION: exact version and API compatibility with Svelte 5)
- Existing: SvelteKit 2.x, Socket.IO 4.8.x, SQLite3 5.1.7
**Storage**: SQLite (existing workspace_layout table may need schema adaptation)
**Testing**: Vitest (unit), Playwright (E2E), existing test infrastructure
**Target Platform**: Browser-based web application (modern browsers with CSS Grid/Flexbox support)
**Project Type**: Web application (SvelteKit full-stack)
**Performance Goals**: 60fps (16ms) window operations, <100ms session event replay
**Constraints**:
- Must maintain existing MVVM architecture (Svelte 5 runes, ViewModels, Services)
- Zero regressions in existing E2E tests
- 30% code reduction in window management implementation
**Scale/Scope**: Single-user development environment, multiple concurrent windows per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### PHASE 0 RESEARCH COMPLETED

**Research Document**: [research.md](./research.md)

### ✅ **GATE PASSED: All Principles Satisfied**

### I. Simplicity & Maintainability ✅ **PASS**

- **Status**: **PASS**
- **Library Status** (Corrected):
  - ✅ Published to npm: `npm install sv-window-manager`
  - ✅ Internally maintained by project team
  - ✅ Control over features, releases, bug fixes
  - ✅ Svelte 5 native (aligns with existing architecture)

- **Approach**: Use sv-window-manager as **foundation library** for layout management (binary tree, resizing, pane positioning) with custom feature layer for minimize/maximize/close/keyboard shortcuts/persistence.

- **Justification**:
  - Reduces complexity of layout algorithm (binary tree management) by using library
  - Custom feature layer is lightweight wrapper around library core
  - Internal maintenance means feature gaps can be filled in library itself if needed
  - Net code reduction expected even with custom layer (library handles complex positioning logic)

- **Third-party dependency**: Approved in feature specification, published to npm, internally maintained

### II. Single-User, Developer-First Platform ✅ **PASS**

- **Status**: PASS
- Window manager is UI component enhancing single-user development experience

### III. Isolated, Remotely Accessible Development Environment ✅ **PASS**

- **Status**: PASS
- Browser-only component, no changes to container isolation or security

### IV. Event-Sourced State Management ✅ **PASS**

- **Status**: PASS
- Window manager is presentation layer, does not affect session event sourcing

### V. Adapter Pattern for Extensibility ✅ **PASS**

- **Status**: PASS
- No changes to session adapter pattern (PtyAdapter, ClaudeAdapter, FileEditorAdapter)

### VI. Progressive Enhancement ✅ **PASS**

- **Status**: PASS
- Library failure blocks operations (explicit dependency requirement)

---

### **Gate Result**: ✅ **PASS - Proceed to Phase 1**

**Planning Workflow**: ✅ **ACTIVE** - Proceeding to data modeling and contracts generation.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/lib/client/
├── shared/
│   ├── components/
│   │   └── window-manager/          # TO BE REMOVED - custom implementation
│   ├── services/
│   │   ├── ServiceContainer.svelte.js   # May need sv-window-manager service registration
│   │   └── ...
│   └── state/
│       ├── WorkspaceState.svelte.js     # May need layout persistence updates
│       ├── UIState.svelte.js            # May need window state management updates
│       └── ...
├── terminal/                         # Existing - uses window manager
├── claude/                           # Existing - uses window manager
└── file-editor/                      # Existing - uses window manager

src/lib/server/
└── database/
    └── schema/workspace_layout.sql   # May need migration for sv-window-manager format

src/routes/
└── workspace/
    └── +page.svelte                  # Main workspace UI - integrates window manager

tests/
├── client/                           # Unit tests for ViewModels/Services
└── e2e/                              # Playwright tests for window operations
```

**Structure Decision**: SvelteKit full-stack web application. Frontend follows MVVM pattern with Svelte 5 runes. Window manager is a shared client component used by multiple session types (terminal, Claude, file-editor). Migration primarily affects `src/lib/client/shared/components/window-manager/` (removal) and related state management in ViewModels. Database schema changes limited to workspace layout persistence format adaptation.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** All constitutional principles are satisfied.

