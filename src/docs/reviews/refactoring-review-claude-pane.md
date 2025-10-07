# Refactoring Review: ClaudePaneViewModel and Claude Session Components

**Reviewed by:** Senior Refactoring Specialist
**Date:** 2025-10-07
**Branch:** 007-design-pattern-refactor
**Scope:** Claude session management (ViewModel, components, services)

---

## Executive Summary

The Claude Pane module demonstrates solid fundamentals with clear MVVM separation and use of Svelte 5 runes. However, there are significant opportunities for improvement in **code duplication**, **complexity management**, **separation of concerns**, and **testability**. This review identifies 23 specific refactoring opportunities organized by priority.

**Overall Quality Assessment:**
- **Architecture:** ✅ Good (MVVM pattern correctly applied)
- **Code Duplication:** ⚠️ Moderate (significant DRY violations in event handling)
- **Complexity:** ⚠️ Moderate-High (handleRunEvent method has cyclomatic complexity ~15)
- **Testability:** ⚠️ Poor (ViewModel tightly coupled to singleton, no tests)
- **Naming:** ✅ Good (clear, consistent naming)
- **Error Handling:** ⚠️ Inconsistent (mix of patterns, missing error boundaries)

**Key Metrics:**
- Lines of Code: ~550 (ViewModel), ~380 (MessageList), ~175 (InputArea)
- Cyclomatic Complexity: 15+ (handleRunEvent), 8 (submitInput)
- Test Coverage: 0% (client-side), minimal server-side
- Code Duplication: ~40% in message extraction logic

---

## Priority 1 (High) - Critical Refactorings

### 1.1 Extract Message Parsing Service (DRY Violation)

**Issue:** Message text extraction logic is duplicated in two locations:
- `handleRunEvent()` lines 212-233
- `loadPreviousMessages()` lines 509-523

**Impact:**
- Violates DRY principle (same complex logic in multiple places)
- High maintenance risk (bug fixes must be applied twice)
- Testing becomes redundant

**Current Code (Duplicated):**
```javascript
// In handleRunEvent() - lines 212-233
let messageText = '';
if (payload.events && Array.isArray(payload.events)) {
    for (const evt of payload.events) {
        if (evt.message?.content) {
            for (const block of evt.message.content) {
                if (block.type === 'text' && block.text) {
                    messageText += block.text;
                }
            }
        }
    }
} else {
    messageText = payload.text || payload.content || '';
}

// Identical logic in loadPreviousMessages() - lines 509-523
```

**Refactoring:**
Create a dedicated message parser service with pure functions:

```javascript
// src/lib/client/claude/services/MessageParser.js
/**
 * MessageParser.js
 * Pure utility functions for parsing Claude message payloads
 */

/**
 * Extract text content from Claude message payload
 * @param {Object} payload - Event payload from Claude adapter
 * @returns {string} - Extracted text content
 */
export function extractMessageText(payload) {
    if (!payload) return '';

    // Handle structured event format (preferred)
    if (payload.events && Array.isArray(payload.events)) {
        return extractTextFromEvents(payload.events);
    }

    // Fallback to legacy format
    return payload.text || payload.content || '';
}

/**
 * Extract text from events array
 * @private
 */
function extractTextFromEvents(events) {
    return events.reduce((text, evt) => {
        if (!evt.message?.content) return text;

        const textBlocks = evt.message.content
            .filter(block => block.type === 'text' && block.text)
            .map(block => block.text);

        return text + textBlocks.join('');
    }, '');
}

/**
 * Validate and normalize message structure
 * @param {Object} rawMessage - Raw message from history or event
 * @returns {Object|null} - Normalized message or null if invalid
 */
export function normalizeMessage(rawMessage, role = 'assistant') {
    const text = extractMessageText(rawMessage);
    if (!text) return null;

    return {
        role,
        text,
        timestamp: rawMessage.timestamp ? new Date(rawMessage.timestamp) : new Date(),
        id: rawMessage.id || generateMessageId()
    };
}

function generateMessageId() {
    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}
```

**Usage in ViewModel:**
```javascript
import { extractMessageText, normalizeMessage } from './services/MessageParser.js';

// In handleRunEvent()
case 'assistant':
    const messageText = extractMessageText(payload);
    if (messageText) {
        const newMessage = {
            role: 'assistant',
            text: messageText,
            timestamp: new Date(),
            id: this.nextMessageId()
        };
        // ... rest of logic
    }
    break;

// In loadPreviousMessages()
if (channel === 'claude:message' && type === 'assistant') {
    const message = normalizeMessage(payload, 'assistant');
    if (message) {
        message.id = this.nextMessageId(); // Override with VM sequence
        loadedMessages.push(message);
    }
}
```

**Benefits:**
- ✅ Eliminates 40+ lines of duplication
- ✅ Single source of truth for parsing logic
- ✅ Easily testable pure functions
- ✅ Easier to extend with new message formats

**Estimated Effort:** 2-3 hours

---

### 1.2 Reduce Cyclomatic Complexity in handleRunEvent() (SRP Violation)

**Issue:** The `handleRunEvent()` method has complexity ~15 with nested switch statements and multiple responsibilities:
- Channel-based routing
- Type-based routing within channels
- Message extraction and transformation
- State updates
- Error handling
- Backward compatibility handling

**Current Structure:**
```javascript
handleRunEvent(event) {
    const { channel, type, payload } = event;

    // Channel-based routing (lines 204-272)
    if (channel === 'claude:message') {
        switch (type) {
            case 'assistant': /* 50 lines */ break;
            case 'system': /* ... */ break;
            case 'result': /* ... */ break;
        }
        return;
    }

    if (channel === 'claude:error') { /* ... */ return; }
    if (channel === 'system:input') { /* ... */ return; }

    // Legacy format handling (lines 328-439)
    switch (type) {
        case 'claude:message': /* ... */ break;
        case 'claude:auth_start': /* ... */ break;
        // ... 8 more cases
    }
}
```

