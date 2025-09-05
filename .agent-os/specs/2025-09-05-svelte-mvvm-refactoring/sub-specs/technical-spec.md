# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-svelte-mvvm-refactoring/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Technical Requirements

### 1. Component Decomposition Requirements

#### Projects.svelte Refactoring (Priority 1)
- **Current State**: 746 lines violating SRP with 8+ responsibilities
- **Target Architecture**: Break into 6-8 focused components under 300 lines each:
  - ProjectManager.svelte (Container - 80-100 lines) - Smart component with ViewModel integration
  - ProjectList.svelte (80-120 lines) - Pure presentation for project listing
  - ProjectCard.svelte (40-60 lines) - Individual project display with actions
  - ProjectForm.svelte (60-100 lines) - Create/edit form with validation
  - ProjectHeader.svelte (40-60 lines) - Project navigation and title
  - ProjectActions.svelte (40-60 lines) - Project operation buttons

#### Other God Components
- **CommandMenu.svelte** (593 lines → 4 components under 150 lines each)
- **DirectoryPicker.svelte** (498 lines → 4 components under 125 lines each)  
- **KeyboardToolbar.svelte** (384 lines → 3 components under 130 lines each)

### 2. MVVM Architecture Implementation

#### ViewModel Layer (.svelte.js files for runes)
```javascript
// All ViewModels must use .svelte.js extension for Svelte 5 runes compilation
src/lib/viewmodels/
├── base/BaseViewModel.svelte.js - Common patterns with $state, $derived, $effect
├── ProjectViewModel.svelte.js - Project management state and operations  
├── TerminalViewModel.svelte.js - Terminal UI state (enhance existing)
├── CommandMenuViewModel.svelte.js - Command processing and search
├── DirectoryPickerViewModel.svelte.js - File system navigation state
└── LayoutViewModel.svelte.js - Multi-pane layout management
```

#### Service Layer (Simple Constructor Injection)
```javascript
// No complex DI container - simple constructor arguments
export class ProjectViewModel extends BaseViewModel {
  constructor(projectService, socketService, validationService) {
    super();
    this.#projectService = projectService;
    this.#socketService = socketService; 
    this.#validationService = validationService;
  }
}

// Instantiation in components:
const projectService = new ProjectService();
const socketService = new SocketService();
const validationService = new ValidationService();
const viewModel = new ProjectViewModel(projectService, socketService, validationService);
```

### 3. Foundation Component Library

#### Standardized UI Primitives
- **Button.svelte** - variant (primary/secondary/danger/ghost), size (small/medium/large), loading states
- **Input.svelte** - form inputs with integrated validation display
- **Modal.svelte** - standardized modal wrapper with backdrop and keyboard handling
- **LoadingSpinner.svelte** - consistent loading indicators across components
- **ErrorDisplay.svelte** - standardized error message presentation
- **Card.svelte** - content container with consistent styling
- **ValidationMessage.svelte** - input validation feedback display

### 4. State Management Architecture

#### Context System with Svelte 5 Runes
```javascript
// AppContext.svelte.js - Global application state
class AppState {
  #user = $state(null);
  #isAuthenticated = $state(false);
  #theme = $state('dark');
  #socketConnection = $state(null);
  #connectionStatus = $state('disconnected');
  #notifications = $state([]);
  
  // Computed properties
  get isOnline() {
    return $derived(this.#connectionStatus === 'connected');
  }
  
  get canPerformActions() {
    return $derived(this.#isAuthenticated && this.isOnline);
  }
}
```

### 5. Migration Strategy

#### Direct Replacement Approach
- Create new components alongside existing ones
- Update imports to use new components when ready
- Delete old components after successful replacement
- Use git commits for rollback points (no feature flags needed)

#### Component Testing Exclusion
- Focus testing on ViewModels and Services only (>80% coverage target)
- Component testing infrastructure excluded for initial implementation
- Integration tests for critical user workflows maintained

### 6. Performance Requirements

#### Bundle Size Constraints
- Bundle size increase under 15% from current state
- Component render times under 100ms
- Initial page load under 2 seconds
- Memory usage stable during extended sessions

#### State Optimization  
- Use $derived.by() for expensive computations
- Simple scrollback limits instead of virtual scrolling (10,000 line limit)
- Batch WebSocket message updates (16ms intervals for 60fps)

## Approach

### Phase 1: Foundation 
1. Create BaseViewModel.svelte.js with common patterns
2. Implement foundation component library (Button, Input, Modal, etc.)
3. Set up custom validation logic in services (no external dependencies)
4. Create AppContext.svelte.js for global state
5. Implement SocketService wrapper for Socket.IO communication

### Phase 2: Projects Component Decomposition
1. Create ProjectViewModel.svelte.js with full project management logic
2. Break Projects.svelte into 6 focused components:
   - ProjectManager.svelte (container with ViewModel)
   - ProjectList.svelte (presentation)
   - ProjectCard.svelte (individual project)
   - ProjectForm.svelte (create/edit)
   - ProjectHeader.svelte (navigation)
   - ProjectActions.svelte (operations)
