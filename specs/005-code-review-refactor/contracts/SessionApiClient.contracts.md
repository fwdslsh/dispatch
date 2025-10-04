# SessionApiClient Module Contracts

**Feature**: Code Review Refactor (005)
**Purpose**: Define interfaces for SessionApiClient module split (FR-004)

## Overview

The SessionApiClient will be split into three cohesive modules:

- **queries.js**: Read operations
- **mutations.js**: Write operations
- **validation.js**: Input validation and sanitization

## Queries Module Interface

### `getAllSessions(filters?: SessionFilters): Promise<Session[]>`

**Purpose**: Retrieve all sessions, optionally filtered

**Parameters**:

- `filters` (optional): Filter criteria
  - `type?: string` - Session type (e.g., 'pty', 'claude')
  - `workspacePath?: string` - Filter by workspace
  - `status?: 'running' | 'stopped' | 'error'`

**Returns**: `Promise<Session[]>` - Array of session objects

**Example**:

```javascript
const sessions = await getAllSessions({ type: 'pty', status: 'running' });
```

### `getSession(id: string): Promise<Session>`

**Purpose**: Retrieve single session by ID

**Parameters**:

- `id` (required): Session ID string

**Returns**: `Promise<Session>` - Session object

**Throws**: Error if session not found

**Example**:

```javascript
const session = await getSession('session-123');
```

### `getSessionEvents(id: string, fromSeq?: number): Promise<Event[]>`

**Purpose**: Retrieve event log for session (for replay/debugging)

**Parameters**:

- `id` (required): Session ID string
- `fromSeq` (optional): Start sequence number (for incremental fetching)

**Returns**: `Promise<Event[]>` - Array of event objects

**Example**:

```javascript
const events = await getSessionEvents('session-123', 100);
```

### `getWorkspaceSessions(workspaceId: string): Promise<Session[]>`

**Purpose**: Retrieve all sessions for a specific workspace

**Parameters**:

- `workspaceId` (required): Workspace ID/path

**Returns**: `Promise<Session[]>` - Array of session objects

**Example**:

```javascript
const sessions = await getWorkspaceSessions('/workspace/my-project');
```

---

## Mutations Module Interface

### `createSession(data: CreateSessionData): Promise<Session>`

**Purpose**: Create new session

**Parameters**:

- `data` (required): Session creation data
  - `type: string` - Session type ('pty', 'claude', etc.)
  - `workspacePath: string` - Workspace path
  - `options?: object` - Type-specific options

**Returns**: `Promise<Session>` - Created session object

**Example**:

```javascript
const session = await createSession({
	type: 'pty',
	workspacePath: '/workspace/my-project',
	options: { shell: '/bin/bash' }
});
```

### `updateSession(id: string, updates: Partial<Session>): Promise<Session>`

**Purpose**: Update session metadata

**Parameters**:

- `id` (required): Session ID string
- `updates` (required): Partial session object with fields to update

**Returns**: `Promise<Session>` - Updated session object

**Example**:

```javascript
const session = await updateSession('session-123', { name: 'New Name' });
```

### `deleteSession(id: string): Promise<void>`

**Purpose**: Delete session and cleanup resources

**Parameters**:

- `id` (required): Session ID string

**Returns**: `Promise<void>`

**Example**:

```javascript
await deleteSession('session-123');
```

### `sendInput(id: string, input: string): Promise<void>`

**Purpose**: Send input to running session

**Parameters**:

- `id` (required): Session ID string
- `input` (required): Input string to send

**Returns**: `Promise<void>`

**Example**:

```javascript
await sendInput('session-123', 'ls -la\n');
```

### `closeSession(id: string): Promise<void>`

**Purpose**: Gracefully close session

**Parameters**:

- `id` (required): Session ID string

**Returns**: `Promise<void>`

**Example**:

```javascript
await closeSession('session-123');
```

---

## Validation Module Interface

### `validateSessionData(data: unknown): ValidationResult<CreateSessionData>`

**Purpose**: Validate session creation data

**Parameters**:

- `data` (required): Unknown data to validate

