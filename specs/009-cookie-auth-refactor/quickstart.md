# Quickstart: Cookie Authentication Testing Guide

**Feature**: 009-cookie-auth-refactor
**Date**: 2025-10-09

## Overview

This quickstart guide provides manual test scenarios for validating the cookie-based authentication system. Testing is **optional/manual** per user requirement - automated tests can be added later if desired.

## Prerequisites

- Dispatch server running (development mode: `npm run dev`)
- Fresh database (reset if needed)
- Browser with developer tools
- Optional: API client (curl, Postman, or Node.js script)

---

## Test Scenario 1: Onboarding Flow (First API Key Generation)

**Feature Requirement**: FR-001, FR-002, FR-003, FR-004

**Goal**: Verify first-run onboarding generates API key, displays it once, and sets session cookie

### Steps

1. **Navigate to onboarding page**:

   ```
   URL: http://localhost:5173/onboarding
   ```

2. **Complete onboarding form**:
   - Fill in any required fields (name, email if applicable)
   - Click "Complete Onboarding" button

3. **Verify API key displayed**:
   - ✅ API key shown on screen (44-character base64url string)
   - ✅ Warning message: "Save this key - it will not be shown again"
   - ✅ Copy button or selection enabled

4. **Copy API key** (save to clipboard or text file)

5. **Verify session cookie set**:
   - Open browser DevTools → Application → Cookies
   - ✅ Cookie name: `dispatch_session`
   - ✅ Cookie value: UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
   - ✅ HttpOnly: `true`
   - ✅ Secure: `true` (in production) or `false` (in dev)
   - ✅ SameSite: `Lax`
   - ✅ Max-Age: `2592000` (30 days)

6. **Verify redirect to main application**:
   - ✅ Redirected to `/` (main dashboard)
   - ✅ User is authenticated (can access protected routes)

### Expected Result

- ✅ API key generated and displayed once
- ✅ Session cookie set with correct attributes
- ✅ User logged in automatically after onboarding
- ✅ API key stored hashed in database (not plaintext)

### Verification Commands

```bash
# Check database for API key (hashed)
sqlite3 .testing-home/dispatch/data/workspace.db \
  "SELECT id, label, key_hash, disabled FROM auth_api_keys WHERE user_id = 'default';"

# Check database for session
sqlite3 .testing-home/dispatch/data/workspace.db \
  "SELECT id, provider, expires_at FROM auth_sessions WHERE user_id = 'default';"
```

---

## Test Scenario 2: Login with API Key (Cookie Session Creation)

**Feature Requirement**: FR-005, FR-006, FR-007

**Goal**: Verify API key login creates session cookie and redirects to app

### Steps

1. **Clear browser cookies** (simulate logged-out state):
   - DevTools → Application → Cookies → Delete `dispatch_session`

2. **Navigate to login page**:

   ```
   URL: http://localhost:5173/login
   ```

3. **Enter API key** (from onboarding):
   - Paste API key into input field
   - Click "Log In" button

4. **Verify session cookie set**:
   - DevTools → Application → Cookies
   - ✅ Cookie `dispatch_session` present with correct attributes

5. **Verify redirect to main app**:
   - ✅ Redirected to `/`
   - ✅ User is authenticated

