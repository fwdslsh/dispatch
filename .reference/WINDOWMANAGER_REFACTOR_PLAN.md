# WindowManager Integration Refactor Plan

## Overview

This document outlines the comprehensive plan to refactor the WorkspacePage.svelte component to integrate the WindowManager for desktop session layout management while maintaining the existing MVVM architecture and mobile experience.

## Current Architecture Analysis

### Existing Components

- **WorkspacePage.svelte**: Main container with MVVM integration
- **SessionGrid.svelte**: Responsive grid layout with mobile touch gestures
- **SessionContainer.svelte**: Individual session display with header/content snippets
- **WindowManager.svelte**: Tiling window manager with keyboard shortcuts and drag-to-resize

### Existing ViewModels

- **WorkspaceViewModel**: Workspace management and operations
- **SessionViewModel**: Session lifecycle, display state, and activity tracking
- **LayoutViewModel**: UI layout and responsive behavior detection
- **ModalViewModel**: Modal state management

## Refactor Strategy

### 1. MVVM Architecture Integration

#### New ViewModel: WindowViewModel

**Purpose**: Manage window layout state and session-to-tile mapping
**Location**: `src/lib/client/shared/viewmodels/WindowViewModel.svelte.js`

**Responsibilities:**

- Session-to-tile bidirectional mapping using reactive Maps
- Focus management and synchronization
- Layout state persistence via PersistenceService
- Mobile/desktop mode handling
- Window configuration (gap, minSize, keyboard shortcuts)

**Key Reactive State:**

```javascript
// Core mapping state
this.sessionToTileMap = $state(new Map());
this.tileToSessionMap = $state(new Map());
this.focusedTile = $state(null);

// Derived active tiles
this.activeTiles = $derived.by(() => {
	// Auto-generates tile list from current sessions
});

// Window configuration
this.config = $state({
	gap: 4,
	minSize: 300,
	keymap: {
		/* keyboard shortcuts */
	}
});
```

**Dependencies:**

- SessionViewModel (constructor injection)
- PersistenceService (via ServiceContainer)

#### ViewModel Integration Pattern

- **WindowViewModel depends on SessionViewModel** (not vice versa)
- **Clean separation**: SessionViewModel handles session business logic, WindowViewModel handles layout
- **Event coordination**: SessionViewModel emits session events, WindowViewModel reacts to layout changes

### 2. Component Architecture

#### New Component: SessionWindowManager

**Purpose**: Bridge WindowManager with session management
**Location**: `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`

**Architecture:**

- Pure presentation component (no business logic)
- Delegates to WindowViewModel for state management
- Renders SessionContainer components within WindowManager tiles
- Handles focus coordination between window tiles and sessions

**Implementation Pattern:**

```svelte
<WindowManager {config} bind:focused={windowViewModel.focusedTile}>
	{#snippet tile({ focused, tileId })}
		{@const session = windowViewModel.getSessionForTile(tileId)}
		{#if session}
			<SessionContainer {session} isFocused={focused === tileId}>
				<!-- Existing session header/content snippets -->
			</SessionContainer>
		{:else}
			<!-- Empty tile with create session options -->
		{/if}
	{/snippet}
</WindowManager>
```

#### WorkspacePage Integration

**Strategy**: Conditional rendering based on screen size and session state

```svelte
<!-- Derived state for layout decision -->
{@const useWindowManager = !isMobile && displayedSessions.length > 0}

<!-- Conditional rendering -->
{#if useWindowManager}
	<SessionWindowManager {windowViewModel} />
{:else}
	<SessionGrid sessions={displayedSessions} {onSessionFocus}>
		<!-- Existing SessionContainer rendering -->
	</SessionGrid>
{/if}
```

### 3. State Management Strategy

#### Session-to-Tile Mapping

- **Approach**: Use session.id as tileId for simplicity
- **Reactivity**: Maps automatically update when sessions change
- **Persistence**: Save/restore layout state across browser sessions

