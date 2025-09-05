# Deprecated Code Removal Specification

This document provides a comprehensive breakdown of all deprecated code that can be removed from the Dispatch codebase as part of the UI architecture refactor.

> Created: 2025-09-03
> Version: 1.0.0

## Executive Summary

The Dispatch codebase contains several layers of deprecated code that emerged from architectural evolution:

1. **Legacy Socket Architecture**: Monolithic socket handlers replaced by specialized handlers
2. **Svelte 4 Store Patterns**: Traditional writable/derived stores superseded by Svelte 5 runes
3. **PTY_ROOT Environment Structure**: Old session storage paths replaced by proper project/session hierarchy
4. **Unused Chat Components**: Chat interface components no longer actively used
5. **Legacy Route Structures**: Old session-based routing replaced by project-based navigation

## Phase 1: Critical Infrastructure Cleanup (Priority: High)

### 1.1 Legacy Socket Handler Architecture

**Files to Remove:**

- `/src/lib/server/socket-handler.js` (if exists - original monolithic handler)
- Any imports/references to the old socket handler

**Justification:**
The monolithic socket handler has been replaced by the refactored handler architecture using `SocketRouter` and specialized handlers. The new architecture in `/src/lib/server/socket-handler-refactored.js` provides:

- Better separation of concerns
- Specialized handlers for auth, sessions, projects, Claude auth, and terminal I/O
- Middleware support for cross-cutting concerns
- Improved testability and maintainability

**Migration Status:** ✅ **COMPLETE** - App.js already uses refactored handler

### 1.2 PTY_ROOT Legacy Environment Structure

**Files to Update:**

- `/src/lib/server/terminal.js` - Remove PTY_ROOT references (lines 94, 95, 96, 109, 110, 111)
- `/src/lib/server/storage-manager.js` - Remove PTY_ROOT backward compatibility (lines 14, 98, 171)

**Code Patterns to Remove:**

```javascript
// Remove these patterns from terminal.js and storage-manager.js
const PTY_ROOT = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
const projectDir = path.join(PTY_ROOT, projectId);

// Replace with proper directory manager usage
const projectDir = this.directoryManager.getProjectPath(projectId);
```

**Justification:**

- PTY_ROOT is marked as "deprecated" in CLAUDE.md
- New `DISPATCH_CONFIG_DIR` and `DISPATCH_PROJECTS_DIR` provide proper separation
- DirectoryManager handles all path resolution correctly
- Maintains backward compatibility through DirectoryManager when needed

## Phase 2: Component Architecture Modernization (Priority: Medium)

### 2.1 Svelte 4 Store Pattern Removal

**Files to Update:**

- `/src/lib/stores/panel-store.js` - **KEEP BUT MODERNIZE** - Convert to Svelte 5 context pattern
- Remove any remaining `writable()` and `derived()` imports in components

**Store Migration Strategy:**

```javascript
// OLD (Svelte 4 pattern):
import { writable, derived } from 'svelte/store';
export const panelStore = writable(initialState);
export const derivedStore = derived(panelStore, ($panel) => $panel.header);

// NEW (Svelte 5 context pattern):
import { getContext, setContext } from 'svelte';
// Move to context-based state management in components
```

**Justification:**

- Svelte 5 runes (`$state`, `$derived`, `$effect`) are more performant
- Components already use modern runes pattern
- Context-based state management provides better component isolation
- Removes external dependency on store subscriptions

### 2.2 Chat Interface Component Cleanup

**Files to Evaluate for Removal:**

- `/src/lib/components/ChatInterface.svelte` - **EVALUATE** - Check active usage
- `/src/lib/components/ChatSettings.svelte` - **EVALUATE** - Check active usage

**Analysis Required:**

1. Verify if chat components are actively used in current routes
2. Check if they're part of the Claude integration workflow
3. If unused, remove completely; if partially used, refactor to modern patterns

**Justification:**

- Components may be legacy from earlier architectural iterations
- Modern Claude integration might use different UI patterns
- Reduces bundle size and maintenance overhead

## Phase 3: Route and Navigation Cleanup (Priority: Medium)

### 3.1 Legacy Session Route Structure

**Files to Analyze:**

- Check for any `/sessions/[id]` route patterns
- Look for session-based navigation that should be project-based

**Migration Pattern:**

```javascript
// OLD: Session-centric navigation
goto(`/sessions/${sessionId}`);

// NEW: Project-centric navigation
goto(`/projects/${projectId}?session=${sessionId}`);
```

**Justification:**

