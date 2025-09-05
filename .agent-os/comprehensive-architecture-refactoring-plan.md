# Comprehensive Architecture Refactoring Plan

> **Created**: 2025-09-05  
> **Status**: Planning  
> **Scope**: Complete UI/UX architecture refactoring for maintainable, scalable, and testable Dispatch codebase

## Executive Summary

This comprehensive refactoring plan addresses critical architecture violations identified in the Dispatch codebase, establishing a maintainable, scalable MVVM architecture using Svelte 5 runes while eliminating code redundancies, breaking down god components, and implementing foundational design patterns. **The primary goal is to simplify the code without over-engineering** - focusing on clean, readable patterns that reduce complexity rather than adding unnecessary abstractions. The plan is aligned with existing specifications and provides a systematic approach to transform the codebase without losing functionality.

**Key Metrics (Current State)**:

- **Projects.svelte**: 746 lines (248% over 300-line limit)
- **ChatInterface.svelte**: 613 lines (204% over limit)
- **CommandMenu.svelte**: 593 lines (197% over limit)
- **DirectoryPicker.svelte**: 498 lines (166% over limit)
- **MultiPaneLayout.svelte**: 413 lines (137% over limit)
- **KeyboardToolbar.svelte**: 384 lines (128% over limit)

**Target State**: All components under 300 lines, consistent MVVM architecture, unified state management, comprehensive service layer.

## 1. Architecture Assessment & Current Issues

### 1.1 God Component Violations (Critical Priority)

**Primary Violators**:

1. **Projects.svelte (746 lines)**
   - **Issues**: Manages project listing, creation, editing, validation, session management, socket connections
   - **SRP Violations**: 8+ distinct responsibilities
   - **Refactor Target**: Break into 6-8 focused components

2. **ChatInterface.svelte (613 lines)**
   - **Issues**: Chat UI, message handling, connection management, history tracking
   - **Status**: Needs to be implemented (identified in specs)

3. **CommandMenu.svelte (593 lines)**
   - **Issues**: Command processing, UI rendering, keyboard handling, state management
   - **Refactor Target**: Separate command logic from UI presentation

4. **DirectoryPicker.svelte (498 lines)**
   - **Issues**: File system operations, UI tree rendering, validation logic
   - **Refactor Target**: Extract file system service and tree components

### 1.2 MVVM Implementation Inconsistencies

**Current State Analysis**:

- ✅ `ProjectViewModel.svelte.js` - Properly implemented with Svelte 5 runes
- ✅ `TerminalViewModel.svelte.js` - Exists but needs enhancement
- ❌ Missing ViewModels for Chat, Command, Directory, Layout components
- ❌ Inconsistent Model layer implementation
- ❌ Service layer partially implemented

### 1.3 State Management Fragmentation

**Current Patterns Identified**:

- ✅ Svelte 5 runes in ViewModels (`$state`, `$derived`)
- ❌ Mixed context patterns (some legacy, some modern)
- ❌ Direct socket management in components
- ❌ Inconsistent error handling patterns

### 1.4 Code Redundancy Analysis

**Duplicate Validation Logic**:

- Project name validation duplicated in Projects.svelte and utils
- Session validation scattered across components
- Input validation patterns repeated without standardization

**Repeated UI Patterns**:

- Loading states implemented differently across components
- Error display patterns inconsistent
- Modal/dialog patterns duplicated
- Button styling and behavior not standardized

## 2. Foundational Architecture Design

### 2.1 MVVM Structure Implementation

