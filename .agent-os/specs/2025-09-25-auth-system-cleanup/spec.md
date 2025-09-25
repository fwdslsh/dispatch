# Spec Requirements Document

> Spec: Authentication System Cleanup
> Created: 2025-09-25
> Status: Planning

## Overview

Remove deprecated migration code and legacy terminal key authentication to simplify the authentication system after the hosting upgrade is complete. This cleanup will eliminate unnecessary complexity while maintaining all current authentication functionality.

## User Stories

### Story 1: Clean System Administration

As a system administrator, I want the authentication system to be clean and maintainable without deprecated migration code, so that I can focus on actual security management rather than navigating legacy migration paths.

**Acceptance Criteria:**

- No migration-related code paths remain in the authentication flow
- Authentication system configuration is simplified and clear
- System monitoring shows only active authentication components

### Story 2: Simplified Development

As a developer, I want the codebase to be simplified by removing legacy authentication paths, so that I can understand and maintain the authentication system more easily.

**Acceptance Criteria:**

- Authentication code is easier to follow without migration conditionals
- Test suite covers only active authentication paths
- Documentation reflects current authentication architecture only
- Deprecated tests are removed

### Story 3: Secure Production Environment

As a security-conscious operator, I want all legacy authentication fallback mechanisms removed, so that there are no deprecated security vectors in the production system.

**Acceptance Criteria:**

- Terminal key authentication is completely removed
- Only OAuth and WebAuthn authentication methods remain
- No legacy API endpoints for authentication exist

## Spec Scope

### 1. Migration Infrastructure Removal

- Remove `AuthMigrationManager` class and all related migration logic
- Remove migration state tracking in database tables
- Remove migration-related configuration options
- Clean up migration helper utilities and validation functions

### 2. Legacy Authentication Cleanup

- Remove terminal key authentication fallback paths
- Remove legacy session validation mechanisms
- Clean up deprecated authentication middleware
- Remove legacy authentication error handling

### 3. API Endpoint Cleanup

- Remove `/api/admin/migration/*` endpoint family
- Remove `/api/auth/migrate/*` endpoint family
- Remove migration status endpoints
- Clean up authentication status endpoints to remove migration references

### 4. Database Cleanup

- Remove migration tracking tables (`auth_migrations`, `migration_state`, etc.)
- Clean up migration-related columns from existing tables
- Remove migration-related indexes and constraints
- Update database schema documentation

### 5. UI Component Removal

- Remove migration progress components
- Remove legacy authentication form components
- Remove migration wizard and onboarding flows
- Clean up authentication status displays

### 6. Configuration Simplification

- Remove migration-related environment variables
- Simplify authentication configuration structure
- Update deployment configuration to remove migration options
- Clean up development environment configuration

## Out of Scope

### Authentication Core Functionality

- OAuth provider implementations (Google, GitHub) remain unchanged
- WebAuthn implementation remains unchanged
- Session management core functionality unchanged
- User account management unchanged

### Database Schema Changes

- No changes to core user tables structure
- No changes to session tables structure
- No changes to OAuth integration tables
- Only cleanup of migration-specific tables
- Exception: If tables can be simplified without breaking existing functionality you may do so

### Security Features

- Multi-factor authentication features unchanged
- Security monitoring and logging unchanged
- Rate limiting and security policies unchanged
- Audit trails for authentication events unchanged

## Expected Deliverable

### 1. Functional Requirements

- Authentication system works identically to current implementation
- All existing authentication methods (OAuth, WebAuthn) function normally
- New user sessions continue to work without interruption
- Admin authentication functions remain intact

### 2. Code Quality Requirements

- All migration-related code and UI components completely removed
- No legacy authentication fallback paths remain in codebase
- Test suite updated to reflect simplified authentication architecture
- Code complexity metrics improved through cleanup

### 3. Documentation Requirements

- Updated authentication flow documentation
- Simplified deployment guides without migration references
- Clean API documentation reflecting current endpoints only
- Updated troubleshooting guides without legacy paths

### 4. Security Requirements

- No deprecated authentication vectors remain
- Security audit passes with simplified authentication surface
- All authentication endpoints follow current security standards
- No legacy credential handling remains in system

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-25-auth-system-cleanup/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-25-auth-system-cleanup/sub-specs/technical-spec.md
