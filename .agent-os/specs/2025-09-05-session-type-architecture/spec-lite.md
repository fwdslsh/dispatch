# Session Type Architecture Refactoring - Lite Summary

Transform session types into the primary extension point of the Dispatch terminal application by isolating PTY/Terminal and Claude Code session types into dedicated, pluggable modules with a registry-based system. This refactoring enables each session type to operate in its own namespace with dedicated WebSocket handlers, creation forms, and rendering components, allowing developers to create custom session types without modifying core code.

## Key Points

- Refactor session types to be the main extension point with complete isolation between PTY/Terminal and Claude Code session types
- Implement session type system with pluggable architecture for custom forms and components
- Enable developers to create new session types by extended base class and placing files in dedicated folder structures (`src/lib/session-types/{type-name}/`)
