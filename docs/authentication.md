# 🔐 Authentication System

## Overview
Dispatch implements a secure, dual-token authentication system that combines the security of HTTP-only cookies with the flexibility needed for WebSocket connections.

## Authentication Methods

### SSH Key Authentication with System Integration
Users can authenticate using SSH public keys through an intuitive file selection interface:

- File selection instead of key pasting for better UX
- SSH key generation and download during setup
- Full integration with system SSH daemon
- Unified authentication - same keys work for both web interface and direct SSH access
- Support for all major SSH key types (rsa, ed25519, ecdsa, dss)
- Unique fingerprint generation for secure identification

### OAuth Integration
Full OAuth 2.0 support for both GitHub and Google providers:

- Secure authorization flows with CSRF protection
- Automatic user profile retrieval and account creation
- First user automatically becomes admin
## 🛠️ Technical Implementation

### Dual Token Security Architecture

Dispatch implements a secure dual-token approach that balances security with functionality:

#### HTTP-Only Cookie (Primary Security)
- **Purpose**: Secures all HTTP API requests against XSS attacks
- **Storage**: Browser cookie storage with `httpOnly: true`
- **Properties**:
  - Automatic inclusion in HTTP requests
  - Cannot be accessed by JavaScript (XSS protection)
  - Secure flag for HTTPS environments
  - SameSite protection against CSRF
  - 7-day expiration

#### SessionStorage Token (WebSocket Authentication)
- **Purpose**: Enables WebSocket authentication (cookies can't be sent to WebSocket handshake)
- **Storage**: Browser sessionStorage (cleared on tab close)
- **Properties**:
  - Same JWT token as the cookie
  - Accessible to JavaScript for WebSocket auth
  - Automatically cleared on browser tab close
  - Not shared between tabs (additional security)

### Authentication Flow

1. **User Authentication**: SSH key or OAuth provider
2. **Server Response**:
   - Sets HTTP-only cookie with JWT token
   - Returns token in response body for WebSocket use
3. **Client Storage**:
   - HTTP-only cookie handles API requests automatically
   - SessionStorage stores token copy for WebSocket authentication
4. **WebSocket Connection**: Uses sessionStorage token for authentication
5. **Logout**: Clears both cookie and sessionStorage

### Backend Architecture

- **AuthManager**: Centralized authentication handling with JWT generation/verification
- **SSHManager**: System SSH integration and authorized_keys management
- **Database**: Tables for users, sessions, SSH keys, and OAuth configuration
- **Session Management**: JWT-based with database session tracking
- **Socket.IO**: Unified authentication supporting all methods
### API Endpoints

- `/api/auth/ssh` - SSH key authentication (returns token + sets cookie)
- `/api/auth/oauth` - OAuth flow initiation
- `/api/auth/oauth/callback` - OAuth callback handling (sets cookie + redirects with token)
- `/api/auth/setup` - First-time setup wizard
- `/api/auth/check` - Verify authentication status via cookie
- `/api/auth/logout` - Clear authentication cookie and session
- `/api/ssh` - SSH daemon management
Frontend Components:

Two-tab authentication interface (SSH Key + OAuth)
SSH public key file selection interface
SSH key generation with secure download in setup wizard
Enhanced login page maintaining existing design aesthetic
Full PWA compatibility
Docker SSH Integration:

Updated Dockerfile with openssh-server
SSH daemon configured on port 2222 with key-based authentication only
Environment variables for SSH configuration (SSH_ENABLED, SSH_PORT)
Automatic SSH key synchronization between database and system

## 🔒 Security Features

### Authentication Security
- **Dual Token Protection**: HTTP-only cookies for API requests + sessionStorage for WebSocket
- **XSS Protection**: JWT tokens in HTTP-only cookies cannot be accessed by malicious scripts
- **CSRF Protection**: SameSite cookie attributes and OAuth state tokens
- **Session Management**: Database-backed JWT sessions with configurable expiration
- **Automatic Cleanup**: Expired sessions and OAuth states are automatically removed

### SSH Security
- **Key-Based Only**: No password authentication via SSH (keys only)
- **Fingerprint Verification**: Unique SSH key fingerprint generation for identification
- **System Integration**: SSH key management through authorized_keys
- **Port Isolation**: SSH daemon on dedicated port 2222

### Access Control
- **Admin Privileges**: First user automatically becomes admin
- **Role-Based Access**: Granular permission system
- **Session Isolation**: SessionStorage tokens not shared between browser tabs
🐳 Docker & System Integration
Container Features:

OpenSSH server runs on port 2222
Key-based authentication only (no passwords)
Environment variable control for SSH features
Automatic SSH key synchronization on startup
Unified Access:
Users can now:

Generate SSH keys through the web interface
Download and save private keys locally
SSH directly to the container using the same credentials
Use identical authentication for both web and terminal access
📱 Progressive Web App Support
All authentication methods work seamlessly in PWA mode, maintaining the existing URL changing functionality for PWA instances while providing responsive design across mobile and desktop.

🧪 Testing
Added comprehensive test coverage for:

AuthManager functionality and security features
SSH key validation and fingerprint generation
System SSH integration with SSHManager
API endpoint authentication flows
JWT token generation and verification

## Summary

The authentication system implements a modern, secure approach that:

- **Balances Security & Functionality**: HTTP-only cookies protect against XSS while sessionStorage enables WebSocket authentication
- **Unified Experience**: Same credentials work for web interface, WebSocket connections, and direct SSH access
- **Follows Best Practices**: JWT tokens, CSRF protection, secure cookie attributes, and proper session management
- **Maintains Compatibility**: Svelte 5 runes architecture with existing Socket.IO infrastructure
- **Enables Real-time Features**: Secure WebSocket authentication for terminal sessions and Claude interactions

The dual token approach ensures maximum security for HTTP requests while enabling the real-time features that make Dispatch powerful and responsive.
