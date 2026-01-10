# UX Mental Model Analysis: Sessions & Workspaces

> A comprehensive review of terminology, information architecture, and user mental model issues in Dispatch.

## Executive Summary

Dispatch suffers from **terminology fragmentation** and **conceptual overloading** that creates confusion for users. The core problems are:

1. **"Session" is overloaded** - means both the execution context AND the browser login state
2. **Internal vs External terminology mismatch** - database uses "runs", API/UI uses "sessions"
3. **Deprecated types still visible** - UI shows 5 session types, architecture has 3
4. **Workspace role is unclear** - users don't understand the relationship to sessions
5. **"Layout" means multiple things** - view arrangement vs session-to-pane mapping

---

## 1. Terminology Confusion Matrix

| User-Facing Term | Database Term | Internal Code Term | What It Actually Means |
|------------------|---------------|-------------------|------------------------|
| Session | `run_id` | Run, Session | An execution context (terminal, AI agent, file editor) |
| Workspace | `workspaces.path` | Workspace | A project directory that provides context |
| Login Session | `auth_sessions` | AuthSession | Browser authentication state |
| Pane | (none) | Pane, Tile | Visual container for a session |
| Window | (none) | Glass (BinaryWindow) | A pane with title bar and controls |
| Layout | `workspace_layout` | Layout, ViewMode | Either the view arrangement OR session-to-tile mapping |

### Critical Issue: "Session" is Overloaded

Users encounter "session" in three contexts:

```
1. "Create New Session" → Create terminal/AI execution
2. "Session expired" → Authentication timeout
3. "Resume Session" → Reconnect to previous execution
```

**Recommendation**: Rename execution contexts to something else. Options:
- **"Tab"** - familiar from browsers, lightweight feel
- **"Terminal"** / **"Agent"** - specific to type, but inconsistent
- **"Instance"** - technical but accurate
- **"Activity"** - action-oriented, modern

---

## 2. Session Type Inconsistency

### Current State (Broken)

The `CreateSessionModal.svelte` displays **5 session types**:

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Claude Code   │    OpenCode     │  OpenCode TUI   │
│   (deprecated)  │   (deprecated)  │   (deprecated)  │
├─────────────────┼─────────────────┼─────────────────┤
│    Terminal     │   File Editor   │                 │
│   (canonical)   │   (canonical)   │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### Intended State (Per session-types.js)

```javascript
// Only 3 canonical types
SESSION_TYPE.TERMINAL    // 'terminal'
SESSION_TYPE.AI          // 'ai'
SESSION_TYPE.FILE_EDITOR // 'file-editor'
```

### User Impact

- **Confusion**: "What's the difference between Claude Code and OpenCode?"
- **Decision paralysis**: Too many options for the same thing
- **Broken expectations**: Selecting deprecated types may have unexpected behavior

### Recommendation

Update `CreateSessionModal.svelte` to show only 3 options:

```
┌─────────────────┬─────────────────┬─────────────────┐
│    Terminal     │    AI Agent     │   File Editor   │
│  Shell access   │  AI assistant   │  Browse & edit  │
└─────────────────┴─────────────────┴─────────────────┘
```

---

## 3. Workspace Mental Model

### Current Problem

Users don't understand the relationship between workspaces and sessions:

```
Q: "What is a workspace?"
A: A directory... but also has sessions... but sessions can exist without workspaces...
   and multiple sessions share workspaces... and workspaces have themes?
```

### The Conceptual Mismatch

**What the system thinks:**
```
Workspace (directory)
  └── Session (execution in that directory)
```

**What users think:**
```
Workspace = Project = Everything I'm working on
  └── Multiple windows/tabs for different tasks
```

### Recommendation: Clarify the Hierarchy

Rename concepts to match user mental models:

| Current Term | Proposed Term | Rationale |
|--------------|---------------|-----------|
| Workspace | **Project** | Familiar, implies scope |
| Session | **Tab** or **Instance** | Familiar from browsers |
| Pane | **Panel** | Common in IDEs |
| Layout | **View** or **Arrangement** | Clear purpose |

New mental model:
```
Project (directory scope)
  └── Tabs (execution instances within project)
        └── Panels (visual arrangement of tabs)
```

---

## 4. Navigation & Information Architecture

### Current Navigation Structure