#### Focus Management

- **WindowManager focus** ↔ **Session focus** synchronization
- **Keyboard navigation** works with existing session operations
- **Mobile**: Continue using existing session navigation

#### Layout Generation

- **Dynamic tree building**: Create WindowManager layout from current sessions
- **Default strategy**: Simple row/column splits (configurable for future)
- **Responsive**: Automatically adapt to session count changes

### 4. Implementation Steps

#### Phase 1: Core Infrastructure

1. **Create WindowViewModel** with basic reactive state
2. **Implement session-to-tile mapping** logic
3. **Add focus management** and synchronization
4. **Setup ServiceContainer integration** with dependency injection

#### Phase 2: Component Integration

1. **Create SessionWindowManager** component
2. **Implement WindowManager → SessionContainer** bridge
3. **Add empty tile handling** with session creation options
4. **Setup proper CSS integration** for WindowManager styling

#### Phase 3: WorkspacePage Integration

1. **Add conditional rendering** logic (mobile vs desktop)
2. **Integrate WindowViewModel** into ServiceContainer
3. **Update session event handlers** for window management
4. **Test responsive behavior** and mode switching

#### Phase 4: Enhanced Features

1. **Implement layout persistence** across browser sessions
2. **Add custom keyboard shortcuts** configuration
3. **Optimize drag-to-resize** behavior
4. **Add layout templates** (optional)

### 5. Technical Considerations

#### Reactive Architecture

- Use Svelte 5 runes (`$state`, `$derived`, `$derived.by`) throughout
- Minimize manual state synchronization through proper reactive patterns
- Leverage `$effect` for cross-ViewModel coordination

#### Performance Optimization

- Lazy-load WindowViewModel only when needed (desktop mode)
- Efficient reactive Maps for session-to-tile mapping
- Minimal re-renders through precise reactive dependencies

#### Backward Compatibility

- **Mobile experience unchanged**: SessionGrid continues to work
- **Existing session operations preserved**: create, close, pin/unpin, focus
- **Gradual enhancement**: WindowManager only for desktop with multiple sessions

### 6. Benefits

#### For Users

- **Desktop**: Professional tiling window manager with keyboard shortcuts
- **Drag-to-resize**: Intuitive split pane adjustments
- **Keyboard navigation**: Efficient focus management and layout control
- **Mobile**: Existing swipe-based navigation preserved
- **Seamless**: Automatic switching between modes

#### For Developers

- **MVVM compliance**: Clean separation of concerns maintained
- **Testable**: Each ViewModel independently unit testable
- **Maintainable**: Clear responsibilities and minimal coupling
- **Extensible**: Easy to add window management features
- **Reusable**: WindowManager pattern applicable elsewhere

### 7. Testing Strategy

#### Unit Testing

- **WindowViewModel**: Test reactive state, mapping logic, focus management
- **SessionWindowManager**: Test component rendering and event delegation
- **Integration**: Test ViewModel coordination and ServiceContainer

#### E2E Testing

- **Desktop mode**: Test window management operations, keyboard shortcuts
- **Mobile mode**: Verify existing touch gestures continue working
- **Responsive**: Test automatic mode switching
- **Session operations**: Verify all existing functionality preserved

### 8. Migration Path

#### Development

1. Implement WindowViewModel and SessionWindowManager in parallel
2. Add conditional rendering to WorkspacePage without removing SessionGrid
3. Test desktop window management alongside existing mobile behavior
4. Gradual rollout with feature flags if needed

#### Production

1. Deploy with both approaches running simultaneously
2. Monitor performance and user experience metrics
3. Collect feedback on window management UX
4. Potential future deprecation of SessionGrid for desktop (if desired)

### 9. Future Enhancements

#### Advanced Layout Features

- **Drag-and-drop**: Session reordering between tiles
- **Layout templates**: Predefined split configurations
- **Custom ratios**: User-configurable split proportions
- **Layout saving**: Named layout configurations