```
src/lib/
├── models/                           # Data models and business entities
│   ├── base/
│   │   ├── BaseModel.js             # Abstract base with validation
│   │   └── ModelValidation.js       # Centralized validation rules
│   ├── TerminalModel.js             # Terminal session data model
│   ├── ProjectModel.js              # Project data structure
│   ├── SessionModel.js              # Session metadata model
│   ├── CommandModel.js              # Command/menu item model
│   ├── ChatModel.js                 # Chat message model
│   └── DirectoryModel.js            # File system model
│
├── viewmodels/                       # Business logic and UI state (all .svelte.js for runes)
│   ├── base/
│   │   └── BaseViewModel.svelte.js  # Common ViewModel patterns (uses runes)
│   ├── TerminalViewModel.svelte.js  # ✅ Already exists - enhance
│   ├── ProjectViewModel.svelte.js   # ✅ Already exists - relocate
│   ├── CommandMenuViewModel.svelte.js
│   ├── DirectoryPickerViewModel.svelte.js
│   ├── ChatViewModel.svelte.js      # Only if chat is retained
│   └── LayoutViewModel.svelte.js    # Multi-pane layout logic

**Important**: All ViewModel files must use `.svelte.js` extension to enable Svelte 5 runes compilation.
│
├── services/                         # Business logic and external communication
│   ├── base/
│   │   └── BaseService.js           # Common service patterns (simple constructor injection)
│   ├── TerminalService.js           # ✅ Enhance existing terminal services
│   ├── ProjectService.js            # Project CRUD operations
│   ├── CommandService.js            # Command processing logic
│   ├── DirectoryService.js          # File system operations
│   ├── ValidationService.js         # Centralized validation
│   ├── SocketService.js             # Unified socket management
│   └── ChatService.js               # Chat operations (if retained)
│
├── components/                       # Pure presentation components
│   ├── foundation/                   # Reusable UI primitives
│   │   ├── Button.svelte            # Standardized buttons
│   │   ├── Input.svelte             # Form inputs with validation
│   │   ├── Modal.svelte             # Modal wrapper
│   │   ├── LoadingSpinner.svelte    # Loading states
│   │   ├── ErrorDisplay.svelte      # Error message display
│   │   ├── ConfirmationDialog.svelte # ✅ Already exists - enhance
│   │   ├── ValidationMessage.svelte  # Input validation feedback
│   │   └── Card.svelte              # Content card container
│   │
│   ├── layout/                       # Layout and navigation
│   │   ├── MainLayout.svelte        # Application shell
│   │   ├── HeaderToolbar.svelte     # ✅ Exists - refactor (131 lines)
│   │   ├── Sidebar.svelte           # Navigation sidebar
│   │   ├── PaneLayout.svelte        # Multi-pane container (split from MultiPaneLayout)
│   │   └── KeyboardToolbar.svelte   # ✅ Exists - refactor (384 lines)
│   │
│   ├── terminal/                     # Terminal-specific components
│   │   ├── TerminalContainer.svelte  # Terminal container (smart)
│   │   ├── TerminalDisplay.svelte    # xterm.js wrapper (pure)
│   │   ├── TerminalToolbar.svelte    # Terminal controls
│   │   └── TerminalStatus.svelte     # Connection status
│   │
│   ├── project/                      # Project management components
│   │   ├── ProjectManager.svelte     # Project container (smart)
│   │   ├── ProjectList.svelte        # Project listing (pure)
│   │   ├── ProjectCard.svelte        # Individual project display
│   │   ├── ProjectForm.svelte        # Create/edit form
│   │   ├── ProjectHeader.svelte      # Project title/navigation
│   │   ├── SessionPanel.svelte       # ✅ Exists - enhance (152 lines)
│   │   └── SessionContent.svelte     # ✅ Exists - enhance (170 lines)
│   │
│   ├── session/                      # Session management components
│   │   ├── SessionManager.svelte     # Session container (smart)
│   │   ├── SessionList.svelte        # ✅ Exists - enhance (59 lines)
│   │   ├── SessionCard.svelte        # Individual session display
│   │   ├── CreateSessionForm.svelte  # ✅ Exists - enhance (45 lines)
│   │   └── SessionActions.svelte     # Session control buttons
│   │
│   ├── command/                      # Command menu components
│   │   ├── CommandMenuContainer.svelte # Command container (smart)
│   │   ├── CommandPalette.svelte     # Command search/display (pure)
│   │   ├── CommandItem.svelte        # Individual command display
│   │   └── CommandShortcuts.svelte   # Keyboard shortcut display
│   │
│   ├── directory/                    # Directory picker components
│   │   ├── DirectoryContainer.svelte # Directory container (smart)
│   │   ├── DirectoryTree.svelte      # Tree display (pure)
│   │   ├── DirectoryItem.svelte      # Individual directory/file
│   │   └── DirectoryBreadcrumbs.svelte # Path navigation
│   │
│   ├── chat/                         # Chat components (conditional)
│   │   ├── ChatContainer.svelte      # Chat container (smart)
│   │   ├── ChatMessages.svelte       # Message display (pure)
│   │   ├── ChatInput.svelte          # Message input (pure)
│   │   └── ChatStatus.svelte         # Connection status
│   │
│   └── Icons/                        # ✅ Already well-organized
│       └── [existing icon components]
│
├── contexts/                         # Global state management
│   ├── AppContext.svelte.js          # Global application state
│   ├── TerminalContext.svelte.js     # Terminal-specific state
│   ├── ProjectContext.svelte.js      # Project-specific state
│   └── LayoutContext.svelte.js       # Layout/UI state
│
└── utils/                            # ✅ Keep existing + enhance
    ├── validation.js                 # ✅ Exists - standardize
    ├── session-name-validation.js    # ✅ Exists - consolidate
    ├── error-handling.js             # ✅ Exists - enhance
    ├── cleanup-manager.js            # ✅ Exists
    ├── component-helpers.js          # New - shared component utilities
    └── test-helpers.js               # New - testing utilities
```