**Refactoring:** Apply Strategy Pattern with event handlers:

```javascript
// src/lib/client/claude/services/EventHandlers.js
/**
 * Event handler strategies for different Claude event types
 * Each handler is a pure function returning state updates
 */

export class ClaudeEventHandlers {
    constructor(viewModel) {
        this.vm = viewModel;

        // Channel-based handler map
        this.channelHandlers = {
            'claude:message': this.handleClaudeMessage.bind(this),
            'claude:error': this.handleClaudeError.bind(this),
            'system:input': this.handleSystemInput.bind(this)
        };

        // Legacy type-based handler map
        this.legacyHandlers = {
            'claude:message': this.handleLegacyMessage.bind(this),
            'claude:auth_start': this.handleAuthStart.bind(this),
            'claude:auth_awaiting_code': this.handleAuthAwaitingCode.bind(this),
            'claude:auth_success': this.handleAuthSuccess.bind(this),
            'claude:auth_error': this.handleAuthError.bind(this),
            'claude:tool_use': this.handleLiveEvent.bind(this),
            'claude:tool_result': this.handleLiveEvent.bind(this),
            'claude:thinking': this.handleLiveEvent.bind(this),
            'claude:error': this.handleLegacyError.bind(this)
        };
    }

    /**
     * Main event router
     */
    handleEvent(event) {
        const { channel, type } = event;

        // Try channel-based routing first
        const channelHandler = this.channelHandlers[channel];
        if (channelHandler) {
            return channelHandler(event);
        }

        // Fall back to legacy type-based routing
        const legacyHandler = this.legacyHandlers[type];
        if (legacyHandler) {
            return legacyHandler(event);
        }

        console.log('[ClaudeEventHandlers] Unhandled event:', type, channel);
    }

    /**
     * Handle claude:message channel events
     */
    handleClaudeMessage(event) {
        const { type, payload } = event;

        switch (type) {
            case 'assistant':
                return this.handleAssistantMessage(payload);
            case 'system':
                console.log('[ClaudeEventHandlers] System init:', payload);
                return { type: 'noop' };
            case 'result':
                return this.handleExecutionResult(payload);
            default:
                console.log('[ClaudeEventHandlers] Unhandled claude:message type:', type);
                return { type: 'noop' };
        }
    }

    /**
     * Handle assistant message (extracted for clarity)
     */
    handleAssistantMessage(payload) {
        const messageText = extractMessageText(payload);

        if (!messageText) {
            console.warn('[ClaudeEventHandlers] No text extracted from assistant event');
            return { type: 'noop' };
        }

        return {
            type: 'add_message',
            message: {
                role: 'assistant',
                text: messageText,
                timestamp: new Date(),
                id: this.vm.nextMessageId()
            },
            clearWaiting: true,
            scrollToBottom: true
        };
    }

    /**
     * Handle execution result
     */
    handleExecutionResult(payload) {
        console.log('[ClaudeEventHandlers] Execution result:', payload);
        return {
            type: 'clear_waiting'
        };
    }

    /**
     * Handle error channel events
     */
    handleClaudeError(event) {
        const { payload } = event;
        let errorMessage = payload.error || payload.message || 'An error occurred';

        // Extract nested error if present
        if (payload.events?.length > 0 && payload.events[0].error) {
            errorMessage = payload.events[0].error;
        }

        return {
            type: 'add_error_message',
            message: {
                role: 'assistant',
                text: `Error: ${errorMessage}`,
                timestamp: new Date(),
                id: this.vm.nextMessageId()
            },
            clearWaiting: true,
            setError: errorMessage
        };
    }

    /**
     * Handle system input events (from history or other clients)
     */
    handleSystemInput(event) {
        const { payload } = event;
        const userText = payload.data || payload.text || '';

        if (!userText) return { type: 'noop' };

        // Check for duplicate (last message is same)
        const lastMessage = this.vm.messages[this.vm.messages.length - 1];
        if (lastMessage?.role === 'user' && lastMessage?.text === userText) {
            console.log('[ClaudeEventHandlers] Skipping duplicate user message');
            return { type: 'noop' };
        }

        return {
            type: 'add_message',
            message: {
                role: 'user',
                text: userText,
                timestamp: new Date(),
                id: this.vm.nextMessageId()
            },
            scrollToBottom: true
        };
    }

    // ... additional handlers for auth, live events, etc.
}
```

**Updated ViewModel:**
```javascript
import { ClaudeEventHandlers } from './services/EventHandlers.js';

export class ClaudePaneViewModel {
    constructor(sessionId, claudeSessionId, shouldResume) {
        // ... existing constructor
        this.eventHandlers = new ClaudeEventHandlers(this);
    }

    /**
     * Handle run session events (simplified)
     */
    handleRunEvent(event) {
        console.log('[ClaudePaneViewModel] Handling event:', event);

        const action = this.eventHandlers.handleEvent(event);
        this.applyAction(action);
    }

    /**
     * Apply state changes from event handler action
     */
    applyAction(action) {
        if (!action || action.type === 'noop') return;

        switch (action.type) {
            case 'add_message':
                this.messages = [...this.messages, action.message];
                if (action.clearWaiting) {
                    this.isWaitingForReply = false;
                    this.liveEventIcons = [];
                }
                if (action.scrollToBottom) {
                    this.scrollToBottom();
                }
                break;

            case 'add_error_message':
                this.messages = [...this.messages, action.message];
                this.lastError = action.setError;
                this.isWaitingForReply = false;
                this.liveEventIcons = [];
                this.scrollToBottom();
                break;

            case 'clear_waiting':
                this.isWaitingForReply = false;
                this.liveEventIcons = [];
                break;

            case 'update_auth_state':
                Object.assign(this, action.updates);
                break;
        }
    }
}
```

