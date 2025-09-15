# Current Session State Management Audit

This document analyzes the existing session state management patterns in the Dispatch application before the MVVM refactoring.

## Overview

The current implementation uses **Svelte 5 runes** (`$state`, `$derived`) in a **monolithic component architecture**. All session state is managed within the main workspace page component (`src/routes/workspace/+page.svelte`) which is 1771 lines long.

## State Management Architecture

### Primary State Location: `/workspace/+page.svelte`

The workspace page serves as the **single source of truth** for all session-related state:

```javascript
// Core session data
let sessions = $state([]);           // All sessions from API
let workspaces = $state([]);         // All workspaces from API
let selectedWorkspace = $state(null); // Currently selected workspace

// UI state
let displayed = $state([]);           // Session IDs to display in grid
let currentMobileSession = $state(0); // Mobile session index
let layoutPreset = $state('2up');     // Grid layout preference

// Modal states
let terminalModalOpen = $state(false);
let claudeModalOpen = $state(false);
let createSessionModalOpen = $state(false);
let settingsModalOpen = $state(false);

// Responsive state
let isMobile = $state(false);
let sessionMenuOpen = $state(false);  // Bottom sheet state
```

### Derived State Patterns

The component uses `$derived` for computed values:

```javascript
// Layout calculations
let cols = $derived(isMobile ? 1 : layoutPreset === '1up' ? 1 : layoutPreset === '2up' ? 2 : 2);
const maxVisible = $derived(isMobile ? 1 : layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1);

// Session visibility logic
let visible = $derived.by(() => {
    if (isMobile) {
        // Mobile: show current session from ALL sessions
        const allSessions = sessions.filter(s => s && typeof s === 'object' && 'id' in s && 'type' in s);
        if (allSessions.length === 0) return [];

        const validIndex = Math.min(currentMobileSession, allSessions.length - 1);
        return allSessions.slice(validIndex, validIndex + 1);
    } else {
        // Desktop: map displayed slots to sessions
        const ids = displayed.slice(0, maxVisible);
        return ids.map(id => sessions.find(s => s && s.id === id)).filter(Boolean);
    }
});
```

### Session Socket Management

**SessionSocketManager** (`/lib/client/shared/components/SessionSocketManager.js`):
- **Pattern**: Singleton class managing multiple socket connections
- **State**: Each session gets its own socket instance
- **Lifecycle**: Sockets created on-demand, cached by session ID

```javascript
class SessionSocketManager {
    constructor() {
        this.sockets = new Map();        // sessionId -> socket
        this.socketMetadata = new WeakMap(); // socket -> metadata
        this.activeSession = null;
    }
}
```

## State Flow Patterns

### 1. Data Loading Flow

```
Component Mount → API Calls → Local State Update → UI Re-render
     ↓              ↓              ↓               ↓
onMount() → loadSessions() → sessions = [...] → visible recalculates
         → listWorkspaces() → workspaces = [...] → UI updates
```

### 2. Session Creation Flow

```
User Action → Modal Open → Form Submit → API Call → State Update
     ↓           ↓            ↓           ↓          ↓
  onClick → modalOpen=true → POST /api/sessions → sessions.push(newSession)
                                                 → updateDisplayedWithSession()
```

### 3. Session State Persistence

**Desktop Flow**:
- `displayed` array tracks which sessions are visible
- Sessions can be in `sessions` array but not displayed
- `displayed` persists to localStorage as `dispatch-projects-layout`

**Mobile Flow**:
- `currentMobileSession` index tracks current session
- All sessions potentially visible via swipe navigation
- Index persists to localStorage as `dispatch-projects-current-mobile`

## Current Pain Points Identified

### 1. **Monolithic State Management**
- **Issue**: All session state concentrated in 1771-line component
- **Impact**: Difficult to test, maintain, and extend
- **Location**: Single component handles 17+ state variables

### 2. **Mixed Concerns**
- **Issue**: UI state mixed with business logic
- **Examples**:
  - Layout calculations in main component
  - API calls scattered throughout component
  - Modal state management alongside session logic

### 3. **Complex Derived State**
- **Issue**: Complex `visible` derivation with mobile/desktop branching
- **Impact**: Difficult to debug and test edge cases
- **Lines**: 82-113 in workspace page

### 4. **Inconsistent State Updates**
- **Issue**: Multiple patterns for updating session state
- **Examples**:
  - Direct array manipulation: `sessions = sessions.filter(...)`
  - Index updates: `currentMobileSession = idx`
  - API-driven updates vs local optimistic updates

