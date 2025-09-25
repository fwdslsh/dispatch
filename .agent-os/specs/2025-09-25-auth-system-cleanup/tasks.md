# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-25-auth-system-cleanup/spec.md

> Created: 2025-09-25
> Status: Ready for Implementation

## Tasks

### Task 1: Server-side Migration Infrastructure Removal

**Objective**: Remove all migration-related server components including AuthMigrationManager, API endpoints, and legacy authentication fallbacks.

#### 1.1 Write Tests for Migration Component Identification

- [ ] Create test to identify all migration-related imports and dependencies (isolated in `tests/cleanup/server/`)
- [ ] Write test to verify AuthMigrationManager is completely removed from codebase (isolated in `tests/cleanup/server/`)
- [ ] Create test to validate all migration API endpoints return 404 after removal (isolated in `tests/cleanup/server/`)
- [ ] Write test to ensure no migration-related environment variables are referenced (isolated in `tests/cleanup/server/`)

#### 1.2 Remove AuthMigrationManager and Core Migration Logic

- [ ] Remove `src/lib/server/shared/AuthMigrationManager.js` completely
- [ ] Remove all imports of AuthMigrationManager across the codebase
- [ ] Remove migration helper utilities and validation functions
- [ ] Update any error handling that referenced migration states

#### 1.3 Clean Up Migration API Endpoints

- [ ] Remove `src/routes/api/admin/migration/+server.js` endpoint family
- [ ] Remove `src/routes/api/auth/migrate/+server.js` endpoint family
- [ ] Clean migration-related handlers from `src/routes/api/admin/setup/+server.js`
- [ ] Remove migration status endpoints and related logic

#### 1.4 Update AuthMiddleware and Legacy Support

- [ ] Remove migration fallback logic from `src/lib/server/shared/AuthMiddleware.js`
- [ ] Remove terminal key authentication fallback paths
- [ ] Clean up deprecated authentication middleware components
- [ ] Remove legacy session validation mechanisms

#### 1.5 Verify Server-side Tests Pass

- [ ] Run server-side unit tests to ensure no migration references remain
- [ ] Verify authentication middleware tests pass with simplified logic
- [ ] Test API endpoint removal doesn't break existing functionality
- [ ] Validate admin authentication functions remain intact

### Task 2: Client-side Migration Component Cleanup

**Objective**: Remove migration-related UI components, state management, and Socket.IO handlers while maintaining Svelte 5 architecture patterns.

#### 2.1 Write Tests for Client Component Cleanup

- [ ] Write tests to identify all migration-related Svelte components (isolated in `tests/cleanup/client/`)
- [ ] Create tests to verify migration state properties are removed from SecurityState (isolated in `tests/cleanup/client/`)
- [ ] Write tests to validate Socket.IO migration event handlers are removed (isolated in `tests/cleanup/client/`)
- [ ] Create tests to ensure authentication UI flows work without migration components (isolated in `tests/cleanup/client/`)

#### 2.2 Remove Migration UI Components

- [ ] Remove migration progress components from authentication flows
- [ ] Remove legacy authentication form components
- [ ] Remove migration wizard and onboarding flow components
- [ ] Clean up migration status indicators and displays

#### 2.3 Update State Management (Svelte 5 Compatibility)

- [ ] Remove migration-related state properties from `src/lib/client/shared/state/SecurityState.svelte.js`
- [ ] Remove migration-related derived values using $derived patterns
- [ ] Maintain Svelte 5 runes patterns ($state, $derived) for remaining functionality
- [ ] Update ServiceContainer to remove migration-related services

#### 2.4 Clean Up Socket.IO Event Handlers

- [ ] Remove migration-related Socket.IO event types and handlers
- [ ] Maintain unified Socket.IO protocol structure for remaining auth events
- [ ] Update event-sourced session management to remove migration references
- [ ] Ensure real-time authentication events continue to work

#### 2.5 Verify Client-side Tests Pass

