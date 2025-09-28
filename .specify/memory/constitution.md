<!-- Sync Impact Report
Version change: 0.0.0 → 1.0.0 (initial constitution creation)
Added sections:
- Core Principles (5 principles defined)
- Implementation Standards
- Quality Assurance
- Governance
Templates requiring updates: (to be verified)
✅ plan-template.md - references Constitution Check
✅ spec-template.md - compatible with current structure
✅ tasks-template.md - compatible with task categorization
✅ agent file templates - no outdated references found
-->

# Dispatch Constitution

## Core Principles

### I. Security-First Architecture

Every feature must maintain strict isolation boundaries. Containerized execution is mandatory for all untrusted code. No session may access host system files without explicit user authorization. Security boundaries are non-negotiable and cannot be bypassed for convenience.

### II. Event-Sourced State Management

All session activity must be recorded as immutable events with monotonic sequence numbers. Sessions must be fully recoverable from event history. State changes must be reproducible from any point in the timeline. This enables session portability, debugging, and multi-client synchronization.

### III. Adapter Pattern for Extensibility

New session types must be implemented as adapters conforming to the established interface. Adapters must be self-contained with clear boundaries. Core session management logic must remain type-agnostic. This ensures maintainability and enables feature additions without architectural changes.

### IV. Test-Driven Development

Tests must be written before implementation. Red-Green-Refactor cycle is mandatory for all new features. Unit tests required for business logic, integration tests required for session management and Socket.IO communication. Test coverage must not decrease with any change.

### V. Progressive Enhancement

Start with the simplest working implementation. Features must degrade gracefully when dependencies unavailable. Advanced capabilities (SSL, tunnels, VS Code) must be optional. Core functionality must work in minimal Docker environment.

## Implementation Standards

- **MVVM Frontend Architecture**: Svelte 5 with clean separation of ViewModels ($state runes) and Views (components)
- **Unified Session Protocol**: All session types use consistent Socket.IO event structure
- **Database Schema Evolution**: SQLite migrations
- **Docker Best Practices**: Multi-stage builds, non-root execution, minimal image size
- **Node.js 22+**: Required for modern JavaScript features and performance

## Quality Assurance

- **Code Review**: All changes require review against constitution principles
- **Code Formatting** Must run `npm run format` after changes to ensure proper code formatting
- **Testing Gates**: Unit tests (Vitest), E2E tests (Playwright), lint checks must pass
- **Security Audit**: Any authentication, authorization, or isolation changes require security review
- **Performance Monitoring**: Session replay performance must remain sub-100ms
- **Documentation**: CLAUDE.md and AGENTS.md must be updated for architectural changes

## Governance

The constitution supersedes all development practices. Amendments require:

1. Documentation of the proposed change and rationale
2. Impact assessment on existing features
3. Migration plan if breaking changes required
4. Team approval with version bump

Version bumping follows semantic versioning:

- MAJOR: Removing principles or incompatible governance changes
- MINOR: Adding principles or expanding guidance materially
- PATCH: Clarifications, wording improvements, typo fixes

All pull requests must verify constitutional compliance. Complexity additions must be justified against user value. Use CLAUDE.md for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2025-09-27 | **Last Amended**: 2025-09-27
