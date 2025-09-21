# Dispatch Configuration Inventory

This document provides a comprehensive inventory of all configuration, settings, and environment variables used throughout the Dispatch system.

## Configuration Sources Overview

The Dispatch system uses configuration from multiple sources:
1. **Environment Variables** - Runtime configuration passed to processes
2. **Configuration Files** - JSON/JS files for persistent settings
3. **localStorage/sessionStorage** - Client-side browser settings
4. **Docker Configuration** - Container-specific settings
5. **CLI Configuration** - User's local CLI settings

## Environment Variables

### Core Application Variables

| Variable | Default | Location | Description | Runtime Configurable |
|----------|---------|----------|-------------|---------------------|
| **TERMINAL_KEY** | `testkey12345` (dev), `change-me` (prod) | **Container/Host** | Authentication key for terminal access | No - requires restart |
| **PORT** | `3030` | **Container/Host** | Server listening port | No - requires restart |
| **ENABLE_TUNNEL** | `false` | **Container/Host** | Enable LocalTunnel for public URL access | No - requires restart |
| **LT_SUBDOMAIN** | `''` | **Container/Host** | Custom LocalTunnel subdomain | No - requires restart |
| **DEBUG** | `false` | **Container/Host** | Enable debug logging | No - requires restart |
| **DISPATCH_LOG_LEVEL** | `info` | **Container/Host** | Logging level (error/warn/info/debug) | No - requires restart |
| **NODE_ENV** | `production` | **Container/Host** | Node environment (development/production) | No - requires restart |

### Directory Configuration

| Variable | Default | Location | Description | Runtime Configurable |
|----------|---------|----------|-------------|---------------------|
| **WORKSPACES_ROOT** | `~/.dispatch-home/workspaces` | **Container/Host** | Default workspace directory | No - requires restart |
| **DB_PATH** | `~/.dispatch/data/workspace.db` | **Container/Host** | SQLite database path | No - requires restart |
| **DISPATCH_CONFIG_DIR** | `~/.config/dispatch` | **Container/Host** | Configuration directory path | No - requires restart |
| **DISPATCH_PROJECTS_DIR** | `/projects` | **Container** | Projects directory (Docker volume) | No - requires restart |
| **DISPATCH_WORKSPACE_DIR** | `/workspace` | **Container** | Workspace directory for temp files | No - requires restart |
| **HOME** | User's home | **Container/Host** | Home directory override | No - requires restart |
| **CLAUDE_PROJECTS_DIR** | `''` | **Container/Host** | Claude Code projects directory | No - requires restart |

### Container-Specific Variables

| Variable | Default | Location | Description | Runtime Configurable |
|----------|---------|----------|-------------|---------------------|
| **CONTAINER_ENV** | `true` | **Container** | Flag indicating running in container | No |
| **HOST_UID** | `1000` | **Container** | Host user ID for file ownership mapping | No - requires restart |
| **HOST_GID** | `1000` | **Container** | Host group ID for file ownership mapping | No - requires restart |
| **DEFAULT_UID** | `1000` | **Container** | Default container user ID | No - build-time |
| **DEFAULT_GID** | `1000` | **Container** | Default container group ID | No - build-time |
| **HOST_HOME_DIR** | `/home/dispatch` | **Container** | Container home directory | No |
| **PTY_MODE** | `shell` | **Container** | Terminal mode (shell/claude) | No - requires restart |
| **PTY_ROOT** | `/tmp/dispatch-sessions` | **Container** | PTY session files directory | No - requires restart |

### Project Sandboxing Variables

| Variable | Default | Location | Description | Runtime Configurable |
|----------|---------|----------|-------------|---------------------|
| **PROJECT_SANDBOX_ENABLED** | `true` | **Container** | Enable project sandboxing | No - requires restart |

### Development-Only Variables

| Variable | Default | Location | Description | Runtime Configurable |
|----------|---------|----------|-------------|---------------------|
| **VITE_SSR** | `''` | **Host** | Vite SSR mode flag | No |
| **VITE_BUILD** | `''` | **Host** | Vite build mode flag | No |
| **BUILD** | `''` | **Host** | Build mode flag | No |
| **USE_SIMPLIFIED_SESSIONS** | `true` | **Host** | Use simplified session management (testing) | No |

### Shell Environment Variables

| Variable | Default | Location | Description | Runtime Configurable |
|----------|---------|----------|-------------|---------------------|
| **SHELL** | `/bin/bash` | **Container/Host** | Default shell for terminals | No |
| **TERM** | `xterm-256color` | **Container/Host** | Terminal type | No |
| **PATH** | System default | **Container/Host** | Executable search path | No |
| **USER** | `dispatch` | **Container/Host** | Current username | No |
| **LANG** | System default | **Container/Host** | Language/locale setting | No |

