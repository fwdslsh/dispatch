# Spec Requirements Document

> Spec: Session Type Architecture Refactoring
> Created: 2025-09-05
> Status: Planning

## Overview

Transform session types into the primary extension point of the Dispatch terminal application by isolating PTY/Terminal and Claude Code session types into dedicated, pluggable modules. This refactoring will create a registry-based system where each session type operates in its own namespace with dedicated WebSocket handlers, creation forms, and rendering components.

## User Stories

1. **As a developer**, I want to create custom session types by extending a base class and registering them with the system, so I can extend Dispatch functionality without modifying core code.

2. **As a user**, I want to select from different session types during creation and have each type present its own custom configuration form, so I can create specialized sessions tailored to specific workflows.

3. **As a system administrator**, I want session types to operate in complete isolation with their own data storage and WebSocket namespaces, so I can manage and debug different session types independently.

## Spec Scope

1. **Session Type Registry**: Implement a centralized registry where session types are manually registered with metadata, interfaces, and component references.

2. **Isolated Session Type Folders**: Create dedicated folder structure (`src/lib/session-types/{type-name}/`) where each session type contains all its logic, components, and configuration.

3. **Custom WebSocket Handlers**: Enable session types to define their own WebSocket event handlers within dedicated namespaces to prevent event conflicts.

4. **Pluggable Creation Forms**: Allow session types to provide custom Svelte components for session creation forms that appear in a type picker interface.

5. **Session Component Rendering**: Enable session types to define their own top-level rendering components that replace the current monolithic Terminal.svelte when that session type is active.

## Out of Scope

- Breaking compatibility with existing active sessions during the refactor
- Changing the core WebSocket architecture or Socket.IO implementation
- Modifying the underlying PTY management or container integration
- Altering the project management or directory structure system
- Adding dynamic session type loading or hot-swapping capabilities
- Creating a plugin marketplace or external session type distribution system

## Expected Deliverable

1. **New Session Type Creation**: Developers can create a new session type by extending a base class, placing files in the dedicated folder structure, and registering it with the system without modifying core application code.

2. **Session Type Isolation**: PTY/Terminal and Claude Code session types operate as independent, isolated modules that can be developed, tested, and debugged separately from each other and the core system.

3. **Custom Creation Experience**: Users see a session type picker during creation, with the selected type displaying its own custom configuration form, demonstrating the pluggable UI system working end-to-end.

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-05-session-type-architecture/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-05-session-type-architecture/sub-specs/technical-spec.md
- Database Schema: @.agent-os/specs/2025-09-05-session-type-architecture/sub-specs/database-schema.md
- API Specification: @.agent-os/specs/2025-09-05-session-type-architecture/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-09-05-session-type-architecture/sub-specs/tests.md
