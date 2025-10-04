# ClaudePane Component Contracts

**Feature**: Code Review Refactor (005)
**Purpose**: Define interfaces for ClaudePane component extraction (FR-005)

## Overview

ClaudePane.svelte (~1,800 lines) will be extracted into:

- **ClaudePane.svelte**: Parent container (~200 lines)
- **ToolPanel.svelte**: Tool selection UI
- **TracePanel.svelte**: Trace/debug display
- **MessageList.svelte**: Message rendering
- **InputArea.svelte**: User input handling
- **ClaudePaneViewModel.svelte.js**: Shared state management

## Parent Component Contract

### ClaudePane.svelte

**Purpose**: Container component orchestrating child components

**Props**:

```typescript
interface ClaudePaneProps {
	sessionId: string; // Current Claude session ID
	workspacePath: string; // Workspace path for context
}
```

**Usage**:

```svelte
<ClaudePane sessionId="claude-session-123" workspacePath="/workspace/my-project" />
```

**Responsibilities**:

- Instantiate `ClaudePaneViewModel`
- Pass ViewModel to all child components
- Handle layout (grid/flexbox arrangement)
- No business logic (delegated to ViewModel)

**Rendering Structure**:

```svelte
<div class="claude-pane">
	<ToolPanel {viewModel} />
	<div class="main-content">
		<MessageList {viewModel} />
		<InputArea {viewModel} />
	</div>
	<TracePanel {viewModel} />
</div>
```

---

## Subcomponent Contracts

### ToolPanel.svelte

**Purpose**: Display available tools and handle tool selection

**Props**:

```typescript
interface ToolPanelProps {
	viewModel: ClaudePaneViewModel; // Shared ViewModel instance
}
```

**ViewModel State Access**:

```javascript
viewModel.tools: Tool[]              // Array of available tools
viewModel.selectedTool: string | null // Currently selected tool ID
viewModel.selectTool(toolId: string) // Method to select tool
```

**Events Emitted**: None (uses ViewModel methods)

**Rendering**:

- List of tools with icons
- Active tool visual indicator
- Tool description on hover
- Click handler calling `viewModel.selectTool(toolId)`

**Accessibility**:

- ARIA roles for list and listitem
- Keyboard navigation (Tab, Enter)
- Screen reader announcements for selection

**Example Usage**:

```svelte
<ToolPanel {viewModel} />
```

---

### TracePanel.svelte

**Purpose**: Display execution traces and debug information

**Props**:

```typescript
interface TracePanelProps {
	viewModel: ClaudePaneViewModel;
}
```

**ViewModel State Access**:

```javascript
viewModel.traces: TraceEntry[]               // Array of trace entries
viewModel.tracePanelExpanded: boolean        // Panel visibility state
viewModel.toggleTracePanel()                 // Toggle visibility method
```

**Events Emitted**: None (uses ViewModel methods)

**Rendering**:

- Collapsible panel (header + content)
- Trace entries with syntax highlighting
- Expand/collapse button
- Empty state when no traces

**Accessibility**:

- ARIA expanded state
- Keyboard toggle (Enter/Space)
- Focus management on expand/collapse

**Example Usage**:

```svelte
<TracePanel {viewModel} />
```

---

### MessageList.svelte

**Purpose**: Render conversation messages between user and Claude

**Props**:

```typescript
interface MessageListProps {
	viewModel: ClaudePaneViewModel;
}
```

**ViewModel State Access**:

```javascript
viewModel.messages: Message[]                        // Array of messages
viewModel.handleMessageAction(messageId, action)     // Action handler
```

**Events Emitted**: None (uses ViewModel methods)

**Rendering**:

- Scrollable message list
- Message differentiation (user vs. assistant)
- Action buttons (copy, retry, regenerate)
- Loading indicator for in-progress responses
- Auto-scroll to bottom on new messages

**Message Actions**:

- `copy`: Copy message content to clipboard
- `retry`: Retry failed message
- `regenerate`: Request new response

**Accessibility**:

- ARIA live region for new messages
- Semantic HTML (article, section)
- Keyboard-accessible action buttons

**Example Usage**:

```svelte
<MessageList {viewModel} />
```

---

### InputArea.svelte

**Purpose**: Handle user text input and submission

**Props**:

```typescript
interface InputAreaProps {
	viewModel: ClaudePaneViewModel;
}
```

**ViewModel State Access**:

```javascript
viewModel.inputText: string                  // Current input text
viewModel.isProcessing: boolean              // Processing state
viewModel.canSubmit: boolean                 // Derived: can submit?
viewModel.submitInput()                      // Submit handler
viewModel.cancelProcessing()                 // Cancel handler
```

**Events Emitted**: None (uses ViewModel methods)

**Rendering**:

- Auto-resizing textarea
- Submit button (disabled when `!canSubmit`)
- Cancel button (visible only when `isProcessing`)
- Character count (optional)

**Keyboard Shortcuts**:

- `Enter` (no modifiers): Submit input
- `Shift+Enter`: New line
- `Escape`: Cancel processing (if active)

**Accessibility**:

- Label for textarea
- Button states announced
- Error messages via aria-live

**Example Usage**:

```svelte
<InputArea {viewModel} />
```

---

## ViewModel Contract

