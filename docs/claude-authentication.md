# Claude Authentication Workflow

This document explains the workflow for authenticating Claude from the projects page in Dispatch. The authentication process enables users to access Claude AI features through an interactive web interface.

## Overview

The Claude authentication workflow provides a seamless way for users to authenticate with Anthropic's Claude AI service directly from the Dispatch projects page, eliminating the need to manually run command-line authentication tools.

## Workflow Steps

### 1. Authentication Status Check

When users access the projects page, the system automatically checks if Claude is already authenticated:

- **GET `/api/claude/auth`** - Checks current authentication status
- If authenticated: Users can create Claude sessions immediately
- If not authenticated: Login prompt is displayed

### 2. Login Prompt

If Claude is not authenticated, the projects page displays an authentication interface with:

- Clear indication that Claude authentication is required
- A **"Login to Claude"** button to initiate the authentication process
- Information about what Claude authentication enables

### 3. Trigger Setup

When the user clicks the "Login to Claude" button:

- **POST `/api/claude/setup-token`** - Server initiates the setup process
- The server runs `claude setup-token` command internally
- Response includes:
  - OAuth authorization URL for Anthropic login
  - Session identifier for tracking the authentication process
  - Instructions for the user

### 4. Receive OAuth URL

The server responds with:

```json
{
  "success": true,
  "authUrl": "https://console.anthropic.com/login?code=xyz...",
  "sessionId": "auth-session-uuid",
  "instructions": "Click the link to log in to Anthropic, then paste the authorization code below"
}
```

The UI then displays:
- A **clickable link** that opens the OAuth flow in a new tab
- A **text input field** for entering the authorization code
- Clear instructions for the authentication process

### 5. User Authentication

The user follows these steps:

1. **Click the OAuth link** - Opens Anthropic's login page in a new browser tab
2. **Log in to Anthropic** - User enters their Anthropic account credentials
3. **Authorize the application** - User grants permission to Claude CLI
4. **Receive authorization code** - Anthropic provides a unique authorization code
5. **Copy the code** - User copies the authorization code to clipboard

### 6. Paste & Confirm

Back in the Dispatch interface:

1. **Paste authorization code** - User pastes the code into the text input field
2. **Click "Confirm"** - Initiates the token validation process
3. **Real-time validation** - UI provides immediate feedback on code format

### 7. Complete Login

When the user clicks "Confirm":

- **POST `/api/claude/complete-auth`** - Sends the authorization code to server
- Server validates the code with Anthropic's API
- If valid: Token is stored in `credentials.json` in the project directory
- **Authentication status updates** - Context refreshes across the application
- **Success confirmation** - User sees confirmation message
- **Session creation enabled** - Claude session options become available

## API Endpoints

### Authentication Status Check

```http
GET /api/claude/auth
```

**Response:**
```json
{
  "authenticated": true|false,
  "error": null|"error message",
  "hint": "suggested action if not authenticated"
}
```

### Initiate Setup Token

```http
POST /api/claude/setup-token
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://console.anthropic.com/login?code=...",
  "sessionId": "auth-session-uuid",
  "instructions": "Authentication instructions"
}
```

### Complete Authentication

```http
POST /api/claude/complete-auth

Content-Type: application/json
{
  "sessionId": "auth-session-uuid",
  "authCode": "user-provided-authorization-code"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication completed successfully"
}
```

## Error Handling

### Invalid Authorization Code

**Symptoms:**
- User enters incorrect or expired authorization code
- API returns validation error

**Response:**
```json
{
  "success": false,
  "error": "Invalid authorization code",
  "canRetry": true
}
```

**UI Behavior:**
- Display clear error message
- Keep input field active for retry
- Provide option to generate new OAuth URL

### Network Issues

**Symptoms:**
- Server cannot reach Anthropic's authentication servers
- Timeout during token validation

**Response:**
```json
{
  "success": false,
  "error": "Network timeout - please check your connection and try again",
  "canRetry": true
}
```

**UI Behavior:**
- Display network error message
- Provide "Retry" button
- Suggest checking internet connection

### Session Expired

**Symptoms:**
- Authentication session expires before completion
- User takes too long to complete OAuth flow

**Response:**
```json
{
  "success": false,
  "error": "Authentication session expired",
  "canRetry": false
}
```

**UI Behavior:**
- Display session expired message
- Automatically restart authentication flow
- Clear any stored session data

### Server Configuration Issues

**Symptoms:**
- Claude CLI not installed or not accessible
- Permission issues with credentials storage

**Response:**
```json
{
  "success": false,
  "error": "Claude CLI not properly configured",
  "hint": "Contact administrator to install Claude CLI",
  "canRetry": false
}
```

**UI Behavior:**
- Display configuration error
- Show administrator contact information
- Disable authentication attempts until resolved

## UI/UX Implementation Notes

### Authentication Flow Interface

The authentication interface should provide a smooth, guided experience:

#### Initial State (Not Authenticated)
```html
<div class="claude-auth-prompt">
  <div class="auth-icon">🤖</div>
  <h3>Claude AI Authentication Required</h3>
  <p>Connect to Claude AI to access intelligent coding assistance and enhanced project features.</p>
  <button class="btn-primary" onclick="startAuth()">
    <span class="icon">🔗</span>
    Login to Claude
  </button>
</div>
```

