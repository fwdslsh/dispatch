# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-session-type-architecture/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Technical Requirements

### 1. Session Type Interface Definition

Each session type must extend a core base class that provides:

```typescript
class SessionType {
  // Metadata
  id: string;           // Unique identifier (e.g., 'shell', 'claude', 'jupyter')
  name: string;         // Human-readable name
  description: string;  // Brief description for UI
  version: string;      // Version for compatibility
  category: string;     // Category for grouping ('terminal', 'development', 'analysis')
  
  // Behavioral configuration
  requiresProject: boolean;              // Whether project selection is mandatory
  supportsResume: boolean;           // Whether existing sessions can be resumed or are removed when they end
  defaultOptions: Record<string, any>;   // Default creation options
  
  // WebSocket namespace
  namespace: string;                     // Socket.IO namespace (e.g., '/shell', '/claude')
  
  // Lifecycle hooks
  onCreate?(options: SessionCreationOptions,  socket: Socket): Promise<SessionMetadata>;
  onAttach?(sessionId: string, socket: Socket): Promise<boolean>;
  onDestroy?(sessionId: string): Promise<void>;
  validate?(options: SessionCreationOptions): ValidationResult;
}

// Note: Components are referenced via conditional rendering rather than direct component references
// This allows for better build-time optimization and tree shaking

class SessionCreationOptions {
  name?: string;
  projectId?: string;
  workingDirectory?: string;
  cols?: number;
  rows?: number;
  customOptions?: Record<string, any>;
}

class SessionMetadata {
  id: string;
  name: string;
  type: string;
  projectId?: string;
  status: 'active' | 'inactive' | 'error';
  created: string;
  customData?: Record<string, any>;
}
```

### 2. Session Type Registry Architecture

#### Registry Implementation

Create `src/lib/session-types/registry.js` as the central registry:

```javascript
class SessionTypeRegistry {
  constructor() {
    this.types = new Map();
    this.initialized = false;
  }
  
  register(sessionType) {
    if (!this.validateSessionType(sessionType)) {
      throw new Error(`Invalid session type: ${sessionType.id}`);
    }
    
    this.types.set(sessionType.id, sessionType);
    console.log(`Registered session type: ${sessionType.id}`);
  }
  
  get(typeId) {
    return this.types.get(typeId);
  }
  
  list() {
    return Array.from(this.types.values());
  }
  
  getByCategory(category) {
    return this.list().filter(type => type.category === category);
  }
  
  validateSessionType(sessionType) {
    const required = ['id', 'name', 'namespace'];
    return required.every(field => sessionType[field] !== undefined);
  }
}

export const sessionTypeRegistry = new SessionTypeRegistry();
```

#### Manual Registration System

Session types are manually registered during application startup in `src/lib/session-types/index.js`:

```javascript
import { sessionTypeRegistry } from './registry.js';
import { shellSessionType } from './shell/index.js';
import { claudeSessionType } from './claude/index.js';
// Import additional session types here for static bundling

// Manual registration - explicit and controlled
export function initializeSessionTypes() {
  sessionTypeRegistry.register(shellSessionType);
  sessionTypeRegistry.register(claudeSessionType);
  
  // Future session types would be added here manually
  // sessionTypeRegistry.register(jupyterSessionType);
  // sessionTypeRegistry.register(dockerSessionType);
  
  console.log(`Initialized ${sessionTypeRegistry.list().length} session types`);
}

// Static exports for build-time optimization
export { sessionTypeRegistry };
export { shellSessionType, claudeSessionType };
```

### 3. Folder Structure Implementation

#### Directory Layout

```
src/lib/session-types/
├── index.js                    # Registry initialization and exports
├── registry.js                 # Core registry implementation
├── base/                       # Base classes and utilities
│   ├── BaseSessionType.js      # Abstract base class
│   ├── BaseCreationForm.svelte # Base creation form component
│   └── BaseSessionView.svelte  # Base session view component
├── shell/                      # Shell/Terminal session type
│   ├── index.js               # Shell session type definition
│   ├── ShellCreationForm.svelte
│   ├── ShellSessionView.svelte
│   ├── handlers/              # WebSocket event handlers
│   │   ├── ShellHandler.js
│   │   └── ShellIOHandler.js
│   └── utils/
│       └── shellCommands.js
├── claude/                     # Claude Code session type
│   ├── index.js               # Claude session type definition
│   ├── ClaudeCreationForm.svelte
│   ├── ClaudeSessionView.svelte
│   ├── handlers/
│   │   ├── ClaudeHandler.js
│   │   └── ClaudeAuthHandler.js
│   └── utils/
│       └── claudeCommands.js
└── shared/                     # Shared utilities across session types
    ├── SessionTypeUtils.js
    ├── ValidationUtils.js
    └── components/
        ├── ProjectSelector.svelte
        └── WorkingDirectoryPicker.svelte
```