3. Integrate with foundation components
4. Wire up validation and error handling

### Phase 3: Remaining God Components 
1. Decompose CommandMenu.svelte using CommandMenuViewModel.svelte.js
2. Break down DirectoryPicker.svelte with DirectoryPickerViewModel.svelte.js
3. Refactor KeyboardToolbar.svelte with proper state management
4. Enhance existing TerminalViewModel.svelte.js

### Phase 4: Integration & Testing 
1. Wire all ViewModels into AppContext system
2. Implement ViewModel and Service unit tests
3. Update integration tests for new architecture
4. Performance testing and optimization

### Implementation Patterns

#### ViewModel Structure
```javascript
// BaseViewModel.svelte.js
export class BaseViewModel {
  #isLoading = $state(false);
  #error = $state(null);
  #validationErrors = $state({});
  
  get isLoading() { return this.#isLoading; }
  get error() { return this.#error; }
  get validationErrors() { return this.#validationErrors; }
  
  setLoading(loading) { this.#isLoading = loading; }
  setError(error) { this.#error = error; }
  setValidationErrors(errors) { this.#validationErrors = errors; }
  
  clearError() { this.#error = null; }
  clearValidation() { this.#validationErrors = {}; }
}
```

#### Component-ViewModel Integration
```svelte
<!-- ProjectManager.svelte -->
<script>
  import { ProjectViewModel } from '$lib/viewmodels/ProjectViewModel.svelte.js';
  import { ProjectService } from '$lib/services/ProjectService.js';
  
  const projectService = new ProjectService();
  const viewModel = new ProjectViewModel(projectService);
  
  // Reactive properties automatically update UI
  const { projects, isLoading, error } = viewModel;
</script>

{#if isLoading}
  <LoadingSpinner />
{:else if error}
  <ErrorDisplay message={error} />
{:else}
  <ProjectList {projects} onselect={viewModel.selectProject} />
{/if}
```

#### Service Layer Pattern
```javascript
// ProjectService.js - Pure business logic with Socket.IO
export class ProjectService {
  constructor(socketService) {
    this.socketService = socketService;
  }
  
  async getProjects() {
    return new Promise((resolve, reject) => {
      this.socketService.emit('listProjects', (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.projects || []);
        }
      });
    });
  }
  
  async createProject(projectData) {
    const validation = this.validateProject(projectData);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }
    
    return new Promise((resolve, reject) => {
      this.socketService.emit('createProject', projectData, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.project);
        }
      });
    });
  }
  
  async deleteProject(projectId) {
    return new Promise((resolve, reject) => {
      this.socketService.emit('deleteProject', { projectId }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.success);
        }
      });
    });
  }
  
  validateProject(data) {
    // Custom validation logic (no external dependencies)
    const errors = {};
    
    // Name validation
    if (!data.name || typeof data.name !== 'string') {
      errors.name = 'Project name is required';
    } else if (data.name.trim().length === 0) {
      errors.name = 'Project name cannot be empty';
    } else if (data.name.length > 50) {
      errors.name = 'Project name must be 50 characters or less';
    } else if (!/^[a-zA-Z0-9\s_-]+$/.test(data.name)) {
      errors.name = 'Project name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    
    // Description validation (optional)
    if (data.description && data.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}

// SocketService.js - Socket.IO wrapper
export class SocketService {
  constructor(socket) {
    this.socket = socket;
  }
  
  emit(event, data, callback) {
    if (typeof data === 'function') {
      // Handle case where data is actually the callback
      this.socket.emit(event, data);
    } else {
      this.socket.emit(event, data, callback);
    }
  }
  
  on(event, handler) {
    this.socket.on(event, handler);
  }
  
  off(event, handler) {
    this.socket.off(event, handler);
  }
  
  get connected() {
    return this.socket.connected;
  }
}

// ValidationError.js - Custom error class
export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
```

## External Dependencies

### New Development Dependencies
```json
{
  "devDependencies": {    
    "vitest": "^1.0.4",    // Unit testing framework
    "jsdom": "^23.0.1"     // DOM environment for testing  
  }
}
```

### Dependency Analysis

- **Vitest**: Fast, Vite-native testing, built for modern ES modules
- **jsdom**: Standard DOM environment for Node.js testing

**Dependencies Explicitly Excluded**:
- **No Joi**: Custom validation logic eliminates external validation dependencies
- **No Svelte testing library**: Components won't be tested initially (focus on ViewModels/Services)
- **No virtual scrolling dependencies**: Keep lists simple with standard {#each}
- **No complex DI containers**: Use simple constructor injection
- **No additional UI libraries**: Build foundation components from existing patterns

### Bundle Impact Assessment
- **Expected bundle size increase**: <10KB after tree-shaking
- **Performance impact**: Negligible, validation runs only on form submission