**Benefits:**
- ✅ Reduces cyclomatic complexity from 15 to ~3
- ✅ Each handler is independently testable
- ✅ Clear separation of concerns
- ✅ Easy to add new event types
- ✅ Better error isolation

**Estimated Effort:** 4-5 hours

---

### 1.3 Remove Singleton Dependency for Testability

**Issue:** The ViewModel imports and uses `runSessionClient` singleton directly (line 17), making it impossible to:
- Unit test without running a real WebSocket server
- Mock dependencies in tests
- Test error scenarios
- Run tests in parallel

**Current Code:**
```javascript
import { runSessionClient } from '../../shared/services/RunSessionClient.js';

export class ClaudePaneViewModel {
    async submitInput(e) {
        // Direct singleton usage
        runSessionClient.sendInput(this.sessionId, userMessage);
    }
}
```

**Refactoring:** Dependency Injection via constructor:

```javascript
/**
 * ClaudePaneViewModel.svelte.js
 *
 * @param {Object} config - Configuration object
 * @param {string} config.sessionId - Session identifier
 * @param {string} config.claudeSessionId - Claude-specific session ID
 * @param {boolean} config.shouldResume - Resume flag
 * @param {Object} config.sessionClient - Session client instance (injectable)
 */
export class ClaudePaneViewModel {
    constructor({
        sessionId,
        claudeSessionId = null,
        shouldResume = false,
        sessionClient = null
    }) {
        this.sessionId = sessionId;
        this.claudeSessionId = claudeSessionId;
        this.shouldResume = shouldResume;

        // Use injected client or fall back to singleton for backward compatibility
        this.sessionClient = sessionClient || runSessionClient;

        // ... rest of initialization
    }

    async submitInput(e) {
        // Use injected dependency
        this.sessionClient.sendInput(this.sessionId, userMessage);
    }

    getConnectionStatus() {
        return this.sessionClient.getStatus();
    }
}
```

**Updated Component Usage:**
```javascript
// ClaudePane.svelte
import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';

// Create ViewModel with explicit dependency injection
const viewModel = new ClaudePaneViewModel({
    sessionId,
    claudeSessionId,
    shouldResume,
    sessionClient: runSessionClient // Explicit injection
});
```

**Test Example:**
```javascript
// tests/client/claude/ClaudePaneViewModel.test.js
import { describe, it, expect, vi } from 'vitest';
import { ClaudePaneViewModel } from '../../../src/lib/client/claude/viewmodels/ClaudePaneViewModel.svelte.js';

describe('ClaudePaneViewModel', () => {
    it('should send user input to session client', async () => {
        // Create mock session client
        const mockClient = {
            sendInput: vi.fn(),
            getStatus: vi.fn(() => ({ connected: true, authenticated: true }))
        };

        // Inject mock
        const vm = new ClaudePaneViewModel({
            sessionId: 'test-session',
            sessionClient: mockClient
        });

        vm.input = 'Hello Claude';
        vm.isAttached = true;

        await vm.submitInput();

        expect(mockClient.sendInput).toHaveBeenCalledWith('test-session', 'Hello Claude');
        expect(vm.input).toBe(''); // Input cleared
        expect(vm.isWaitingForReply).toBe(true);
    });

    it('should not send when not attached', async () => {
        const mockClient = { sendInput: vi.fn() };
        const vm = new ClaudePaneViewModel({
            sessionId: 'test-session',
            sessionClient: mockClient
        });

        vm.input = 'Test';
        vm.isAttached = false;

        await vm.submitInput();

        expect(mockClient.sendInput).not.toHaveBeenCalled();
    });
});
```

**Benefits:**
- ✅ Enables comprehensive unit testing
- ✅ Tests can run without network/server
- ✅ Easy to test error scenarios
- ✅ Follows Dependency Inversion Principle
- ✅ Maintains backward compatibility

**Estimated Effort:** 2-3 hours

---

### 1.4 Extract Authentication Flow Management (SRP Violation)

**Issue:** The ViewModel manages multiple concerns including authentication state and flow logic mixed with message handling. Authentication has 4 state flags plus flow logic scattered across `submitInput()` and `handleRunEvent()`.

**Current State Variables:**
```javascript
authStartRequested = $state(false);
authAwaitingCode = $state(false);
authInProgress = $state(false);
pendingAuthUrl = $state('');
```

**Refactoring:** Extract to dedicated AuthenticationManager:

```javascript
// src/lib/client/claude/services/AuthenticationManager.svelte.js
/**
 * AuthenticationManager.svelte.js
 * Manages OAuth authentication flow state for Claude sessions
 */

export class AuthenticationManager {
    // Authentication state
    startRequested = $state(false);
    awaitingCode = $state(false);
    inProgress = $state(false);
    pendingUrl = $state('');

    // Derived states
    isAuthenticating = $derived(this.inProgress || this.awaitingCode);
    needsAuthentication = $derived(this.awaitingCode || this.startRequested);

    /**
     * Handle auth_start event
     */
    handleAuthStart(url) {
        this.startRequested = true;
        this.awaitingCode = false;
        this.inProgress = true;
        this.pendingUrl = url;

        return {
            message: `Please authorize Claude Code:\n\n[Open Authorization URL](${url})`,
            role: 'assistant'
        };
    }

    /**
     * Handle auth_awaiting_code event
     */
    handleAuthAwaitingCode() {
        this.awaitingCode = true;
        this.inProgress = false;

        return {
            message: 'Please paste the authorization code from the browser:',
            role: 'assistant'
        };
    }

    /**
     * Handle auth_success event
     */
    handleAuthSuccess() {
        this.reset();

        return {
            message: '✓ Authentication successful! You can now use Claude Code.',
            role: 'assistant'
        };
    }

    /**
     * Handle auth_error event
     */
    handleAuthError(error) {
        const errorMsg = error || 'Authentication failed';
        this.reset();

        return {
            message: `Authentication error: ${errorMsg}`,
            role: 'assistant',
            isError: true
        };
    }

    /**
     * Process user input during auth flow
     * @returns {string|null} - Auth command to send, or null if not in auth flow
     */
    processAuthInput(userInput) {
        if (!this.awaitingCode || !userInput.trim()) {
            return null;
        }

        this.inProgress = true;
        return `/auth ${userInput.trim()}`;
    }

    /**
     * Reset authentication state
     */
    reset() {
        this.startRequested = false;
        this.awaitingCode = false;
        this.inProgress = false;
        this.pendingUrl = '';
    }

    /**
     * Reset on new user turn (not auth-related)
     */
    resetForNewTurn() {
        this.startRequested = false;
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            startRequested: this.startRequested,
            awaitingCode: this.awaitingCode,
            inProgress: this.inProgress,
            pendingUrl: this.pendingUrl,
            isAuthenticating: this.isAuthenticating
        };
    }
}
```

**Updated ViewModel:**
```javascript
import { AuthenticationManager } from './services/AuthenticationManager.svelte.js';

export class ClaudePaneViewModel {
    constructor(config) {
        // ... other initialization

        // Replace auth state flags with manager
        this.authManager = new AuthenticationManager();
    }

    // Remove old auth state variables and replace with derived
    get isAuthenticating() {
        return this.authManager.isAuthenticating;
    }

    async submitInput(e) {
        if (e) e.preventDefault();
        if (!this.input.trim() || !this.isAttached) return;

        const userMessage = this.input.trim();
        this.authManager.resetForNewTurn();

        // Check if this is auth code submission
        const authCommand = this.authManager.processAuthInput(userMessage);
        if (authCommand) {
            this.input = '';
            this.sessionClient.sendInput(this.sessionId, authCommand);

            // Show status message
            this.messages = [
                ...this.messages,
                {
                    role: 'assistant',
                    text: 'Submitting authorization code…',
                    timestamp: new Date(),
                    id: this.nextMessageId()
                }
            ];
            await this.scrollToBottom();
            return;
        }

        // Normal message flow
        // ... rest of submitInput logic
    }

    // Updated status derived to include auth state
    status = $derived.by(() => {
        if (this.connectionError) return 'connection-error';
        if (this.authManager.inProgress) return 'auth-in-progress';
        if (this.authManager.awaitingCode) return 'awaiting-auth-code';
        if (this.loading) return 'loading';
        if (this.isCatchingUp) return 'catching-up';
        if (this.isWaitingForReply) return 'thinking';
        return 'idle';
    });
}
```

**Benefits:**
- ✅ Single Responsibility: Auth logic isolated
- ✅ Testable auth flows independently
- ✅ Clearer state transitions
- ✅ Reduces ViewModel complexity by ~80 lines
- ✅ Reusable for other auth flows

**Estimated Effort:** 3-4 hours

---

## Priority 2 (Medium) - Important Refactorings

### 2.1 Consolidate Message State Management

**Issue:** Message operations (add, clear, load) are scattered and lack encapsulation. Direct array manipulation makes it hard to add features like message history limits, search, or filtering.

**Refactoring:** Create MessageStore class:

```javascript
// src/lib/client/claude/services/MessageStore.svelte.js
/**
 * MessageStore.svelte.js
 * Encapsulates message collection with reactive state
 */

export class MessageStore {
    messages = $state([]);
    messageSequence = 0;

    // Derived queries
    messageCount = $derived(this.messages.length);
    hasMessages = $derived(this.messages.length > 0);
    lastMessage = $derived(this.messages[this.messages.length - 1] || null);

    /**
     * Add a single message
     */
    addMessage(message) {
        if (!message.id) {
            message.id = this.nextMessageId();
        }
        this.messages = [...this.messages, message];
        return message;
    }

    /**
     * Add multiple messages (bulk operation)
     */
    addMessages(messages) {
        const withIds = messages.map(msg => ({
            ...msg,
            id: msg.id || this.nextMessageId()
        }));
        this.messages = [...this.messages, ...withIds];
    }

    /**
     * Create and add a message from text
     */
    createMessage(role, text, options = {}) {
        const message = {
            role,
            text,
            timestamp: options.timestamp || new Date(),
            id: this.nextMessageId(),
            ...options
        };
        return this.addMessage(message);
    }

    /**
     * Check if last message is duplicate
     */
    isDuplicateOfLast(role, text) {
        if (!this.lastMessage) return false;
        return this.lastMessage.role === role && this.lastMessage.text === text;
    }

    /**
     * Clear all messages
     */
    clear() {
        this.messages = [];
    }

    /**
     * Replace entire message collection (for history load)
     */
    replaceAll(messages) {
        this.messages = messages.map(msg => ({
            ...msg,
            id: msg.id || this.nextMessageId()
        }));
    }

    /**
     * Get messages by role
     */
    getMessagesByRole(role) {
        return this.messages.filter(m => m.role === role);
    }

    /**
     * Generate unique message ID
     */
    nextMessageId() {
        this.messageSequence = (this.messageSequence + 1) % Number.MAX_SAFE_INTEGER;
        return `${Date.now()}-${this.messageSequence}`;
    }

    /**
     * Export state for debugging
     */
    toArray() {
        return [...this.messages];
    }
}
```