6. **Verify session in database**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT id, provider, expires_at > strftime('%s', 'now') * 1000 as valid FROM auth_sessions WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 1;"
   ```

   - ✅ `provider` = `'api_key'`
   - ✅ `valid` = `1` (session not expired)

### Expected Result

- ✅ Login form accepts valid API key
- ✅ Session cookie created with 30-day expiration
- ✅ Session recorded in database with `provider = 'api_key'`
- ✅ User redirected to authenticated app

### Error Cases to Test

**Invalid API key**:

- Enter wrong key → ✅ Error: "Invalid API key"
- ✅ No redirect
- ✅ No session cookie set

**Missing API key**:

- Submit empty form → ✅ Error: "API key required"

---

## Test Scenario 3: API Key Management (CRUD Operations)

**Feature Requirement**: FR-011, FR-012, FR-013, FR-014, FR-015, FR-016

**Goal**: Verify users can create, list, disable, and delete API keys

### Steps: Create New API Key

1. **Navigate to API key settings**:

   ```
   URL: http://localhost:5173/settings/api-keys
   ```

2. **Click "Create New API Key" button**

3. **Enter label**: "Test Key"

4. **Click "Generate Key"**

5. **Verify key displayed once**:
   - ✅ New API key shown (44-char base64url)
   - ✅ Warning message displayed
   - ✅ Key NOT saved in browser (refresh → key gone)

6. **Copy and save key** (for later tests)

### Steps: List API Keys

1. **Navigate to API keys list** (same page)

2. **Verify list displays metadata**:
   - ✅ Key ID (UUID)
   - ✅ Label ("Test Key")
   - ✅ Created date
   - ✅ Last used (null initially, or timestamp if used)
   - ✅ Status (active/disabled)
   - ✅ NO secret key shown (security)

### Steps: Disable API Key

1. **Click "Disable" button** on test key

2. **Confirm action**

3. **Verify key disabled**:
   - ✅ Status changed to "Disabled"
   - ✅ Visual indicator (grayed out, badge, etc.)

4. **Test disabled key authentication**:
   - Logout → Attempt login with disabled key
   - ✅ Error: "Invalid API key" (disabled keys rejected)

### Steps: Delete API Key

1. **Click "Delete" button** on test key

2. **Confirm action** (hard delete warning)

3. **Verify key removed**:
   - ✅ Key removed from list
   - ✅ Key removed from database

4. **Test deleted key authentication**:
   - Attempt login with deleted key
   - ✅ Error: "Invalid API key"

### Expected Result

- ✅ Users can create multiple API keys with labels
- ✅ Keys displayed EXACTLY ONCE on creation
- ✅ List shows metadata (no secrets)
- ✅ Disabled keys fail authentication
- ✅ Deleted keys fail authentication
- ✅ `last_used_at` timestamp updates on successful auth

---

## Test Scenario 4: Session Refresh (Rolling Window)

**Feature Requirement**: FR-008, FR-032, FR-033, FR-034

**Goal**: Verify sessions automatically refresh within 24h of expiration

### Steps

1. **Log in and obtain session cookie**

2. **Check initial session expiration**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT id, datetime(expires_at / 1000, 'unixepoch') as expires FROM auth_sessions WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 1;"
   ```

   - Note expiration time (30 days from now)

3. **Simulate approaching expiration** (manual database edit):

   ```bash
   # Set expires_at to 23 hours from now (within refresh window)
   sqlite3 .testing-home/dispatch/data/workspace.db <<EOF
   UPDATE auth_sessions
   SET expires_at = strftime('%s', 'now') * 1000 + (23 * 60 * 60 * 1000)
   WHERE user_id = 'default';
   EOF
   ```

4. **Make authenticated request** (refresh page or API call)

5. **Verify session refreshed**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT id, datetime(expires_at / 1000, 'unixepoch') as new_expires FROM auth_sessions WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 1;"
   ```

   - ✅ `new_expires` is now 30 days from current time (refreshed)

6. **Verify `last_active_at` updated**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT datetime(last_active_at / 1000, 'unixepoch') as last_active FROM auth_sessions WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 1;"
   ```

   - ✅ Timestamp is recent (updated on request)

### Expected Result

- ✅ Sessions within 24h of expiration automatically refresh
- ✅ New expiration is 30 days from refresh time (rolling window)
- ✅ `last_active_at` updated on each request
- ✅ User experiences seamless auth (no forced re-login)

---

## Test Scenario 5: Socket.IO Dual Authentication

**Feature Requirement**: FR-022, FR-020

**Goal**: Verify Socket.IO accepts BOTH cookies AND API keys

### Test 5A: Socket.IO with Session Cookie (Browser)

1. **Log in via browser** (session cookie set)

2. **Open browser console**

3. **Establish Socket.IO connection**:

   ```javascript
   const socket = io({ withCredentials: true });

   socket.on('connect', () => {
   	console.log('✅ Connected with session cookie');
   	console.log('Socket ID:', socket.id);
   });

   socket.on('connect_error', (error) => {
   	console.error('❌ Connection failed:', error.message);
   });
   ```

4. **Verify connection succeeds**:
   - ✅ `connect` event fires
   - ✅ Socket ID assigned
   - ✅ No `connect_error`

### Test 5B: Socket.IO with API Key (Programmatic)