- [ ] Run client-side unit tests with Vitest to ensure components work
- [ ] Test authentication UI flows work without migration paths
- [ ] Verify Socket.IO communication works with simplified event structure
- [ ] Validate Svelte 5 state management patterns are maintained

### Task 3: Database Schema and Configuration Cleanup

**Objective**: Remove migration-specific database tables, columns, and configuration while maintaining data integrity.

#### 3.1 Write Tests for Database Cleanup

- [ ] Write tests to verify migration tables can be safely dropped (isolated in `tests/cleanup/database/`)
- [ ] Create tests to identify migration-related columns in existing tables (isolated in `tests/cleanup/database/`)
- [ ] Write tests to validate no foreign key dependencies exist for migration data (isolated in `tests/cleanup/database/`)
- [ ] Create tests to verify migration-related settings are removable (isolated in `tests/cleanup/database/`)

#### 3.2 Remove Migration Database Tables

- [ ] Create database migration to safely drop `auth_migrations` table
- [ ] Remove related indices and constraints for migration tables
- [ ] Verify no foreign key dependencies exist before dropping tables
- [ ] Create database backup before schema changes

#### 3.3 Clean Up Migration Columns and Settings

- [ ] Remove migration status columns from user/auth tables
- [ ] Remove migration timestamp fields from relevant tables
- [ ] Remove migration metadata columns from system tables
- [ ] Clean up migration-related system settings entries

#### 3.4 Update Configuration Files

- [ ] Remove migration-related environment variables from docker-compose.yml
- [ ] Clean up migration configuration from deployment scripts
- [ ] Update environment variable documentation
- [ ] Remove migration-specific Docker setup and build steps

#### 3.5 Verify Database and Configuration Tests Pass

- [ ] Run database schema tests to ensure integrity after cleanup
- [ ] Verify authentication data model works without migration columns
- [ ] Test deployment configuration works without migration variables
- [ ] Validate Docker container builds and runs without migration setup

### Task 4: Testing Infrastructure Updates

**Objective**: Remove migration-related tests and strengthen core authentication testing while maintaining coverage.

#### 4.1 Write Tests for Test Infrastructure Cleanup

- [ ] Create inventory of all migration-related test files and test cases (isolated in `tests/cleanup/testing/`)
- [ ] Write tests to verify migration test removal doesn't break test suites (isolated in `tests/cleanup/testing/`)
- [ ] Create tests to ensure authentication test coverage is maintained (isolated in `tests/cleanup/testing/`)
- [ ] Write tests to validate test fixtures work without migration data (isolated in `tests/cleanup/testing/`)

#### 4.2 Remove Migration-Related Tests

- [ ] Remove `tests/server/auth-migration.test.js` and related migration test files
- [ ] Remove migration-related test cases from existing authentication test files
- [ ] Clean up migration test fixtures and mock data
- [ ] Remove migration-related test helpers and utilities

#### 4.3 Strengthen Core Authentication Testing

- [ ] Update authentication unit tests to focus on core functionality
- [ ] Enhance OAuth and WebAuthn testing with better coverage
- [ ] Update E2E tests to cover authentication flows without migration paths
- [ ] Ensure tests work with event-sourced session management architecture

#### 4.4 Update Test Environment Configuration

- [ ] Remove migration-related test environment variables
- [ ] Clean up test container configuration to remove migration setup
- [ ] Update test fixtures to remove migration-specific data
- [ ] Maintain test container patterns and ServiceContainer test support

#### 4.5 Verify Complete Test Suite Passes

- [ ] Run complete Vitest unit test suite to ensure all tests pass
- [ ] Run complete Playwright E2E test suite for authentication flows
- [ ] Verify test coverage metrics are maintained for core authentication
- [ ] Test authentication functionality across multiple browsers and scenarios

### Task 5: Documentation and Monitoring Updates

**Objective**: Update documentation, error handling, and monitoring to reflect simplified authentication architecture.

#### 5.1 Write Tests for Documentation Completeness

