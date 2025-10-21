# Data Model: sv-window-manager Migration

**Feature**: sv-window-manager Migration
**Date**: 2025-10-20

## Overview

This document defines the minimal data structures for integrating sv-window-manager library into Dispatch's MVVM architecture. The approach delegates all layout management, window state tracking, and pane lifecycle to the sv-window-manager library, with the application layer only maintaining a reference to the BwinHost instance.

---

## Entities

### 1. BwinHost Reference (Application-Managed)

**Purpose**: Store reference to sv-window-manager BwinHost instance for pane operations

**Location**: `workspaceState.windowManager.bwinHostRef`

**Type**: `BwinHost | null`

**Usage**:
```javascript
// Add reference when BwinHost mounts
workspaceState.windowManager.bwinHostRef = $state(null);

// Use reference to add panes
const bwinHost = workspaceState.windowManager.bwinHostRef;
bwinHost.addPane(sessionId, {}, Component, props);
```

**Lifecycle**:
- Created when BwinHost component mounts
- Set to null when component unmounts
- Accessed via reactive state when adding/removing panes

---

### 2. Session-to-Pane Mapping (Library-Managed)

**Purpose**: Track which session IDs correspond to which panes

**Owner**: sv-window-manager library (internal implementation)

**Application Responsibility**: None - library handles all pane tracking

**Usage**: Pass `sessionId` as pane ID when calling `addPane()`:

```javascript
bwinHost.addPane(
  sessionId,  // Library uses this as pane identifier
  {},         // Pane configuration (optional)
  Component,  // Svelte component to render
  props       // Props to pass to component
);
```

---

### 3. Layout Persistence (Future Enhancement)

**Current Status**: Out of scope for initial migration

**Future Considerations**:
- Layout persistence will be handled manually
- May leverage sv-window-manager's internal state serialization
- Database schema updates will be managed outside this migration
---

## Architecture

### Minimal Integration Approach

**Application Responsibilities**:
1. Install and import sv-window-manager library
2. Mount BwinHost component in workspace route
3. Store BwinHost reference in existing `workspaceState.windowManager`
4. Call `addPane()` when creating new sessions

**Library Responsibilities** (sv-window-manager):
1. Pane layout management (binary tree structure)
2. Resizing via draggable dividers
3. Component mounting and rendering
4. Window state tracking (minimize, maximize, etc.)
5. All keyboard shortcuts and interactions

### Data Flow

```
Session Created
    ↓
App calls sessionApi.createSession()
    ↓
App receives sessionId
    ↓
App calls bwinHost.addPane(sessionId, {}, Component, props)
    ↓
sv-window-manager handles all layout/rendering
```

### Component Hierarchy

```
+page.svelte (workspace route)
  ├── BwinHost (from sv-window-manager)
  │   ├── Pane (terminal session)
  │   ├── Pane (Claude session)
  │   └── Pane (file editor session)
  └── workspaceState.windowManager.bwinHostRef → BwinHost reference
```

---

## Summary

The minimal integration approach delegates all window management complexity to the sv-window-manager library. The application layer only needs to:

1. Mount the BwinHost component
2. Store a reference to it in existing state
3. Call `addPane()` when sessions are created

This approach maximizes simplicity and leverages the library's built-in features without custom wrappers or complex state management.
