# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-24-auth-hosting-upgrade/spec.md

> Created: 2025-09-24
> Version: 1.0.0

## Authentication Endpoints

### POST /api/auth/register
**Purpose:** Register new user account (admin-only endpoint)
**Parameters:**
- `username` (string, required) - Unique username
- `email` (string, optional) - User email address
- `password` (string, required for local auth) - User password
- `display_name` (string, optional) - Display name
- `is_admin` (boolean, optional) - Admin privileges flag

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "newuser",
    "display_name": "New User",
    "email": "user@example.com",
    "is_admin": false
  }
}
```
**Errors:** `400` (validation), `409` (username/email conflict), `403` (unauthorized)

### POST /api/auth/login
**Purpose:** Authenticate user with available methods
**Parameters:**
- `auth_method` (string, required) - 'local', 'webauthn', 'oauth'
- For local: `username`, `password`, `device_name`
- For webauthn: `credential_response` (WebAuthn assertion response)
- For oauth: handled via redirect flow

**Response:**
```json
{
  "success": true,
  "session_token": "jwt_token_here",
  "user": { "id": 1, "username": "user", "is_admin": false },
  "expires_at": "2025-09-25T12:00:00Z"
}
```
**Errors:** `401` (invalid credentials), `429` (rate limited), `400` (validation)

### POST /api/auth/logout
**Purpose:** Terminate current session
**Parameters:** None (uses session token from header)
**Response:** `{ "success": true }`
**Errors:** `401` (unauthorized)

### GET /api/auth/me
**Purpose:** Get current user information and auth status
**Parameters:** None (uses session token)
**Response:**
```json
{
  "user": { "id": 1, "username": "user", "is_admin": true },
  "device": { "id": 1, "device_name": "Chrome Browser", "is_trusted": true },
  "auth_method": "webauthn",
  "session_expires_at": "2025-09-25T12:00:00Z"
}
```
**Errors:** `401` (unauthorized)

## WebAuthn Endpoints

### POST /api/auth/webauthn/register/begin
**Purpose:** Start WebAuthn credential registration
**Parameters:**
- `device_name` (string, required) - Name for the authenticator

**Response:**
```json
{
  "challenge": "base64_challenge",
  "rp": { "name": "Dispatch", "id": "example.com" },
  "user": { "id": "user_id", "name": "username", "displayName": "Display Name" }
}
```
**Errors:** `401` (unauthorized), `400` (WebAuthn not available)

### POST /api/auth/webauthn/register/complete
**Purpose:** Complete WebAuthn credential registration
**Parameters:**
- `credential_response` (object, required) - WebAuthn attestation response
- `device_name` (string, required) - Authenticator device name

**Response:** `{ "success": true, "credential_id": "base64_id" }`
**Errors:** `400` (invalid response), `401` (unauthorized)

### POST /api/auth/webauthn/authenticate/begin
**Purpose:** Start WebAuthn authentication
**Parameters:** None
**Response:**
```json
{
  "challenge": "base64_challenge",
  "allowCredentials": [{ "id": "cred_id", "type": "public-key" }]
}
```
**Errors:** `400` (WebAuthn not available)

### POST /api/auth/webauthn/authenticate/complete
**Purpose:** Complete WebAuthn authentication
**Parameters:**
- `credential_response` (object, required) - WebAuthn assertion response
- `device_name` (string, optional) - Device identification

**Response:** Same as `/api/auth/login`
**Errors:** `401` (invalid assertion), `400` (validation)

## OAuth Endpoints

### GET /api/auth/oauth/:provider
**Purpose:** Initiate OAuth flow for provider (google, github)
**Parameters:**
- `provider` (path param) - OAuth provider name
- `redirect_uri` (query, optional) - Post-auth redirect URL

**Response:** HTTP 302 redirect to provider authorization URL
**Errors:** `400` (invalid provider), `500` (OAuth not configured)

### GET /api/auth/oauth/:provider/callback
**Purpose:** Handle OAuth provider callback
**Parameters:**
- `provider` (path param) - OAuth provider name
- `code` (query) - OAuth authorization code
- `state` (query) - CSRF protection state

**Response:** HTTP 302 redirect to app with session cookie set
**Errors:** `400` (invalid state/code), `401` (OAuth error)

## User Management Endpoints (Admin Only)

### GET /api/admin/users
**Purpose:** List all users with pagination
**Parameters:**
- `page` (query, optional) - Page number (default: 1)
- `limit` (query, optional) - Results per page (default: 50)
- `search` (query, optional) - Search username/email

**Response:**
```json
{
  "users": [
    { "id": 1, "username": "admin", "email": "admin@example.com", "is_admin": true, "created_at": "..." }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```
**Errors:** `403` (not admin), `401` (unauthorized)

### DELETE /api/admin/users/:id
**Purpose:** Delete user account and all associated data
**Parameters:** `id` (path param) - User ID
**Response:** `{ "success": true }`
**Errors:** `404` (user not found), `403` (cannot delete self), `401` (unauthorized)

### GET /api/admin/devices
**Purpose:** List all user devices with last activity
**Parameters:** Similar pagination as users endpoint
**Response:**
```json
{
  "devices": [
    {
      "id": 1,
      "user": { "username": "admin" },
      "device_name": "Chrome Browser",
      "last_seen_at": "2025-09-24T10:00:00Z",
      "last_ip_address": "192.168.1.100"
    }
  ]
}
```
**Errors:** `403` (not admin), `401` (unauthorized)

### DELETE /api/admin/devices/:id
**Purpose:** Revoke device access and terminate sessions
**Parameters:** `id` (path param) - Device ID
**Response:** `{ "success": true }`
**Errors:** `404` (not found), `403` (not admin)

## Security Configuration Endpoints

### GET /api/admin/auth/config
**Purpose:** Get current authentication configuration
**Parameters:** None
**Response:**
```json
{
  "enabled_methods": ["local", "webauthn"],
  "webauthn_available": true,
  "oauth_providers": { "google": { "configured": true }, "github": { "configured": false } },
  "security_policies": {
    "require_device_trust": false,
    "session_timeout_hours": 24,
    "max_devices_per_user": 10
  }
}
```
**Errors:** `403` (not admin)

### PUT /api/admin/auth/config
**Purpose:** Update authentication configuration
**Parameters:**
- `enabled_methods` (array) - Enabled auth methods
- `security_policies` (object) - Security policy settings
- `oauth_providers` (object) - OAuth provider configurations

**Response:** `{ "success": true }`
**Errors:** `400` (validation), `403` (not admin)

## Certificate Management Endpoints

### GET /api/admin/certificates
**Purpose:** List certificates and their status
**Parameters:** None
**Response:**
```json
{
  "certificates": [
    {
      "id": 1,
      "cert_type": "letsencrypt",
      "domain": "dispatch.example.com",
      "expires_at": "2025-12-24T00:00:00Z",
      "is_active": true,
      "auto_renew": true
    }
  ]
}
```
**Errors:** `403` (not admin)

### POST /api/admin/certificates
**Purpose:** Add new certificate (upload or generate)
**Parameters:**
- `cert_type` (string) - 'mkcert', 'letsencrypt', 'custom'
- `domain` (string) - Certificate domain
- For custom: `certificate_pem`, `private_key_pem`
- For letsencrypt: `email` (contact email)

**Response:** `{ "success": true, "certificate_id": 1 }`
**Errors:** `400` (validation), `403` (not admin), `500` (generation failed)

### DELETE /api/admin/certificates/:id
**Purpose:** Delete certificate
**Parameters:** `id` (path param) - Certificate ID
**Response:** `{ "success": true }`
**Errors:** `404` (not found), `403` (not admin), `400` (certificate in use)

## Security Posture Endpoints

### GET /api/admin/security/status
**Purpose:** Get overall security posture and recommendations
**Parameters:** None
**Response:**
```json
{
  "https_enabled": true,
  "hsts_enabled": true,
  "webauthn_available": true,
  "oauth_configured": ["google"],
  "active_sessions": 5,
  "security_warnings": ["tunnel_subdomain_changed", "cert_expires_soon"],
  "recommendations": ["enable_webauthn", "configure_rate_limiting"]
}
```
**Errors:** `403` (not admin)

### GET /api/admin/security/events
**Purpose:** Get recent authentication events for audit
**Parameters:**
- `user_id` (query, optional) - Filter by user
- `event_type` (query, optional) - Filter by event type
- `days` (query, optional) - Days to look back (default: 7)

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "user": { "username": "admin" },
      "event_type": "login",
      "ip_address": "192.168.1.100",
      "created_at": "2025-09-24T10:00:00Z"
    }
  ]
}
```
**Errors:** `403` (not admin)