**Updated ViewModel:**
```javascript
import { MessageStore } from './services/MessageStore.svelte.js';

export class ClaudePaneViewModel {
    constructor(config) {
        // Replace direct messages array with store
        this.messageStore = new MessageStore();
    }

    // Expose messages as derived for components
    get messages() {
        return this.messageStore.messages;
    }

    async submitInput(e) {
        // Simplified message addition
        this.messageStore.createMessage('user', userMessage);
        this.input = '';
        this.isWaitingForReply = true;
        await this.scrollToBottom();

        // Send to session client
        this.sessionClient.sendInput(this.sessionId, userMessage);
    }

    handleAssistantMessage(messageText) {
        if (!this.messageStore.isDuplicateOfLast('assistant', messageText)) {
            this.messageStore.createMessage('assistant', messageText);
            this.scrollToBottom();
        }
    }

    clearMessages() {
        this.messageStore.clear();
        this.liveEventIcons = [];
    }
}
```

**Benefits:**
- ✅ Encapsulation of message operations
- ✅ Easy to add features (search, filtering, limits)
- ✅ Testable message operations
- ✅ Cleaner ViewModel code

**Estimated Effort:** 2-3 hours

---

### 2.2 Separate UI State from Business Logic

**Issue:** The ViewModel contains UI-specific state (`isMobile`, `messagesContainer`) that violates separation of concerns and makes testing harder.

**Current Violations:**
```javascript
// UI concerns in ViewModel
isMobile = $state(false);
messagesContainer = $state(null);

setMobile(isMobile) { this.isMobile = isMobile; }
setMessagesContainer(element) { this.messagesContainer = element; }
```

**Refactoring:** Move to component-local state or UI helper:

```javascript
// ClaudePane.svelte - keep UI state in component
<script>
    import { ClaudePaneViewModel } from './viewmodels/ClaudePaneViewModel.svelte.js';

    // ViewModel for business logic only
    const viewModel = new ClaudePaneViewModel({ /* ... */ });

    // UI-specific state stays in component
    let isMobile = $state(false);
    let messagesContainer = $state(null);

    function checkMobile() {
        return ('ontouchstart' in window || navigator.maxTouchPoints > 0)
            && window.innerWidth <= 768;
    }

    function handleResize() {
        isMobile = checkMobile();
    }

    onMount(() => {
        isMobile = checkMobile();
        window.addEventListener('resize', handleResize);
    });
</script>
```

**MessageList.svelte - auto-scroll on messages change:**
```svelte
<script>
    let { viewModel } = $props();
    let messagesContainer = $state();

    // Auto-scroll effect when messages change
    $effect(() => {
        // React to messages change
        viewModel.messages;

        // Scroll to bottom
        tick().then(() => {
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        });
    });
</script>

<div class="messages" bind:this={messagesContainer}>
    {#each viewModel.messages as m (m.id)}
        <!-- message rendering -->
    {/each}
</div>
```

**Benefits:**
- ✅ Pure business logic in ViewModel
- ✅ UI concerns in UI layer
- ✅ Better testability
- ✅ Follows MVVM pattern correctly

**Estimated Effort:** 1-2 hours

---

### 2.3 Implement Proper Error Boundaries

**Issue:** Error handling is inconsistent with direct state mutations and no error recovery mechanisms:

```javascript
// Inconsistent error handling
catch (error) {
    console.error('[ClaudePaneViewModel] Failed to send message:', error);
    this.lastError = error.message || 'Failed to send message';
    this.isWaitingForReply = false;
}
```

**Refactoring:** Structured error handling with recovery:

```javascript
// src/lib/client/claude/services/ErrorHandler.js
/**
 * ErrorHandler.js
 * Centralized error handling with categorization and recovery
 */

export class ErrorCategory {
    static NETWORK = 'network';
    static AUTHENTICATION = 'authentication';
    static VALIDATION = 'validation';
    static SERVER = 'server';
    static UNKNOWN = 'unknown';
}

export class ClaudeError extends Error {
    constructor(message, category, recoverable = true, originalError = null) {
        super(message);
        this.name = 'ClaudeError';
        this.category = category;
        this.recoverable = recoverable;
        this.originalError = originalError;
        this.timestamp = new Date();
    }
}

export class ErrorHandler {
    /**
     * Process and categorize errors
     */
    static handle(error, context = '') {
        // Categorize error
        const category = this.categorize(error);
        const message = this.getUserFriendlyMessage(error, category);
        const recoverable = this.isRecoverable(category);

        // Create structured error
        const claudeError = new ClaudeError(message, category, recoverable, error);

        // Log with context
        console.error(`[ErrorHandler] ${context}:`, {
            message,
            category,
            recoverable,
            originalError: error
        });

        return claudeError;
    }

    /**
     * Categorize error type
     */
    static categorize(error) {
        if (!error) return ErrorCategory.UNKNOWN;

        const message = error.message || '';

        if (message.includes('Not authenticated') || message.includes('auth')) {
            return ErrorCategory.AUTHENTICATION;
        }
        if (message.includes('Not connected') || message.includes('network')) {
            return ErrorCategory.NETWORK;
        }
        if (message.includes('Failed to attach') || message.includes('session')) {
            return ErrorCategory.SERVER;
        }
        if (message.includes('Invalid') || message.includes('required')) {
            return ErrorCategory.VALIDATION;
        }

        return ErrorCategory.UNKNOWN;
    }

    /**
     * Get user-friendly error message
     */
    static getUserFriendlyMessage(error, category) {
        const message = error.message || 'An unexpected error occurred';

        switch (category) {
            case ErrorCategory.AUTHENTICATION:
                return 'Authentication failed. Please check your credentials and try again.';
            case ErrorCategory.NETWORK:
                return 'Connection lost. Please check your network and refresh the page.';
            case ErrorCategory.SERVER:
                return 'Server error. The session may have ended or the server is unavailable.';
            case ErrorCategory.VALIDATION:
                return `Invalid input: ${message}`;
            default:
                return message;
        }
    }

    /**
     * Check if error is recoverable
     */
    static isRecoverable(category) {
        return [
            ErrorCategory.VALIDATION,
            ErrorCategory.NETWORK
        ].includes(category);
    }

    /**
     * Get recovery suggestions
     */
    static getRecoverySuggestions(category) {
        switch (category) {
            case ErrorCategory.AUTHENTICATION:
                return ['Refresh the page and re-authenticate', 'Check your API key'];
            case ErrorCategory.NETWORK:
                return ['Check your internet connection', 'Refresh the page'];
            case ErrorCategory.SERVER:
                return ['Try creating a new session', 'Contact support if the issue persists'];
            default:
                return ['Try again', 'Refresh the page if the problem continues'];
        }
    }
}
```

