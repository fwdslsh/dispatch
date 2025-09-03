# Spec Requirements Document

> Spec: server-architecture-refactoring
> Created: 2025-09-02

## Overview

Refactor the Dispatch server architecture to eliminate critical technical debt by splitting the monolithic socket handler, consolidating multiple overlapping storage systems, and implementing proper separation of concerns following SOLID principles. This refactoring will improve code maintainability, testability, and scalability while reducing complexity and removing architectural violations identified in the comprehensive server architecture review.

## User Stories

### Developer Maintainability

As a developer working on the Dispatch server, I want to have focused, single-responsibility modules so that I can easily understand, modify, and test specific functionality without navigating through a massive 1,138-line file.

The current socket-handler.js violates the Single Responsibility Principle by handling 28+ different responsibilities including authentication, session lifecycle, project management, terminal I/O, Claude authentication workflow, file system operations, directory listing, rate limiting, error handling, and cleanup. This makes the codebase fragile, difficult to test, and hard to extend with new features.

### Data Consistency and Reliability

As a system operator, I want a unified data storage approach so that session and project data remains consistent and reliable without the risk of data conflicts from multiple overlapping storage systems.

Currently, the system maintains three coexisting storage approaches: legacy session store (sessions.json), project-based storage (projects.json + project directories), and DirectoryManager storage (.dispatch/ structure). This creates complexity without clear benefits and introduces potential data inconsistency risks.

### Code Quality and Testing

As a developer, I want properly separated components with dependency injection so that I can write comprehensive unit tests and maintain high code quality standards.

The current tight coupling between components makes it nearly impossible to mock dependencies for testing, while large complex functions (110-150 lines each) are difficult to unit test, debug, and maintain.

## Spec Scope

1. **Socket Handler Refactoring** - Split the monolithic 1,138-line socket-handler.js into focused handlers using a router pattern with separate AuthHandler, SessionHandler, ProjectHandler, ClaudeAuthHandler, and TerminalIOHandler classes.

2. **Storage System Consolidation** - Eliminate the three overlapping storage systems and implement a single, unified storage approach with proper data migration and consistency guarantees.

3. **Authentication Middleware** - Extract and centralize authentication logic into reusable middleware that ensures consistent auth handling across all endpoints and operations.

4. **Dependency Injection Implementation** - Implement proper dependency injection patterns to decouple components and enable comprehensive testing with mocked dependencies.

5. **Service Layer Architecture** - Establish a clean service layer with dedicated SessionService, ProjectService, AuthService, and StorageService following single responsibility principles.

## Out of Scope

- Backwards compatibility or migration
- Performance optimization beyond architectural improvements (horizontal scaling, caching layers)
- Database migration to external systems (PostgreSQL, Redis)
- Frontend component refactoring or UI/UX changes
- New feature development or API endpoint additions
- DevOps pipeline or deployment configuration changes
- Security auditing beyond fixing inconsistent authentication patterns
- Legacy code migration from other parts of the codebase not identified in the review

## Expected Deliverable

1. **Modular Socket Architecture** - A refactored server with clearly separated handlers, each responsible for a single domain (auth, sessions, projects, Claude integration, terminal I/O) that can be independently tested and maintained.

2. **Unified Data Storage** - A single, consistent storage system with proper data migration from existing systems and elimination of the three overlapping approaches currently causing complexity.

3. **Testable Codebase** - All major components properly decoupled with dependency injection, enabling comprehensive unit testing with >80% code coverage for core business logic.