### ClaudePaneViewModel.svelte.js

**Purpose**: Centralized state management using Svelte 5 runes-in-classes pattern

**Constructor**:

```javascript
constructor(sessionId: string, workspacePath: string)
```

**State Properties** (using `$state` runes):

```javascript
sessionId: string                    // Session ID
workspacePath: string                // Workspace path

// Tool state
tools: Tool[]                        // Available tools
selectedTool: string | null          // Selected tool ID

// Trace state
traces: TraceEntry[]                 // Trace entries
tracePanelExpanded: boolean          // Panel visibility

// Message state
messages: Message[]                  // Conversation messages

// Input state
inputText: string                    // Current input
isProcessing: boolean                // Processing flag
```

**Derived Properties** (using `$derived`):

```javascript
hasActiveSession: boolean; // Is session active?
canSubmit: boolean; // Can submit input?
```

**Methods**:

```javascript
selectTool(toolId: string): void
toggleTracePanel(): void
handleMessageAction(messageId: string, action: string): void
submitInput(): Promise<void>
cancelProcessing(): void
```

**Example Instantiation**:

```javascript
const viewModel = new ClaudePaneViewModel('claude-123', '/workspace/my-project');
```

---

## Shared Types

### Tool

```typescript
interface Tool {
	id: string;
	name: string;
	description: string;
	icon: string; // Icon name or path
	enabled: boolean;
}
```

### TraceEntry

```typescript
interface TraceEntry {
	id: string;
	timestamp: string; // ISO timestamp
	type: 'info' | 'warning' | 'error';
	message: string;
	data?: object; // Optional structured data
}
```

### Message

```typescript
interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string; // ISO timestamp
	status: 'pending' | 'complete' | 'error';
}
```

---

## Testing Strategy

### Component Contract Tests

Each subcomponent will have tests validating:

- Props interface matches contract
- ViewModel methods are called correctly
- Rendering matches expected structure
- Accessibility attributes present

### Integration Tests

Tests validating full component tree:

- ClaudePane instantiates ViewModel
- ViewModel state updates propagate to subcomponents
- User interactions trigger correct ViewModel methods
- No regressions from original ClaudePane behavior

---

## State Flow

### Unidirectional Data Flow

```
ClaudePane (parent)
  └─> ClaudePaneViewModel (instantiate)
       └─> Pass to children via props

ToolPanel (child)
  ├─> Read viewModel.tools (reactive)
  └─> Call viewModel.selectTool() (action)

TracePanel (child)
  ├─> Read viewModel.traces (reactive)
  └─> Call viewModel.toggleTracePanel() (action)

MessageList (child)
  ├─> Read viewModel.messages (reactive)
  └─> Call viewModel.handleMessageAction() (action)

InputArea (child)
  ├─> Read viewModel.inputText (reactive)
  └─> Call viewModel.submitInput() (action)
```

**Key Principle**: Children never mutate ViewModel state directly; always via ViewModel methods.

---

## Backward Compatibility

### Props Interface

ClaudePane.svelte props interface remains identical:

```svelte
<!-- Before refactor -->
<ClaudePane sessionId={id} workspacePath={path} />

<!-- After refactor (same) -->
<ClaudePane sessionId={id} workspacePath={path} />
```

### Event Emissions

All events emitted by original ClaudePane.svelte are preserved:

- `session-started`
- `session-ended`
- `message-sent`
- `error`

(Events may be moved to ViewModel or parent, but external interface unchanged)

---

## Error Handling

### ViewModel Error Handling

All async operations follow standardized error pattern (per FR-007):

```javascript
async submitInput() {
  if (!this.canSubmit) return

  this.isProcessing = true
  this.error = null

  try {
    const result = await sendMessageToSession(this.sessionId, this.inputText)
    if (!result.success) {
      this.error = result.error || 'Failed to send message'
      return
    }

    // Success: add message to list
    this.messages.push(result.data)
    this.inputText = ''
  } catch (error) {
    this.error = error?.message || 'Unknown error occurred'
  } finally {
    this.isProcessing = false
  }
}
```

### Component Error Boundaries

Use Svelte's `<svelte:boundary>` for component-level error handling:

```svelte
<svelte:boundary>
	<MessageList {viewModel} />
	{#snippet error(err)}
		<ErrorMessage message={err.message} />
	{/snippet}
</svelte:boundary>
```

---

## Performance Considerations

### Reactivity Optimization

- Use `$derived` for computed values (avoid re-renders)
- Avoid unnecessary prop drilling (ViewModel pattern reduces this)
- Large message lists: Consider virtualization if >1000 messages

### Lazy Loading

- Traces fetched on-demand when panel expanded
- Message history paginated for long conversations

---

## Migration Path

### Extraction Order

1. **ClaudePaneViewModel.svelte.js**: Extract state/logic first
2. **ToolPanel.svelte**: Smallest subcomponent (low risk)
3. **TracePanel.svelte**: Medium complexity
4. **InputArea.svelte**: Medium complexity
5. **MessageList.svelte**: Highest complexity (rendering logic)
6. **ClaudePane.svelte**: Update to orchestrator (final step)

### Testing After Each Step

- Run existing ClaudePane tests
- Verify no visual regressions
- Check performance metrics (no degradation)
