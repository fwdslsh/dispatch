# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-24-auth-hosting-upgrade/spec.md

> Created: 2025-09-24
> Version: 1.0.0

## Technical Requirements

### Authentication Architecture

- **Pluggable Authentication System** - Create `AuthManager` class that supports multiple authentication adapters (local, webauthn, oauth, proxy) with runtime switching via database settings
- **Authentication Middleware** - Implement Express/SvelteKit middleware that validates requests based on current auth mode configuration and provides unified user context
- **Session Management** - Replace single TERMINAL_KEY with proper user sessions, JWT tokens, and device-specific session tracking with revocation support
- **WebAuthn Integration** - Implement WebAuthn registration/authentication with rpID validation based on current hostname and HTTPS availability
- **OAuth Integration** - Add OAuth 2.0 flows for Google/GitHub with automatic redirect URI updates when tunnel URLs change

### Database Schema Extensions

- **User Management Tables** - `users`, `user_devices`, `auth_sessions` tables with proper indexing and foreign key constraints
- **Authentication Events** - `auth_events` table for audit logging with event types (login, logout, failed_attempt, device_registered)
- **Security Settings** - Extend existing settings system with `auth` and `security` categories for runtime auth mode and policy configuration
- **Migration Scripts** - Database migration from current key-based system to new user-based system with initial admin user creation

### Security Policy Management

- **Dynamic CORS Configuration** - Replace hardcoded `origin: '*'` with database-driven allowed origins based on current LAN IP and tunnel URL
- **Cookie Security Policies** - Implement cookie settings that automatically enable Secure flag for HTTPS contexts and appropriate SameSite policies
- **HSTS Management** - Conditional HSTS header application based on HTTPS certificate source and hostname stability
- **CSRF Protection** - Add CSRF token generation and validation for state-changing operations
- **Rate Limiting** - Implement configurable rate limiting for authentication endpoints and sensitive operations

### Certificate Management System

- **Certificate Storage** - Encrypted certificate and private key storage in database with rotation support
- **mkcert Integration** - Certificate generation and installation workflows with UI for certificate upload and trust chain management
- **Let's Encrypt Integration** - ACME client implementation with automatic certificate provisioning, renewal scheduling, and domain validation
- **Certificate Status Monitoring** - Certificate expiry tracking, renewal alerts, and health check endpoints

### Enhanced Tunnel Integration

- **URL Change Detection** - Monitor tunnel URL changes and automatically propagate to OAuth redirect URIs, CORS origins, and WebAuthn rpID validation
- **Security Policy Synchronization** - Automatic security policy updates when switching between LAN-only, tunnel, and custom domain modes
- **Tunnel Status Management** - Enhanced tunnel status reporting with security recommendations and WebAuthn compatibility warnings

### API Enhancements

- **Authentication Endpoints** - RESTful APIs for user registration, login, logout, device management, and WebAuthn operations
- **Security Management APIs** - Endpoints for auth mode configuration, security policy management, and certificate operations
- **Admin APIs** - User/device listing, session revocation, audit log access, and security posture reporting

### UI/UX Components

- **Authentication Modal System** - Dynamic login UI that shows available auth methods based on current configuration and context
- **Admin Dashboard Enhancements** - Security posture widget, user/device management, certificate status, and auth mode configuration
- **Security Warnings** - Contextual warnings for WebAuthn hostname changes, weak security modes, and certificate expiry

## Approach

### Implementation Phases

**Phase 1: Core Authentication Infrastructure**
- Implement AuthManager and authentication adapter pattern
- Create database schema extensions with migration scripts
- Build authentication middleware with session management
- Add basic user registration and login functionality

**Phase 2: Security Policy Management**
- Implement dynamic CORS and cookie security policies
- Add CSRF protection and rate limiting systems
- Create certificate storage and management infrastructure
- Build security configuration UI components

**Phase 3: Advanced Authentication Methods**
- Integrate WebAuthn with hostname validation
- Implement OAuth flows with dynamic redirect URIs
- Add certificate provisioning (mkcert and Let's Encrypt)
- Create comprehensive admin dashboard

**Phase 4: Integration and Hardening**
- Enhance tunnel integration with security synchronization
- Implement audit logging and monitoring
- Add security warnings and posture reporting
- Performance optimization and security testing

### Technical Architecture Patterns

**Adapter Pattern for Authentication**
```javascript
class AuthManager {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async authenticate(request) {
    return this.adapter.authenticate(request);
  }
}

// Adapters: LocalAuthAdapter, WebAuthnAdapter, OAuthAdapter
```

**Event-Sourced Security Configuration**
- Leverage existing event sourcing architecture for security policy changes
- Store auth configuration changes as events for audit trail
- Enable rollback of security policy changes

**Middleware Chain Pattern**
- Authentication middleware -> Authorization middleware -> CSRF middleware
- Each middleware enriches request context with security information
- Fail-fast pattern for security violations

## External Dependencies

### Core Authentication Libraries

- **@webauthn/server** (v9.0.0+) - WebAuthn server-side implementation for passkey support
  - **Justification:** Industry-standard WebAuthn library with comprehensive attestation and assertion support
  - **Risk Mitigation:** Well-maintained with active security updates and W3C specification compliance

- **passport** (v0.7.0+) - Authentication middleware for OAuth integration
  - **Justification:** Mature authentication framework with extensive OAuth provider support and session management
  - **Risk Mitigation:** Established library with broad ecosystem support and security best practices

### Certificate Management

- **node-acme-client** (v5.0.0+) - Let's Encrypt ACME client for automatic certificate provisioning
  - **Justification:** Lightweight ACME client with Promise-based API and automatic renewal support
  - **Risk Mitigation:** Actively maintained with RFC 8555 compliance and error handling

### Security Infrastructure

- **rate-limiter-flexible** (v4.0.0+) - Advanced rate limiting with memory and database storage
  - **Justification:** Flexible rate limiting with distributed storage support and attack prevention features
  - **Risk Mitigation:** Configurable thresholds and storage backends for scalability

- **helmet** (v7.0.0+) - Security header middleware
  - **Justification:** Comprehensive security header management with sensible defaults
  - **Risk Mitigation:** Regular updates for emerging security header standards

### Development and Testing

- **@peculiar/webcrypto** - WebCrypto API polyfill for Node.js testing
  - **Justification:** Enables WebAuthn testing in Node.js environment
  - **Risk Mitigation:** Only used in test environment, not production

### Database Extensions

- **bcryptjs** (v2.4.3+) - Password hashing for local authentication fallback
  - **Justification:** Secure password hashing with configurable work factors
  - **Risk Mitigation:** Battle-tested library with timing attack protection