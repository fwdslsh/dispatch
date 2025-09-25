# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-25-auth-system-cleanup/spec.md

> Created: 2025-09-25
> Version: 1.0.0

## Technical Requirements

### 1. Server-side Code Removal

#### Authentication Migration Manager
- **Target**: `src/lib/server/shared/AuthMigrationManager.js`
- **Action**: Complete removal
- **Dependencies**: Remove all imports and references across codebase
- **Impact**: Eliminates migration workflow complexity

#### Legacy Admin Seeder Methods
- **Target**: `AdminUserSeeder.js` migration-specific methods
- **Action**: Remove methods related to auth migration detection and handling
- **Retain**: Core admin user creation functionality
- **Impact**: Simplifies admin user management

#### Migration API Endpoints
- **Targets**:
  - `src/routes/api/admin/migration/+server.js`
  - `src/routes/api/admin/setup/+server.js` (migration-related handlers)
- **Action**: Complete removal of migration endpoints
- **Retain**: Non-migration admin setup functionality
- **Impact**: Reduces API surface area

#### AuthMiddleware Legacy Support
- **Target**: `src/lib/server/shared/AuthMiddleware.js`
- **Action**: Remove migration fallback logic and compatibility layers
- **Retain**: Core authentication verification
- **Impact**: Streamlines authentication flow

### 2. Client-side Component Cleanup

#### Migration UI Components
- **Targets**:
  - Migration-related Svelte components in auth flows
  - Setup wizard migration steps
  - Migration status indicators
- **Action**: Remove components and associated state management
- **Integration**: Ensure removal doesn't break event-sourced session management
- **Impact**: Simplifies authentication UI

#### State Management Updates
- **Target**: `src/lib/client/shared/state/SecurityState.svelte.js`
- **Action**: Remove migration-related state properties and derived values
- **Compatibility**: Maintain Svelte 5 runes patterns ($state, $derived)
- **Impact**: Reduces client state complexity

#### Socket.IO Event Handlers
- **Target**: Migration-related Socket.IO event handling
- **Action**: Remove migration event types and handlers
- **Compatibility**: Maintain unified Socket.IO protocol structure
- **Impact**: Streamlines real-time communication

### 3. Database Schema Cleanup

#### Migration Table Removal
- **Target**: `auth_migrations` table and related indices
- **Action**: Create migration to drop table and cleanup
- **Safety**: Ensure no foreign key dependencies exist
- **Impact**: Reduces database schema complexity

#### Column Cleanup
- **Targets**:
  - Migration status columns in user/auth tables
  - Migration timestamp fields
  - Migration metadata columns
- **Action**: Create schema migration to remove columns
- **Safety**: Backup critical data before removal
- **Impact**: Normalizes authentication data model

#### Settings Cleanup
- **Target**: Migration-related system settings
- **Action**: Remove migration configuration entries
- **Safety**: Preserve non-migration authentication settings
- **Impact**: Simplifies system configuration

### 4. Configuration and Deployment

#### Environment Variables
- **Target**: Migration-related environment variables
- **Action**: Remove from docker-compose.yml and configuration files
- **Documentation**: Update environment variable documentation
- **Impact**: Reduces configuration complexity

#### Docker Configuration
- **Target**: Migration-specific Docker setup
- **Action**: Remove migration-related build steps and volumes
- **Compatibility**: Maintain existing session management architecture
- **Impact**: Streamlines containerization

#### Deployment Scripts
- **Target**: Migration handling in deployment automation
- **Action**: Remove migration checks and fallbacks
- **Safety**: Ensure deployment reliability
- **Impact**: Simplifies deployment process

### 5. Testing Infrastructure Updates

#### Remove Migration Tests
- **Targets**:
  - `tests/server/auth-migration.test.js`
  - Migration-related test cases in existing test files
- **Action**: Remove test files and test cases
- **Coverage**: Ensure remaining auth tests maintain coverage
- **Impact**: Reduces test maintenance burden

#### Update Authentication Tests
- **Focus**: Strengthen core authentication testing
- **Architecture**: Ensure tests work with event-sourced session management
- **Coverage**: Maintain test coverage for retained functionality
- **Frameworks**: Continue using Vitest for unit tests, Playwright for E2E
- **Impact**: Improves test reliability and focus

#### Test Environment Cleanup
- **Target**: Migration-related test fixtures and mocks
- **Action**: Remove migration test data and helpers
- **Compatibility**: Maintain test container patterns
- **Impact**: Simplifies test setup

### 6. Error Handling and Logging

#### Migration Error Paths
- **Target**: Migration-specific error handling
- **Action**: Remove migration error types and handlers
- **Retain**: Core authentication error handling
- **Impact**: Streamlines error management

#### Logging Cleanup
- **Target**: Migration-related log statements
- **Action**: Remove migration logging
- **Retain**: Core authentication audit logging
- **Impact**: Reduces log noise

#### Monitoring Updates
- **Target**: Migration-related monitoring metrics
- **Action**: Remove migration monitoring
- **Focus**: Strengthen core authentication monitoring
- **Impact**: Improves observability focus

## Approach

### Phase 1: Database and Backend Cleanup (Low Risk)
1. Remove database migration table and columns
2. Remove server-side migration components
3. Clean up API endpoints
4. Update configuration files

### Phase 2: Frontend Cleanup (Medium Risk)
1. Remove client-side migration components
2. Update state management (maintain Svelte 5 patterns)
3. Clean up Socket.IO event handling
4. Update UI flows

### Phase 3: Testing and Documentation (Low Risk)
1. Remove migration-related tests
2. Update remaining authentication tests
3. Clean up test fixtures
4. Update documentation

### Phase 4: Monitoring and Deployment (Low Risk)
1. Update deployment scripts
2. Clean up monitoring configuration
3. Update error handling
4. Final integration testing

## External Dependencies

### Core Dependencies (No Changes)
- SvelteKit 2.x with Svelte 5 (maintains existing patterns)
- Socket.IO 4.8.x (maintains unified protocol)
- SQLite3 5.1.7 (database cleanup only)
- Node.js >=22 (no version changes)

### Architecture Compatibility
- **RunSessionManager**: No changes to session management
- **Event Sourcing**: Authentication events continue to work
- **MVVM Pattern**: Client architecture remains unchanged
- **ServiceContainer**: Dependency injection patterns maintained

### Testing Dependencies (No Changes)
- Vitest for unit testing
- Playwright for E2E testing
- Test container patterns maintained

## Risk Mitigation

### Data Safety
- Database backup before schema changes
- Staged rollout approach
- Rollback procedures documented

### System Stability
- Maintain core authentication functionality
- Preserve session management architecture
- Extensive testing at each phase

### Integration Points
- Socket.IO protocol compatibility
- Database schema integrity
- Client-server API consistency