**Returns**: `ValidationResult<CreateSessionData>`

```typescript
{
  success: boolean
  data?: CreateSessionData  // If valid
  error?: string            // If invalid
}
```

**Example**:

```javascript
const result = validateSessionData({ type: 'pty', workspacePath: '/workspace' });
if (result.success) {
	// result.data is typed CreateSessionData
}
```

### `validateSessionId(id: unknown): ValidationResult<string>`

**Purpose**: Validate session ID format

**Parameters**:

- `id` (required): Unknown value to validate as session ID

**Returns**: `ValidationResult<string>`

**Validation Rules**:

- Must be non-empty string
- Must match pattern: `^[a-zA-Z0-9-_]+$`

**Example**:

```javascript
const result = validateSessionId('session-123');
if (result.success) {
	// result.data is valid session ID string
}
```

### `validateSessionFilters(filters: unknown): ValidationResult<SessionFilters>`

**Purpose**: Validate session filter object

**Parameters**:

- `filters` (required): Unknown value to validate as filters

**Returns**: `ValidationResult<SessionFilters>`

**Example**:

```javascript
const result = validateSessionFilters({ type: 'pty', status: 'running' });
```

### `sanitizeInput(input: string): string`

**Purpose**: Sanitize user input before sending to session

**Parameters**:

- `input` (required): Raw input string

**Returns**: `string` - Sanitized input

**Sanitization Rules**:

- Trim whitespace
- Escape dangerous characters
- Limit length to reasonable max (e.g., 10,000 chars)

**Example**:

```javascript
const safe = sanitizeInput(userInput);
await sendInput(sessionId, safe);
```

---

## Shared Types

### Session

```typescript
interface Session {
	id: string;
	type: 'pty' | 'claude' | 'file-editor';
	workspacePath: string;
	status: 'running' | 'stopped' | 'error';
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
	metadata?: object; // Type-specific metadata
}
```

### CreateSessionData

```typescript
interface CreateSessionData {
	type: string;
	workspacePath: string;
	options?: object;
}
```

### SessionFilters

```typescript
interface SessionFilters {
	type?: string;
	workspacePath?: string;
	status?: 'running' | 'stopped' | 'error';
}
```

### Event

```typescript
interface Event {
	id: string;
	sessionId: string;
	sequence: number;
	type: string;
	payload: object;
	timestamp: string; // ISO timestamp
}
```

### ValidationResult<T>

```typescript
interface ValidationResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}
```

---

## Backward Compatibility

### Facade Pattern

The `SessionApiClient.js` file will serve as a facade during transition:

```javascript
// SessionApiClient.js
export * from './session-api/queries.js';
export * from './session-api/mutations.js';
export * from './session-api/validation.js';
```

**Migration Path**:

1. Existing imports continue working: `import { getAllSessions } from '$lib/client/shared/services/SessionApiClient.js'`
2. New code uses specific modules: `import { getAllSessions } from '$lib/client/shared/services/session-api/queries.js'`
3. Eventually remove facade after all consumers updated

---

## Testing Strategy

### Contract Tests

Each module will have contract tests validating:

- Function exports exist
- Function signatures match contracts
- Return types are correct (Promise, ValidationResult, etc.)

### Integration Tests

Existing SessionApiClient tests will be updated to:

- Import from new module paths
- Validate same behavior as before split
- Ensure no regressions

---

## Error Handling

All async functions follow standardized error handling pattern (per FR-007):

```javascript
async function getAllSessions(filters) {
	try {
		const response = await fetch('/api/sessions', {
			/* ... */
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		return await response.json();
	} catch (error) {
		console.error('getAllSessions failed:', error);
		throw error; // Re-throw for caller to handle
	}
}
```

**Validation functions** return `ValidationResult` instead of throwing:

```javascript
function validateSessionId(id) {
	if (typeof id !== 'string' || id.trim() === '') {
		return { success: false, error: 'Session ID must be non-empty string' };
	}
	if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
		return { success: false, error: 'Session ID contains invalid characters' };
	}
	return { success: true, data: id };
}
```