### 2.2 Service Layer Architecture

**Simple Constructor Injection (No Over-Engineering)**:

```javascript
// Keep dependency injection simple - just pass services to constructors
// No complex registry or DI container needed

export class ProjectViewModel extends BaseViewModel {
	constructor(projectService, socketService, validationService) {
		super();
		this.#projectService = projectService;
		this.#socketService = socketService;
		this.#validationService = validationService;
	}
}

// Simple instantiation in components:
const projectService = new ProjectService();
const socketService = new SocketService();
const validationService = new ValidationService();
const viewModel = new ProjectViewModel(projectService, socketService, validationService);
```

### 2.3 Foundation Component Library

**Standardized UI Primitives**:

```javascript
// Button.svelte - Standardized button component
<script>
  let {
    variant = 'primary',     // primary, secondary, danger, ghost
    size = 'medium',         // small, medium, large
    disabled = false,
    loading = false,
    onclick = () => {},
    children,
    ...props
  } = $props();
</script>

<button
  class="btn btn--{variant} btn--{size}"
  {disabled}
  onclick={onclick}
  {...props}
>
  {#if loading}
    <LoadingSpinner size="small" />
  {/if}
  {@render children()}
</button>
```

## 3. Component Decomposition Strategy

### 3.1 Projects.svelte Refactoring (Priority 1)

**Current**: 746 lines with 8+ responsibilities

**Target Structure**:

```
ProjectManager.svelte (Container - 80-100 lines)
├── ProjectHeader.svelte (40-60 lines)
├── ProjectList.svelte (80-120 lines)
├── ProjectForm.svelte (60-100 lines)
├── ProjectCard.svelte (40-60 lines)
├── ProjectActions.svelte (40-60 lines)
└── ProjectValidation.svelte (30-50 lines)
```

**Decomposition Plan**:

1. **Extract ProjectViewModel** (Complete)
   - Move business logic to existing `src/lib/viewmodels/ProjectViewModel.svelte.js`
   - Enhance with validation and error handling services

2. **Create Foundation Components**

   ```javascript
   // ProjectCard.svelte - Reusable project display
   <script>
     let { project, onEdit, onDelete, onNavigate } = $props();
   </script>

   <Card class="project-card">
     <div class="project-header">
       <h3>{project.name}</h3>
       <ProjectActions {project} {onEdit} {onDelete} />
     </div>
     <div class="project-stats">
       <span>{project.sessionCount} sessions</span>
       <span>Modified {project.lastModified}</span>
     </div>
     <Button variant="primary" onclick={() => onNavigate(project.id)}>
       Open Project
     </Button>
   </Card>
   ```

3. **Extract Validation Logic**
   ```javascript
   // ValidationService.js
   export class ValidationService extends BaseService {
   	validateProjectName(name) {
   		const rules = [
   			{ test: (name) => name?.length > 0, message: 'Name required' },
   			{ test: (name) => name.length <= 50, message: 'Name too long' },
   			{ test: (name) => /^[a-zA-Z0-9\s_-]+$/.test(name), message: 'Invalid characters' }
   		];

   		for (const rule of rules) {
   			if (!rule.test(name)) {
   				return { isValid: false, message: rule.message };
   			}
   		}
   		return { isValid: true };
   	}
   }
   ```

### 3.2 CommandMenu.svelte Refactoring (Priority 2)

**Current**: 593 lines with command processing + UI

**Target Structure**:

```
CommandMenuContainer.svelte (Container - 60-80 lines)
├── CommandPalette.svelte (100-120 lines)
├── CommandItem.svelte (30-50 lines)
├── CommandShortcuts.svelte (40-60 lines)
└── CommandSearch.svelte (60-80 lines)
```

