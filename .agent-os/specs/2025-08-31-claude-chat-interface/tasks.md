# Spec Tasks

## Tasks

- [ ] 1. **Set up Claude Code SDK integration and authentication**
  - [ ] 1.1 Write tests for Claude Code SDK service wrapper
  - [ ] 1.2 Install and configure @anthropic-ai/claude-code-sdk package
  - [ ] 1.3 Create ClaudeCodeService class with query() method integration
  - [ ] 1.4 Integrate with Claude.ai subscription authentication using CLI credentials
  - [ ] 1.5 Create authentication status endpoints and login handling
  - [ ] 1.6 Add authentication middleware that verifies Claude CLI login status
  - [ ] 1.7 Create user context provider for auth state management
  - [ ] 1.8 Verify all authentication and SDK tests pass

- [ ] 2. **Implement core chat interface components**
  - [ ] 2.1 Write tests for ChatInterface.svelte component
  - [ ] 2.2 Create ChatInterface.svelte with virtual scrolling message display
  - [ ] 2.3 Implement distinct user vs assistant message styling
  - [ ] 2.4 Add typing indicator with CSS animation (three dots pulse)
  - [ ] 2.5 Implement message formatting for code blocks and markdown
  - [ ] 2.6 Add localStorage-based chat history storage
  - [ ] 2.7 Create responsive design matching Dispatch theme
  - [ ] 2.8 Verify all chat interface tests pass

- [ ] 3. **Build command menu system**
  - [ ] 3.1 Write tests for CommandMenu.svelte component
  - [ ] 3.2 Create CommandMenu component with searchable command list
  - [ ] 3.3 Implement keyboard shortcut (Cmd/Ctrl + K) trigger
  - [ ] 3.4 Pre-populate with Claude Code commands from current project/session
  - [ ] 3.5 Add command execution handler with chat input integration
  - [ ] 3.6 Implement session-based command caching
  - [ ] 3.7 Verify all command menu tests pass

- [ ] 4. **Create settings panel and configuration**
  - [ ] 4.1 Write tests for ChatSettings.svelte component
  - [ ] 4.2 Create ChatSettings component with tabbed interface
  - [ ] 4.3 Implement forms for allowed tools configuration
  - [ ] 4.4 Add permission mode and model selection dropdowns
  - [ ] 4.5 Create MCP server configuration interface
  - [ ] 4.6 Implement database storage for user settings
  - [ ] 4.7 Apply settings to SDK initialization on chat load
  - [ ] 4.8 Verify all settings panel tests pass

- [ ] 5. **Integrate with existing Dispatch infrastructure**
  - [ ] 5.1 Write tests for Socket.IO chat event handlers
  - [ ] 5.2 Extend Socket.IO with claude:query, claude:response, claude:typing events
  - [ ] 5.3 Create new view at /sessions/[id] with chat view option
  - [ ] 5.4 Replace existing mobile chat view with new chat interface for Claude sessions
  - [ ] 5.5 Add chat mode toggle in session header toolbar
  - [ ] 5.6 Implement database schema with SQLite/IndexDB integration
  - [ ] 5.7 Ensure compatibility with existing terminal functionality
  - [ ] 5.8 Verify all integration tests pass