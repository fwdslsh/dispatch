# Feature Specification: sv-window-manager Migration

**Feature Branch**: `010-sv-window-manager-migration`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "migrate window manager to sv-window-manager https://github.com/itlackey/sv-window-manager instead of the @src/lib/client/shared/components/window-manager/ custom component"

## Clarifications

### Session 2025-10-20

- Q: When migrating from the custom window manager to sv-window-manager, how should existing persisted window layouts be handled? → A: Reset on migration: Clear existing layouts, users start fresh (simpler but loses user customizations)
- Q: If sv-window-manager fails to load or initialize, what should the system do? → A: Block application: Show error message and prevent any workspace operations until library loads successfully
- Q: When a window's saved position is partially or fully off-screen (e.g., user switches to smaller monitor or different resolution), how should the system reposition it? → A: No intervention: Allow windows to remain off-screen; users must manually reposition them
- Q: When a window transitions between states (normal → minimized → maximized), how should position and size be handled? → A: Library behavior: Use sv-window-manager's built-in state transition handling without customization
- Q: When a user opens their workspace immediately after the migration and their layout has been reset, what should the system do? → A: Silent reset with auto-create: No notification, but automatically create one terminal session as default starting point
- Q: How should the application handle sv-window-manager library version updates? → A: Accept minor updates: Use caret range (^) to auto-accept minor/patch updates, block majors

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing Window Behavior Preserved (Priority: P1)

Users interact with the terminal/file editor windows exactly as they do today - dragging, resizing, minimizing, maximizing, and closing windows works identically after the migration to sv-window-manager.

**Why this priority**: This is the foundation - if basic window operations break, the entire application becomes unusable. All other functionality depends on working window management.

**Independent Test**: Can be fully tested by opening multiple sessions (terminal, Claude, file editor), performing all window operations (drag, resize, minimize, maximize, close), and verifying behavior matches pre-migration experience. Delivers continued usability of core application.

**Acceptance Scenarios**:

1. **Given** a user has multiple terminal sessions open, **When** they drag a window to reposition it, **Then** the window follows the cursor and maintains its size
2. **Given** a user has a file editor window open, **When** they resize the window by dragging corners/edges, **Then** the window dimensions adjust smoothly and content reflows appropriately
3. **Given** a user has windows at various positions, **When** they minimize/maximize windows, **Then** the window state changes immediately and sv-window-manager's built-in state transition logic handles position/size restoration
4. **Given** a user closes a window, **When** the close action completes, **Then** the window is removed from view and the session terminates properly

---

### User Story 2 - Post-Migration Workspace Initialization (Priority: P2)

When users open their workspace after migration with reset layouts, the system provides immediate usability by auto-creating one terminal session without displaying migration notifications.

**Why this priority**: Ensures users have a functional workspace immediately after migration without confusing empty states or disruptive notifications. Critical for smooth migration experience but not blocking core functionality.

**Independent Test**: Can be tested by clearing workspace layouts, opening workspace, and verifying one terminal session is automatically created with no migration prompts. Delivers seamless post-migration experience.

**Acceptance Scenarios**:

1. **Given** a workspace has no saved layout (post-migration state), **When** the user opens the workspace, **Then** one terminal session is automatically created
2. **Given** the layout has been reset during migration, **When** the user opens the workspace, **Then** no migration notification or prompt is displayed
3. **Given** multiple workspaces exist, **When** each workspace is opened post-migration, **Then** each workspace independently auto-creates one terminal session

---

### Edge Cases