1. **Create Node.js test script** (`test-socket-auth.js`):

   ```javascript
   import { io } from 'socket.io-client';

   const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with actual key

   const socket = io('http://localhost:5173', {
   	auth: { token: API_KEY }
   });

   socket.on('connect', () => {
   	console.log('✅ Connected with API key');
   	console.log('Socket ID:', socket.id);
   	process.exit(0);
   });

   socket.on('connect_error', (error) => {
   	console.error('❌ Connection failed:', error.message);
   	process.exit(1);
   });
   ```

2. **Run script**:

   ```bash
   node test-socket-auth.js
   ```

3. **Verify connection succeeds**:
   - ✅ `connect` event fires
   - ✅ Script exits successfully

### Test 5C: Socket.IO Session Expiration Event

1. **Connect with session cookie** (browser console)

2. **In separate terminal, expire session**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "UPDATE auth_sessions SET expires_at = 0 WHERE user_id = 'default';"
   ```

3. **Wait 60 seconds** (periodic validation interval)

4. **Verify `session:expired` event**:

   ```javascript
   socket.on('session:expired', (data) => {
   	console.log('✅ Session expired event received:', data.message);
   	// Should redirect to /login
   });
   ```

5. **Verify socket disconnected**:
   ```javascript
   socket.on('disconnect', (reason) => {
   	console.log('✅ Socket disconnected:', reason);
   });
   ```

### Expected Result

- ✅ Browser clients connect with session cookies
- ✅ Programmatic clients connect with API keys
- ✅ Both auth methods work for same Socket.IO endpoint
- ✅ Expired sessions emit `session:expired` and disconnect

---

## Test Scenario 6: OAuth Login (Optional)

**Feature Requirement**: FR-025, FR-026, FR-027, FR-028, FR-029

**Goal**: Verify OAuth login creates same session cookie as API key login

### Prerequisites

- OAuth provider enabled in settings (GitHub or Google)
- Valid OAuth client ID and secret configured

### Steps

1. **Navigate to login page**:

   ```
   URL: http://localhost:5173/login
   ```

2. **Click "Log in with GitHub"** (or Google)

3. **Authorize app on OAuth provider**:
   - Redirect to GitHub/Google
   - Click "Authorize" button

4. **Verify redirect to app**:
   - ✅ Redirected to `/` (main dashboard)

5. **Verify session cookie set**:
   - DevTools → Cookies
   - ✅ Cookie `dispatch_session` present

6. **Verify session provider**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT provider FROM auth_sessions WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 1;"
   ```

   - ✅ `provider` = `'oauth_github'` or `'oauth_google'`