**Updated ViewModel with error handling:**
```javascript
import { ErrorHandler, ErrorCategory } from './services/ErrorHandler.js';

export class ClaudePaneViewModel {
    // Enhanced error state
    lastError = $state(null); // ClaudeError instance or null
    errorRecoverable = $derived(this.lastError?.recoverable ?? true);

    async submitInput(e) {
        try {
            // ... submission logic
            this.clearError(); // Clear previous errors on success
        } catch (error) {
            const claudeError = ErrorHandler.handle(error, 'submitInput');
            this.handleError(claudeError);
        }
    }

    /**
     * Centralized error handling
     */
    handleError(error) {
        this.lastError = error;
        this.isWaitingForReply = false;

        // Add error message to chat
        this.messageStore.createMessage('assistant', error.message, {
            isError: true,
            errorCategory: error.category,
            recoverable: error.recoverable
        });

        this.scrollToBottom();

        // Emit error event for monitoring
        if (this.onError) {
            this.onError(error);
        }
    }

    /**
     * Clear error state
     */
    clearError() {
        this.lastError = null;
    }

    /**
     * Retry last failed operation
     */
    retry() {
        if (!this.lastError?.recoverable) {
            console.warn('Cannot retry non-recoverable error');
            return;
        }

        this.clearError();
        // Trigger appropriate retry based on error category
        // ... retry logic
    }
}
```

**Benefits:**
- ✅ Consistent error handling across all operations
- ✅ User-friendly error messages
- ✅ Error categorization for better UX
- ✅ Recovery suggestions
- ✅ Better monitoring and debugging

**Estimated Effort:** 3-4 hours

---

### 2.4 Remove Excessive Console Logging

**Issue:** Production code contains 30+ `console.log()` statements that should be behind a proper logging abstraction.

**Current Code:**
```javascript
console.log('[ClaudePaneViewModel] submitInput called:', { /* ... */ });
console.log('[ClaudePaneViewModel] Adding user message:', userMsg);
console.log('[ClaudePaneViewModel] Messages array after user message:', /* ... */);
console.log('[ClaudePaneViewModel] Handling event:', event);
// ... 26 more console.log statements
```

**Refactoring:** Use existing logger utility:

```javascript
import { createLogger } from '$lib/client/shared/utils/logger.js';

const log = createLogger('claude:viewmodel');

export class ClaudePaneViewModel {
    async submitInput(e) {
        log.debug('Submit input', {
            sessionId: this.sessionId,
            inputLength: this.input.length,
            isAttached: this.isAttached
        });

        // ... logic

        log.info('Message sent successfully');
    }

    handleRunEvent(event) {
        log.debug('Received event', {
            channel: event.channel,
            type: event.type
        });
        // ... handling
    }
}
```

**Benefits:**
- ✅ Production-safe logging
- ✅ Configurable log levels
- ✅ Cleaner console output
- ✅ Performance (logs can be disabled)

**Estimated Effort:** 1 hour

---

### 2.5 Extract LiveEventIcon Management

**Issue:** Live event icon management is scattered across multiple methods with tight coupling to ViewModel state.

**Refactoring:** Create LiveEventManager:

```javascript
// src/lib/client/claude/services/LiveEventManager.svelte.js
/**
 * LiveEventManager.svelte.js
 * Manages streaming activity indicators during Claude processing
 */

export class LiveEventManager {
    icons = $state([]);
    messageSequence = 0;

    // Derived state
    hasIcons = $derived(this.icons.length > 0);
    iconCount = $derived(this.icons.length);

    /**
     * Add a live event icon
     */
    addIcon(eventType) {
        const icon = {
            type: eventType,
            timestamp: Date.now(),
            id: this.nextIconId()
        };
        this.icons = [...this.icons, icon];
        return icon;
    }

    /**
     * Clear all icons
     */
    clear() {
        this.icons = [];
    }

    /**
     * Remove icons older than specified age
     */
    pruneOld(maxAgeMs = 30000) {
        const now = Date.now();
        this.icons = this.icons.filter(icon => now - icon.timestamp < maxAgeMs);
    }

    /**
     * Generate unique icon ID
     */
    nextIconId() {
        this.messageSequence++;
        return `icon-${Date.now()}-${this.messageSequence}`;
    }
}
```

**Benefits:**
- ✅ Encapsulated icon lifecycle
- ✅ Easy to add features (max icons, auto-pruning)
- ✅ Testable independently
- ✅ Cleaner ViewModel