### 3.3 DirectoryPicker.svelte Refactoring (Priority 3)

**Current**: 498 lines with file system + tree UI

**Target Structure**:

```
DirectoryContainer.svelte (Container - 60-80 lines)
├── DirectoryTree.svelte (120-150 lines)
├── DirectoryItem.svelte (40-60 lines)
├── DirectoryBreadcrumbs.svelte (50-70 lines)
└── DirectoryActions.svelte (40-60 lines)
```

## 4. State Management Consolidation

### 4.1 Context Architecture with Svelte 5 Runes

```javascript
// AppContext.svelte.js - Global application state
import { getContext, setContext } from 'svelte';

class AppState {
	// Authentication state
	#user = $state(null);
	#isAuthenticated = $state(false);
	#authToken = $state(null);

	// UI state
	#theme = $state('dark');
	#sidebarOpen = $state(false);
	#activeModal = $state(null);

	// Connection state
	#socketConnection = $state(null);
	#connectionStatus = $state('disconnected');

	// Error handling
	#globalError = $state(null);
	#notifications = $state([]);

	constructor() {
		// Initialize from localStorage
		this.loadPersistedState();
	}

	// Computed properties
	get isOnline() {
		return $derived(this.#connectionStatus === 'connected');
	}

	get canPerformActions() {
		return $derived(this.#isAuthenticated && this.isOnline);
	}

	// Actions
	setAuthentication(user, token) {
		this.#user = user;
		this.#authToken = token;
		this.#isAuthenticated = true;
		this.persistAuthState();
	}

	addNotification(notification) {
		this.#notifications = [
			...this.#notifications,
			{
				id: crypto.randomUUID(),
				timestamp: Date.now(),
				...notification
			}
		];
	}
}
```

### 4.2 Context Provider Pattern

```javascript
// contexts/ContextProvider.svelte
<script>
  import { createAppContext } from './AppContext.svelte.js';
  import { createTerminalContext } from './TerminalContext.svelte.js';
  import { createProjectContext } from './ProjectContext.svelte.js';

  let { children } = $props();

  // Initialize all contexts
  const appContext = createAppContext();
  const terminalContext = createTerminalContext(appContext);
  const projectContext = createProjectContext(appContext);
</script>

{@render children()}
```

## 5. Dead Code Elimination Plan

### 5.1 ChatInterface.svelte Decision

**Analysis**: 613-line component with unclear integration status

**Recommendation**:

- Refactor to comply with the project component structure and make a note that it needs to be implemented and a link to the related spec.

### 5.2 Unused Utilities and Functions

**Candidates for Removal** (requires verification):

```javascript
// Check these files for actual usage:
src / lib / utils / cleanup - manager.js; // Verify integration
src / lib / contexts / BaseModel.svelte.js; // May be redundant with new BaseModel
src / lib / contexts / BaseViewModel.svelte.js; // May be redundant with new BaseViewModel
```

### 5.3 Legacy Context Files

**Migration Plan**:

1. Audit existing contexts in `src/lib/contexts/`
2. Migrate functionality to new Svelte 5 rune-based contexts
3. Update all context consumers
4. Remove legacy context files

## 6. Performance Optimization Strategy

### 6.1 State Management Optimizations

**Derived State Memoization**:

```javascript
class ProjectViewModel extends BaseViewModel {
	// Expensive computation with memoization
	#filteredProjects = $derived.by(() => {
		if (!this.#searchTerm) return this.#projects;

		return this.#projects.filter(
			(project) =>
				project.name.toLowerCase().includes(this.#searchTerm.toLowerCase()) ||
				project.description.toLowerCase().includes(this.#searchTerm.toLowerCase())
		);
	});
}
```

## 7. Testing Infrastructure Requirements

### 7.1 Simplified Testing Structure (ViewModels & Services Only)

```
tests/
├── unit/
│   ├── viewmodels/
│   │   ├── ProjectViewModel.test.js
│   │   ├── TerminalViewModel.test.js
│   │   ├── CommandMenuViewModel.test.js
│   │   └── DirectoryPickerViewModel.test.js
│   ├── services/
│   │   ├── ProjectService.test.js
│   │   ├── TerminalService.test.js
│   │   ├── ValidationService.test.js
│   │   └── SocketService.test.js
│   └── utils/
│       ├── validation.test.js
│       └── error-handling.test.js
└── integration/
    ├── project-management.test.js
    ├── terminal-workflow.test.js
    └── command-processing.test.js

Note: Component testing is excluded for now - focus on ViewModels and Services only
```

