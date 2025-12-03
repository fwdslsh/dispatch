# Changelog

All notable changes to Dispatch will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-20

### Added
- **E2E Test Suite**: Comprehensive regression test coverage (33 tests passing)
  - New `e2e/onboarding-regressions.spec.js` with 10 regression tests
  - Authentication test suite (23 tests) covering API key login, session persistence, and multi-tab synchronization
  - Accessibility test suite for WCAG compliance
  - Session and workspace test suites
- **API Error Handling**: Standardized error handling across all 57 API routes (H7 Migration)
  - Consistent error response format with structured error objects
  - Comprehensive error boundaries for async operations
  - Improved error messages and user feedback
- **Authentication Enhancements**:
  - Rate limiting for authentication attempts (10 per minute per IP)
  - Strategy pattern implementation for extensible auth methods
  - Improved session cookie security with httpOnly, Secure, and SameSite flags
  - API key management with creation timestamps and labels
- **MVVM Architecture**: Complete frontend refactoring to clean MVVM pattern (H1-H6, H14-H15)
  - ViewModels with Svelte 5 runes ($state, $derived, $effect)
  - ServiceContainer for dependency injection
  - Separation of business logic from UI components
  - Comprehensive MVVM patterns documentation
- **Settings System**: Plugin-based settings registry with category-based organization
  - OAuth provider configuration UI
  - Theme management settings
  - Workspace environment variables
  - Home directory manager
- **Git Features**:
  - Git worktree support with initialization helpers
  - Complete git operations API (status, commit, push, pull)
  - Tilde expansion for file paths
- **Developer Experience**:
  - `.nvmrc` file for Node.js version consistency (v22)
  - Comprehensive test helpers and database seeding utilities
  - Test automation key for predictable E2E testing
  - Dedicated `dev:test` server for automated UI testing (port 7173, no SSL)

### Fixed
- **Critical UX Issues**:
  - Login page now accessible during onboarding (exempted from redirects)
  - Login error messages clear reactively when user starts typing
  - Protected routes properly redirect to onboarding when incomplete
  - Test automation key consistency for E2E tests
- **Security Vulnerabilities**:
  - All dependency security vulnerabilities resolved (H6)
  - Path traversal attack prevention (H12)
  - OAuth client secret encryption (C1)
  - Git API security hardening
- **Performance**:
  - N+1 query pattern fixed in workspace API (C3)
  - Event sourcing race conditions resolved
  - Promise chain poisoning prevention
  - Memory leak fixes in event system
- **Type Safety**:
  - All TypeScript type errors resolved (363 → 0) (H5)
  - Comprehensive JSDoc parameter types
  - Correct async function return types
- **Build & Runtime**:
  - Fixed critical import path issues ($lib imports replaced with relative paths)
  - Session crash fix in DELETE /api/sessions
  - EventStore race condition with Promise-based locks
  - Socket.IO authentication event handling

### Changed
- **Refactoring**:
  - Authentication middleware refactored with Strategy pattern (H8)
  - All 57 API routes migrated to standardized error handling (H7)
  - Complete MVVM refactoring across frontend (H1-H15)
  - Settings system unified with dot-notation access
  - Repository pattern for database operations
- **Testing**:
  - Removed obsolete E2E tests (3 files, -587 lines)
  - Removed test-specific API endpoints (anti-pattern)
  - Improved test isolation and database seeding
  - Added comprehensive unit test coverage
- **Documentation**:
  - Updated `CLAUDE.md` with onboarding route exemptions
  - Added MVVM patterns guide
  - Added adapter registration guide
  - Added error handling guide
  - Import patterns prevention guide

### Removed
- Test-specific API endpoints (`/api/test/*`) - anti-pattern eliminated
- Obsolete E2E test files:
  - `e2e/auth-login.spec.ts` (duplicated functionality)
  - `e2e/login-animation-capture.spec.js` (design tool, not regression tests)
  - `e2e/window-manager-migration.spec.js` (failing tests for removed features)
- Legacy code and documentation after unified session refactor
- Outdated unit tests for deprecated settings system

## [0.2.1] - 2024-12-15

### Added
- Release script for versioning and tagging
- Server-driven home directory detection via environment API
- Comprehensive documentation for Home Directory Manager
- Security tests for Home Directory Manager
- Session event cleanup logic for failed run sessions

### Fixed
- Text selection behavior during drag in Split component
- Terminal scroll class for full height rendering
- Directory browser and file editor style fixes
- Base URL for testing environment