- [ ] Create tests to verify no migration references remain in documentation (isolated in `tests/cleanup/docs/`)
- [ ] Write tests to validate API documentation reflects current endpoints only (isolated in `tests/cleanup/docs/`)
- [ ] Create tests to ensure deployment guides are migration-free (isolated in `tests/cleanup/docs/`)
- [ ] Write tests to verify troubleshooting guides cover current auth paths only (isolated in `tests/cleanup/docs/`)

#### 5.2 Update Authentication Documentation

- [ ] Update authentication flow documentation to remove migration references
- [ ] Simplify deployment guides without migration setup instructions
- [ ] Clean API documentation to reflect current endpoints only
- [ ] Update troubleshooting guides to remove legacy authentication paths

#### 5.3 Clean Up Error Handling and Logging

- [ ] Remove migration-specific error types and error handling paths
- [ ] Clean up migration-related log statements and debug output
- [ ] Remove migration-related monitoring metrics and dashboards
- [ ] Maintain core authentication audit logging and error handling

#### 5.4 Update Development Environment Documentation

- [ ] Update development setup instructions to remove migration steps
- [ ] Clean up authentication testing documentation
- [ ] Update code architecture documentation to reflect simplified auth system
- [ ] Remove migration-related environment variable documentation

#### 5.5 Verify Documentation and Monitoring Updates

- [ ] Review all documentation to ensure migration references are removed
- [ ] Test that error handling works correctly for authentication failures
- [ ] Verify monitoring shows only active authentication components
- [ ] Validate deployment process works with simplified configuration

### Task 6: Clean Up All Task-Related Tests

**Objective**: Remove all temporary cleanup tests from the codebase that were created during the implementation process.

#### 6.1 Remove Cleanup Test Directory

- [ ] Remove entire `tests/cleanup/` directory and all subdirectories
- [ ] Remove `tests/cleanup/server/` migration component identification tests
- [ ] Remove `tests/cleanup/client/` component cleanup verification tests
- [ ] Remove `tests/cleanup/database/` schema cleanup validation tests
- [ ] Remove `tests/cleanup/testing/` test infrastructure verification tests
- [ ] Remove `tests/cleanup/docs/` documentation verification tests

#### 6.2 Verify Test Suite Integrity

- [ ] Run complete test suite to ensure no broken imports after cleanup test removal
- [ ] Verify core authentication tests continue to pass without cleanup tests
- [ ] Ensure test coverage metrics exclude the removed cleanup tests
- [ ] Confirm no references to cleanup tests remain in test configuration files

## Implementation Notes

### Technical Dependencies

- **Database tasks (Task 3)** should be completed before **server-side cleanup (Task 1)** to avoid referential integrity issues
- **Server-side cleanup (Task 1)** must be completed before **client-side cleanup (Task 2)** to maintain API consistency
- **Testing updates (Task 4)** should run in parallel with implementation tasks to maintain TDD approach
- **Documentation updates (Task 5)** should be completed before **cleanup test removal (Task 6)**
- **Cleanup test removal (Task 6)** must be completed last after all other tasks are verified

### Cleanup Test Strategy

- All cleanup verification tests are isolated in `tests/cleanup/` subdirectories
- These tests are temporary and will be removed in Task 6 after successful implementation
- Cleanup tests validate removal completeness but are not part of the permanent test suite
- Core authentication tests remain in their original locations and are preserved

### Risk Mitigation

- Create database backup before any schema changes
- Maintain rollback procedures for each major task
- Use feature flags if gradual rollout is needed
- Test authentication flows thoroughly at each step

### Architecture Compatibility

- Maintain SvelteKit 2.x with Svelte 5 patterns throughout cleanup
- Preserve Socket.IO unified protocol structure
- Keep event-sourced session management architecture intact
- Maintain MVVM pattern and ServiceContainer dependency injection

### Success Criteria

- All migration-related code completely removed from codebase
- Authentication system functions identically to pre-cleanup state
- Test coverage maintained or improved for core authentication functionality
- No deprecated authentication vectors remain in production system
- Documentation reflects simplified authentication architecture only
