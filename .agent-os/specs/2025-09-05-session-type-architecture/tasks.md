# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-05-session-type-architecture/spec.md

> Created: 2025-09-05
> Status: Ready for Implementation

## Tasks

### 1. Foundation Layer - Registry and Base Classes

- [x] 1.1 Write unit tests for SessionTypeRegistry class (registry validation, type storage, category filtering)
- [x] 1.2 Implement SessionTypeRegistry with Map-based storage and validation methods
- [x] 1.3 Create BaseSessionType abstract class with lifecycle hooks and default implementations
- [x] 1.4 Write unit tests for BaseSessionType validation and configuration handling
- [x] 1.5 Create session-types folder structure with base/, shared/, shell/, claude/ directories
- [x] 1.6 Implement session-types/index.js with manual registration system and static exports
- [x] 1.7 Create base Svelte components (BaseCreationForm.svelte, BaseSessionView.svelte)
- [x] 1.8 Verify all foundation layer tests pass and registry system is functional

### 2. WebSocket Namespace Isolation Framework

- [x] 2.1 Write integration tests for namespace creation and handler registration
- [x] 2.2 Extend socket-handler.js to create isolated namespaces per session type
- [x] 2.3 Implement createSessionTypeHandler function with static handler mapping
- [x] 2.4 Create SESSION_TYPE_HANDLERS object with static imports for build optimization
- [x] 2.5 Add namespace connection/disconnection logging and error handling
- [x] 2.6 Create base handler pattern for session types with standard event signatures
- [x] 2.7 Implement handler factory interface that session types must implement
- [x] 2.8 Verify namespace isolation tests pass and handlers are properly registered

### 3. Shell Session Type - Reference Implementation

- [x] 3.1 Write unit tests for Shell session type configuration and validation
- [x] 3.2 Create shell session type definition extending BaseSessionType
- [x] 3.3 Implement ShellHandler.js and ShellIOHandler.js with existing terminal logic
- [ ] 3.4 Write component tests for ShellCreationForm.svelte with form validation
- [x] 3.5 Create ShellCreationForm.svelte with terminal configuration options
- [ ] 3.6 Create ShellSessionView.svelte wrapping Terminal.svelte with shell-specific UI
- [ ] 3.7 Integrate shell session type with TerminalManager for PTY management
- [ ] 3.8 Verify shell session type tests pass and terminal functionality works correctly

### 4. Claude Session Type - Second Implementation

- [ ] 4.1 Write unit tests for Claude session type with authentication and command validation
- [ ] 4.2 Create claude session type definition with Claude-specific configuration
- [ ] 4.3 Implement ClaudeHandler.js and ClaudeAuthHandler.js for Claude Code integration
- [ ] 4.4 Write component tests for ClaudeCreationForm.svelte with auth flow validation
- [ ] 4.5 Create ClaudeCreationForm.svelte with Claude authentication and project selection
- [ ] 4.6 Create ClaudeSessionView.svelte with Claude-specific terminal and chat interface
- [ ] 4.7 Implement Claude session storage for authentication tokens and metadata
- [ ] 4.8 Verify Claude session type tests pass and Claude Code integration works correctly

### 5. UI Integration and Dynamic Component Rendering

- [ ] 5.1 Write component tests for TypePicker.svelte with session type selection
- [ ] 5.2 Create TypePicker.svelte with session type registry integration and icons
- [ ] 5.3 Write component tests for CreationFormContainer.svelte with conditional rendering
- [ ] 5.4 Create CreationFormContainer.svelte with static conditional form rendering
- [ ] 5.5 Update session routing ([id]/+page.svelte) to conditionally render session type components
- [ ] 5.6 Create session creation flow integrating type picker and form container
- [ ] 5.7 Update main application interface to use session type registry for session management
- [ ] 5.8 Verify UI integration tests pass and end-to-end session creation workflow functions correctly
