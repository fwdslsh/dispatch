# Cookie Authentication Refactor - Cleanup Tasks

**Date**: 2025-01-09
**Validation Status**: PASS WITH WARNINGS
**Critical Issues**: 2
**High Priority Issues**: 7
**Medium Priority Issues**: 12
**Low Priority Issues**: 5

---

## Executive Summary

The cookie-based authentication refactor is **functionally complete** but requires cleanup to remove deprecated code, fix integration issues, and improve security. The core implementation is solid:

- ✅ `SessionManager` (cookie-based sessions with 30-day expiry)
- ✅ `ApiKeyManager` (bcrypt-hashed API keys)
- ✅ `CookieService` (secure cookie handling)
- ✅ `OAuthManager` (GitHub/Google OAuth)
- ✅ Database migration (migration #2 in migrate.js)
- ✅ Dual authentication in `hooks.server.js` and `socket-setup.js`

However, **localStorage is still being used** for authentication token storage in multiple client files, which undermines the cookie-based approach. Additionally, several deprecated authentication files should be removed.

---

## ✅ Progress Update

**Last Updated**: 2025-01-09

### Completed Critical Fixes (50 minutes)

1. **✅ JWTService.js Removal** (15 min)
   - Deleted `/src/lib/server/auth/JWTService.js`
   - Removed all imports and references from `services.js`
   - Cleaned up typedef and exports
   - No remaining JWT references found

2. **✅ session.js Removal** (30 min)
   - Deleted `/src/lib/server/auth/session.js`
   - Verified no imports remain
   - `SessionManager.server.js` is now single source of truth

3. **✅ jsonwebtoken Dependency Removal** (5 min)
   - Removed from `package.json`
   - User action required: Run `npm install` to update lock file

4. **✅ authHandlers.js Cleanup**
   - Removed `validateToken()` and `refreshToken()` handlers
   - Kept `hello()` handler for compatibility
   - Added documentation about JWT removal

### In Progress: localStorage Cleanup 🚧

**16 files identified** with localStorage authentication usage. This is a **HIGH SECURITY PRIORITY** as localStorage storage undermines cookie-based security (XSS vulnerability).

**Files Requiring Cleanup:**
- High Priority (3): OAuth callback, AuthenticationStep, OnboardingFlow
- Medium Priority (2): SessionApiClient, ServiceContainer
- Other (11): Various components using localStorage for auth tokens

**Estimated Effort**: 2-3 hours

**See** `/specs/009-cookie-auth-refactor/critical-fixes-progress.md` for detailed tracking.

---

# Cookie-Based Authentication - Cleanup Tasks

This document tracks architectural issues and improvements identified during the MVVM architecture review of the cookie-based authentication implementation.

---

## 8. MVVM Architecture Issues

### 8.1 Pattern Violations

#### 8.1.1 Direct fetch() Calls in ViewModels (CRITICAL)

**Issue**: ViewModels contain direct fetch() calls instead of using Service layer abstraction.

**Affected Files**:
- `src/lib/client/shared/state/AuthViewModel.svelte.js` (lines 123, 145, 188, 238)
- `src/lib/client/shared/state/ApiKeyState.svelte.js` (lines 93, 129, 182, 226)
- `src/lib/client/settings/OAuthSettings.svelte` (lines 62, 106)

**Why This Violates MVVM**:
- ViewModels should contain business logic, not HTTP implementation details
- Makes ViewModels harder to test (requires mocking fetch globally)
- Violates Single Responsibility Principle (ViewModel handles both logic AND transport)
- Prevents proper dependency injection and service abstraction

**Current Implementation** (AuthViewModel.svelte.js:123-130):
```javascript
async loadAuthConfig() {
    try {
        const response = await fetch('/api/auth/config');
        if (response.ok) {
            this.authConfig = await response.json();
            log.info('Auth config loaded', this.authConfig);
        } else {
            log.error('Failed to load auth config', response.status);
        }
    } catch (err) {
        log.error('Failed to load auth config', err);
    }
}
```

**Recommended Fix**:
Create an `AuthService` class to handle all authentication API calls:

```javascript
// src/lib/client/shared/services/AuthService.js
export class AuthService {
    constructor(config = {}) {
        this.baseUrl = config.apiBaseUrl || '';
    }

    async getAuthConfig() {
        const response = await fetch(`${this.baseUrl}/api/auth/config`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Failed to load auth config: ${response.status}`);
        }
        return response.json();
    }

    async loginWithKey(key) {
        const formData = new FormData();
        formData.append('key', key);

        const response = await fetch(`${this.baseUrl}/login`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            redirect: 'manual'
        });

        if (response.type === 'opaqueredirect' || response.status === 303 || response.ok) {
            return { success: true };
        }

        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Invalid API key');
    }

    async checkExistingAuth() {
        const response = await fetch(`${this.baseUrl}/api/workspaces`, {
            method: 'GET',
            credentials: 'include'
        });
        return response.ok;
    }

    async initiateOAuth(provider = 'github') {
        const response = await fetch(`${this.baseUrl}/api/auth/oauth/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.message || `OAuth provider ${provider} is not available`);
        }

        const data = await response.json();
        if (!data.authUrl) {
            throw new Error('Failed to get OAuth authorization URL');
        }

        return data.authUrl;
    }
}
```

**Updated AuthViewModel**:
```javascript
export class AuthViewModel {
    constructor(authService) {
        this.authService = authService;

        // Reactive state
        this.key = $state('');
        this.error = $state('');
        this.loading = $state(false);
        this.authConfig = $state(null);
    }

    async loadAuthConfig() {
        try {
            this.authConfig = await this.authService.getAuthConfig();
            log.info('Auth config loaded', this.authConfig);
        } catch (err) {
            log.error('Failed to load auth config', err);
        }
    }

    async loginWithKey(key) {
        this.loading = true;
        this.error = '';

        try {
            log.info('Attempting login with API key');
            const result = await this.authService.loginWithKey(key);
            return result;
        } catch (err) {
            this.error = err.message;
            log.error('Login error', err);
            return { success: false, error: err.message };
        } finally {
            this.loading = false;
        }
    }
}
```

**Priority**: CRITICAL
**Effort**: Medium (2-3 hours)
**Benefits**: Testability, maintainability, proper separation of concerns

---

#### 8.1.2 OAuthSettings Component Mixing ViewModel and View Logic (HIGH)

**Issue**: `OAuthSettings.svelte` component contains both ViewModel logic (state management, validation, API calls) and View logic (rendering), violating MVVM separation.

**File**: `src/lib/client/settings/OAuthSettings.svelte`

**Why This Violates MVVM**:
- Component has 592 lines combining state management, business logic, and UI
- Direct API calls in component instead of ViewModel (lines 62, 106)
- Business logic (validation, data transformation) mixed with rendering
- Difficult to test business logic without rendering component

**Current Implementation** (lines 13-44):
```svelte
<script>
    // Component state mixing ViewModel concerns
    let loading = $state(false);
    let saving = $state(false);
    let error = $state('');
    let successMessage = $state('');

    let providers = $state({
        github: { enabled: false, clientId: '', clientSecret: '' },
        google: { enabled: false, clientId: '', clientSecret: '' }
    });

    let originalProviders = $state(null);

    // Derived state - belongs in ViewModel
    let hasChanges = $derived.by(() => {
        if (!originalProviders) return false;
        return JSON.stringify(providers) !== JSON.stringify(originalProviders);
    });

    let canSave = $derived.by(() => {
        return hasChanges && !saving && !loading;
    });

    // Direct API calls - belongs in Service layer
    async function loadOAuthSettings() {
        loading = true;
        error = '';
        try {
            const response = await fetch('/api/settings/oauth', {
                method: 'GET',
                credentials: 'include'
            });
            // ... more logic
        } catch (err) {
            error = 'Unable to reach server';
        } finally {
            loading = false;
        }
    }
</script>
```

**Recommended Fix**:
Create dedicated `OAuthSettingsViewModel.svelte.js` and `OAuthService.js`:

```javascript
// src/lib/client/shared/services/OAuthService.js
export class OAuthService {
    constructor(config = {}) {
        this.baseUrl = config.apiBaseUrl || '';
    }

    async getOAuthSettings() {
        const response = await fetch(`${this.baseUrl}/api/settings/oauth`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to load OAuth settings');
        }

        return response.json();
    }

    async saveOAuthSettings(providers) {
        const response = await fetch(`${this.baseUrl}/api/settings/oauth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ providers })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to save OAuth settings');
        }

        return response.json();
    }
}
```

```javascript
// src/lib/client/shared/state/OAuthSettingsViewModel.svelte.js
export class OAuthSettingsViewModel {
    constructor(oauthService) {
        this.oauthService = oauthService;

        // Reactive state
        this.loading = $state(false);
        this.saving = $state(false);
        this.error = $state('');
        this.successMessage = $state('');

        this.providers = $state({
            github: { enabled: false, clientId: '', clientSecret: '' },
            google: { enabled: false, clientId: '', clientSecret: '' }
        });

        this.originalProviders = $state(null);
    }