- What happens when a window's saved position is off-screen (e.g., user switches to smaller monitor or different resolution)? System allows windows to remain off-screen; users must manually drag them back into view.
- How does system handle rapid resize/drag operations? Should prevent visual glitches or state corruption from event flooding.
- What happens when multiple windows overlap and user tries to interact with a partially obscured window? Click-through should work correctly and bring window to front.
- How does the window manager behave when browser viewport is extremely small (mobile devices)? Should gracefully degrade or prevent operations that would create unusable layouts.
- What happens if sv-window-manager library fails to load or initialize? System displays error message and blocks workspace operations until issue is resolved (no fallback mode).
- What happens when a user opens their workspace immediately after migration with reset layouts? System silently auto-creates one terminal session as default starting point; no migration notification displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace the custom window manager component with sv-window-manager library while maintaining all existing window management capabilities
- **FR-001a**: System MUST detect sv-window-manager library load/initialization failures and display clear error message blocking workspace operations until resolved
- **FR-002**: System MUST support dragging windows to reposition them within the browser viewport
- **FR-003**: System MUST support resizing windows by dragging edges and corners
- **FR-004**: System MUST support minimizing, maximizing, and restoring windows using sv-window-manager's built-in state transition behavior
- **FR-005**: System MUST support closing windows and properly cleaning up associated resources/sessions
- **FR-006**: System MUST clear existing workspace layouts during migration (layout reset strategy)
- **FR-007**: System MUST handle window positioning edge cases (allow off-screen positions without automatic correction, support overlapping windows, handle viewport size changes)
- **FR-008**: System MUST maintain z-index ordering when windows overlap (bring-to-front on interaction)
- **FR-009**: System MUST integrate with existing session types (terminal, Claude, file editor) without requiring changes to session logic
- **FR-010**: System MUST provide window controls (close, minimize, maximize) via sv-window-manager library's built-in UI; verify library controls match or exceed existing UX patterns
- **FR-011**: System MUST handle rapid user interactions (fast dragging, resizing) without visual artifacts or state corruption
- **FR-012**: System MUST automatically create one terminal session when a workspace is opened with no saved layout (post-migration default state)
- **FR-013**: System MUST use caret range (^) versioning for sv-window-manager dependency to accept minor/patch updates while preventing automatic major version upgrades

### Key Entities

- **Window Instance**: Represents a single managed window with properties including position (x, y), size (width, height), state (normal, minimized, maximized), z-index, and associated session identifier
- **Workspace Layout**: Collection of window instances and their configurations specific to a workspace, persisted to database and restored on workspace load
- **Session Binding**: Connection between window instance and underlying session (terminal, Claude, file editor) that handles lifecycle coordination

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can perform all window operations (drag, resize, minimize, maximize, close) without perceiving any behavioral differences compared to the custom window manager
- **SC-002**: Workspace layout migration completes with clean reset; post-migration workspaces auto-create one terminal session on first open
- **SC-003**: Window operations (drag, resize) respond to user input within 16ms (60fps) to maintain smooth visual feedback
- **SC-004**: Migration completes cleanly with old layout data cleared; users can immediately create new layouts that persist going forward
- **SC-005**: Zero regressions in existing E2E tests related to session management and window interactions
- **SC-006**: Custom window manager code is reduced by at least 30% (measured in lines of code) by leveraging sv-window-manager library
- **SC-007**: Window manager handles edge cases (rapid interactions, viewport changes) without user-visible errors or layout corruption; off-screen windows are preserved as-is
- **SC-008**: Post-migration workspace load provides immediate usability with one auto-created terminal session; no migration notification interrupts workflow

## Assumptions

- The sv-window-manager library provides all necessary features currently implemented in the custom window manager
- The sv-window-manager library's API is compatible with Svelte 5 and the existing MVVM architecture
- Window layout persistence can be adapted to use existing database schema or minor schema changes are acceptable
- Browser compatibility requirements remain the same (modern browsers with CSS Grid/Flexbox support)
- Performance characteristics of sv-window-manager meet or exceed the custom implementation
- The migration will use standard npm package installation for sv-window-manager
- Testing will leverage existing Playwright E2E infrastructure
- The migration will follow the existing MVVM pattern with services and ViewModels
- A 30% code reduction target is reasonable for library migrations of this type (industry standard for replacing custom components with well-designed third-party libraries)
- sv-window-manager's default behaviors (keyboard shortcuts, state transitions, off-screen handling) are acceptable without customization

## Dependencies

- sv-window-manager library (external dependency from https://github.com/itlackey/sv-window-manager)
  - Version management: Use caret range (^) in package.json to auto-accept minor/patch updates while blocking major versions
  - Internal maintenance ensures backward compatibility within major version
- Existing database schema for workspace layouts (may need review/adaptation)
- Existing session management services (RunSessionManager, SessionViewModel)
- Existing UI state management (UIState.svelte.js, WorkspaceState.svelte.js)

## Out of Scope

- Adding new window management features not present in current implementation
- Redesigning the visual appearance of window chrome/controls (unless required by sv-window-manager)
- Changing session lifecycle management or session types
- Modifying database persistence strategy beyond adapting to sv-window-manager's data model
- Supporting mobile/touch-specific gestures beyond basic drag/resize (unless sv-window-manager provides them)
- Backward compatibility for existing window layout data (layouts will be reset during migration)
