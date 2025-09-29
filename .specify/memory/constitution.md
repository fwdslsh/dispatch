<!-- Sync Impact Report
Version change: 1.1.0 → 1.2.0 (deprioritize TDD, revise security/architecture principle)
Modified principles:
- "Security-First Architecture" → "Isolated, Remotely Accessible Development Environment" (revised and renamed)
- "Test-Driven Development" deprioritized (moved to implementation standards, not a core principle)
Templates requiring updates:
✅ plan-template.md - Constitution Check aligns (no change needed)
✅ spec-template.md - User scenarios/test guidance matches (no change needed)
✅ tasks-template.md - Task categories compatible (no change needed)
✅ README.md - Security/architecture summary and TDD emphasis (if present) should be reviewed for alignment
✅ docs/quickstart.md - Should clarify remote, single-user, isolated environment
Follow-up TODOs:
None (all placeholders resolved)
-->

# Dispatch Constitution

## Core Principles

### I. Simplicity & Maintainability

Dispatch must prioritize simple, maintainable architecture that is robust, flexible, and not overengineered. The SOLID and YAGNI principles must guide all design and implementation decisions. Simplicity is the grounding principle: avoid unnecessary abstraction, complexity, or features. Unnecessary third-party dependencies are prohibited unless explicitly approved as part of a feature specification.

**Rationale:** Simple systems are easier to maintain, test, and extend. By grounding all work in simplicity and proven design principles, Dispatch remains robust, flexible, and accessible to contributors. Avoiding unnecessary dependencies reduces risk and ensures long-term sustainability.

### II. Single-User, Developer-First Platform

Dispatch is designed and governed as a single-user platform, intended for use by individual developers as their primary development environment. All features, user stories, and use cases must be justified by the needs of a single developer working in their own isolated workspace. Multi-user, team, or shared scenarios are explicitly out of scope unless they directly enhance the single-user experience. This principle is non-negotiable and supersedes all others in case of conflict.

**Rationale:** Focusing on the individual developer ensures simplicity, security, and a tailored experience. It prevents unnecessary complexity and risk introduced by multi-user features, and guarantees that all improvements serve the core user: a developer using Dispatch as their main environment.

### III. Isolated, Remotely Accessible Development Environment

Dispatch must provide a fully isolated development environment for a single user, accessible remotely without requiring cloud hosting or complex home networking. All code and sessions must run in secure containers, with no exposure of host system files unless explicitly authorized. The platform must enable secure remote access (e.g., via tunnels or direct connection) for the individual developer, ensuring privacy and simplicity. No feature may compromise this isolation or require multi-user access.

**Rationale:** Developers need a secure, private workspace that can be accessed from anywhere, without the risks or complexity of exposing their home network or relying on third-party cloud providers. This principle ensures that Dispatch remains simple, secure, and truly single-user.

### IV. Event-Sourced State Management

All session activity must be recorded as immutable events with monotonic sequence numbers. Sessions must be fully recoverable from event history. State changes must be reproducible from any point in the timeline. This enables session portability, debugging, and reliable recovery for the single user.

### V. Adapter Pattern for Extensibility

New session types must be implemented as adapters conforming to the established interface. Adapters must be self-contained with clear boundaries. Core session management logic must remain type-agnostic. This ensures maintainability and enables feature additions without architectural changes, always serving the single-user, developer-centric model.

### VI. Progressive Enhancement

Start with the simplest working implementation. Features must degrade gracefully when dependencies are unavailable. Advanced capabilities (SSL, tunnels, VS Code) must be optional. Core functionality must work in a minimal Docker environment, always prioritizing the needs of the individual developer.

## Implementation Standards

- **Simplicity First**: Favor simple, direct solutions. Avoid overengineering and unnecessary abstraction.
- **SOLID & YAGNI**: Apply SOLID and YAGNI principles to all code and architecture decisions.
- **Minimal Dependencies**: Avoid introducing third-party dependencies unless explicitly approved in a feature spec.
- **Single-User Focus**: All implementation decisions must reinforce the single-user, developer-primary use case.
- **MVVM Frontend Architecture**: Svelte 5 with clean separation of ViewModels ($state runes) and Views (components)
- **Unified Session Protocol**: All session types use consistent Socket.IO event structure
- **Database Schema Evolution**: SQLite migrations
- **Docker Best Practices**: Multi-stage builds, non-root execution, minimal image size
- **Node.js 22+**: Required for modern JavaScript features and performance
- **Testing Discipline**: While tests are important, strict test-driven development (TDD) is not required. Tests should be added where they provide clear value, but implementation may proceed before tests in cases where rapid prototyping or research is needed.

## Quality Assurance

- **Code Review**: All changes require review against constitution principles, with special attention to single-user, developer-centric focus
- **Code Formatting**: Must run `npm run format` after changes to ensure proper code formatting
- **Testing Gates**: Unit tests (Vitest), E2E tests (Playwright), lint checks must pass
- **Security Audit**: Any authentication, authorization, or isolation changes require security review
- **Performance Monitoring**: Session replay performance must remain sub-100ms
- **Documentation**: CLAUDE.md and AGENTS.md must be updated for architectural changes

## Governance

The constitution supersedes all development practices. Amendments require:

1. Documentation of the proposed change and rationale
2. Impact assessment on existing features and on the single-user, developer-primary focus
3. Migration plan if breaking changes required
4. Team approval with version bump

Version bumping follows semantic versioning:

- MAJOR: Removing principles or incompatible governance changes
- MINOR: Adding principles or expanding guidance materially (including changes to the single-user, developer focus)
- PATCH: Clarifications, wording improvements, typo fixes

All pull requests must verify constitutional compliance. Complexity additions must be justified against the value to the individual developer. Use CLAUDE.md for runtime development guidance.

**Version**: 1.3.0 | **Ratified**: 2025-09-27 | **Last Amended**: 2025-09-29