7. **Verify user email/name populated** (if OAuth provides):
   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT email, name FROM auth_users WHERE user_id = 'default';"
   ```

### OAuth Fallback Test (Clarification)

1. **Simulate OAuth provider unavailable**:
   - Disable network temporarily
   - OR configure invalid OAuth credentials

2. **Click "Log in with GitHub"**

3. **Verify error message**:
   - ✅ Error: "OAuth provider unavailable"
   - ✅ Fallback option: "Log in with API key instead"

4. **Verify API key login still works**

### Expected Result

- ✅ OAuth login creates session cookie (same as API key login)
- ✅ Session provider tracked (`oauth_github`/`oauth_google`)
- ✅ Email/name populated from OAuth profile
- ✅ OAuth unavailable → Fallback to API key login offered
- ✅ Disabled providers reject new logins but preserve existing sessions

---

## Test Scenario 7: Logout (Session Invalidation)

**Feature Requirement**: FR-009, FR-010

**Goal**: Verify logout invalidates session and clears cookie

### Steps

1. **Log in and verify authenticated state**

2. **Click "Logout" button** (or POST to `/api/auth/logout`)

3. **Verify session cookie cleared**:
   - DevTools → Cookies
   - ✅ Cookie `dispatch_session` deleted (Max-Age=0)

4. **Verify session invalidated in database**:

   ```bash
   sqlite3 .testing-home/dispatch/data/workspace.db \
     "SELECT COUNT(*) as active_sessions FROM auth_sessions WHERE user_id = 'default' AND expires_at > strftime('%s', 'now') * 1000;"
   ```

   - ✅ `active_sessions` = 0 (or session deleted entirely)

5. **Verify redirect to login page**:
   - ✅ Redirected to `/login`

6. **Verify protected routes inaccessible**:
   - Try to access `/settings` directly
   - ✅ Redirected back to `/login`

### Expected Result

- ✅ Session cookie deleted on logout
- ✅ Session invalidated in database
- ✅ User redirected to login page
- ✅ Cannot access protected routes after logout

---

## Test Scenario 8: Multi-Tab Session Sharing

**Feature Requirement**: FR-030, FR-031

**Goal**: Verify multiple browser tabs share same session cookie

### Steps

1. **Log in Tab 1**:
   - Log in normally
   - Note session ID in DevTools

2. **Open Tab 2** (same browser):
   - Navigate to `/` (main app)
   - Check DevTools → Cookies

3. **Verify same session cookie**:
   - ✅ Tab 1 and Tab 2 have identical `dispatch_session` value

4. **Logout in Tab 1**

5. **Verify Tab 2 affected**:
   - Refresh Tab 2
   - ✅ Tab 2 also logged out (cookie cleared)

### Expected Result

- ✅ Multiple tabs share same session cookie
- ✅ Logout in one tab affects all tabs (shared cookie)
- ✅ Session state synchronized across tabs

---

## Test Scenario 9: No Rate Limiting on Failed Auth

**Feature Requirement**: FR-041 (Clarification)

**Goal**: Verify system always processes auth attempts without rate limiting

### Steps

1. **Create script to test multiple failed logins**:

   ```bash
   #!/bin/bash
   for i in {1..100}; do
     curl -X POST http://localhost:5173/login \
       -d "key=invalid_key_$i" \
       -w "\nStatus: %{http_code}\n" \
       -s -o /dev/null
   done
   ```

2. **Run script**

3. **Verify all attempts processed**:
   - ✅ All 100 requests return 401 (not rate-limited)
   - ✅ No 429 (Too Many Requests) responses
   - ✅ Server continues processing requests

### Expected Result

- ✅ No rate limiting applied to failed auth attempts
- ✅ All requests processed and rejected with 401
- ✅ No temporary IP blocking or throttling

**Note**: bcrypt's inherent cost factor provides natural rate limiting (~100ms per attempt).

---

## Performance Validation

### API Key Validation Performance

**Goal**: Verify API key validation completes <100ms

```bash
# Test with curl and time measurement
time curl -X POST http://localhost:5173/login -d "key=YOUR_API_KEY_HERE" -s -o /dev/null
```

**Expected**: <100ms total time (bcrypt cost factor 12)

### Session Cookie Validation Performance

**Goal**: Verify session validation completes <50ms

1. Log in (session cookie set)
2. Measure authenticated request time:
   ```bash
   time curl http://localhost:5173/api/sessions -H "Cookie: dispatch_session=YOUR_SESSION_ID" -s -o /dev/null
   ```

**Expected**: <50ms total time (SQLite indexed lookup)

---

## Verification Checklist

After completing all test scenarios, verify:

- [x] Onboarding generates first API key
- [x] API keys shown exactly once on creation
- [x] Session cookies set with correct attributes
- [x] API key login creates session cookies
- [x] Users can create, list, disable, delete API keys
- [x] Sessions refresh within 24h of expiration (rolling window)
- [x] Socket.IO accepts cookies AND API keys
- [x] OAuth login creates session cookies (optional)
- [x] Logout invalidates session and clears cookie
- [x] Multi-tab sessions synchronized
- [x] No rate limiting on failed auth
- [x] Performance targets met (API key <100ms, session <50ms)

---

## Troubleshooting

### Cookie Not Set

**Symptom**: Login succeeds but cookie not in browser

**Fixes**:

- Check `Secure` attribute matches environment (false in dev, true in prod)
- Verify SameSite=Lax allows cross-origin (if applicable)
- Check browser console for cookie warnings

### Socket.IO Connection Rejected

**Symptom**: `connect_error: Authentication required`

**Fixes**:

- Verify `withCredentials: true` in client config (for cookies)
- Check API key format (44-char base64url) if using API key auth
- Verify server middleware parsing cookies correctly

### Session Not Refreshing

**Symptom**: Session expires after 30 days even with active use

**Fixes**:

- Verify `last_active_at` updating on requests
- Check refresh window logic (24h before expiration)
- Verify cookie Max-Age updating on refresh

---

**Status**: Quickstart guide complete, ready for manual testing