## Configuration Files

### Host Configuration Files

| File | Location | Description | Format | Runtime Editable |
|------|----------|-------------|--------|------------------|
| **~/.dispatch/config.json** | **Host** | CLI tool configuration | JSON | Yes - via CLI |
| **docker-compose.yml** | **Host** | Docker service configuration | YAML | Yes - requires restart |
| **.env** | **Host** | Local environment overrides | ENV | Yes - requires restart |
| **package.json** | **Host** | NPM scripts and dependencies | JSON | No |

### Container Configuration Files

| File | Location | Description | Format | Runtime Editable |
|------|----------|-------------|--------|------------------|
| **/config/** | **Container** | Mounted configuration directory | Various | Yes |
| **/entrypoint.sh** | **Container** | Container startup script | Bash | No |

## Client-Side Configuration (Browser)

### localStorage Keys

| Key | Default | Location | Description | User Editable |
|-----|---------|----------|-------------|---------------|
| **dispatch-auth-key** | `''` | **Client** | Terminal authentication key | Yes - via UI |
| **dispatch-session-id** | `''` | **Client** | Current session identifier | No - system managed |
| **dispatch-theme** | `'system'` | **Client** | UI theme (light/dark/system) | Yes - via settings |
| **dispatch-settings** | `'{}'` | **Client** | User preferences JSON | Yes - via settings |
| **terminal-wrap-mode** | `'off'` | **Client** | Terminal line wrapping | Yes - via UI |
| **pwa-ios-prompt-shown** | `'false'` | **Client** | PWA install prompt flag | No - system managed |
| **clientId** | UUID | **Client** | Unique client identifier | No - system managed |
| **file-editor-state** | `'{}'` | **Client** | File editor state/preferences | Yes - via UI |

### sessionStorage Keys

| Key | Default | Location | Description | User Editable |
|-----|---------|----------|-------------|---------------|
| **dispatch-temp** | `''` | **Client** | Temporary session data | No - system managed |
| **dispatch-nav** | `''` | **Client** | Navigation state | No - system managed |

## Constants and Hardcoded Configuration

### UI Configuration (src/lib/shared/constants.js)

| Constant | Value | Location | Description | Runtime Configurable |
|----------|-------|----------|-------------|---------------------|
| **DESKTOP_BREAKPOINT** | `1024` | **Client** | Desktop responsive breakpoint (px) | No |
| **TABLET_BREAKPOINT** | `768` | **Client** | Tablet responsive breakpoint (px) | No |
| **MOBILE_BREAKPOINT** | `480` | **Client** | Mobile responsive breakpoint (px) | No |
| **MOBILE_KEYBOARD_HEIGHT** | `300` | **Client** | Mobile keyboard height (px) | No |
| **TOUCH_TARGET_MIN** | `44` | **Client** | Minimum touch target size (px) | No |
| **ANIMATION_DURATION** | `200` | **Client** | Default animation duration (ms) | No |
| **DEBOUNCE_DELAY** | `300` | **Client** | Input debounce delay (ms) | No |
| **TOAST_DURATION** | `5000` | **Client** | Toast notification duration (ms) | No |
| **SIDEBAR_WIDTH** | `280` | **Client** | Sidebar width (px) | No |
| **HEADER_HEIGHT** | `60` | **Client** | Header height (px) | No |
| **FOOTER_HEIGHT** | `40` | **Client** | Footer height (px) | No |

### Storage Limits

| Constant | Value | Location | Description | Runtime Configurable |
|----------|-------|----------|-------------|---------------------|
| **MAX_STORAGE_SIZE** | `10MB` | **Client** | Maximum localStorage size | No |
| **WARN_STORAGE_SIZE** | `8MB` | **Client** | Warning threshold for storage | No |
| **MAX_FILE_SIZE** | `50MB` | **Client** | Maximum uploadable file size | No |

### Validation Rules

| Constant | Value | Location | Description | Runtime Configurable |
|----------|-------|----------|-------------|---------------------|
| **MIN_PASSWORD_LENGTH** | `8` | **Client** | Minimum password length | No |
| **MAX_PASSWORD_LENGTH** | `128` | **Client** | Maximum password length | No |
| **MAX_USERNAME_LENGTH** | `50` | **Client** | Maximum username length | No |
| **ALLOWED_MODES** | `['claude', 'shell']` | **Client** | Valid terminal modes | No |