#### Base Class Implementation

Create `src/lib/session-types/base/BaseSessionType.js`:

```javascript
export class BaseSessionType {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.version = config.version || '1.0.0';
    this.category = config.category || 'general';
    this.namespace = config.namespace || `/${this.id}`;
    this.requiresProject = config.requiresProject ?? true;
    this.supportsAttachment = config.supportsAttachment ?? true;
    this.defaultOptions = config.defaultOptions || {};
  }
  
  // Default implementations that can be overridden
  async onCreate(options, socket) {
    throw new Error('onCreate must be implemented by session type');
    // Configures settings based on options and registers socket listeners
  }
  
  async onAttach(sessionId, socket) {
    return false; // Default: attachment not supported
  }
  
  async onDestroy(sessionId) {
    // Remove any event listeners and save any session data that is session type needs to persist
  }
  
  validate(options) {
    return { valid: true, errors: [] };
  }
}
```

### 4. WebSocket Namespace Isolation

#### Namespace Configuration

Extend the Socket.IO server setup in `src/lib/server/socket-handler.js`:

```javascript
import { sessionTypeRegistry } from '../session-types/index.js';
import { createShellHandlers } from '../session-types/shell/handlers/index.js';
import { createClaudeHandlers } from '../session-types/claude/handlers/index.js';

// Static handler map for build-time optimization
const SESSION_TYPE_HANDLERS = {
  'shell': createShellHandlers,
  'claude': createClaudeHandlers
  // Add new session types here with static imports
};

function createNamespacedSocketHandler(io) {
  // Main namespace handler (existing functionality)
  const mainHandler = createSocketHandler(io);
  io.on('connection', mainHandler);
  
  // Create isolated namespaces for each session type
  for (const sessionType of sessionTypeRegistry.list()) {
    const namespace = io.of(sessionType.namespace);
    const namespaceHandler = createSessionTypeHandler(sessionType, namespace);
    namespace.on('connection', namespaceHandler);
    
    console.log(`Created namespace ${sessionType.namespace} for ${sessionType.name}`);
  }
}

function createSessionTypeHandler(sessionType, namespace) {
  return (socket) => {
    console.log(`Socket connected to ${sessionType.namespace}:`, socket.id);
    
    // Get statically imported handler factory
    const createHandlers = SESSION_TYPE_HANDLERS[sessionType.id];
    if (!createHandlers) {
      console.error(`No handler factory found for session type: ${sessionType.id}`);
      socket.disconnect();
      return;
    }
    
    try {
      const handlers = createHandlers(sessionType, namespace, socket);
      
      // Register all handlers for this session type
      for (const [eventName, handler] of Object.entries(handlers)) {
        socket.on(eventName, handler);
      }
    } catch (err) {
      console.error(`Failed to create handlers for ${sessionType.id}:`, err);
      socket.disconnect();
    }
    
    // Standard cleanup
    socket.on('disconnect', () => {
      console.log(`Socket disconnected from ${sessionType.namespace}:`, socket.id);
    });
  };
}
```

#### Session Type Handler Pattern

Each session type provides its own handlers in `session-types/{type}/handlers/index.js`:

```javascript
// Example: src/lib/session-types/shell/handlers/index.js
export function createHandlers(sessionType, namespace, socket) {
  return {
    'create-session': async (options, callback) => {
      try {
        const session = await sessionType.onCreate(options);
        callback({ success: true, session });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    },
    
    'attach-session': async (sessionId, callback) => {
      try {
        const attached = await sessionType.onAttach(sessionId, socket);
        callback({ success: attached });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    },
    
    'shell-input': (data) => {
      // Shell-specific input handling
      const sessionId = socket.sessionId;
      if (sessionId) {
        terminalManager.sendInput(sessionId, data);
      }
    },
    
    'shell-resize': (dimensions) => {
      // Shell-specific resize handling
      const sessionId = socket.sessionId;
      if (sessionId && dimensions.cols && dimensions.rows) {
        terminalManager.resize(sessionId, dimensions.cols, dimensions.rows);
      }
    }
  };
}
```

### 5. Pluggable UI Component Architecture

#### Type Picker Interface

Create `src/lib/components/session-creation/TypePicker.svelte`:

```svelte
<script>
  import { sessionTypeRegistry } from '../../session-types/index.js';
  import ShellIcon from '../../session-types/shell/ShellIcon.svelte';
  import ClaudeIcon from '../../session-types/claude/ClaudeIcon.svelte';
  
  let { onTypeSelected = () => {} } = $props();
  
  let sessionTypes = $state([]);
  let selectedType = $state(null);
  
  $effect(() => {
    sessionTypes = sessionTypeRegistry.list();
  });
  
  function selectType(type) {
    selectedType = type;
    onTypeSelected(type);
  }
</script>

<div class="type-picker">
  <h3>Select Session Type</h3>
  
  {#each sessionTypes as type}
    <div 
      class="type-option" 
      class:selected={selectedType?.id === type.id}
      onclick={() => selectType(type)}
    >
      {#if type.id === 'shell'}
        <ShellIcon />
      {:else if type.id === 'claude'}
        <ClaudeIcon />
      {:else}
        <div class="default-icon">{type.name.charAt(0)}</div>
      {/if}
      
      <div class="type-info">
        <h4>{type.name}</h4>
        <p>{type.description}</p>
        <span class="category">{type.category}</span>
      </div>
    </div>
  {/each}
</div>
```

#### Static Creation Forms

Create `src/lib/components/session-creation/CreationFormContainer.svelte`:

```svelte
<script>
  import ShellCreationForm from '../../session-types/shell/ShellCreationForm.svelte';
  import ClaudeCreationForm from '../../session-types/claude/ClaudeCreationForm.svelte';
  
  let { 
    sessionType = null, 
    onSessionCreated = () => {},
    onCancel = () => {} 
  } = $props();
  
  let formData = $state({});
  let isCreating = $state(false);
  let error = $state(null);
  
  async function createSession() {
    if (!sessionType) return;
    
    isCreating = true;
    error = null;
    
    try {
      // Validate form data
      const validation = sessionType.validate(formData);
      if (!validation.valid) {
        error = validation.errors.join(', ');
        return;
      }
      
      // Create session using session type's onCreate method
      const session = await sessionType.onCreate(formData);
      onSessionCreated(session);
    } catch (err) {
      error = err.message;
    } finally {
      isCreating = false;
    }
  }
  
  function updateFormData(data) {
    formData = { ...formData, ...data };
  }
</script>

{#if sessionType}
  <div class="creation-form-container">
    <div class="form-header">
      <h3>Create {sessionType.name} Session</h3>
      <p>{sessionType.description}</p>
    </div>
    
    <!-- Conditionally render session type creation forms -->
    {#if sessionType.id === 'shell'}
      <ShellCreationForm 
        initialData={sessionType.defaultOptions}
        onDataChange={updateFormData}
      />
    {:else if sessionType.id === 'claude'}
      <ClaudeCreationForm 
        initialData={sessionType.defaultOptions}
        onDataChange={updateFormData}
      />
    {:else}
      <div class="unsupported-type">
        <p>Session type '{sessionType.id}' creation form not implemented.</p>
      </div>
    {/if}
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <div class="form-actions">
      <button onclick={onCancel} disabled={isCreating}>Cancel</button>
      <button onclick={createSession} disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Session'}
      </button>
    </div>
  </div>
{/if}
```

#### Session Component Rendering

Update main session view to conditionally render session type components:

```svelte
<!-- src/routes/sessions/[id]/+page.svelte -->
<script>
  import { sessionTypeRegistry } from '$lib/session-types/index.js';
  import ShellSessionView from '$lib/session-types/shell/ShellSessionView.svelte';
  import ClaudeSessionView from '$lib/session-types/claude/ClaudeSessionView.svelte';
  import Terminal from '$lib/components/Terminal.svelte'; // Fallback component
  
  let { data } = $props();
  let { session } = data;
  
  let sessionType = $derived(
    session ? sessionTypeRegistry.get(session.type) : null
  );
</script>

<!-- Conditionally render session type components -->
{#if session?.type === 'shell'}
  <ShellSessionView 
    {session}
    socket={data.socket}
    projectId={session.projectId}
  />
{:else if session?.type === 'claude'}
  <ClaudeSessionView 
    {session}
    socket={data.socket}
    projectId={session.projectId}
  />
{:else}
  <!-- Fallback to default terminal component -->
  <Terminal 
    socket={data.socket}
    sessionId={session?.id}
    projectId={session?.projectId}
  />
{/if}
```

### 6. Data Storage Integration

#### Extended Session Storage Schema

Extend the existing storage manager to support session type metadata:

```javascript
// Addition to src/lib/server/storage-manager.js

class StorageManager {
  // ... existing methods ...
  
  async addSessionToProject(projectId, sessionData) {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    // Enhanced session data with type-specific metadata
    const enhancedSession = {
      id: sessionData.id,
      name: sessionData.name || sessionData.id,
      type: sessionData.type || 'shell',
      status: sessionData.status || 'active',
      created: sessionData.created || new Date().toISOString(),
      pid: sessionData.pid,
      
      // Type-specific metadata storage
      typeMetadata: sessionData.typeMetadata || {},
      customOptions: sessionData.customOptions || {},
      
      // Namespace information
      namespace: sessionData.namespace,
      
      // Connection info
      lastAttached: sessionData.lastAttached,
      attachmentCount: sessionData.attachmentCount || 0
    };
    
    if (!project.sessions) {
      project.sessions = [];
    }
    
    // Remove existing session with same ID
    project.sessions = project.sessions.filter(s => s.id !== sessionData.id);
    
    // Add the enhanced session
    project.sessions.push(enhancedSession);
    
    await this.updateProject(projectId, { sessions: project.sessions });
    return enhancedSession;
  }
  
  getSessionsByType(type) {
    const allSessions = [];
    const projects = this.getProjects();
    
    for (const project of projects) {
      if (project.sessions) {
        const typeSessions = project.sessions
          .filter(session => session.type === type)
          .map(session => ({ ...session, projectId: project.id }));
        allSessions.push(...typeSessions);
      }
    }
    
    return allSessions;
  }
  
  updateSessionMetadata(sessionId, metadata) {
    const projects = this.getProjects();
    
    for (const project of projects) {
      if (project.sessions) {
        const sessionIndex = project.sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex >= 0) {
          project.sessions[sessionIndex] = {
            ...project.sessions[sessionIndex],
            ...metadata,
            updated: new Date().toISOString()
          };
          
          this.updateProject(project.id, { sessions: project.sessions });
          return project.sessions[sessionIndex];
        }
      }
    }
    
    return null;
  }
}
```

#### Session Type Specific Storage

Each session type can define its own storage requirements:

```javascript
// Example: src/lib/session-types/claude/storage.js
export class ClaudeSessionStorage {
  constructor(storageManager) {
    this.storage = storageManager;
  }
  
  async saveClaudeAuth(sessionId, authData) {
    return this.storage.updateSessionMetadata(sessionId, {
      typeMetadata: {
        ...this.getSessionTypeMetadata(sessionId),
        auth: {
          token: authData.token,
          expires: authData.expires,
          user: authData.user
        }
      }
    });
  }
  
  async getClaudeAuth(sessionId) {
    const session = this.storage.getSessionById(sessionId);
    return session?.typeMetadata?.auth || null;
  }
  
  getSessionTypeMetadata(sessionId) {
    const session = this.storage.getSessionById(sessionId);
    return session?.typeMetadata || {};
  }
}
```

### 7. Migration Strategy

#### Migration Plan Overview

1. **Phase 1**: Infrastructure Setup
   - Create session type registry and base classes
   - Set up folder structure
   - Implement namespace isolation framework

2. **Phase 2**: Shell Session Type Migration
   - Extract existing shell/terminal logic into Shell session type
   - Create ShellCreationForm and ShellSessionView components
   - Implement Shell-specific WebSocket handlers

3. **Phase 3**: Claude Session Type Migration  
   - Extract Claude Code logic into Claude session type
   - Create Claude-specific UI components
   - Implement Claude authentication and command handlers

4. **Phase 4**: Integration and Testing
   - Update main UI to use session type registry
   - Implement type picker and dynamic form rendering
   - Add backward compatibility layer for existing sessions

#### Backward Compatibility

Not needed, treat as greenfield development.

#### Terminal Manager Integration

Update TerminalManager to only be used with Terminal session types. Not all session types will need a PTY connection

## External Dependencies

- **Socket.IO Namespaces**: Leverage Socket.IO's built-in namespace isolation
- **Svelte 5 Dynamic Components**: Use `svelte:component` for dynamic UI rendering
- **ES Modules**: Utilize dynamic imports for session type handler loading
- **Existing Storage System**: Build upon current StorageManager and DirectoryManager

## Approach

### Development Sequence

1. **Foundation Layer**
   - Implement session type registry and base classes
   - Create folder structure and base components
   - Set up namespace isolation framework

2. **Reference Implementation**
   - Migrate Shell session type as first reference implementation
   - Create Shell-specific components and handlers
   - Test namespace isolation and conditional component rendering

3. **Second Implementation**
   - Migrate Claude session type using Shell as template
   - Implement Claude-specific authentication and UI
   - Validate session type interface completeness

4. **Integration Phase**
   - Update main UI components to use session type registry
   - Implement type picker and creation flow
   - Add comprehensive error handling and validation

5. **Migration and Compatibility**
   - Implement backward compatibility layer
   - Migrate existing sessions to new format
   - Performance optimization and cleanup

### Testing Strategy

- **Unit Tests**: Test each session type in isolation
- **Integration Tests**: Test namespace isolation and cross-type operations
- **UI Tests**: Test conditional component rendering and form validation
- **Performance Tests**: Ensure namespace isolation doesn't impact performance
