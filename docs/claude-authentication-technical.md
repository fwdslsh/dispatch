# Claude Authentication Workflow (WebSocket‑Driven)

This document explains how Dispatch authenticates Anthropic’s Claude via a real‑time, Socket.IO‑based flow. The server runs the Claude CLI in a PTY (node‑pty), streams the OAuth URL to the client, and accepts the pasted authorization code to complete login.

## Overview

- Server runs `claude setup-token` in a PTY.
- Client receives an OAuth URL over WebSockets, opens it, then pastes back the authorization code.
- Client sends the code over WebSockets; the server writes it to the PTY and reports completion.

No REST endpoints are used to start or complete the flow. The only REST endpoint that remains is `/api/claude/auth` for status checks and optional API‑key auth.

## Workflow Steps

### 1. Authentication Status Check

When users access the projects page, the system automatically checks if Claude is already authenticated:

- **GET `/api/claude/auth`** - Checks current authentication status
- If authenticated: Users can create Claude sessions immediately
- If not authenticated: Login prompt is displayed

### 2. Login Prompt

If Claude is not authenticated, the Settings page shows a “Login with Claude” button that starts the OAuth flow via WebSockets.

### 3. Start Flow (WebSocket)

When the user clicks “Login with Claude”, the client ensures the socket is connected and authenticated, then emits:

- `claude.auth.start` with `{ key }`

The server starts `claude setup-token` in a PTY for that socket and will emit the OAuth URL when ready.

### 4. Receive OAuth URL

The server emits `claude.auth.url` with `{ url, instructions }`. The UI opens the link in a new tab and shows a code input.

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

When the user clicks “Confirm”, the client emits `claude.auth.code` with `{ key, code }`. The server writes the code to the PTY, watches for success, and emits `claude.auth.complete` (or `claude.auth.error`).

## Socket Events

- `claude.auth.start` (client → server): `{ key }`
- `claude.auth.url` (server → client): `{ url, instructions? }`
- `claude.auth.code` (client → server): `{ key, code }`
- `claude.auth.complete` (server → client): `{ success: true }`
- `claude.auth.error` (server → client): `{ success: false, error }`

The Claude chat pane also auto‑starts the flow when an error result mentions “/login” and prompts the user to paste the code inline.

## Error Handling

### Invalid Authorization Code

**Symptoms:**

- User enters incorrect or expired authorization code
- API returns validation error

Server emits `claude.auth.error` and the UI keeps the input visible for retry.

**UI Behavior:**

- Display clear error message
- Keep input field active for retry
- Provide option to generate new OAuth URL

### Network Issues / Timeout

**Symptoms:**

- Server cannot reach Anthropic's authentication servers
- Timeout during token validation

Server emits `claude.auth.error` with a timeout message; start the flow again.

**UI Behavior:**

- Display network error message
- Provide "Retry" button
- Suggest checking internet connection

### Session Expired

**Symptoms:**

- Authentication session expires before completion
- User takes too long to complete OAuth flow

Start a new flow; the server will spawn a fresh PTY.

**UI Behavior:**

- Display session expired message
- Automatically restart authentication flow
- Clear any stored session data

### Server Configuration Issues

**Symptoms:**

- Claude CLI not installed or not accessible
- Permission issues with credentials storage

The Settings page will surface an error; install the CLI and retry.

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
			bind:value="{authCode}"
		/>
		<button class="btn-primary" onclick="completeAuth()" disabled="{!authCode.trim()}">
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

The runtime must include the Claude CLI (provided by `@anthropic-ai/claude-code`). Dispatch prefers the project‑local binary at `node_modules/.bin/claude`, falling back to a system `claude`.

## Related Files

### Frontend Components

- `src/lib/components/ClaudePane.svelte` — Inline chat‑driven OAuth flow
- `src/lib/components/Settings/ClaudeAuth.svelte` — Manual OAuth flow and API‑key fallback

### Server

- `src/lib/server/claude/ClaudeAuthManager.js` — PTY OAuth runner and URL/code parser
- `src/lib/server/socket-setup.js` — WebSocket handlers for auth start/code and events
- `src/lib/server/utils/events.js` — Event name constants (includes auth events)

### Status/API‑Key Fallback

- `src/routes/api/claude/auth/+server.js` — Status check, API‑key login, and logout

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