### Project Configuration

| Constant | Value | Location | Description | Runtime Configurable |
|----------|-------|----------|-------------|---------------------|
| **CONFIG_DIRS_TO_COPY** | `['.claude', '.config/gh', '.config/git']` | **Container** | Directories to copy for sandboxing | No |
| **CONFIG_FILES_TO_COPY** | `['.gitconfig', '.bashrc', '.profile', '.bash_profile', '.vimrc', '.zshrc']` | **Container** | Files to copy for sandboxing | No |
| **CONFIG_FILE_MODE** | `0o644` | **Container** | Permissions for copied config files | No |
| **CONFIG_DIR_MODE** | `0o755` | **Container** | Permissions for copied directories | No |

## Docker Volume Mounts

| Mount Point | Host Path | Container Path | Description | Configurable |
|-------------|-----------|----------------|-------------|--------------|
| **Config** | `./dispatch-config` | `/config` | Configuration files | Yes - docker-compose.yml |
| **Projects** | `./dispatch-projects` | `/projects` | Project files | Yes - docker-compose.yml |
| **Workspace** | `./dispatch-workspace` | `/workspace` | Temporary workspace | Yes - docker-compose.yml |
| **SSH** | `~/.ssh` | `/home/dispatch/.ssh` | SSH keys (optional) | Yes - CLI flags |
| **Claude** | `~/.claude` | `/home/dispatch/.claude` | Claude config (optional) | Yes - CLI flags |

## CLI Configuration (~/.dispatch/config.json)

| Setting | Default | Location | Description | Runtime Configurable |
|---------|---------|----------|-------------|---------------------|
| **image** | `fwdslsh/dispatch:latest` | **Host** | Docker image to use | Yes - via CLI |
| **port** | `3030` | **Host** | Host port mapping | Yes - via CLI |
| **terminalKey** | Generated | **Host** | Terminal authentication key | Yes - via CLI |
| **enableTunnel** | `false` | **Host** | Enable LocalTunnel | Yes - via CLI |
| **ltSubdomain** | `null` | **Host** | LocalTunnel subdomain | Yes - via CLI |
| **ptyMode** | `shell` | **Host** | Default terminal mode | Yes - via CLI |
| **volumes.projects** | `~/dispatch/projects` | **Host** | Projects directory mount | Yes - via CLI |
| **volumes.home** | `~/dispatch/home` | **Host** | Home directory mount | Yes - via CLI |
| **volumes.ssh** | `null` | **Host** | SSH directory mount (optional) | Yes - via CLI |
| **volumes.claude** | `null` | **Host** | Claude directory mount (optional) | Yes - via CLI |
| **build** | `false` | **Host** | Build image locally | Yes - via CLI |
| **openBrowser** | `false` | **Host** | Auto-open browser on start | Yes - via CLI |
| **notifications.enabled** | `false` | **Host** | Enable webhook notifications | Yes - via CLI |
| **notifications.webhook.url** | `null` | **Host** | Webhook URL | Yes - via CLI |

## NPM Script Environment Overrides

| Script | Environment Variables | Purpose |
|--------|----------------------|---------|
| **dev** | `TERMINAL_KEY='testkey12345'`, `HOME=$(pwd)/.testing-home`, `WORKSPACES_ROOT=$(pwd)/.testing-home/workspaces` | Development with test environment |
| **dev:local** | `TERMINAL_KEY='testkey12345'`, `WORKSPACES_ROOT=$HOME/code` | Development with local code directory |
| **dev:no-key** | `TERMINAL_KEY=''` | Development without authentication |
| **dev:tunnel** | `TERMINAL_KEY='testkey12345'`, `ENABLE_TUNNEL=true` | Development with LocalTunnel |
| **start** | `PORT=5170`, `TERMINAL_KEY='testkey12345'`, `ENABLE_TUNNEL=true` | Production with tunnel |
| **test:original** | `USE_SIMPLIFIED_SESSIONS=false` | Testing with original session management |

## Configuration Inheritance Chain

1. **Build-time defaults** (Dockerfile ENV)
2. **docker-compose.yml environment**
3. **Host .env file**
4. **CLI flags** (--key, --port, etc.)
5. **Runtime environment** (process.env)
6. **Application defaults** (code constants)
7. **User preferences** (localStorage)

## Recommendations for Configuration Management

### 1. Centralize Configuration Sources
**Problem**: Configuration is scattered across multiple files, environment variables, and hardcoded constants.