#### Window Management

- **Tab groups**: Multiple sessions per tile with tab interface
- **Floating windows**: Detachable session windows
- **Multi-monitor**: Cross-screen window management
- **Session clustering**: Related sessions grouped together

## Implementation Status

✅ **Completed by MVVM Architect:**

- WindowViewModel with full reactive state management
- SessionWindowManager component integration
- WorkspacePage conditional rendering setup
- Mobile/desktop mode detection and switching
- Session-to-tile mapping and focus management
- Layout persistence infrastructure

🔧 **Ready for Enhancement:**

- Custom layout tree building algorithms
- Advanced keyboard shortcuts configuration
- Drag-and-drop session reordering
- Layout templates and presets
- Performance optimizations for large session counts

## TODO List

### Phase 1: Core Implementation Verification ✅ COMPLETED

- [x] Create WindowViewModel with reactive state management
- [x] Implement SessionWindowManager component
- [x] Add conditional rendering to WorkspacePage
- [x] Setup ServiceContainer integration
- [x] Basic session-to-tile mapping functionality

### Phase 2: Integration & Testing 🔧 IN PROGRESS

- [ ] **Test WindowViewModel initialization** in ServiceContainer
- [ ] **Verify session-to-tile mapping reactivity** with live sessions
- [ ] **Test focus synchronization** between tiles and sessions
- [ ] **Validate mobile/desktop mode switching** behavior
- [ ] **Test keyboard shortcuts** integration with WindowManager
- [ ] **Verify layout persistence** across browser sessions

### Phase 3: Bug Fixes & Edge Cases 🐛 NEEDS INVESTIGATION

- [ ] **Handle session creation** when no tiles exist (empty state)
- [ ] **Handle session deletion** and tile cleanup
- [ ] **Fix potential memory leaks** in reactive Maps
- [ ] **Test rapid session creation/deletion** scenarios
- [ ] **Validate WindowManager layout tree** generation logic
- [ ] **Handle WindowViewModel errors** gracefully

### Phase 4: Enhanced Features 🚀 FUTURE

- [ ] **Custom layout tree building** algorithms
- [ ] **Drag-and-drop session reordering** between tiles
- [ ] **Advanced keyboard shortcuts** configuration UI
- [ ] **Layout templates** and presets
- [ ] **Performance optimization** for large session counts
- [ ] **Window manager settings** persistence UI

### Phase 5: Documentation & Polish 📚 FUTURE

- [ ] **Component documentation** with JSDoc
- [ ] **Unit tests** for WindowViewModel
- [ ] **E2E tests** for window management operations
- [ ] **User guide** for window management features
- [ ] **Performance benchmarks** and optimization

## Potential Issues to Investigate

### 🔍 Implementation Concerns

#### 1. **ServiceContainer Integration**

- **Issue**: WindowViewModel may not be properly registered in ServiceContainer
- **Location**: Check `WorkspacePage.svelte` ViewModel initialization
- **Symptoms**: WindowViewModel undefined, component fails to render
- **Investigation**: Verify ServiceContainer.get('windowViewModel') works

#### 2. **Reactive State Synchronization**

- **Issue**: Session changes may not properly update tile mappings
- **Location**: `WindowViewModel.svelte.js` $effect blocks
- **Symptoms**: Stale tile content, incorrect session-tile associations
- **Investigation**: Test session create/delete cycles with logging

#### 3. **Layout Tree Generation**

- **Issue**: Initial layout may not generate correctly for existing sessions
- **Location**: `WindowViewModel.generateLayoutTree()` method
- **Symptoms**: Empty tiles, incorrect split directions, layout corruption
- **Investigation**: Test with 1, 2, 3, 4+ sessions

#### 4. **Focus Management**