```
┌─────────────────────────────────────────────────────────┐
│ WorkspacePage                                           │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Header: Workspace name, settings, session controls  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │                                                     │ │
│ │  Window Manager OR Single Session View              │ │
│ │  (depending on desktop/mobile)                      │ │
│ │                                                     │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ StatusBar: Create session, navigate, menu           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Problems

1. **No workspace switcher in main view** - must go to menu
2. **Session list hidden in bottom sheet** - not visible at a glance
3. **No visual indicator of workspace scope** - unclear what directory you're in
4. **View mode toggle is buried** - users don't know about window manager

### Recommendation: Sidebar Navigation

```
┌───────┬─────────────────────────────────────────────────┐
│       │ Header: Session title, actions                  │
│  P    ├─────────────────────────────────────────────────┤
│  R    │                                                 │
│  O    │                                                 │
│  J    │  Active Session Content                         │
│  E    │                                                 │
│  C    │                                                 │
│  T    ├─────────────────────────────────────────────────┤
│  S    │ Tab bar: [Terminal] [AI Agent] [+ New]          │
│       │                                                 │
└───────┴─────────────────────────────────────────────────┘
```

Benefits:
- Projects visible at a glance (left sidebar)
- Sessions organized as tabs (bottom bar)
- Clear hierarchy without menus

---

## 5. State Terminology

### Current State Labels

| State | Used For | Problem |
|-------|----------|---------|
| `active` | Running sessions | Also used for "current selection" |
| `running` | Process is executing | Duplicates `active` meaning |
| `stopped` | Process terminated | Unclear if resumable |
| `error` | Process crashed | No recovery guidance |
| `inLayout` | Session visible in pane | Jargon, not user-facing |
| `pinned` | UI term for `inLayout` | Inconsistent with `inLayout` |

### Recommendation: Consistent State Model

```javascript
// Execution states (visible to user)
const EXECUTION_STATE = {
  RUNNING: 'running',      // Process is active
  PAUSED: 'paused',        // Can be resumed (new!)
  STOPPED: 'stopped',      // Process ended normally
  FAILED: 'failed'         // Process crashed (was 'error')
};

// Display states (visibility)
const DISPLAY_STATE = {
  VISIBLE: 'visible',      // In current view (was 'inLayout')
  HIDDEN: 'hidden',        // Not displayed but exists
  MINIMIZED: 'minimized'   // Collapsed (new!)
};