**Estimated Effort:** 1-2 hours

---

## Priority 3 (Low) - Nice-to-Have Refactorings

### 3.1 Improve Naming Consistency

**Issue:** Inconsistent naming between similar concepts:
- `sessionId` vs `claudeSessionId`
- `isWaitingForReply` vs `isCatchingUp` (both are "is" boolean states but only one uses gerund)
- `handleRunEvent` vs `submitInput` (handle vs action verb)

**Recommendations:**
- Use consistent prefixes: `is*` for booleans, `handle*` for event handlers, action verbs for commands
- Rename `sessionId` → `runSessionId` for clarity
- Rename `claudeSessionId` → `conversationId` (more domain-specific)

**Estimated Effort:** 1-2 hours

---

### 3.2 Add TypeScript-style JSDoc Comments

**Issue:** Missing type information for better IDE support and documentation.

**Example:**
```javascript
/**
 * Submit user input to Claude session
 * @param {Event|null} e - Submit event (can be null for programmatic calls)
 * @returns {Promise<void>}
 * @throws {Error} When session is not attached or authenticated
 */
async submitInput(e) {
    // ... implementation
}

/**
 * Message structure
 * @typedef {Object} Message
 * @property {string} id - Unique message identifier
 * @property {'user'|'assistant'|'system'} role - Message role
 * @property {string} text - Message content
 * @property {Date} timestamp - Message timestamp
 * @property {boolean} [isError] - Whether this is an error message
 */
```

**Estimated Effort:** 2 hours

---

### 3.3 Implement Message Virtualization for Performance

**Issue:** With long conversations, rendering hundreds of message components can cause performance issues.

**Recommendation:** Use virtual scrolling library (e.g., `svelte-virtual-list`) for MessageList when message count exceeds threshold (e.g., 100 messages).

**Estimated Effort:** 3-4 hours

---

### 3.4 Add Loading States Enum

**Issue:** Multiple loading flags without clear state machine:
- `loading`
- `isWaitingForReply`
- `isCatchingUp`
- `authInProgress`

**Refactoring:** Use state machine pattern:

```javascript
export const LoadingState = {
    IDLE: 'idle',
    LOADING: 'loading',
    CATCHING_UP: 'catching_up',
    WAITING_REPLY: 'waiting_reply',
    AUTHENTICATING: 'authenticating'
};

export class ClaudePaneViewModel {
    loadingState = $state(LoadingState.IDLE);

    // Derived booleans for backward compatibility
    get loading() { return this.loadingState === LoadingState.LOADING; }
    get isWaitingForReply() { return this.loadingState === LoadingState.WAITING_REPLY; }
    get isCatchingUp() { return this.loadingState === LoadingState.CATCHING_UP; }
}
```

**Estimated Effort:** 2-3 hours

---

## Testing Strategy Recommendations

### Current State
- **Client-side tests:** 0 test files
- **Server-side tests:** 5 test files for Claude adapter
- **Coverage:** Server ~60%, Client 0%

### Recommended Test Structure

```
tests/client/claude/
├── viewmodels/
│   ├── ClaudePaneViewModel.test.js          # Priority 1
│   └── ClaudePaneViewModel.integration.test.js
├── services/
│   ├── MessageParser.test.js                # Priority 1
│   ├── EventHandlers.test.js                # Priority 1
│   ├── AuthenticationManager.test.js        # Priority 2
│   ├── MessageStore.test.js                 # Priority 2
│   └── ErrorHandler.test.js                 # Priority 2
├── components/
│   ├── MessageList.test.js                  # Priority 3
│   └── InputArea.test.js                    # Priority 3
```

### Test Coverage Goals
- **Phase 1 (Priority 1):** ViewModel core logic - 80% coverage
- **Phase 2 (Priority 2):** Service layer - 90% coverage
- **Phase 3 (Priority 3):** Components - 70% coverage

**Estimated Effort:** 16-20 hours total

---

## Complexity Metrics

### Current Metrics
```
ClaudePaneViewModel.svelte.js:
  - Lines of Code: 551
  - Cyclomatic Complexity:
    - handleRunEvent(): 15
    - submitInput(): 8
    - loadPreviousMessages(): 6
  - Code Duplication: 40% (message parsing)
  - Test Coverage: 0%

ClaudePane.svelte:
  - Lines of Code: 155
  - Complexity: Low (orchestration only)

MessageList.svelte:
  - Lines of Code: 380 (includes styles)
  - Complexity: Low (presentation)
```

### Target Metrics (After Refactoring)
```
ClaudePaneViewModel.svelte.js:
  - Lines of Code: ~300 (45% reduction)
  - Cyclomatic Complexity:
    - handleRunEvent(): 3 (80% reduction)
    - submitInput(): 4 (50% reduction)
  - Code Duplication: <5%
  - Test Coverage: 80%+

Extracted Services:
  - MessageParser.js: ~80 LOC, 100% testable
  - EventHandlers.js: ~200 LOC, 100% testable
  - AuthenticationManager.js: ~120 LOC, 100% testable
  - MessageStore.js: ~100 LOC, 100% testable
```

---

## SOLID Principles Analysis

### Current Adherence

#### ✅ Single Responsibility Principle (SRP)
**Grade: C-**
- **Violations:** ViewModel handles too many responsibilities:
  - Message management
  - Authentication flow
  - Event routing and handling
  - UI state (mobile, scroll)
  - Live event icons
- **Recommendation:** Extract services as outlined in Priority 1 refactorings

#### ✅ Open/Closed Principle (OCP)
**Grade: B**
- **Good:** Event handling can be extended via new event types
- **Concern:** Adding new message types requires modifying ViewModel
- **Recommendation:** Strategy pattern for event handlers (see 1.2)

