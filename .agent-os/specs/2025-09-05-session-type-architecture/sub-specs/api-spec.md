# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-05-session-type-architecture/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## WebSocket API Extensions

> **Note**: This is greenfield development - session types are statically defined at build time. The client application has all session type information available through static imports and does not need to query the server for session type discovery or management.

### 1. Session Type Architecture

#### Static Session Type Registration

**Build-time Registration**: Session types are registered statically during application startup:

```javascript
// Session types available at build time
const AVAILABLE_SESSION_TYPES = {
  'shell': {
    id: 'shell',
    name: 'Shell Terminal', 
    description: 'Standard shell terminal session',
    category: 'terminal',
    namespace: '/shell',
    requiresProject: false,
    supportsAttachment: true,
    defaultOptions: {
      shell: '/bin/bash',
      cols: 80,
      rows: 24
    }
  },
  'claude': {
    id: 'claude',
    name: 'Claude Code',
    description: 'AI-assisted development session', 
    category: 'development',
    namespace: '/claude',
    requiresProject: true,
    supportsAttachment: false,
    defaultOptions: {
      model: 'claude-3-sonnet',
      cols: 120,
      rows: 30
    }
  }
};
```

#### Client-side Session Type Management

**No Runtime Discovery**: Session types are not dynamic and do not require server-side listing or management. All session type information is available to the client at build time through static imports.

### 2. Session Creation Events

#### `createSession(options, callback)`

**Purpose**: Create a new session with type-specific parameters

**Request Parameters**:
```javascript
{
  type: 'shell',              // Required: session type ID
  name: 'Development Shell',  // Optional: custom session name
  projectId: 'proj_123',     // Optional: project context
  cols: 80,                  // Terminal dimensions
  rows: 24,
  customOptions: {           // Type-specific options
    shell: '/bin/zsh',
    env: {
      'EDITOR': 'vim'
    }
  }
}
```

**Response Format**:
```javascript
{
  success: true,
  session: {
    id: 'sess_abc123',
    name: 'Development Shell',
    type: 'shell',
    namespace: '/shell',
    status: 'active',
    created: '2025-09-05T10:30:00Z',
    projectId: 'proj_123',
    customData: {
      shell: '/bin/zsh',
      pid: 12345
    }
  }
}
```

**Error Responses**:
```javascript
// Invalid session type
{
  success: false,
  error: 'Unknown session type: invalid_type',
  code: 'UNKNOWN_SESSION_TYPE'
}

// Validation failed
{
  success: false,
  error: 'Validation failed: project required for session type',
  code: 'VALIDATION_ERROR',
  details: {
    field: 'projectId',
    message: 'Project ID is required for Claude sessions'
  }
}

// Creation failed
{
  success: false,
  error: 'Failed to create session: insufficient resources',
  code: 'CREATION_ERROR'
}
```

### 3. Session Type WebSocket Namespaces

Each session type operates within its own Socket.IO namespace to prevent event conflicts and enable type-specific message handling.

#### Namespace Pattern

- **Shell sessions**: `/shell`
- **Claude sessions**: `/claude`  
- **Custom types**: `/{typeId}`

#### Namespace-Specific Events

##### Shell Namespace (`/shell`)

**Client Events**:
- `connect()` - Connect to shell namespace
- `input(data)` - Send terminal input
- `resize(dims)` - Resize terminal `{cols, rows}`

**Server Events**:
- `output(data)` - Terminal output

##### Claude Namespace (`/claude`)

**Client Events**:
- `connect()` - Connect to Claude namespace
- `login` - Login to Claude Code
- `sendMessage(message)` - Send message to Claude
- `getCommands()` - Request a list of available commands

**Server Events**:
- `authenticated` - Confirms user is authenticated to Claude Code
- `message(data)` - Claude response message
- `commands(list of commands)` - Returns all commands registered with Claude code

### 4. Session Management Events

#### `attachToSession(options, callback)`

**Purpose**: Attach to existing typed session with namespace context

**Request Parameters**:
```javascript
{
  sessionId: 'sess_abc123',
  type: 'shell',           // Session type for namespace routing
  cols: 120,               // Current terminal dimensions
  rows: 40
}
```

**Response Format**:
```javascript
{
  success: true,
  session: {
    id: 'sess_abc123',
    type: 'shell',
    namespace: '/shell',
    status: 'active',
    attachedAt: '2025-09-05T10:35:00Z'
  },
  namespaceSocket: '/shell'  // Namespace to connect to
}
```

#### `detachFromSession(callback)`

**Purpose**: Detach from current session while keeping it active

**Response Format**:
```javascript
{
  success: true,
  detachedAt: '2025-09-05T10:40:00Z'
}
```

#### `getSessionInfo(sessionId, callback)`

**Purpose**: Get session information and metadata via WebSocket

**Request Parameters**:
```javascript
{
  sessionId: 'sess_abc123'
}
```

**Response Format**:
```javascript
{
  success: true,
  session: {
    id: 'sess_abc123',
    type: 'shell',
    namespace: '/shell',
    status: 'active',
    created: '2025-09-05T10:30:00Z',
    projectId: 'proj_123',
    customData: {
      shell: '/bin/zsh',
      pid: 12345
    }
  }
}
```

## WebSocket-Only Architecture

> **Important**: This is greenfield development with **no REST API endpoints**. All session management, creation, and communication is handled exclusively through WebSocket connections. Session types are statically defined at build time and do not require runtime discovery or management.

## Greenfield Development

> **Architecture Decision**: This is greenfield development with no backward compatibility requirements. Session types are statically registered at build time, eliminating the need for:
> 
> - Runtime session type discovery
> - Dynamic session type management
> - REST API endpoints for session type operations
> - Server-side session type listing
> 
> All session type information is available to the client application through static imports and conditional rendering.

## Error Handling Standards

### Error Response Format

All API responses use consistent error format:

```javascript
{
  success: false,
  error: 'Human-readable error message',
  code: 'MACHINE_READABLE_CODE',
  details: {
    field: 'problematic_field',
    value: 'invalid_value',
    expected: 'valid_format'
  },
  timestamp: '2025-09-05T10:45:00Z'
}
```

### Error Codes

- `UNKNOWN_SESSION_TYPE` - Invalid session type ID
- `VALIDATION_ERROR` - Session creation validation failed
- `CREATION_ERROR` - Session creation process failed
- `NAMESPACE_ERROR` - WebSocket namespace operation failed
- `ATTACHMENT_ERROR` - Session attachment failed
- `REGISTRY_ERROR` - Session type registry operation failed
- `AUTH_ERROR` - Authentication failed for namespace
- `RESOURCE_ERROR` - Insufficient resources for session creation

## Security Considerations

### Namespace Isolation

- Each session type operates in isolated Socket.IO namespace
- Cross-namespace message injection prevented by namespace boundaries
- Session type registration requires administrative privileges

### Authentication Per Namespace

- Each namespace requires separate authentication
- Terminal key validated before namespace operations


## Performance Implications

### Namespace Overhead

- Each session type creates separate Socket.IO namespace
- Memory usage: ~50KB per active namespace
- CPU overhead: Minimal (handled by Socket.IO routing)

### Registry Performance

- Session type lookup: O(1) via Map data structure
- Type validation: O(n) where n is number of required fields

### WebSocket Connection Scaling

- Multiple namespace connections per client supported
- Connection limit: Standard Socket.IO limits apply per namespace
- Resource cleanup: Automatic when client disconnects from namespace