    // Derived state
    hasChanges = $derived.by(() => {
        if (!this.originalProviders) return false;
        return JSON.stringify(this.providers) !== JSON.stringify(this.originalProviders);
    });

    canSave = $derived.by(() => {
        return this.hasChanges && !this.saving && !this.loading;
    });

    // Business logic methods
    async initialize() {
        await this.loadSettings();
    }

    async loadSettings() {
        this.loading = true;
        this.error = '';

        try {
            const data = await this.oauthService.getOAuthSettings();
            this.providers = {
                github: {
                    enabled: data.github?.enabled || false,
                    clientId: data.github?.clientId || '',
                    clientSecret: ''
                },
                google: {
                    enabled: data.google?.enabled || false,
                    clientId: data.google?.clientId || '',
                    clientSecret: ''
                }
            };

            this.originalProviders = JSON.parse(JSON.stringify(this.providers));
        } catch (err) {
            this.error = err.message;
            throw err;
        } finally {
            this.loading = false;
        }
    }

    async save() {
        this.saving = true;
        this.error = '';
        this.successMessage = '';

        try {
            await this.oauthService.saveOAuthSettings(this.providers);
            this.successMessage = 'OAuth settings saved successfully';
            await this.loadSettings();

            // Auto-clear success message
            setTimeout(() => {
                this.successMessage = '';
            }, 3000);

            return true;
        } catch (err) {
            this.error = err.message;
            return false;
        } finally {
            this.saving = false;
        }
    }