// Selection states
const SELECTION_STATE = {
  SELECTED: 'selected',    // Currently focused (was 'active' in some contexts)
  UNSELECTED: 'unselected'
};
```

---

## 6. Onboarding Flow Issues

### Current Flow

```
1. Welcome → 2. Create Workspace → 3. Theme → 4. API Key → 5. Continue
```

### Problems

1. **Workspace created before understanding** - user creates workspace before knowing what it is
2. **API key shown once** - high-stakes moment with no recovery option
3. **No explanation of sessions** - user enters app without understanding core concept
4. **Theme selection before context** - premature personalization

### Recommended Flow

```
1. Welcome: "Dispatch is your terminal in the cloud"
2. Quick Tour: 3 panels explaining Projects, Terminals, AI Agents
3. First Project: Clone a repo OR select existing directory
4. First Terminal: Auto-create terminal in project
5. Credentials: API key with copy + email backup option
6. Customize: Theme (optional, skippable)
```

Key changes:
- Teach concepts before asking for decisions
- Reduce API key anxiety with backup options
- Get user to value immediately (terminal running)

---

## 7. Mobile vs Desktop Mental Model

### Current Approach

Desktop:
```
Window Manager (tiling) → Multiple panes → Resize/drag
```

Mobile:
```
Single Session View → Swipe between sessions → Dots indicator
```

### Problem: Mental Model Mismatch

Users on mobile can't understand:
- Why they can only see one session at a time
- How to compare two sessions
- What the dots represent (sessions? panes? pages?)

### Recommendation: Unified Mental Model

Both platforms should share the concept of **"Tabs"**:

**Desktop**: Tabs shown as panels in window manager (can tile)
**Mobile**: Tabs shown as swipeable cards (like browser tabs)

Visual consistency:
```
Desktop: [Tab 1] [Tab 2] [Tab 3] [+] ←── Tab bar at top
Mobile:  [Tab 1] [Tab 2] [Tab 3] [+] ←── Same, but as bottom nav
```

---

## 8. Action Terminology

### Current Action Labels

| Action | Current Label | Problem |
|--------|---------------|---------|
| Start new execution | "Create Session" | Verbose, jargon |
| Stop execution | "Close" | Ambiguous (close view or stop?) |
| Restart | "Resume" | Used for both restart and reconnect |
| Switch to | "Connect" | Implies network action |
| Add to view | "Pin" | Metaphor unclear |
| Remove from view | "Unpin" | Negative action unclear |

### Recommended Labels

| Action | Recommended Label | Icon Suggestion |
|--------|-------------------|-----------------|
| Start new | "New Terminal" / "New AI" | `+` |
| Stop | "Stop" or "End" | `■` (stop) |
| Restart | "Restart" | `↻` |
| Focus | "Open" or just click | `→` |
| Show in view | "Show" | `👁` |
| Hide from view | "Hide" | `👁‍🗨` |
| Delete permanently | "Delete" | `🗑` (with confirmation) |

---

## 9. Recommended Terminology Glossary

### User-Facing Terms (Final Recommendations)

| Concept | Term | Definition (for docs/tooltips) |
|---------|------|--------------------------------|
| Execution context | **Tab** | A running terminal, AI agent, or file editor |
| Project directory | **Project** | A folder containing your code |
| Visual container | **Panel** | A section of the screen showing a tab |
| View arrangement | **Layout** | How panels are arranged (e.g., split view) |
| Authentication | **Login** | Your browser session with Dispatch |
| API access | **API Key** | Secret key for programmatic access |

### Technical Terms (Code/Docs Only)

| Concept | Term | Usage |
|---------|------|-------|
| Database session record | `run` | `run_id`, `RunSessionManager` |
| Execution instance | `session` | API responses, client state |
| UI container | `pane` | Window manager internal |
| Auth browser state | `authSession` | Cookie management |

---

## 10. Implementation Priority

### Phase 1: Quick Wins (1-2 days)

1. ✅ Fix `CreateSessionModal` to show only 3 canonical types
2. ✅ Rename "Claude Code" → "AI Agent" in UI
3. ✅ Update button labels: "Create Session" → "New Tab"
4. ✅ Add tooltips explaining workspace = project directory

### Phase 2: Consistency (3-5 days)

1. Audit all UI text for "session" and replace with "tab" where appropriate
2. Create terminology glossary in docs
3. Update onboarding flow with concept explanations
4. Add workspace/project indicator to header

### Phase 3: Restructure (1-2 weeks)

1. Add sidebar navigation for projects
2. Implement tab bar for sessions
3. Unify desktop/mobile tab mental model
4. Create proper state management with clear state names

---

## Appendix A: Current vs Proposed IA

### Current Information Architecture

```
Dispatch
├── /login
├── /onboarding
├── /workspace ← Everything happens here
│   ├── Header (workspace name, controls)
│   ├── Content (window manager OR single view)
│   ├── Modals (create session, settings)
│   └── Bottom sheet (session menu)
├── /settings
├── /console (admin)
└── /cron
```

### Proposed Information Architecture

```
Dispatch
├── /login
├── /welcome (onboarding)
├── /projects ← Project list/switcher
│   └── /projects/[id] ← Active project view
│       ├── Sidebar (project tree, quick actions)
│       ├── Tab bar (open tabs)
│       ├── Content (active tab)
│       └── Status bar (minimal)
├── /settings
└── /admin
```

---

## Appendix B: Glossary Comparison

| What we say now | What users think | What we should say |
|-----------------|------------------|-------------------|
| "Session" | "Login?" | "Tab" |
| "Workspace" | "My whole project setup" | "Project" |
| "Create Session" | "Start something" | "New Terminal" / "New AI" |
| "Claude Session" | "Claude?" | "AI Agent" |
| "Terminal Session" | "What's PTY?" | "Terminal" |
| "Pin to layout" | "Pin where?" | "Show" |
| "inLayout sessions" | "???" | "Open tabs" |
| "Run" | "Execute?" | (internal only) |

---

## Conclusion

The core mental model issues stem from:

1. **Historical terminology** that wasn't cleaned up during refactoring
2. **Internal jargon** leaking into UI (run, pty, inLayout)
3. **Overloaded terms** (session = execution AND authentication)
4. **Missing concepts** (no clear "tab" or "project" terminology)

The recommended approach is:
1. Adopt **"Tab"** for execution instances (familiar, lightweight)
2. Adopt **"Project"** for workspaces (familiar, scoped)
3. Reserve **"Session"** for authentication only
4. Unify mobile/desktop around the tab metaphor

This will reduce cognitive load and make Dispatch feel familiar to users coming from IDEs and browsers.
