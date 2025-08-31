# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-31-claude-chat-interface/spec.md

## Technical Requirements

### Chat Interface Implementation
- Implement `ChatInterface.svelte` component with message history display using virtual scrolling for performance
- Design message components with distinct styling for user vs assistant messages
- Implement typing indicator overlay that appears during Claude Code processing
- Store chat history in browser localStorage with session-based keys
- Handle message formatting including code blocks, markdown, and special Claude Code outputs

### Claude Code SDK Integration
- Install and configure `@anthropic-ai/claude-code-sdk` package
- Create `ClaudeCodeService` class to wrap SDK functionality
- Implement `query()` method integration with proper error handling
- Configure SDK options including model selection, system prompts, and tool permissions
- Handle non-streaming responses with proper typing indicator coordination
- Implement message queuing to prevent concurrent requests

### Command Menu Implementation
- Create `CommandMenu.svelte` component with searchable command list
- Implement keyboard shortcut (Cmd/Ctrl + K) to trigger menu
- Pre-populate with Claude Code commands from the current project/session
- Add command execution handler that integrates with chat input
- Cache commands per session

### Authentication System
- Integrate with Claude.ai subscription authentication using existing Claude CLI credentials
- Create `/auth/claude` endpoint to handle login status verification
- Utilize Claude Code SDK's built-in authentication that uses stored credentials
- Implement session validation to check if user is logged in to Claude.ai
- Add authentication middleware that verifies Claude CLI login status
- Create user context provider for component access to authentication state
- Handle login prompts by directing users to use `/login` command in terminal

### Settings Panel
- Create `ChatSettings.svelte` component with tabbed interface
- Implement forms for configuring:
  - Allowed tools (with checkbox list from SDK)
  - Permission mode (dropdown list from SDK)  
  - Model selection (dropdown with available models)
  - MCP server configuration (JSON editor / file uploader)
- Store settings in database per user/session
- Apply settings to SDK initialization on chat load

### UI/UX Specifications
- Responsive design supporting desktop and tablet viewports
- Theme support matching existing Dispatch theme
- Typing indicator using CSS animation (three dots pulse)
- Message timestamps with relative time display
- Copy code button for code blocks in messages
- Smooth scroll to bottom on new messages
- Unread message indicator when scrolled up

### Integration Requirements
- Extend existing Socket.IO infrastructure for real-time updates
- Add new socket events: 'claude:query', 'claude:response', 'claude:typing'
- Integrate with existing session management system
- Share authentication state with terminal sessions
- Add chat mode toggle in session header toolbar
- Maintain compatibility with existing terminal functionality

### Performance Criteria
- Initial chat interface load time < 500ms
- Message rendering < 100ms per message
- Typing indicator response time < 200ms
- Command menu open time < 50ms
- Settings save confirmation < 300ms
- Support chat history up to 1000 messages without degradation

## External Dependencies

- **@anthropic-ai/claude-code-sdk** - Official Claude Code TypeScript SDK for AI interactions
- **Justification:** Required for proper integration with Claude Code features and typed interfaces

- **svelte-virtual-list** - Virtual scrolling for chat messages
- **Justification:** Necessary for performance with large message histories

- **marked** - Markdown parser for message formatting
- **Justification:** Required to properly render Claude's markdown responses

- **prismjs** - Syntax highlighting for code blocks
- **Justification:** Enhances readability of code in chat messages