- Project-based architecture is the new standard
- Sessions are now children of projects
- Improves URL structure and navigation logic

### 3.2 Authentication Route Modernization

**Files to Update:**

- `/src/routes/+page.svelte` - **ALREADY MODERN** - Uses proper project redirection

**Verification:**
The main auth page already redirects to `/projects` instead of `/sessions`, indicating migration is complete.

## Phase 4: Service Layer Optimization (Priority: Low)

### 4.1 Redundant Service Files

**Files to Evaluate:**

- `/src/lib/services/terminal-session.js` - Check for overlap with newer service patterns
- `/src/lib/services/terminal-socket.js` - Verify integration with refactored socket handler
- `/src/lib/services/terminal-viewmodel.js` - Assess if view model pattern is still needed

**Analysis Strategy:**

1. Map service dependencies and usage
2. Identify overlapping functionality
3. Consolidate into unified service interfaces
4. Remove redundant abstractions

### 4.2 Legacy Mobile Service Patterns

**Files to Update:**

- `/src/lib/services/mobile-responsive.js` - Evaluate against panel-store functionality
- `/src/lib/services/gesture-service.js` - Check for overlap with panel-store gesture handling

**Justification:**

- panel-store.js already includes comprehensive mobile/gesture handling
- Multiple mobile services may cause conflicts or redundancy
- Consolidation improves maintainability

## Phase 5: Cleanup and Optimization (Priority: Low)

### 5.1 Unused Utility Functions

**Files to Audit:**

- `/src/lib/utils/session-name-validation.js` - May be superseded by DirectoryManager methods
- `/src/lib/utils/cleanup-manager.js` - Verify active usage patterns

**Review Criteria:**

1. Is functionality duplicated elsewhere?
2. Are imports/exports actually used?
3. Can logic be consolidated into existing services?

### 5.2 Development and Debug Code

**Patterns to Remove:**

- Console.log statements without proper logging levels
- Debug-specific imports not used in production
- Temporary workarounds with TODO comments

## Implementation Strategy

### Phase Execution Order

1. **Phase 1 (Critical)** - Complete within first sprint
2. **Phase 2 (Component)** - Complete within second sprint
3. **Phase 3 (Routes)** - Verify during Phase 2, fix if needed
4. **Phase 4 (Services)** - Third sprint, careful analysis required
5. **Phase 5 (Cleanup)** - Ongoing, integrate with other development

### Risk Mitigation

1. **Create feature branch** for each phase
2. **Comprehensive testing** after each file removal
3. **Rollback plan** with git commits for each logical change
4. **Gradual deployment** to catch runtime issues

### Testing Requirements

- **Unit tests** for all modified service files
- **Integration tests** for socket handler changes
- **E2E tests** for navigation and authentication flows
- **Mobile responsiveness tests** for UI component changes

## Breaking Change Assessment

### External API Impact: **NONE**

- All changes are internal to the application
- Socket.IO API remains unchanged
- Public routes maintain compatibility

### Configuration Impact: **LOW**

- PTY_ROOT environment variable becomes optional
- New DISPATCH\_\* environment variables are additive
- Graceful degradation for old configurations

### Database/Storage Impact: **NONE**

- Project storage structure unchanged
- Session data migration handled by DirectoryManager
- Backward compatibility maintained where needed

## Success Metrics

### Code Quality Improvements

- **Reduce bundle size** by removing unused components
- **Improve build times** by eliminating dead code paths
- **Reduce maintenance surface** by consolidating similar functionality
- **Improve test coverage** by removing untestable legacy patterns

### Performance Benefits

- **Faster initial page loads** from reduced JavaScript bundle
- **Better runtime performance** from Svelte 5 runes vs stores
- **Reduced memory usage** from eliminated store subscriptions
- **Improved mobile responsiveness** from consolidated gesture handling

### Development Experience

- **Clearer architecture** with well-defined component boundaries
- **Easier debugging** with specialized handlers vs monolithic code
- **Better IDE support** with modern Svelte 5 patterns
- **Reduced cognitive load** from fewer architectural patterns to understand

## Long-term Architectural Vision

This deprecated code removal supports the transition to a **modern, maintainable architecture** with:

- **Specialized handlers** instead of monolithic controllers
- **Context-based state** instead of global stores
- **Project-centric data model** instead of session-centric
- **Svelte 5 modern patterns** instead of legacy patterns
- **Proper environment configuration** instead of legacy env vars

The result will be a **cleaner, more maintainable codebase** that's easier to extend and debug.