#### ✅ Liskov Substitution Principle (LSP)
**Grade: N/A**
- No inheritance hierarchy currently

#### ✅ Interface Segregation Principle (ISP)
**Grade: B+**
- **Good:** ViewModel exposes focused interface to components
- **Good:** Clean separation via MVVM pattern
- **Minor:** Some unused state variables

#### ❌ Dependency Inversion Principle (DIP)
**Grade: D**
- **Major Violation:** Direct dependency on `runSessionClient` singleton
- **Impact:** Cannot test without real WebSocket server
- **Recommendation:** Dependency injection (see 1.3)

---

## Migration Path

### Phase 1: Foundation (Priority 1 - 2 weeks)
1. Extract MessageParser service (DRY violation)
2. Implement dependency injection for sessionClient
3. Reduce handleRunEvent complexity with Strategy pattern
4. Extract AuthenticationManager
5. Write core ViewModel tests

### Phase 2: Improvement (Priority 2 - 1 week)
6. Consolidate message state with MessageStore
7. Separate UI state from business logic
8. Implement proper error boundaries
9. Remove excessive console logging
10. Extract LiveEventManager

### Phase 3: Polish (Priority 3 - 3 days)
11. Improve naming consistency
12. Add JSDoc type annotations
13. Implement component tests
14. Performance optimizations

### Phase 4: Validation
15. Achieve 80%+ test coverage
16. Run complexity analysis
17. Performance benchmarking
18. Code review

---

## Risk Assessment

### Low Risk Refactorings
- ✅ Extract MessageParser (pure functions)
- ✅ Remove console.log (non-functional)
- ✅ Add JSDoc comments (documentation only)
- ✅ Extract LiveEventManager (isolated feature)

### Medium Risk Refactorings
- ⚠️ MessageStore (changes data flow, needs thorough testing)
- ⚠️ AuthenticationManager (critical user flow)
- ⚠️ Error handling improvements (affects all error scenarios)

### High Risk Refactorings
- ⚠️⚠️ EventHandlers Strategy pattern (touches all event processing)
- ⚠️⚠️ Dependency injection (changes initialization flow)
- ⚠️⚠️ Separate UI state (component coordination changes)

**Mitigation:**
- Comprehensive testing at each phase
- Feature flags for gradual rollout
- Maintain backward compatibility during transition
- Parallel implementation (keep old code until validated)

---

## Success Criteria

### Code Quality Metrics
- ✅ Cyclomatic complexity < 5 for all methods
- ✅ Code duplication < 5%
- ✅ No direct singleton dependencies
- ✅ Separation of concerns score: A

### Testing Metrics
- ✅ Unit test coverage > 80%
- ✅ Integration test coverage > 60%
- ✅ All critical paths tested
- ✅ Error scenarios tested

### Maintainability Metrics
- ✅ Average file size < 300 LOC
- ✅ Single responsibility per class
- ✅ Dependencies injectable
- ✅ Clear documentation (JSDoc)

---

## Recommended Reading

For team members working on these refactorings:
1. "Refactoring: Improving the Design of Existing Code" - Martin Fowler (Chapters 1, 6, 10)
2. "Clean Code" - Robert Martin (Chapters 3, 7, 10)
3. "Working Effectively with Legacy Code" - Michael Feathers (Chapter 25)
4. Svelte 5 Runes Documentation - https://svelte.dev/docs/svelte/what-are-runes

---

## Appendix A: Code Smell Checklist

### Found in ClaudePaneViewModel:
- ✅ **Long Method** - `handleRunEvent()` (112 lines)
- ✅ **Duplicated Code** - Message parsing (2 locations)
- ✅ **Large Class** - Multiple responsibilities (551 lines)
- ✅ **Feature Envy** - Accessing `runSessionClient` internals
- ✅ **Primitive Obsession** - Using strings for state instead of enums
- ✅ **Long Parameter List** - Constructor could use config object (partially done)
- ✅ **Inappropriate Intimacy** - ViewModel knows about DOM (messagesContainer)

### Not Found:
- ❌ Data Clumps
- ❌ Switch Statement Abuse (manageable currently)
- ❌ Lazy Class
- ❌ Speculative Generality

---

## Appendix B: Comparison with TerminalPaneViewModel

The `TerminalPaneViewModel` demonstrates several best practices that ClaudePaneViewModel should adopt:

**TerminalPaneViewModel Strengths:**
1. ✅ Clear section comments with separators
2. ✅ Proper logger usage (no console.log)
3. ✅ Clean initialization/lifecycle separation
4. ✅ Consistent error handling with structured returns
5. ✅ JSDoc comments with type information
6. ✅ Smaller, focused methods
7. ✅ Clear state query methods (`getState()`)

**ClaudePaneViewModel Should Adopt:**
- Structured section organization
- Logger instead of console.log
- Return objects from methods (success/error)
- Consistent JSDoc
- State query method for debugging

---

## Summary

The ClaudePaneViewModel module is functional and follows MVVM patterns correctly, but has accumulated technical debt through:
- Duplicated message parsing logic
- High complexity in event handling
- Tight coupling to singletons preventing testing
- Mixed concerns (business logic + UI state + auth flow)

**The proposed refactorings will:**
- Reduce codebase size by ~45%
- Reduce complexity by ~70-80%
- Enable comprehensive unit testing (0% → 80%+)
- Improve maintainability and extensibility
- Follow SOLID principles more strictly

**Total Estimated Effort:** 35-45 hours across all priority levels

**Recommended Approach:** Implement Priority 1 refactorings first (2 weeks) with comprehensive testing, then evaluate whether Priority 2 and 3 refactorings provide sufficient ROI for the remaining effort.