### Changed
- Relocated TerminalHeader component and updated import paths
- Simplified terminal layout styles by removing unnecessary flex properties
- Enhanced CSS style guide with comprehensive documentation
- Finalized CSS refactor with accurate completion status

### Removed
- CSS Optimization Report and Refactor TODO documents after 97% CSS reduction

## [0.2.0] - 2024-12-01

### Added
- Git operations for DirectoryBrowser component with tests
- Tunnel URL check after container start with API integration
- Runtime tunnel control with TunnelManager and UI
- Subdomain configuration for LocalTunnel
- Socket.IO integration for tunnel management
- Comprehensive documentation for advanced configuration and troubleshooting
- AI agent sandbox documentation

### Fixed
- Directory cloning layout issues and JavaScript errors
- Accessibility fixes across components
- TunnelControl localStorage key correction

### Changed
- Font styles refactoring and build script improvements
- Simplified setup by removing PTY_MODE configuration
- Enhanced setup instructions and security feature documentation
- Improved spacing and responsiveness in clone directory form

## [0.1.2] - 2024-11-15

### Added
- FileEditor component for editing files with save/cancel functionality
- Quick-create buttons for file editor
- Confirmation dialogs for unsaved changes
- localStorage state management for file editor
- Help modal for keyboard shortcuts in file editor
- Mobile-specific terminal view with HTML rendering for touch devices
- Mobile keyboard toolbar and text input for terminal sessions
- Custom settings sections for session type modules

### Fixed
- Session creation logic for file editor
- Default model handling in Claude settings
- Mobile terminal input for better usability

### Changed
- Expanded Claude settings component to support full SDK configuration options
- Updated Claude default query options to bypass permissions and enable all tools
- Enhanced PWA installation instructions
- Improved documentation organization and user-friendliness
- Modularized icon components

### Removed
- Mobile text input and keyboard toolbar components from terminal pane (replaced with mobile-specific view)

## [0.1.1] - 2024-11-01

### Added
- Message ID generation for Claude sessions
- Session resume functionality with improved state management
- Comprehensive session management and creation tests
- ServiceContainer tests
- Reactive session management features

### Fixed
- Terminal session ID mapping and session resume API
- Session history loading and Docker fixes

### Changed
- Implemented clean single-ID terminal architecture
- Enhanced SessionViewModel with session normalization and improved logging
- Refactored tests and improved Svelte 5 rune shims

### Removed
- ModalViewModel and SessionViewModel tests (superseded by new architecture)

## [0.1.0] - 2024-10-15

### Added
- Initial public release
- Cookie-based authentication system
- Session management with event sourcing
- Socket.IO real-time communication
- Terminal sessions via node-pty
- Claude Code integration
- Theme management system
- Workspace management
- Docker containerization
- OAuth authentication (GitHub, Google)
- API key authentication
- Settings management UI
- Onboarding flow

### Security
- bcrypt password hashing for sessions and API keys
- Rate limiting on authentication endpoints
- Session expiration and rotation
- CORS and origin validation

## [0.0.10] - 2024-09-01

### Changed
- Pre-release refinements
- Bug fixes and stability improvements

## [0.0.7] - 2024-08-15

### Added
- Early alpha features
- Core session management
- Basic authentication

## Earlier Versions

Versions 0.0.1 through 0.0.6 were pre-release development versions with experimental features and frequent breaking changes.

---

## Release Notes

### Version 0.3.0 Highlights

This release represents a major quality and stability milestone with comprehensive refactoring, security hardening, and test coverage improvements:

- **Zero Critical Issues**: All security vulnerabilities resolved, all type errors fixed
- **Production Ready**: Comprehensive E2E test coverage (33 tests passing)
- **Clean Architecture**: Complete MVVM refactoring with dependency injection
- **Standardized APIs**: All 57 routes migrated to unified error handling
- **Enhanced Security**: Rate limiting, OAuth encryption, path traversal prevention
- **Better UX**: Fixed critical onboarding and login flow issues

### Upgrade Notes

**Breaking Changes**: None - this release maintains backward compatibility with v0.2.x

**Migration**: No migration steps required. The database schema is compatible with previous versions.

**Testing**: All E2E tests passing. Run `npm run test:e2e` to verify your installation.

---

[0.3.0]: https://github.com/fwdslsh/dispatch/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/fwdslsh/dispatch/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/fwdslsh/dispatch/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/fwdslsh/dispatch/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/fwdslsh/dispatch/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/fwdslsh/dispatch/compare/v0.0.10...v0.1.0