- **Issue**: Focus state may desync between WindowManager and SessionViewModel
- **Location**: Focus event handlers and $effect synchronization
- **Symptoms**: Wrong session focused, keyboard shortcuts not working
- **Investigation**: Add focus state logging and manual testing

#### 5. **Mobile/Desktop Mode Switching**

- **Issue**: State corruption when switching between mobile and desktop modes
- **Location**: `useWindowManager` derived state logic
- **Symptoms**: WindowManager persists in mobile, SessionGrid shows in desktop
- **Investigation**: Test responsive breakpoint changes with sessions active

### 🐛 Edge Cases & Error Scenarios

#### 1. **Empty State Handling**

- **Issue**: WindowManager behavior when no sessions exist
- **Symptoms**: Empty tiles, no create session options, layout corruption
- **Test**: Start with empty workspace, verify empty tile behavior

#### 2. **Rapid Session Operations**

- **Issue**: Race conditions during fast session create/delete cycles
- **Symptoms**: Orphaned tiles, incorrect mappings, memory leaks
- **Test**: Automated session creation/deletion stress testing

#### 3. **Memory Management**

- **Issue**: Reactive Maps may hold references to deleted sessions
- **Symptoms**: Memory leaks, stale tile content, performance degradation
- **Test**: Monitor memory usage during long session cycles

#### 4. **WindowManager Keyboard Events**

- **Issue**: Keyboard shortcuts may conflict with session shortcuts
- **Symptoms**: Unexpected splits, wrong focus navigation, broken session operations
- **Test**: Test all keyboard combinations in both empty and session tiles

#### 5. **Layout Persistence**

- **Issue**: Saved layout may not restore correctly on page reload
- **Symptoms**: Wrong session placement, corrupted layout tree, missing sessions
- **Test**: Save complex layout, reload page, verify session restoration

### 🔧 Code Quality Issues

#### 1. **Error Handling**

- **Missing**: WindowViewModel lacks comprehensive error handling
- **Risk**: Unhandled exceptions could crash ViewModel state
- **Fix**: Add try-catch blocks and error state management

#### 2. **Type Safety**

- **Missing**: Some Map operations lack null checks
- **Risk**: Runtime errors when accessing undefined sessions/tiles
- **Fix**: Add TypeScript-style JSDoc and null guards

#### 3. **Performance**

- **Concern**: Reactive Maps may trigger excessive re-renders
- **Risk**: Poor performance with many sessions
- **Fix**: Profile reactive dependencies and optimize derived state

#### 4. **Testing Coverage**

- **Missing**: No unit tests for WindowViewModel
- **Risk**: Regressions during future changes
- **Fix**: Add comprehensive test suite

### 🎯 Integration Points to Verify

#### 1. **SessionViewModel Coordination**

- Verify session events properly trigger tile updates
- Test session focus changes update WindowManager focus
- Confirm session deletion cleans up tile mappings

#### 2. **LayoutViewModel Integration**

- Test mobile/desktop mode detection accuracy
- Verify responsive breakpoint changes trigger mode switching
- Confirm isMobile state properly controls conditional rendering

#### 3. **WorkspacePage Event Handling**

- Test all session event handlers work with WindowManager
- Verify create session modal integration
- Confirm session navigation events work correctly

#### 4. **WindowManager Component Integration**

- Test tile rendering with SessionContainer components
- Verify keyboard shortcuts don't interfere with session operations
- Confirm drag-to-resize works with session content

## Conclusion

This refactor maintains the existing MVVM architecture while seamlessly integrating professional window management for desktop users. The mobile experience remains unchanged, and all existing session functionality continues to work as expected. The implementation follows Svelte 5 best practices and provides a solid foundation for future window management enhancements.

The conditional rendering approach ensures users get the best experience for their context: touch-optimized mobile interface or keyboard-driven desktop window management, all while maintaining a single, coherent codebase.

**⚠️ NEXT STEPS**: Focus on Phase 2 testing and Phase 3 bug investigation to ensure robust integration before moving to enhanced features.
