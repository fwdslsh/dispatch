# Dispatch Architecture Diagrams

This directory contains comprehensive architecture diagrams for the Dispatch system. Each diagram uses Mermaid format for rendering in GitHub and documentation tools.

## Overview

Dispatch is a containerized web application providing interactive terminal sessions and AI-powered coding assistance via browser. These diagrams illustrate the system's architecture, design patterns, and key components.

## Diagram Index

### 01. High-Level Architecture
**File:** [01-high-level-architecture.md](01-high-level-architecture.md)

**Description:** Overall system architecture showing the main components and their interactions, including the client layer, SvelteKit application (frontend and backend), runtime layer with session management, and storage.

**Key Topics:**
- Client-Server architecture
- SvelteKit frontend and backend
- Session management runtime
- External service integrations
- Data flow patterns

### 02. Session Management Architecture
**File:** [02-session-management.md](02-session-management.md)

**Description:** Unified session management system built on event sourcing principles, showing how RunSessionManager coordinates different session types through adapters.

**Key Topics:**
- Event sourcing core
- Adapter pattern implementation
- Session lifecycle management
- Multi-client synchronization
- Event persistence and replay

### 03. Authentication System
**File:** [03-authentication-system.md](03-authentication-system.md)

**Description:** Dual authentication system supporting both session cookies (for browsers) and API keys (for programmatic access), plus optional OAuth integration.

**Key Topics:**
- Cookie-based authentication
- API key authentication
- OAuth provider integration
- Middleware architecture
- Session lifecycle management
- Security features

### 04. Frontend MVVM Architecture
**File:** [04-frontend-mvvm.md](04-frontend-mvvm.md)

**Description:** Svelte 5 MVVM pattern using runes for reactivity, ServiceContainer for dependency injection, and clean separation between Views, ViewModels, and Services.

**Key Topics:**
- MVVM pattern with Svelte 5
- Reactive state management ($state, $derived)
- ServiceContainer dependency injection
- View-ViewModel-Service separation
- Data flow patterns

### 05. Database Schema
**File:** [05-database-schema.md](05-database-schema.md)

**Description:** SQLite database structure supporting event-sourced sessions, authentication, workspace management, and application settings.

**Key Topics:**
- Table relationships
- Event sourcing schema
- Authentication tables
- Workspace management
- Settings storage
- Query patterns

### 06. Socket.IO Event Flow
**File:** [06-socketio-event-flow.md](06-socketio-event-flow.md)

**Description:** Real-time bidirectional communication protocol using Socket.IO, including authentication, session attachment, event streaming, and multi-client synchronization.

**Key Topics:**
- Event protocol specification
- Client-server communication
- Event replay mechanism
- Multi-client synchronization
- Error handling
- Performance considerations

### 07. Session Adapter Pattern
**File:** [07-session-adapter-pattern.md](07-session-adapter-pattern.md)

**Description:** Adapter pattern enabling extensible session types with a unified interface, allowing new session capabilities without modifying core RunSessionManager.

**Key Topics:**
- Adapter interface contract
- Concrete adapter implementations
- Adapter registration
- Adding new adapters
- Benefits of the pattern

### 08. API Routes Structure
**File:** [08-api-routes.md](08-api-routes.md)

**Description:** RESTful API architecture, route organization, and request/response flow through the SvelteKit backend.

**Key Topics:**
- API route groups
- REST endpoints
- Authentication flow
- Request/response formats
- Error handling
- Best practices

### 09. Settings System
**File:** [09-settings-system.md](09-settings-system.md)

**Description:** Hierarchical settings management with category-based organization, database persistence, and real-time UI synchronization.

**Key Topics:**
- Category-based organization
- Settings storage and retrieval
- Default settings
- Validation and migrations
- Real-time synchronization
- OAuth settings management

### 10. Configuration System
**File:** [10-configuration-system.md](10-configuration-system.md)

**Description:** Environment-based configuration system, including environment variables, runtime modes, and deployment configurations.

**Key Topics:**
- Environment variables
- Development modes
- Docker configuration
- CLI configuration
- Validation and defaults
- Best practices

## How to Use These Diagrams

### Viewing in GitHub
All diagrams use Mermaid syntax and render automatically in GitHub's markdown viewer. Simply click on any `.md` file to view the rendered diagram.

### Viewing Locally
You can use any markdown viewer that supports Mermaid, such as:
- **VS Code**: Install the "Markdown Preview Mermaid Support" extension
- **IntelliJ/WebStorm**: Built-in Mermaid support in markdown preview
- **Obsidian**: Native Mermaid support
- **Typora**: Native Mermaid support

### For New Developers
**Recommended Reading Order:**

1. Start with **01-high-level-architecture.md** for system overview
2. Read **02-session-management.md** to understand core architecture
3. Study **04-frontend-mvvm.md** for frontend patterns
4. Review **03-authentication-system.md** for security implementation
5. Explore specific areas as needed (API routes, settings, etc.)

### For Feature Development
**When adding new features, reference:**

- **07-session-adapter-pattern.md** - For new session types
- **08-api-routes.md** - For new API endpoints
- **04-frontend-mvvm.md** - For UI components
- **09-settings-system.md** - For configurable features

### For DevOps/Deployment
**Focus on:**

- **10-configuration-system.md** - Environment setup
- **03-authentication-system.md** - Security configuration
- **05-database-schema.md** - Data persistence

### For API Integration
**Reference:**

- **08-api-routes.md** - REST API documentation
- **06-socketio-event-flow.md** - Real-time events
- **03-authentication-system.md** - Authentication methods

## Diagram Conventions

### Color Coding
- **Blue (#e7f3ff)**: Core infrastructure components
- **Yellow (#fff3cd)**: Business logic and orchestration
- **Green (#d4edda)**: Data storage and persistence
- **Pink (#fce8e8)**: External services and clients

### Diagram Types
- **Component Diagrams**: Show system components and relationships
- **Sequence Diagrams**: Show interaction flows over time
- **Class Diagrams**: Show object-oriented structure
- **Entity-Relationship Diagrams**: Show database schema
- **Flow Charts**: Show decision flows and processes

## Contributing

When updating or adding diagrams:

1. **Follow Naming Convention**: `##-descriptive-name.md` (numbered for order)
2. **Include Description**: Start with a brief description of what the diagram shows
3. **Add Key Topics**: List main concepts covered
4. **Use Mermaid Syntax**: Ensure diagrams render properly
5. **Update This README**: Add entry to the index above
6. **Test Rendering**: Verify diagram renders correctly in GitHub

## Additional Resources

### Related Documentation
- **Architecture Guide**: `../mvvm-patterns.md`
- **Adapter Guide**: `../adapter-guide.md`
- **API Documentation**: `../../reference/api-routes.md`
- **Database Reference**: `../../reference/database-schema.md`

### Mermaid Resources
- [Mermaid Documentation](https://mermaid.js.org/)
- [Mermaid Live Editor](https://mermaid.live/)
- [GitHub Mermaid Support](https://github.blog/2022-02-14-include-diagrams-markdown-files-mermaid/)

## Questions?

For questions about these diagrams or the architecture they represent:
- Review the related documentation linked above
- Check the main project README at `/docs/README.md`
- Consult the CLAUDE.md file for development guidelines
