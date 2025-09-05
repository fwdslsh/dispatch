# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-05-svelte-mvvm-refactoring/spec.md

> Created: 2025-09-05
> Status: Ready for Implementation

## Tasks

### Task 1: Foundation Layer Implementation

Create the foundational MVVM infrastructure and reusable components that all subsequent refactoring will depend on.

1.1 Write comprehensive unit tests for BaseViewModel.svelte.js covering all common state patterns ($state, $derived, $effect)
1.2 Implement BaseViewModel.svelte.js with common patterns for loading, error, and validation state using Svelte 5 runes
1.3 Write unit tests for foundation components (Button, Input, Modal, LoadingSpinner, ErrorDisplay, Card, ValidationMessage)
1.4 Create foundation component library with standardized props, variants, and consistent styling using augmented-ui
1.5 Write unit tests for SocketService and ValidationError classes covering all Socket.IO communication patterns
1.6 Implement SocketService wrapper for Socket.IO and ValidationError custom error class
1.7 Create AppContext.svelte.js for global state management with authentication, theme, connection status, and notifications
1.8 Verify all foundation layer tests pass and components render correctly in isolation

### Task 2: Projects Component Decomposition (Priority 1)

Break down the 746-line Projects.svelte god component into 6 focused components following MVVM patterns with comprehensive ViewModel testing.

2.1 Write comprehensive unit tests for ProjectViewModel.svelte.js covering project listing, creation, editing, validation, and Socket.IO integration
2.2 Implement ProjectViewModel.svelte.js extending BaseViewModel with all project management logic and Socket.IO communication
2.3 Write unit tests for ProjectService.js covering getProjects, createProject, deleteProject, and validateProject methods
2.4 Implement ProjectService.js with Socket.IO integration and custom validation logic (no external dependencies)
2.5 Create 6 focused components: ProjectManager.svelte (container, 80-100 lines), ProjectList.svelte (presentation, 80-120 lines), ProjectCard.svelte (individual project, 40-60 lines), ProjectForm.svelte (create/edit with validation, 60-100 lines), ProjectHeader.svelte (navigation, 40-60 lines), ProjectActions.svelte (operations, 40-60 lines)
2.6 Wire ProjectManager.svelte with ProjectViewModel using constructor injection pattern and foundation components
2.7 Update routing and imports to use new ProjectManager instead of old Projects.svelte
2.8 Verify all tests pass and Projects functionality works identically to before refactoring

### Task 3: CommandMenu Component Refactoring

Refactor the 593-line CommandMenu.svelte god component into 4 focused components with dedicated ViewModel and Service layer.

3.1 Write unit tests for CommandMenuViewModel.svelte.js covering command processing, search functionality, keyboard navigation, and state management
3.2 Implement CommandMenuViewModel.svelte.js extending BaseViewModel with command search, filtering, and execution logic
3.3 Write unit tests for CommandService.js covering command registration, search algorithms, and execution patterns
3.4 Implement CommandService.js with command registry, search functionality, and execution handling
3.5 Break CommandMenu.svelte into 4 components under 150 lines each: CommandMenuManager.svelte (container), CommandSearchInput.svelte (search UI), CommandList.svelte (command listing), CommandItem.svelte (individual commands)
3.6 Integrate CommandMenuViewModel with new components using constructor injection and foundation components
3.7 Update all imports and integrations to use new CommandMenuManager
3.8 Verify all tests pass and CommandMenu functionality works identically with improved performance

### Task 4: DirectoryPicker and KeyboardToolbar Refactoring

Complete the remaining god component decompositions following established MVVM patterns and foundation components.

4.1 Write unit tests for DirectoryPickerViewModel.svelte.js covering file system navigation, path resolution, and selection state management
4.2 Implement DirectoryPickerViewModel.svelte.js and DirectoryService.js with file system navigation logic
4.3 Break DirectoryPicker.svelte (498 lines) into 4 components under 125 lines each with ViewModel integration
4.4 Write unit tests for KeyboardToolbar ViewModel covering keyboard shortcut management and toolbar state
4.5 Refactor KeyboardToolbar.svelte (384 lines) into 3 components under 130 lines each with proper state management
4.6 Enhance existing TerminalViewModel.svelte.js with additional MVVM patterns and foundation component integration
4.7 Update all component imports and ensure consistent foundation component usage across refactored components
4.8 Verify all tests pass and Directory/Keyboard functionality works identically with improved maintainability

### Task 5: Integration, Testing, and Optimization

Complete the MVVM architecture integration, comprehensive testing, and performance optimization to meet bundle size and performance requirements.

5.1 Write integration tests for complete MVVM system covering ViewModel to Service to Socket.IO communication flows
5.2 Wire all ViewModels into AppContext system with proper dependency injection and state management
5.3 Implement comprehensive unit test coverage (>80% target) for all ViewModels and Services
5.4 Update existing integration tests to work with new MVVM architecture and component structure
5.5 Perform bundle size analysis and optimize to stay under 15% increase from baseline
5.6 Conduct performance testing for component render times (under 100ms) and memory usage during extended sessions
5.7 Optimize state management using $derived.by() for expensive computations and 16ms batch updates for WebSocket messages
5.8 Verify all tests pass, performance requirements met, and complete MVVM architecture functioning properly