### 5. **Persistence Scattered**
- **Issue**: localStorage calls throughout component
- **Examples**:
  - Layout persistence in effect hooks
  - Mobile index persistence in functions
  - No centralized persistence strategy

### 6. **Error Handling Inconsistency**
- **Issue**: Different error handling patterns across functions
- **Examples**: Some functions return empty arrays, others throw, some log only

### 7. **Socket State Coupling**
- **Issue**: Session state tightly coupled to socket management
- **Impact**: Difficult to test session logic without socket infrastructure

## State Synchronization Patterns

### Current Synchronization Issues

1. **API vs Local State Mismatches**:
   ```javascript
   // Local optimistic update
   sessions = sessions.filter(s => s.id !== sessionId);

   // But if API call fails, state becomes inconsistent
   const response = await fetch('/api/sessions', { method: 'DELETE' });
   if (!response.ok) {
       // State already modified, no rollback mechanism
   }
   ```

2. **Mobile/Desktop State Drift**:
   - Different state management paths for mobile vs desktop
   - `displayed` array vs `currentMobileSession` index
   - Potential for inconsistencies during responsive transitions

3. **Socket Reconnection State**:
   - Socket state managed separately from session state
   - No automatic session state refresh on reconnection
   - Potential for stale session data after network issues

## Current Testing Challenges

### Testability Issues

1. **Monolithic Component**: Difficult to test individual state management functions
2. **Side Effects**: API calls and localStorage access mixed into state logic
3. **Complex Dependencies**: Component depends on Socket.IO, localStorage, fetch API
4. **State Coupling**: Multiple state variables interdependent, hard to test in isolation

### Missing Test Coverage

- Session state transitions (create, update, delete)
- Mobile/desktop responsive state management
- Error state handling and recovery
- Socket reconnection scenarios
- Persistence and restoration logic

## Patterns to Preserve in Refactoring

### Good Patterns Currently Used

1. **Svelte 5 Runes**: Already using modern `$state` and `$derived`
2. **Reactive Derived State**: `visible` calculation is appropriately reactive
3. **Session ID Management**: Proper session identification and mapping
4. **Responsive Design**: Mobile/desktop state differentiation

### Architecture Decisions to Maintain

1. **Session-Centric Design**: Sessions as primary entities
2. **Workspace Scoping**: Sessions tied to workspace contexts
3. **Real-time Updates**: Socket.IO integration for live updates
4. **Optimistic Updates**: Local state updates before API confirmation

## Refactoring Recommendations

### 1. Extract ViewModels
- **SessionViewModel**: Handle session CRUD and state management
- **WorkspaceViewModel**: Handle workspace selection and operations
- **LayoutViewModel**: Handle responsive layout and persistence
- **ModalViewModel**: Handle modal state management

### 2. Centralize API Client
- **SessionApiClient**: All session-related API calls
- **WorkspaceApiClient**: All workspace-related API calls
- Consistent error handling and response processing

### 3. Implement State Services
- **PersistenceService**: Centralized localStorage management
- **SocketService**: Abstracted socket state management
- **ValidationService**: Input validation and state consistency

### 4. Separate UI from Business Logic
- Move all API calls to ViewModels
- Extract layout calculations to LayoutService
- Separate state management from DOM manipulation

### 5. Add Proper Error Boundaries
- Implement error recovery strategies
- Add rollback mechanisms for failed operations
- Centralized error state management

## Migration Strategy

### Phase 1: Extract Core Services
1. Create API clients with existing endpoint contracts
2. Create PersistenceService wrapping current localStorage usage
3. Ensure backward compatibility during transition

### Phase 2: Create ViewModels
1. Extract session management to SessionViewModel
2. Move workspace operations to WorkspaceViewModel
3. Preserve existing reactive patterns using runes

### Phase 3: Refactor UI Components
1. Break down monolithic component into feature components
2. Connect ViewModels to UI components
3. Remove direct API calls from UI components

### Phase 4: Implement Proper Testing
1. Add comprehensive ViewModel tests
2. Add integration tests for state synchronization
3. Add error scenario testing

## Success Metrics

### Code Quality
- No component > 200 lines
- Business logic isolated in ViewModels
- 90%+ test coverage for state management

### Performance
- Same or better reactive performance
- Reduced memory usage through focused ViewModels
- Faster component rendering through separation of concerns

### Maintainability
- Clear separation between UI and business logic
- Predictable state flow patterns
- Easy to add new session types or features