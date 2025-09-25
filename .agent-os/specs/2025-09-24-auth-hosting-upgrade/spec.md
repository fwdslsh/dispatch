# Spec Requirements Document

> Spec: Authentication and Hosting Upgrade
> Created: 2025-09-24
> Status: Planning

## Overview

Upgrade Dispatch's authentication system from single-key auth to flexible multi-mode authentication supporting local access codes, WebAuthn/Passkeys, OAuth, and proxy authentication. Enhance hosting capabilities with HTTPS certificate management, improved tunnel integration, and dynamic security policy management that adapts to LAN-only, remote tunnel, and custom domain deployment modes.

## User Stories

### Multi-Mode Authentication Support

As a **home user**, I want to use simple local authentication with access codes for my family network, so that I can easily share access without complex setup while keeping external access secure.

The user can enable local authentication mode via admin settings, generate/rotate access codes, and family members can authenticate using the shared code. When switching to remote access, stronger authentication modes (WebAuthn, OAuth) can be enabled automatically or manually via the admin interface.

### Secure Remote Access with Auto-Configuration

As an **admin user**, I want to securely expose my Dispatch instance to the internet with automatic security configuration, so that tunnel URLs are automatically propagated to authentication callbacks and security policies adapt to the hosting environment.

The user can enable LocalTunnel from the admin interface, and the system automatically updates OAuth redirect URIs, enables HTTPS-only cookies, applies appropriate CORS policies, and displays security recommendations. WebAuthn support is enabled/disabled based on HTTPS availability and hostname stability.

### Professional Hosting with Certificate Management

As a **professional user**, I want to host Dispatch on my own domain with automatic HTTPS certificate management, so that I can provide stable WebAuthn support and production-grade security without manual certificate handling.

The user can configure their custom domain, enable Let's Encrypt integration, and the system automatically provisions/renews certificates, updates all security policies for the stable domain, and provides full WebAuthn and OAuth support with stable callback URLs.

## Spec Scope

1. **Multi-Mode Authentication System** - Pluggable authentication supporting local access codes, WebAuthn/Passkeys, OAuth (Google/GitHub), and proxy authentication with runtime mode switching
2. **Enhanced Database Schema** - User accounts, device sessions, authentication events, and security policy storage with migration from current key-based system
3. **Dynamic Security Policy Management** - Automatic CORS, cookie, HSTS, and origin policy updates based on current hosting mode (LAN/tunnel/custom domain)
4. **Certificate Management Integration** - Support for mkcert (LAN HTTPS), LocalTunnel TLS (automatic), and Let's Encrypt (custom domains) with automatic renewal
5. **Improved Admin Interface** - User/device management, authentication mode configuration, certificate status, tunnel controls, and security posture dashboard

## Out of Scope

- Migration of existing session data (POC application, no backward compatibility required)
- Multi-tenant or organization support (single-admin deployment model)
- Advanced user permissions beyond basic admin/user roles
- Third-party authentication providers beyond Google/GitHub OAuth
- Database clustering or high-availability features
- Custom certificate authority integration beyond mkcert

## Expected Deliverable

1. **Functional multi-mode authentication** - Admin can switch between local, WebAuthn, OAuth, and proxy authentication modes via settings interface, with appropriate UI changes based on current mode
2. **Automatic security policy adaptation** - System detects current hosting environment (LAN/tunnel/domain) and automatically applies appropriate CORS, cookie, and security policies with tunnel URL propagation
3. **Certificate management interface** - Admin can view certificate status, enable mkcert for LAN HTTPS, configure Let's Encrypt for custom domains, and monitor certificate expiry/renewal status

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-24-auth-hosting-upgrade/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-24-auth-hosting-upgrade/sub-specs/technical-spec.md
- Database Schema: @.agent-os/specs/2025-09-24-auth-hosting-upgrade/sub-specs/database-schema.md
- API Specification: @.agent-os/specs/2025-09-24-auth-hosting-upgrade/sub-specs/api-spec.md