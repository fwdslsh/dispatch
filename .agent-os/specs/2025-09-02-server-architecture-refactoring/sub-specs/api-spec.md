# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-02-server-architecture-refactoring/spec.md

VERY IMPORTANT: Interfaces are shown as an example, use JSDoc instead of TypeScript

## Socket.IO Event Handlers

The refactored architecture will maintain the existing Socket.IO API contract while implementing improved internal organization. All existing client events and server events will continue to function identically to ensure backward compatibility.

### Authentication Events

#### auth
**Purpose:** Authenticate client connection with terminal key  
**Handler:** AuthHandler  
**Parameters:** `(key: string, callback: Function)`  
**Response:** `{success: boolean, message?: string}`  
**Errors:** Invalid key, missing key, rate limit exceeded

### Session Management Events

#### create
**Purpose:** Create new PTY session with project context  
**Handler:** SessionHandler  
**Parameters:** `(opts: {mode: string, cols: number, rows: number, meta?: object, project?: string}, callback: Function)`  
**Response:** `{success: boolean, sessionId?: string, error?: string}`  
**Errors:** Invalid parameters, project not found, PTY creation failure

#### attach
**Purpose:** Attach to existing session  
**Handler:** SessionHandler  
**Parameters:** `(opts: {sessionId: string, cols: number, rows: number}, callback: Function)`  
**Response:** `{success: boolean, session?: object, error?: string}`  
**Errors:** Session not found, invalid dimensions, permission denied

#### list
**Purpose:** Get all accessible sessions  
**Handler:** SessionHandler  
**Parameters:** `(callback: Function)`  
**Response:** `{sessions: Array<SessionMetadata>}`  
**Errors:** None (always succeeds with empty array)

#### end
**Purpose:** Terminate session and cleanup resources  
**Handler:** SessionHandler  
**Parameters:** `(sessionId?: string)`  
**Response:** `{success: boolean, error?: string}`  
**Errors:** Session not found, cleanup failure

### Project Management Events

#### listProjects
**Purpose:** Get all accessible projects  
**Handler:** ProjectHandler  
**Parameters:** `(callback: Function)`  
**Response:** `{projects: Array<ProjectMetadata>}`  
**Errors:** Storage access failure

### Terminal I/O Events

#### input
**Purpose:** Send input data to attached session  
**Handler:** TerminalIOHandler  
**Parameters:** `(data: string)`  
**Response:** None (fire-and-forget)  
**Errors:** No attached session, session terminated

#### resize
**Purpose:** Resize terminal dimensions  
**Handler:** TerminalIOHandler  
**Parameters:** `(dims: {cols: number, rows: number})`  
**Response:** None (fire-and-forget)  
**Errors:** Invalid dimensions, no attached session

#### detach
**Purpose:** Detach from session without termination  
**Handler:** TerminalIOHandler  
**Parameters:** None  
**Response:** None (fire-and-forget)  
**Errors:** No attached session

### Claude Authentication Events

#### start-claude-auth
**Purpose:** Initiate Claude OAuth authentication flow  
**Handler:** ClaudeAuthHandler  
**Parameters:** `(callback: Function)`  
**Response:** `{success: boolean, authUrl?: string, error?: string}`  
**Errors:** OAuth service unavailable, configuration missing

#### submit-claude-token
**Purpose:** Complete Claude authentication with OAuth token  
**Handler:** ClaudeAuthHandler  
**Parameters:** `(tokenData: object, callback: Function)`  
**Response:** `{success: boolean, error?: string}`  
**Errors:** Invalid token, OAuth verification failure

## Router Implementation

### SocketRouter Class

The SocketRouter will dispatch events to appropriate handlers while maintaining the existing API contract:

```javascript
class SocketRouter {
  constructor(handlers, middlewares) {
    this.handlers = handlers;
    this.middlewares = middlewares;
  }
  
  async route(eventName, socket, ...args) {
    // Apply middleware chain (auth, validation, rate limiting)
    // Dispatch to appropriate handler
    // Handle response formatting and error handling
  }
}
```

### Handler Interface

All handlers will implement a consistent interface:

```javascript
interface EventHandler {
  canHandle(eventName: string): boolean;
  execute(socket: Socket, ...args: any[]): Promise<any>;
  validate(args: any[]): ValidationResult;
}
```

### Middleware Chain

Authentication and validation will be applied consistently:

1. **AuthenticationMiddleware** - Verify terminal key for protected operations
2. **ValidationMiddleware** - Validate input parameters and formats  
3. **RateLimitMiddleware** - Apply rate limiting rules per connection
4. **LoggingMiddleware** - Log events for debugging and monitoring

## Internal Service APIs

### StorageService Interface

```javascript
interface StorageService {
  // Session operations
  createSession(sessionData: SessionMetadata): Promise<string>;
  getSession(sessionId: string): Promise<SessionMetadata | null>;
  updateSession(sessionId: string, updates: Partial<SessionMetadata>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<SessionMetadata[]>;
  
  // Project operations  
  createProject(projectData: ProjectMetadata): Promise<string>;
  getProject(projectId: string): Promise<ProjectMetadata | null>;
  updateProject(projectId: string, updates: Partial<ProjectMetadata>): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  listProjects(): Promise<ProjectMetadata[]>;
}
```

### SessionService Interface

```javascript
interface SessionService {
  createSession(options: CreateSessionOptions): Promise<Session>;
  attachToSession(sessionId: string, socket: Socket): Promise<void>;
  terminateSession(sessionId: string): Promise<void>;
  resizeSession(sessionId: string, dimensions: TerminalDimensions): Promise<void>;
  sendInput(sessionId: string, data: string): Promise<void>;
}
```

The refactored API maintains complete backward compatibility while providing a cleaner, more maintainable internal structure that follows established software engineering principles.