    toggleProvider(providerName) {
        this.providers[providerName].enabled = !this.providers[providerName].enabled;

        if (!this.providers[providerName].enabled) {
            this.providers[providerName].clientId = '';
            this.providers[providerName].clientSecret = '';
        }
    }

    updateClientId(providerName, value) {
        this.providers[providerName].clientId = value;
    }

    updateClientSecret(providerName, value) {
        this.providers[providerName].clientSecret = value;
    }

    discardChanges() {
        if (this.originalProviders) {
            this.providers = JSON.parse(JSON.stringify(this.originalProviders));
        }
        this.error = '';
        this.successMessage = '';
    }

    clearError() {
        this.error = '';
    }

    clearSuccess() {
        this.successMessage = '';
    }
}
```

**Updated Component**:
```svelte
<!-- src/lib/client/settings/OAuthSettings.svelte -->
<script>
    import { onMount } from 'svelte';
    import { OAuthSettingsViewModel } from '$lib/client/shared/state/OAuthSettingsViewModel.svelte.js';
    import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
    import Button from '../shared/components/Button.svelte';
    import InfoBox from '../shared/components/InfoBox.svelte';

    // Get dependencies via DI
    const container = useServiceContainer();
    const oauthService = await container.get('oauthService');

    // Initialize ViewModel
    const viewModel = new OAuthSettingsViewModel(oauthService);

    onMount(async () => {
        await viewModel.initialize();
    });

    // Provider metadata (pure UI data)
    const providerMeta = {
        github: {
            name: 'GitHub',
            icon: 'github',
            docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps',
            description: 'Allow users to log in with their GitHub account'
        },
        google: {
            name: 'Google',
            icon: 'google',
            docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
            description: 'Allow users to log in with their Google account'
        }
    };
</script>

