# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-24-auth-hosting-upgrade/spec.md

> Created: 2025-09-24
> Version: 1.0.0

## Schema Changes

### New Tables

#### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT, -- for local auth mode
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### User Devices Table
```sql
CREATE TABLE user_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    device_fingerprint TEXT UNIQUE NOT NULL, -- browser/device identification
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_ip_address TEXT,
    user_agent TEXT,
    is_trusted BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Authentication Sessions Table
```sql
CREATE TABLE auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id INTEGER,
    session_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES user_devices(id) ON DELETE SET NULL
);
```

#### WebAuthn Credentials Table
```sql
CREATE TABLE webauthn_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL, -- base64 encoded public key
    counter INTEGER DEFAULT 0,
    device_name TEXT,
    aaguid TEXT, -- authenticator AAGUID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### OAuth Accounts Table
```sql
CREATE TABLE oauth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL, -- 'google', 'github', etc.
    provider_account_id TEXT NOT NULL,
    provider_email TEXT,
    provider_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_account_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Authentication Events Table
```sql
CREATE TABLE auth_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device_id INTEGER,
    event_type TEXT NOT NULL, -- 'login', 'logout', 'failed_login', 'device_registered', 'webauthn_registered', etc.
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON details about the event
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES user_devices(id) ON DELETE SET NULL
);
```

#### Certificates Table
```sql
CREATE TABLE certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_type TEXT NOT NULL, -- 'mkcert', 'letsencrypt', 'custom'
    domain TEXT NOT NULL,
    certificate_pem TEXT NOT NULL, -- encrypted certificate
    private_key_pem TEXT NOT NULL, -- encrypted private key
    ca_certificate_pem TEXT, -- for mkcert CA
    issued_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    auto_renew BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Modified Tables

#### Extended Settings Table
The existing `settings` table supports the new auth and security categories:
```sql
-- No schema changes needed, but new setting categories:
-- 'auth' - authentication mode configuration
-- 'security' - security policy settings
-- 'certificates' - certificate management settings
-- 'oauth' - OAuth provider configurations
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_fingerprint ON user_devices(device_fingerprint);
CREATE INDEX idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_account_id);
CREATE INDEX idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX idx_auth_events_created_at ON auth_events(created_at);
CREATE INDEX idx_certificates_domain ON certificates(domain);
CREATE INDEX idx_certificates_active ON certificates(is_active);
```

## Migrations

#### Migration 001: Create Auth Tables
```sql
-- Create all new authentication tables
-- Insert initial admin user based on existing TERMINAL_KEY
-- Migrate existing tunnel settings to new security category
```

#### Migration 002: Create Indexes
```sql
-- Create all performance indexes
-- Add foreign key constraints
```

#### Migration 003: Default Settings
```sql
-- Insert default auth mode configuration
-- Insert default security policies
-- Insert default certificate settings
```

## Data Integrity Rules

### Constraints
- Users must have unique usernames and emails
- Auth sessions automatically expire and cleanup via scheduled job
- WebAuthn credentials are tied to specific users and domains
- OAuth accounts prevent duplicate provider associations
- Certificate private keys are encrypted at rest using app secret

### Cascade Rules
- Deleting users removes all associated devices, sessions, credentials, and OAuth accounts
- Deleting devices removes associated sessions
- Auth events retain user/device IDs as foreign keys with SET NULL on delete for audit trail preservation

### Data Retention
- Auth events older than 90 days are automatically purged
- Expired auth sessions are cleaned up daily
- Inactive devices (not seen for 30 days) are marked for cleanup review