### 7.2 Testing Patterns and Examples

**ViewModel Testing**:

```javascript
// ProjectViewModel.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectViewModel } from '$lib/viewmodels/ProjectViewModel.svelte.js';

describe('ProjectViewModel', () => {
	let viewModel;
	let mockProjectService;
	let mockSocketService;

	beforeEach(() => {
		mockProjectService = {
			fetchProjects: vi.fn().mockResolvedValue([]),
			createProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn()
		};

		mockSocketService = {
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn()
		};

		viewModel = new ProjectViewModel(mockProjectService, mockSocketService);
	});

	it('should initialize with loading state', () => {
		expect(viewModel.loading).toBe(true);
		expect(viewModel.projects).toEqual([]);
	});

	it('should load projects on initialize', async () => {
		const mockProjects = [{ id: 1, name: 'Test Project' }];
		mockProjectService.fetchProjects.mockResolvedValue(mockProjects);

		await viewModel.initialize();

		expect(viewModel.projects).toEqual(mockProjects);
		expect(viewModel.loading).toBe(false);
	});
});
```

## 9. Migration Strategy & Risk Management

### 9.1 Direct Migration Approach (No Feature Flags)

**Strategy**: Replace components directly - no backwards compatibility needed

- Create new components alongside old ones
- Replace old component imports with new ones when ready
- Delete old components after replacement
- Use git commits for safe rollback points

### 9.2 Rollback Strategy

**Simple Rollback Points**:

- Each major component gets its own commit
- Direct component replacement makes rollback straightforward

### 9.3 Performance Monitoring

**Key Metrics to Track**:

- Component render times
- Bundle size impact
- Memory usage patterns
- WebSocket message processing performance
- User interaction responsiveness

## 10. Success Criteria & Validation

### 10.1 Architecture Quality Metrics

**Component Size Compliance**:

- ✅ All components under 300 lines
- ✅ No component with more than 3 primary responsibilities
- ✅ Clear separation of container vs presentation components

**MVVM Implementation**:

- ✅ All major UI sections have dedicated ViewModels
- ✅ Business logic extracted from View components
- ✅ Models handle all data structures and validation
- ✅ Services manage all external communication

**State Management Consistency**:

- ✅ Unified context system using Svelte 5 runes
- ✅ No direct socket management in components
- ✅ Consistent error handling patterns across app

### 10.2 Code Quality Targets

**Testing Coverage (Simplified)**:

- ✅ >80% unit test coverage for ViewModels and Services only
- ✅ Integration tests for critical user workflows
- ✅ E2E tests for complete application features (existing tests)

**Performance Benchmarks**:

- ✅ Initial page load under 2 seconds
- ✅ Component render times under 100ms
- ✅ Bundle size increase under 15% from current state
- ✅ Memory usage stable during extended sessions

### 10.3 Maintainability Validation

**Developer Experience**:

- ✅ New features can be added without modifying existing components
- ✅ Components can be tested in isolation
- ✅ Clear debugging and error tracing
- ✅ Consistent code patterns across all components

## 12. Conclusion

This comprehensive refactoring plan transforms the Dispatch codebase from its current state with oversized god components and inconsistent architecture into a maintainable, scalable MVVM system using modern Svelte 5 patterns. **The focus is on simplification and avoiding over-engineering**.

**Key Benefits**:

- **Simplicity**: Clean, readable code without unnecessary abstractions
- **Maintainability**: All components under 300 lines with single responsibilities
- **Testability**: Focus on ViewModels and Services for core business logic testing
- **Scalability**: Simple service layer with constructor injection supports growth
- **Performance**: Optimized state management with Svelte 5 runes
- **Developer Experience**: Consistent patterns without complex tooling

**Key Simplifications**:

- No feature flags or backwards compatibility complexity
- No component testing initially - focus on ViewModels/Services
- No virtual scrolling or over-engineered performance optimizations
- Simple constructor injection instead of complex DI containers
- Direct migration approach without parallel development overhead

The plan aligns with all existing specifications while providing a clear, simple path forward for long-term maintainability and scalability of the Dispatch codebase.