<div class="oauth-settings" data-testid="oauth-settings">
    <div class="settings-header">
        <h4>OAuth Provider Configuration</h4>
        <p class="settings-description">
            Enable and configure OAuth providers to allow users to authenticate using external services.
        </p>
    </div>

    {#if viewModel.error}
        <InfoBox variant="error">
            <strong>Error:</strong> {viewModel.error}
            <button class="message-close" onclick={() => viewModel.clearError()}>×</button>
        </InfoBox>
    {/if}

    {#if viewModel.successMessage}
        <InfoBox variant="success">
            <strong>Success:</strong> {viewModel.successMessage}
            <button class="message-close" onclick={() => viewModel.clearSuccess()}>×</button>
        </InfoBox>
    {/if}

    {#if viewModel.loading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading OAuth settings...</p>
        </div>
    {:else}
        <!-- Provider Configurations -->
        <div class="providers-container">
            {#each Object.entries(providerMeta) as [providerKey, meta] (providerKey)}
                {@const config = viewModel.providers[providerKey]}
                <div class="provider-card">
                    <div class="provider-header">
                        <div class="provider-info">
                            <h5 class="provider-name">{meta.name}</h5>
                            <p class="provider-description">{meta.description}</p>
                        </div>
                        <label class="toggle-switch">
                            <input
                                type="checkbox"
                                checked={config.enabled}
                                onchange={() => viewModel.toggleProvider(providerKey)}
                                disabled={viewModel.saving}
                            />
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    {#if config.enabled}
                        <div class="provider-config">
                            <div class="form-group">
                                <label for="{providerKey}-client-id" class="form-label">
                                    Client ID
                                    <a href={meta.docsUrl} target="_blank" class="docs-link">📖 Docs</a>
                                </label>
                                <input
                                    id="{providerKey}-client-id"
                                    type="text"
                                    class="form-input"
                                    placeholder="Enter {meta.name} Client ID"
                                    value={config.clientId}
                                    oninput={(e) => viewModel.updateClientId(providerKey, e.target.value)}
                                    disabled={viewModel.saving}
                                />
                            </div>

                            <div class="form-group">
                                <label for="{providerKey}-client-secret" class="form-label">
                                    Client Secret
                                </label>
                                <input
                                    id="{providerKey}-client-secret"
                                    type="password"
                                    class="form-input"
                                    placeholder="Enter {meta.name} Client Secret"
                                    value={config.clientSecret}
                                    oninput={(e) => viewModel.updateClientSecret(providerKey, e.target.value)}
                                    disabled={viewModel.saving}
                                />
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- Action Buttons -->
        <div class="settings-actions">
            <Button
                variant="primary"
                onclick={() => viewModel.save()}
                disabled={!viewModel.canSave}
                loading={viewModel.saving}
            >
                {viewModel.saving ? 'Saving...' : 'Save OAuth Settings'}
            </Button>

            {#if viewModel.hasChanges}
                <Button
                    variant="secondary"
                    onclick={() => viewModel.discardChanges()}
                    disabled={viewModel.saving}
                >
                    Discard Changes
                </Button>
            {/if}
        </div>

        <InfoBox variant="info">
            <strong>Security Notice:</strong>
            OAuth client secrets are encrypted at rest and never sent to the browser.
        </InfoBox>
    {/if}
</div>

<!-- Keep existing styles -->
```

**Priority**: HIGH
**Effort**: Medium (2-3 hours)
**Benefits**:
- Cleaner component code (reduced from 592 to ~150 lines)
- Testable business logic
- Reusable ViewModel for other OAuth components

---

### 8.2 State Management Anti-Patterns

#### 8.2.1 Overuse of $state for Simple Derived Values (MEDIUM)

**Issue**: Using `$state` for values that could be simple `$derived` computations or regular getters.

**File**: `src/lib/client/onboarding/OnboardingViewModel.svelte.js` (lines 33-50)

**Current Implementation**:
```javascript
export class OnboardingViewModel {
    currentStep = $state('auth');
    formData = $state({
        terminalKey: '',
        confirmTerminalKey: '',
        workspaceName: '',
        workspacePath: ''
    });

    // Using regular getters instead of $derived
    get progressPercentage() {
        const steps = ['auth', 'workspace', 'theme', 'settings', 'complete'];
        const currentIndex = steps.indexOf(this.currentStep);
        return Math.round((currentIndex / (steps.length - 1)) * 100);
    }

    get canProceedFromAuth() {
        return (
            this.formData.terminalKey.length >= 8 &&
            this.formData.terminalKey === this.formData.confirmTerminalKey
        );
    }
}
```

**Why This Is Inconsistent**:
- Uses JavaScript getters instead of Svelte's `$derived` rune
- Getters don't integrate with Svelte's reactivity system as cleanly
- Inconsistent with MVVM patterns guide (docs/architecture/mvvm-patterns.md)
- May not trigger component re-renders when dependencies change

**Recommended Fix**:
```javascript
export class OnboardingViewModel {
    currentStep = $state('auth');
    formData = $state({
        terminalKey: '',
        confirmTerminalKey: '',
        workspaceName: '',
        workspacePath: ''
    });

    // Use $derived for reactive computed values
    progressPercentage = $derived.by(() => {
        const steps = ['auth', 'workspace', 'theme', 'settings', 'complete'];
        const currentIndex = steps.indexOf(this.currentStep);
        return Math.round((currentIndex / (steps.length - 1)) * 100);
    });

    canProceedFromAuth = $derived.by(() => {
        return (
            this.formData.terminalKey.length >= 8 &&
            this.formData.terminalKey === this.formData.confirmTerminalKey
        );
    });

    canProceedFromWorkspace = $derived(true); // Simple boolean
}
```

**Priority**: MEDIUM
**Effort**: Low (30 minutes)
**Benefits**: Consistent reactive patterns, better Svelte integration

---

#### 8.2.2 Missing $state for Reactive Component Variables (LOW)

**Issue**: Login page uses component-level `$state` instead of delegating to ViewModel.

**File**: `src/routes/login/+page.svelte` (lines 20-21)

**Current Implementation**:
```svelte
<script>
    const authViewModel = new AuthViewModel();

    // Component state duplicating ViewModel state
    let apiKey = $state('');
    let isSubmitting = $state(false);
</script>

<input
    id="api-key"
    name="key"
    type="password"
    bind:value={apiKey}
    disabled={isSubmitting}
/>
```

**Why This Is Suboptimal**:
- Component maintains its own `apiKey` state separate from ViewModel's `key` state
- `isSubmitting` duplicates ViewModel's `loading` state
- Creates two sources of truth for the same data
- Breaks unidirectional data flow pattern

**Recommended Fix**:
```svelte
<script>
    import { AuthViewModel } from '$lib/client/shared/state/AuthViewModel.svelte.js';
    import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

    const container = useServiceContainer();
    const authService = await container.get('authService');
    const authViewModel = new AuthViewModel(authService);

    // No local state - use ViewModel directly
</script>

<input
    id="api-key"
    name="key"
    type="password"
    bind:value={authViewModel.key}
    disabled={authViewModel.loading}
/>

<Button
    type="submit"
    disabled={authViewModel.loading || !authViewModel.key.trim()}
    loading={authViewModel.loading}
>
    {authViewModel.loading ? 'Logging in...' : 'Log In'}
</Button>
```

**Priority**: LOW
**Effort**: Low (15 minutes)
**Benefits**: Single source of truth, cleaner component code

---

### 8.3 Service Layer Issues

#### 8.3.1 socket-auth.js Should Be a Service Class (HIGH)

**Issue**: `socket-auth.js` is implemented as utility functions instead of a proper Service class, preventing dependency injection and proper state management.

**File**: `src/lib/client/shared/socket-auth.js`

**Why This Violates MVVM**:
- Cannot be properly injected into ViewModels (not following DI pattern)
- Stores configuration as function parameters instead of class instance state
- Cannot maintain connection state across multiple calls
- Harder to test (requires mocking module exports)
- Inconsistent with other services in codebase

**Current Implementation**:
```javascript
// Utility functions - not a class
export async function createAuthenticatedSocket(options = {}, config = {}) {
    const socketUrl = getSocketUrl(config);
    const socketOptions = {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        ...options
    };

    if (config.apiKey) {
        socketOptions.auth = { token: config.apiKey };
    }

    const socket = io(socketUrl, socketOptions);
    // ... connection logic
}

export async function testAuthKey(key, config = {}) {
    const socketUrl = getSocketUrl(config);
    const socket = io(socketUrl, { /* ... */ });
    // ... test logic
}
```

**Recommended Fix**:
Create `SocketAuthService.svelte.js` as a proper service class:

```javascript
// src/lib/client/shared/services/SocketAuthService.svelte.js
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

export class SocketAuthService {
    constructor(config = {}) {
        this.config = config;
        this.socketUrl = config.socketUrl || (typeof window !== 'undefined' ? window.location.origin : '');

        // Track active connections
        this.activeSocket = $state(null);
        this.isConnected = $state(false);
    }

    /**
     * Create authenticated Socket.IO connection with cookie support
     * @param {Object} options - Additional socket options
     * @returns {Promise<{socket: Object, authenticated: boolean}>}
     */
    async createAuthenticatedSocket(options = {}) {
        const socketOptions = {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            ...options
        };

        // If API key provided (programmatic access), include in auth
        if (this.config.apiKey) {
            socketOptions.auth = { token: this.config.apiKey };
        }

        const socket = io(this.socketUrl, socketOptions);

        return new Promise((resolve, reject) => {
            socket.on(SOCKET_EVENTS.CONNECTION, () => {
                socket.emit('client:hello', {}, (response) => {
                    if (response?.success) {
                        this.activeSocket = socket;
                        this.isConnected = true;
                        resolve({ socket, authenticated: true });
                    } else {
                        socket.disconnect();
                        resolve({ socket: null, authenticated: false });
                    }
                });
            });

            socket.on('connect_error', (error) => {
                socket.disconnect();
                reject(error);
            });

            socket.on('session:expired', (data) => {
                console.warn('Session expired:', data.message);
                this.disconnect();
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            });
        });
    }

    /**
     * Test authentication with a specific API key
     * @param {string} key - API key to test
     * @returns {Promise<boolean>}
     */
    async testAuthKey(key) {
        const socket = io(this.socketUrl, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            auth: { token: key }
        });

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                socket.disconnect();
                resolve(false);
            }, 5000);

            socket.on(SOCKET_EVENTS.CONNECTION, () => {
                socket.emit('client:hello', { apiKey: key }, (response) => {
                    clearTimeout(timeout);
                    socket.disconnect();
                    resolve(response?.success === true);
                });
            });

            socket.on(SOCKET_EVENTS.CONNECT_ERROR, () => {
                clearTimeout(timeout);
                socket.disconnect();
                resolve(false);
            });
        });
    }

    /**
     * Check if user is currently authenticated via session cookie
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        try {
            const response = await fetch('/api/workspaces', {
                method: 'GET',
                credentials: 'include'
            });
            return response.ok;
        } catch (err) {
            console.error('Error checking authentication:', err);
            return false;
        }
    }

    /**
     * Disconnect active socket
     */
    disconnect() {
        if (this.activeSocket) {
            this.activeSocket.disconnect();
            this.activeSocket = null;
            this.isConnected = false;
        }
    }

    /**
     * Cleanup on service disposal
     */
    dispose() {
        this.disconnect();
    }
}
```

**Update ServiceContainer registration**:
```javascript
// src/lib/client/shared/services/ServiceContainer.svelte.js
registerCoreServices() {
    // ... existing registrations

    this.registerFactory('socketAuth', async () => {
        const { SocketAuthService } = await import('./SocketAuthService.svelte.js');
        return new SocketAuthService(this.config);
    });
}
```

**Usage in ViewModels**:
```javascript
export class AuthViewModel {
    constructor(authService, socketAuthService) {
        this.authService = authService;
        this.socketAuthService = socketAuthService;
    }

    async initialize() {
        // Check authentication via service
        const isAuthenticated = await this.socketAuthService.isAuthenticated();
        return { redirectToWorkspace: isAuthenticated };
    }
}
```

**Priority**: HIGH
**Effort**: Medium (2 hours)
**Benefits**:
- Proper dependency injection
- Testable service layer
- State management for socket connections
- Consistent with other service classes

---

#### 8.3.2 Missing API Key Service Abstraction (MEDIUM)

**Issue**: `ApiKeyState` ViewModel makes direct API calls instead of using a dedicated service.

**File**: `src/lib/client/shared/state/ApiKeyState.svelte.js` (lines 86-259)

**Recommended Fix**:
Create `ApiKeyService.js`:

```javascript
// src/lib/client/shared/services/ApiKeyService.js
export class ApiKeyService {
    constructor(config = {}) {
        this.baseUrl = config.apiBaseUrl || '';
    }

    async listKeys() {
        const response = await fetch(`${this.baseUrl}/api/auth/keys`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to load API keys');
        }

        const data = await response.json();
        return data.keys || [];
    }

    async createKey(label) {
        const response = await fetch(`${this.baseUrl}/api/auth/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ label })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to create API key');
        }

        return response.json();
    }

    async deleteKey(keyId) {
        const response = await fetch(`${this.baseUrl}/api/auth/keys/${keyId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to delete API key');
        }

        return true;
    }

    async toggleKey(keyId, disabled) {
        const response = await fetch(`${this.baseUrl}/api/auth/keys/${keyId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ disabled })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to toggle API key');
        }

        return true;
    }
}
```

**Updated ApiKeyState ViewModel**:
```javascript
export class ApiKeyState {
    constructor(apiKeyService) {
        this.apiKeyService = apiKeyService;

        this.keys = $state([]);
        this.loading = $state(false);
        this.error = $state('');

        this.activeKeys = $derived.by(() => this.keys.filter(k => k.disabled === 0));
        this.disabledKeys = $derived.by(() => this.keys.filter(k => k.disabled === 1));
        this.activeCount = $derived(this.activeKeys.length);
    }

    async loadKeys() {
        this.loading = true;
        this.error = '';

        try {
            this.keys = await this.apiKeyService.listKeys();
            log.info(`Loaded ${this.keys.length} API keys`);
        } catch (err) {
            this.error = err.message;
            log.error('Load keys error', err);
        } finally {
            this.loading = false;
        }
    }

    async createKey(label) {
        this.loading = true;
        this.error = '';

        try {
            const result = await this.apiKeyService.createKey(label);
            await this.loadKeys();
            return result;
        } catch (err) {
            this.error = err.message;
            return null;
        } finally {
            this.loading = false;
        }
    }

    // ... similar for deleteKey, toggleKey
}
```

**Priority**: MEDIUM
**Effort**: Low (1 hour)
**Benefits**: Consistent service abstraction, better testability

---

### 8.4 Component Structure Issues

#### 8.4.1 Login Page Missing Service Dependency Injection (MEDIUM)

**Issue**: Login page creates AuthViewModel without proper service injection, making it untestable and coupled to global fetch.

**File**: `src/routes/login/+page.svelte` (line 17)

**Current Implementation**:
```svelte
<script>
    // Creates ViewModel without dependencies
    const authViewModel = new AuthViewModel();
</script>
```

**Recommended Fix**:
```svelte
<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { AuthViewModel } from '$lib/client/shared/state/AuthViewModel.svelte.js';
    import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

    // Get dependencies from container
    const container = useServiceContainer();
    const authService = await container.get('authService');
    const authViewModel = new AuthViewModel(authService);

    onMount(async () => {
        const initResult = await authViewModel.initialize();
        if (initResult.redirectToWorkspace) {
            await goto('/');
        }
    });
</script>
```

**Priority**: MEDIUM
**Effort**: Low (30 minutes)
**Benefits**: Testable components, proper DI pattern

---

#### 8.4.2 ApiKeyManager Component Too Large (LOW)

**Issue**: `ApiKeyManager.svelte` is 693 lines with mixed concerns (modal logic, table rendering, form handling).

**File**: `src/lib/client/settings/ApiKeyManager.svelte`

**Recommended Fix**:
Extract sub-components:

1. `ApiKeyTable.svelte` - Table rendering and row actions
2. `CreateKeyModal.svelte` - Key creation flow
3. `DeleteKeyModal.svelte` - Delete confirmation
4. `ApiKeyManager.svelte` - Orchestration component (< 200 lines)

**Priority**: LOW
**Effort**: Medium (2-3 hours)
**Benefits**: Better code organization, reusable components

---

### 8.5 Recommended Refactoring

#### 8.5.1 Create Unified Service Layer (CRITICAL)

**Priority**: CRITICAL
**Effort**: High (4-6 hours)

**Services to Create**:

1. **AuthService.js** - Authentication operations
   - `getAuthConfig()` - Load auth configuration
   - `loginWithKey(key)` - API key login
   - `checkExistingAuth()` - Verify session
   - `initiateOAuth(provider)` - Start OAuth flow

2. **ApiKeyService.js** - API key management
   - `listKeys()` - Get all keys
   - `createKey(label)` - Generate new key
   - `deleteKey(keyId)` - Remove key
   - `toggleKey(keyId, disabled)` - Enable/disable key

3. **OAuthService.js** - OAuth settings
   - `getOAuthSettings()` - Load OAuth config
   - `saveOAuthSettings(providers)` - Update OAuth config

4. **SocketAuthService.svelte.js** - Socket authentication
   - `createAuthenticatedSocket(options)` - Create socket connection
   - `testAuthKey(key)` - Test API key
   - `isAuthenticated()` - Check auth status

**Register in ServiceContainer**:
```javascript
// src/lib/client/shared/services/ServiceContainer.svelte.js
registerCoreServices() {
    this.registerFactory('authService', async () => {
        const { AuthService } = await import('./AuthService.js');
        return new AuthService(this.config);
    });

    this.registerFactory('apiKeyService', async () => {
        const { ApiKeyService } = await import('./ApiKeyService.js');
        return new ApiKeyService(this.config);
    });

    this.registerFactory('oauthService', async () => {
        const { OAuthService } = await import('./OAuthService.js');
        return new OAuthService(this.config);
    });

    this.registerFactory('socketAuth', async () => {
        const { SocketAuthService } = await import('./SocketAuthService.svelte.js');
        return new SocketAuthService(this.config);
    });
}
```

**Benefits**:
- Consistent service abstraction across all auth features
- Testable ViewModels with mock services
- Single source of truth for API endpoints
- Easier to modify API implementation

---

#### 8.5.2 Update All ViewModels to Use Service Layer (CRITICAL)

**Priority**: CRITICAL
**Effort**: Medium (3-4 hours)

**ViewModels to Update**:

1. **AuthViewModel.svelte.js** - Inject `AuthService`
2. **ApiKeyState.svelte.js** - Inject `ApiKeyService`
3. **Create OAuthSettingsViewModel.svelte.js** - Extract from component, inject `OAuthService`

**Example Migration** (AuthViewModel):

**Before**:
```javascript
export class AuthViewModel {
    async loadAuthConfig() {
        const response = await fetch('/api/auth/config');
        // ... handle response
    }
}
```

**After**:
```javascript
export class AuthViewModel {
    constructor(authService) {
        this.authService = authService;
        // ... state initialization
    }

    async loadAuthConfig() {
        try {
            this.authConfig = await this.authService.getAuthConfig();
        } catch (err) {
            log.error('Failed to load auth config', err);
        }
    }
}
```

---

#### 8.5.3 Add Comprehensive ViewModel Tests (HIGH)

**Priority**: HIGH
**Effort**: Medium (3-4 hours)

**Test Files to Create**:

1. `tests/client/state/AuthViewModel.test.js`
2. `tests/client/state/ApiKeyState.test.js`
3. `tests/client/state/OAuthSettingsViewModel.test.js`

**Example Test** (AuthViewModel):
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthViewModel } from '$lib/client/shared/state/AuthViewModel.svelte.js';

describe('AuthViewModel', () => {
    let mockAuthService;
    let viewModel;

    beforeEach(() => {
        mockAuthService = {
            getAuthConfig: vi.fn(),
            loginWithKey: vi.fn(),
            checkExistingAuth: vi.fn(),
            initiateOAuth: vi.fn()
        };

        viewModel = new AuthViewModel(mockAuthService);
    });

    describe('loadAuthConfig', () => {
        it('should load auth config successfully', async () => {
            const mockConfig = {
                terminal_key_set: true,
                oauth_configured: false
            };
            mockAuthService.getAuthConfig.mockResolvedValue(mockConfig);

            await viewModel.loadAuthConfig();

            expect(viewModel.authConfig).toEqual(mockConfig);
            expect(viewModel.hasTerminalKeyAuth).toBe(true);
            expect(viewModel.hasOAuthAuth).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockAuthService.getAuthConfig.mockRejectedValue(new Error('Network error'));

            await viewModel.loadAuthConfig();

            expect(viewModel.authConfig).toBeNull();
        });
    });

    describe('loginWithKey', () => {
        it('should login successfully with valid key', async () => {
            mockAuthService.loginWithKey.mockResolvedValue({ success: true });

            const result = await viewModel.loginWithKey('valid-key');

            expect(result.success).toBe(true);
            expect(viewModel.loading).toBe(false);
            expect(viewModel.error).toBe('');
        });

        it('should set error on invalid key', async () => {
            mockAuthService.loginWithKey.mockRejectedValue(new Error('Invalid API key'));

            const result = await viewModel.loginWithKey('invalid-key');

            expect(result.success).toBe(false);
            expect(viewModel.error).toBe('Invalid API key');
            expect(viewModel.loading).toBe(false);
        });

        it('should set loading state during login', async () => {
            let resolveLogin;
            mockAuthService.loginWithKey.mockReturnValue(
                new Promise((resolve) => { resolveLogin = resolve; })
            );

            const loginPromise = viewModel.loginWithKey('test-key');
            expect(viewModel.loading).toBe(true);

            resolveLogin({ success: true });
            await loginPromise;
            expect(viewModel.loading).toBe(false);
        });
    });

    describe('derived state', () => {
        it('should compute hasAnyAuth correctly', async () => {
            expect(viewModel.hasAnyAuth).toBe(false);

            viewModel.authConfig = { terminal_key_set: true, oauth_configured: false };
            expect(viewModel.hasAnyAuth).toBe(true);

            viewModel.authConfig = { terminal_key_set: false, oauth_configured: true };
            expect(viewModel.hasAnyAuth).toBe(true);

            viewModel.authConfig = { terminal_key_set: true, oauth_configured: true };
            expect(viewModel.hasAnyAuth).toBe(true);
        });
    });
});
```

---

## Summary

### Critical Issues (Must Fix)
1. Direct fetch() calls in ViewModels (8.1.1)
2. Create unified service layer (8.5.1)
3. Update ViewModels to use services (8.5.2)

### High Priority Issues (Should Fix)
1. OAuthSettings component mixing ViewModel and View (8.1.2)
2. socket-auth.js should be a Service class (8.3.1)
3. Add comprehensive ViewModel tests (8.5.3)

### Medium Priority Issues (Nice to Have)
1. Overuse of $state for simple derived values (8.2.1)
2. Missing API Key Service abstraction (8.3.2)
3. Login page missing service injection (8.4.1)

### Low Priority Issues (Optional)
1. Missing $state for reactive component variables (8.2.2)
2. ApiKeyManager component too large (8.4.2)

### Estimated Total Effort
- **Critical**: 7-10 hours
- **High**: 7-9 hours
- **Medium**: 3-4 hours
- **Low**: 2-3 hours
- **Total**: 19-26 hours

### Benefits of Refactoring
1. **Testability**: All ViewModels can be unit tested with mock services
2. **Maintainability**: Clear separation of concerns
3. **Reusability**: Services can be shared across ViewModels
4. **Consistency**: Unified architecture patterns
5. **Type Safety**: Better TypeScript integration with service contracts
6. **Error Handling**: Centralized error handling in service layer

---

## Next Steps

1. **Phase 1** (Critical): Create service layer
   - AuthService.js
   - ApiKeyService.js
   - OAuthService.js
   - SocketAuthService.svelte.js

2. **Phase 2** (Critical): Update ViewModels
   - Refactor AuthViewModel
   - Refactor ApiKeyState
   - Create OAuthSettingsViewModel

3. **Phase 3** (High): Component refactoring
   - Extract OAuthSettings component logic to ViewModel
   - Update login page to use DI

4. **Phase 4** (High): Add tests
   - AuthViewModel tests
   - ApiKeyState tests
   - OAuthSettingsViewModel tests
   - Service layer tests

5. **Phase 5** (Medium/Low): Polish
   - Fix $state/$derived inconsistencies
   - Extract sub-components
   - Documentation updates