#### Authentication Flow (Active)
```html
<div class="claude-auth-flow">
  <div class="auth-step">
    <h4>Step 1: Authorize with Anthropic</h4>
    <a href="{{authUrl}}" target="_blank" class="btn-link">
      <span class="icon">🌐</span>
      Open Anthropic Login
    </a>
  </div>
  
  <div class="auth-step">
    <h4>Step 2: Enter Authorization Code</h4>
    <input 
      type="text" 
      placeholder="Paste your authorization code here"
      class="auth-code-input"
      bind:value={authCode}
    />
    <button 
      class="btn-primary" 
      onclick="completeAuth()"
      disabled={!authCode.trim()}
    >
      Confirm Authentication
    </button>
  </div>
</div>
```

#### Success State
```html
<div class="claude-auth-success">
  <div class="success-icon">✅</div>
  <h3>Claude AI Connected Successfully!</h3>
  <p>You can now create Claude-powered sessions for your projects.</p>
</div>
```

### Mobile Responsive Design

The authentication flow must work seamlessly on mobile devices:

#### Mobile Considerations
- **Touch-friendly buttons** - Minimum 44px touch targets
- **Readable text** - 16px minimum font size to prevent zoom
- **Proper viewport** - Handle keyboard appearance gracefully
- **Copy/paste optimization** - Easy code copying on mobile browsers

#### Mobile Layout Adjustments
```css
@media (max-width: 768px) {
  .claude-auth-flow {
    padding: 1rem;
    margin: 0.5rem;
  }
  
  .auth-code-input {
    font-size: 16px; /* Prevent zoom on iOS */
    padding: 12px;
    width: 100%;
  }
  
  .btn-primary {
    width: 100%;
    padding: 14px;
    font-size: 16px;
  }
}
```

### Loading States

Provide clear feedback during async operations:

#### During OAuth URL Generation
```html
<div class="auth-loading">
  <div class="spinner"></div>
  <p>Preparing authentication...</p>
</div>
```

#### During Token Validation
```html
<div class="auth-validating">
  <div class="spinner"></div>
  <p>Validating authorization code...</p>
</div>
```

### Security Considerations

#### Client-Side Security
- **No token storage** - Never store authentication tokens in browser storage
- **Session timeout** - Authentication sessions expire after 10 minutes
- **HTTPS requirement** - All authentication endpoints require HTTPS in production

#### Server-Side Security
- **Token encryption** - Store credentials securely in project directories
- **Access control** - Validate user permissions before authentication operations
- **Rate limiting** - Prevent abuse of authentication endpoints

## Integration with Docker

When running in Docker environments, additional considerations apply:

### Volume Mounting for Credentials

Ensure Claude credentials persist across container restarts:

```bash
# Mount Claude credentials directory
docker run -v ~/.claude:/home/appuser/.claude dispatch:latest
```

### Environment Variables

Configure Claude authentication behavior:

```bash
# Enable Claude authentication
CLAUDE_AUTH_ENABLED=true

# Set credentials path (optional)
CLAUDE_CREDENTIALS_PATH=/home/appuser/.claude

# Authentication timeout (optional)
CLAUDE_AUTH_TIMEOUT=600000
```

### Claude CLI Installation

The Docker image must include the Claude CLI:

```dockerfile
# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-cli

# Ensure Claude CLI is accessible
RUN which claude || echo "Claude CLI not found"
```

## Related Files

### Frontend Components
- `src/lib/contexts/claude-auth-context.svelte.js` - Authentication state management
- `src/routes/projects/[id]/+page.svelte` - Project page with Claude auth integration
- `src/lib/components/ClaudeAuthFlow.svelte` - Authentication flow component (to be created)

### Backend API
- `src/routes/api/claude/auth/+server.js` - Authentication status endpoint
- `src/routes/api/claude/setup-token/+server.js` - Initiate authentication (to be created)
- `src/routes/api/claude/complete-auth/+server.js` - Complete authentication (to be created)

### Authentication Service
- `src/lib/server/claude-auth-middleware.js` - Authentication middleware
- `src/lib/services/claude-auth-service.js` - Authentication service logic (to be created)

## Testing

### Manual Testing Checklist

- [ ] Authentication status check on page load
- [ ] Login button initiates OAuth flow correctly
- [ ] OAuth URL opens in new tab
- [ ] Authorization code input accepts valid codes
- [ ] Error handling for invalid codes
- [ ] Success confirmation after completion
- [ ] Credential persistence across sessions
- [ ] Mobile interface functionality

### Automated Testing

Implement tests for:
- Authentication API endpoints
- Error handling scenarios
- UI component interactions
- Mobile responsive behavior

### Docker Testing

Test in containerized environment:
- Claude CLI availability
- Credential storage persistence
- Network connectivity to Anthropic APIs

## Troubleshooting

### Common Issues

#### "Claude CLI not found"
- **Cause:** Claude CLI not installed in container
- **Solution:** Ensure Claude CLI is installed via npm or included in Docker image

#### "Permission denied when writing credentials"
- **Cause:** Insufficient permissions for credentials directory
- **Solution:** Check directory permissions and Docker volume mounts

#### "Authentication timeout"
- **Cause:** User took too long to complete OAuth flow
- **Solution:** Restart authentication process with new OAuth URL

#### "Network connection failed"
- **Cause:** Cannot reach Anthropic's authentication servers
- **Solution:** Check internet connectivity and firewall settings

### Support Resources

- [Claude CLI Documentation](https://github.com/anthropics/claude-cli)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Docker Authentication Issues](https://github.com/anthropics/claude-code/issues/434)

---

This documentation provides a comprehensive guide for implementing and using the Claude authentication workflow in Dispatch. For implementation details and code examples, refer to the related source files listed above.