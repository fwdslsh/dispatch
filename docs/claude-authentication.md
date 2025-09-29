# Setting Up Claude AI Integration

This guide shows you how to connect Claude AI to your Dispatch terminal for intelligent coding assistance.

## What You Need

- A Dispatch terminal session running
- An Anthropic account
- A web browser for authentication

## Quick Setup

### Step 1: Start Claude Mode

When creating a new session in Dispatch, choose "Claude Code" instead of "Terminal":

1. **Click "Create Session"** in Dispatch
2. **Select "Claude Code"** from the session type dropdown
3. **Click "Start Session"**

### Step 2: Authenticate with Anthropic

When you start a Claude session for the first time, you'll need to connect it to your Anthropic account:

1. **Click "Login with Claude"** when prompted
2. **Click the authentication link** that appears (opens in a new browser tab)
3. **Log in to your Anthropic account** in the new tab
4. **Authorize Dispatch** to access Claude on your behalf
5. **Copy the authorization code** that Anthropic gives you
6. **Paste the code** back into Dispatch and click "Send"

That's it! Claude is now connected and ready to help with your coding.

## Troubleshooting

### "Authentication failed" error

- Make sure you copied the entire authorization code
- Check that the code hasn't expired (they're only valid for a few minutes)
- Try the authentication process again

## Technical Details (For Developers)

_This section contains technical implementation details that most users can skip._

The authentication uses a WebSocket-driven flow where:

- Server runs `claude setup-token` in a PTY process
- Client receives OAuth URL over WebSockets and opens it in new tab
- User completes OAuth flow and receives authorization code
- Client sends code back over WebSockets to complete authentication

Socket events used:

- `claude.auth.start` - Begin authentication flow
- `claude.auth.url` - Receive OAuth URL
- `claude.auth.code` - Submit authorization code
- `claude.auth.complete` - Authentication completed
- `claude.auth.error` - Authentication failed

Only one REST endpoint is used: `GET /api/claude/auth` for status checks.
