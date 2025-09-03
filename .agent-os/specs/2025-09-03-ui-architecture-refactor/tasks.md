# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-03-ui-architecture-refactor/spec.md

> Created: 2025-09-03
> Status: Ready for Implementation

## Tasks

### 1. Foundation Architecture Setup

**Goal:** Establish the base MVVM architecture patterns and directory structure for the refactor

1.1 Write tests for BaseModel and BaseViewModel classes with validation patterns
1.2 Create directory structure for models, viewmodels, and services (`src/lib/models/`, `src/lib/viewmodels/`, `src/lib/services/`)
1.3 Implement BaseModel class with validation using joi schema patterns
1.4 Implement BaseViewModel class with Svelte 5 runes ($state, $derived, loading, error patterns)
1.5 Create ServiceRegistry and BaseService classes for dependency injection
1.6 Set up testing infrastructure with vitest configuration for Models and ViewModels
1.7 Create component testing patterns using @testing-library/svelte
1.8 Verify all tests pass for foundation architecture

### 2. Terminal Component MVVM Migration

**Goal:** Migrate the existing Terminal.svelte god component to proper MVVM architecture

2.1 Write tests for TerminalModel, TerminalViewModel, and TerminalService classes
2.2 Create TerminalModel class with session data validation and state structure
2.3 Implement TerminalViewModel with reactive terminal state using Svelte 5 runes
2.4 Extract TerminalService from existing terminal component business logic
2.5 Split Terminal.svelte into TerminalContainer (smart) and TerminalDisplay (presentation) components
2.6 Implement TerminalToolbar and TerminalStatus presentation components
2.7 Update TerminalContext to use new ViewModel pattern with proper state management
2.8 Verify all tests pass for terminal component migration

### 3. Project Management Component Decomposition

**Goal:** Break down the 1,215-line project page into focused, maintainable components

3.1 Write tests for ProjectModel, ProjectViewModel, and ProjectService classes
3.2 Create ProjectModel with project metadata validation and structure
3.3 Implement ProjectViewModel for project management UI state and operations
3.4 Extract ProjectService from existing project management logic
3.5 Split project page into ProjectManager (container), ProjectList, ProjectForm, and ProjectCard (presentation) components
3.6 Implement ProjectContext with Svelte 5 runes for shared project state
3.7 Update project routes to use new component architecture
3.8 Verify all tests pass for project component decomposition

### 4. Chat Component Integration and Refactor

**Goal:** Properly integrate or remove Chat component following MVVM patterns

4.1 Write tests for ChatModel, ChatViewModel, and ChatService (if keeping) or deprecation tests
4.2 Analyze Chat component usage patterns and determine integration strategy
4.3 Create ChatModel and ChatViewModel if component is actively used
4.4 Split Chat.svelte into ChatContainer, ChatMessages, ChatInput, and ChatStatus components
4.5 Implement ChatService for auxiliary UI operations and Socket.IO communication
4.6 Update ChatContext to follow new context patterns or deprecate if unused
4.7 Remove ChatInterface.svelte and ChatSettings.svelte if determined to be unused
4.8 Verify all tests pass for chat component integration or removal

### 5. Legacy Code Cleanup and Optimization

**Goal:** Remove all deprecated code patterns and consolidate state management

5.1 Write tests to verify new patterns work correctly before removing legacy code
5.2 Remove PTY_ROOT environment variable references from terminal.js and storage-manager.js
5.3 Convert panel-store.js from Svelte 4 stores to Svelte 5 context pattern
5.4 Remove any remaining writable() and derived() store imports throughout codebase
5.5 Consolidate mobile service patterns (mobile-responsive.js, gesture-service.js) into panel-store
5.6 Clean up unused utility functions and development debug code
5.7 Update all components to use consistent error handling patterns from BaseViewModel
5.8 Verify all tests pass after legacy code removal and optimization