**Recommendation**:
- Create a central configuration service that consolidates all settings
- Implement a configuration schema with validation
- Use a single source of truth for defaults with environment-based overrides

### 2. Implement Runtime Configuration API
**Problem**: Most configuration requires container/application restart to take effect.

**Recommendation**:
- Create a `/api/config` endpoint for runtime-configurable settings
- Separate static (requires restart) from dynamic (runtime) configuration
- Implement configuration hot-reload for applicable settings
- Store runtime configuration in the database

### 3. Configuration Validation and Type Safety
**Problem**: No validation or type checking for configuration values.

**Recommendation**:
- Implement JSON Schema validation for all configuration
- Add TypeScript interfaces for configuration objects
- Validate environment variables on startup
- Provide clear error messages for invalid configuration

### 4. User-Specific Configuration Management
**Problem**: User preferences are only stored in localStorage (browser-specific).

**Recommendation**:
- Implement server-side user preference storage
- Create user preference sync across devices/sessions
- Add import/export functionality for user settings
- Implement configuration profiles/presets

### 5. Secure Sensitive Configuration
**Problem**: Sensitive values (keys, tokens) are passed as environment variables or stored in plain text.

**Recommendation**:
- Implement secrets management (e.g., HashiCorp Vault integration)
- Use encrypted storage for sensitive configuration
- Separate secrets from general configuration
- Implement key rotation capability
- Never log sensitive configuration values

### 6. Environment-Specific Configuration
**Problem**: No clear separation between development, staging, and production configurations.

**Recommendation**:
- Create environment-specific configuration files
- Implement configuration overlays/inheritance
- Use NODE_ENV consistently throughout the application
- Document which settings are environment-specific

### 7. Configuration Documentation and Discovery
**Problem**: Configuration options are not well documented or discoverable.

**Recommendation**:
- Generate configuration documentation from schema
- Create a configuration UI/dashboard
- Add configuration validation on startup with helpful error messages
- Implement `dispatch config list` CLI command to show all available options

### 8. Configuration Migration and Versioning
**Problem**: No mechanism for configuration schema changes or migrations.

**Recommendation**:
- Version the configuration schema
- Implement configuration migration scripts
- Provide backward compatibility for deprecated settings
- Log configuration deprecation warnings

### 9. Container vs Host Configuration Separation
**Problem**: Unclear distinction between container and host configuration.

**Recommendation**:
- Clearly namespace container-specific variables (DISPATCH_CONTAINER_*)
- Separate host CLI configuration from container configuration
- Document which settings apply where
- Implement configuration validation based on execution context

### 10. Monitoring and Auditing
**Problem**: No visibility into configuration changes or usage.

**Recommendation**:
- Log configuration changes with timestamps and sources
- Implement configuration change webhooks/notifications
- Add metrics for configuration-related errors
- Create audit trail for sensitive configuration changes

## Priority Implementation Plan

### Phase 1: Foundation (High Priority)
1. Create centralized configuration service
2. Implement configuration validation
3. Add TypeScript interfaces for all configuration
4. Separate sensitive configuration

### Phase 2: User Experience (Medium Priority)
1. Implement runtime configuration API
2. Add server-side user preference storage
3. Create configuration UI/dashboard
4. Add configuration import/export

### Phase 3: Operations (Medium Priority)
1. Implement environment-specific configuration
2. Add configuration versioning and migration
3. Implement monitoring and auditing
4. Create comprehensive documentation

### Phase 4: Advanced Features (Low Priority)
1. Add secrets management integration
2. Implement configuration profiles/presets
3. Add configuration hot-reload capability
4. Create configuration discovery tools

## Configuration Flow Diagrams

### Current State
```
Environment Variables → Application Code → Runtime State
Docker Compose → Container Environment → Application
CLI Flags → Docker Run Command → Container
localStorage → Client State → UI Components
```

### Recommended State
```
Configuration Schema
    ↓
Configuration Service (validates & merges)
    ↓
[Env Vars | Config Files | Database | API] → Unified Configuration
    ↓
Application Components (subscribe to changes)
    ↓
Runtime State (with hot-reload support)
```

## Summary

The Dispatch system currently uses a complex mix of configuration sources with limited runtime flexibility. The main issues are:

1. **Scattered configuration** across multiple sources
2. **Lack of validation** and type safety
3. **Limited runtime configurability** (most changes require restart)
4. **No central management** or discovery mechanism
5. **Unclear separation** between different configuration contexts

Implementing the recommended improvements would significantly enhance the system's configurability, maintainability, and user experience while reducing configuration-related errors and support burden.