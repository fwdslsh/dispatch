# Dispatch Configuration Inventory

This document provides a comprehensive inventory of all configuration, settings, and environment variables used throughout the Dispatch system.

**Scope:** Complete codebase analysis covering all configuration references

## Configuration Sources Overview

The Dispatch system uses configuration from multiple sources with a clear hierarchy:

1. **Environment Variables** - Runtime configuration passed to processes
2. **Configuration Files** - JSON/JS files for persistent settings
3. **Database Settings** - Server-side stored preferences (SQLite)
4. **localStorage/sessionStorage** - Client-side browser settings
5. **Docker Configuration** - Container-specific settings
6. **CLI Configuration** - User's local CLI settings (~/.dispatch/config.json)
7. **Constants** - Hardcoded application defaults (src/lib/shared/constants.js)

## Configuration Categories

All settings have been categorized into the following types:

- **Container Environment Config** - Docker/deployment environment variables
- **Global Workspace Settings** - System-wide application settings
- **Session-Specific Settings** - Individual session/terminal configuration
- **User Settings** - Personal preferences and overrides
- **Client-Specific Settings** - Browser/UI configuration and state

## Environment Variables

### Container Environment Config

These variables control core container and deployment behavior:

| Variable          | Default                                                       | Location           | Category              | Description                               | Runtime Configurable  |
| ----------------- | ------------------------------------------------------------- | ------------------ | --------------------- | ----------------------------------------- | --------------------- |
| **TERMINAL_KEY**  | `testkey12345` (dev), `change-me-to-a-strong-password` (prod) | **Container/Host** | Container Environment | Authentication key for terminal access    | No - requires restart |
| **ENCRYPTION_KEY** | `none` (dev - WARNING: insecure), **REQUIRED** (prod) | **Container/Host** | Container Environment | AES-256-GCM master key for encrypting OAuth secrets | No - requires restart |
| **PUBLIC_BASE_URL** | Auto-detected (dev), **REQUIRED** (prod) | **Container/Host** | Container Environment | Public base URL for OAuth redirects (e.g., `https://dispatch.example.com`) | No - requires restart |
| **PORT**          | `3030`                                                        | **Container/Host** | Container Environment | Server listening port                     | No - requires restart |
| **ENABLE_TUNNEL** | `false`                                                       | **Container/Host** | Container Environment | Enable LocalTunnel for public URL access  | No - requires restart |
| **LT_SUBDOMAIN**  | `''`                                                          | **Container/Host** | Container Environment | Custom LocalTunnel subdomain              | No - requires restart |
| **NODE_ENV**      | `production`                                                  | **Container/Host** | Container Environment | Node environment (development/production) | No - requires restart |
| **HOST_UID**      | `1000`                                                        | **Container**      | Container Environment | Host user ID for file ownership mapping   | No - requires restart |
| **HOST_GID**      | `1000`                                                        | **Container**      | Container Environment | Host group ID for file ownership mapping  | No - requires restart |
| **DEFAULT_UID**   | `1000`                                                        | **Container**      | Container Environment | Default container user ID                 | No - build-time       |
| **DEFAULT_GID**   | `1000`                                                        | **Container**      | Container Environment | Default container group ID                | No - build-time       |

### Global Workspace Settings

These variables control workspace and directory configuration:

| Variable                   | Default                         | Location           | Category         | Description                        | Runtime Configurable  |
| -------------------------- | ------------------------------- | ------------------ | ---------------- | ---------------------------------- | --------------------- |
| **WORKSPACES_ROOT**        | `~/workspaces`                  | **Container/Host** | Global Workspace | Default workspace directory        | No - requires restart |
| **DB_PATH**                | `~/.dispatch/data/workspace.db` | **Container/Host** | Global Workspace | SQLite database path               | No - requires restart |
| **DISPATCH_CONFIG_DIR**    | `~/.config/dispatch`            | **Container/Host** | Global Workspace | Configuration directory path       | No - requires restart |
| **DISPATCH_WORKSPACE_DIR** | `/workspace`                    | **Container**      | Global Workspace | Workspace directory for temp files | No - requires restart |
| **HOME**                   | User's home                     | **Container/Host** | Global Workspace | Home directory override            | No - requires restart |
| **CLAUDE_PROJECTS_DIR**    | `''`                            | **Container/Host** | Global Workspace | Claude Code projects directory     | No - requires restart |

### Session-Specific Settings

These variables affect individual sessions and terminals:

| Variable                    | Default          | Location           | Category         | Description                                 | Runtime Configurable |
| --------------------------- | ---------------- | ------------------ | ---------------- | ------------------------------------------- | -------------------- |
| **SHELL**                   | `/bin/bash`      | **Container/Host** | Session-Specific | Default shell for terminals                 | No                   |
| **TERM**                    | `xterm-256color` | **Container/Host** | Session-Specific | Terminal type                               | No                   |
| **PATH**                    | System default   | **Container/Host** | Session-Specific | Executable search path                      | No                   |
| **USER**                    | `dispatch`       | **Container/Host** | Session-Specific | Current username                            | No                   |
| **LANG**                    | System default   | **Container/Host** | Session-Specific | Language/locale setting                     | No                   |
| **USE_SIMPLIFIED_SESSIONS** | `true`           | **Host**           | Session-Specific | Use simplified session management (testing) | No                   |

### Development-Only Variables

These are used only during development and testing:

| Variable                   | Default | Location | Category    | Description                        | Runtime Configurable  |
| -------------------------- | ------- | -------- | ----------- | ---------------------------------- | --------------------- |
| **DEBUG**                  | `false` | **Host** | Development | Enable debug logging               | No - requires restart |
| **VITE_SSR**               | `''`    | **Host** | Development | Vite SSR mode flag                 | No                    |
| **VITE_BUILD**             | `''`    | **Host** | Development | Vite build mode flag               | No                    |
| **BUILD**                  | `''`    | **Host** | Development | Build mode flag                    | No                    |
| **CI**                     | `false` | **Host** | Development | Continuous integration flag        | No                    |
| **E2E_TEST_MODE**          | `false` | **Host** | Development | End-to-end testing mode flag       | No                    |
| **DISABLE_SERVICE_WORKER** | `false` | **Host** | Development | Disable service worker for testing | No                    |

### System Logging Variables

| Variable               | Default | Location           | Category | Description                           | Runtime Configurable  |
| ---------------------- | ------- | ------------------ | -------- | ------------------------------------- | --------------------- |
| **DISPATCH_LOG_LEVEL** | `info`  | **Container/Host** | System   | Logging level (error/warn/info/debug) | No - requires restart |

## Database Settings (Server-Side Stored)

The Dispatch system stores server-side settings in SQLite database with the following categories:

### Global Settings Category (`global`)

| Setting   | Default | Location     | Category      | Description        | Usage Location                 | Runtime Configurable   |
| --------- | ------- | ------------ | ------------- | ------------------ | ------------------------------ | ---------------------- |
| **theme** | `retro` | **Database** | User Settings | UI theme selection | Data-theme attribute in layout | Yes - via settings API |

### Claude Settings Category (`claude`)

| Setting                    | Default                      | Location     | Category         | Description                         | Usage Location                 | Runtime Configurable   |
| -------------------------- | ---------------------------- | ------------ | ---------------- | ----------------------------------- | ------------------------------ | ---------------------- |
| **model**                  | `claude-3-5-sonnet-20241022` | **Database** | Session-Specific | Default Claude model                | ClaudeAdapter session creation | Yes - via settings API |
| **permissionMode**         | `default`                    | **Database** | Session-Specific | Claude permission mode              | ClaudeAdapter session creation | Yes - via settings API |
| **executable**             | `auto`                       | **Database** | Session-Specific | Claude executable path preference   | ClaudeAdapter session creation | Yes - via settings API |
| **maxTurns**               | `null`                       | **Database** | Session-Specific | Maximum conversation turns          | ClaudeAdapter session creation | Yes - via settings API |
| **includePartialMessages** | `false`                      | **Database** | Session-Specific | Include partial messages in context | ClaudeAdapter session creation | Yes - via settings API |
| **continueConversation**   | `false`                      | **Database** | Session-Specific | Continue previous conversation      | ClaudeAdapter session creation | Yes - via settings API |

## Configuration Files

### Host Configuration Files

| File                        | Location | Category              | Description                  | Format | Content Type   | Runtime Editable       |
| --------------------------- | -------- | --------------------- | ---------------------------- | ------ | -------------- | ---------------------- |
| **~/.dispatch/config.json** | **Host** | User Settings         | CLI tool configuration       | JSON   | CLI Config     | Yes - via CLI          |
| **~/.dispatch/.env**        | **Host** | Container Environment | Environment configuration    | ENV    | Env Vars       | Yes - requires restart |
| **docker-compose.yml**      | **Host** | Container Environment | Docker service configuration | YAML   | Docker Config  | Yes - requires restart |
| **.env**                    | **Host** | Container Environment | Local environment overrides  | ENV    | Env Vars       | Yes - requires restart |
| **package.json**            | **Host** | Development           | NPM scripts and dependencies | JSON   | Package Config | No                     |

### Container Configuration Files

| File               | Location      | Category              | Description                     | Format  | Content Type | Runtime Editable |
| ------------------ | ------------- | --------------------- | ------------------------------- | ------- | ------------ | ---------------- |
| **/config/**       | **Container** | Global Workspace      | Mounted configuration directory | Various | Mixed Config | Yes              |
| **/entrypoint.sh** | **Container** | Container Environment | Container startup script        | Bash    | Shell Script | No               |

### Build Configuration Files

| File                                      | Location | Category    | Description                | Format | Content Type  | Runtime Editable |
| ----------------------------------------- | -------- | ----------- | -------------------------- | ------ | ------------- | ---------------- |
| **eslint.config.js**                      | **Host** | Development | ESLint configuration       | JS     | Linter Config | No               |
| **playwright.config.js**                  | **Host** | Development | Playwright test config     | JS     | Test Config   | No               |
| **svelte.config.js**                      | **Host** | Development | Svelte build configuration | JS     | Build Config  | No               |
| **vite.config.js**                        | **Host** | Development | Vite build configuration   | JS     | Build Config  | No               |
| **tests/scripts/playwright-ui.config.js** | **Host** | Development | Playwright UI test config  | JS     | Test Config   | No               |

## Client-Side Configuration (Browser)

### localStorage Keys

| Key                            | Default   | Location   | Category        | Description                   | Usage Location                    | User Editable       |
| ------------------------------ | --------- | ---------- | --------------- | ----------------------------- | --------------------------------- | ------------------- |
| **dispatch-auth-key**          | `''`      | **Client** | User Settings   | Terminal authentication key   | Socket auth, API requests         | Yes - via UI        |
| **dispatch-auth-token**        | `''`      | **Client** | User Settings   | Alternative auth token key    | Socket auth (legacy)              | Yes - via UI        |
| **dispatch-session-id**        | `''`      | **Client** | Client-Specific | Current session identifier    | Session management                | No - system managed |
| **dispatch-theme**             | `''`      | **Client** | User Settings   | UI theme (light/dark/system)  | Theme switching in GlobalSettings | Yes - via settings  |
| **dispatch-settings**          | `'{}'`    | **Client** | User Settings   | User preferences JSON         | SettingsService client overrides  | Yes - via settings  |
| **dispatch-sidebar-collapsed** | `false`   | **Client** | User Settings   | Sidebar collapse state        | Sidebar state persistence         | Yes - via UI        |
| **terminal-wrap-mode**         | `'off'`   | **Client** | User Settings   | Terminal line wrapping        | Terminal display settings         | Yes - via UI        |
| **pwa-ios-prompt-shown**       | `'false'` | **Client** | Client-Specific | PWA install prompt flag       | PWA install prompt logic          | No - system managed |
| **clientId**                   | UUID      | **Client** | Client-Specific | Unique client identifier      | Session tracking, UUID generation | No - system managed |
| **file-editor-state**          | `'{}'`    | **Client** | User Settings   | File editor state/preferences | File editor persistence           | Yes - via UI        |
| **terminalKey**                | `''`      | **Client** | User Settings   | Terminal key (legacy)         | Legacy auth support               | Yes - via UI        |

### sessionStorage Keys

| Key               | Default | Location   | Category        | Description            | Usage Location         | User Editable       |
| ----------------- | ------- | ---------- | --------------- | ---------------------- | ---------------------- | ------------------- |
| **dispatch-temp** | `''`    | **Client** | Client-Specific | Temporary session data | Temporary data storage | No - system managed |
| **dispatch-nav**  | `''`    | **Client** | Client-Specific | Navigation state       | Navigation state mgmt  | No - system managed |

## Constants and Hardcoded Configuration

### UI Configuration (src/lib/shared/constants.js - UI_CONFIG)

| Constant                   | Value  | Location   | Category        | Description                        | Usage Location                    | Runtime Configurable |
| -------------------------- | ------ | ---------- | --------------- | ---------------------------------- | --------------------------------- | -------------------- |
| **DESKTOP_BREAKPOINT**     | `1024` | **Client** | Client-Specific | Desktop responsive breakpoint (px) | CSS media queries, UI logic       | No                   |
| **TABLET_BREAKPOINT**      | `768`  | **Client** | Client-Specific | Tablet responsive breakpoint (px)  | CSS media queries, UI logic       | No                   |
| **MOBILE_BREAKPOINT**      | `480`  | **Client** | Client-Specific | Mobile responsive breakpoint (px)  | CSS media queries, UI logic       | No                   |
| **MOBILE_KEYBOARD_HEIGHT** | `300`  | **Client** | Client-Specific | Mobile keyboard height (px)        | Mobile view calculations          | No                   |
| **TOUCH_TARGET_MIN**       | `44`   | **Client** | Client-Specific | Minimum touch target size (px)     | CSS touch-friendly sizing         | No                   |
| **ANIMATION_DURATION**     | `200`  | **Client** | Client-Specific | Default animation duration (ms)    | CSS animations, transitions       | No                   |
| **DEBOUNCE_DELAY**         | `300`  | **Client** | Client-Specific | Input debounce delay (ms)          | Input handling, search debouncing | No                   |
| **TOAST_DURATION**         | `5000` | **Client** | Client-Specific | Toast notification duration (ms)   | Notification display timing       | No                   |
| **SIDEBAR_WIDTH**          | `280`  | **Client** | Client-Specific | Sidebar width (px)                 | Layout calculations               | No                   |
| **HEADER_HEIGHT**          | `60`   | **Client** | Client-Specific | Header height (px)                 | Layout calculations               | No                   |
| **FOOTER_HEIGHT**          | `40`   | **Client** | Client-Specific | Footer height (px)                 | Layout calculations               | No                   |

### Storage Configuration (src/lib/shared/constants.js - STORAGE_CONFIG)

| Constant                 | Value                   | Location   | Category        | Description                      | Usage Location               | Runtime Configurable |
| ------------------------ | ----------------------- | ---------- | --------------- | -------------------------------- | ---------------------------- | -------------------- |
| **AUTH_TOKEN_KEY**       | `'dispatch-auth-key'`   | **Client** | Client-Specific | localStorage key for auth token  | Socket auth, auth management | No                   |
| **SESSION_ID_KEY**       | `'dispatch-session-id'` | **Client** | Client-Specific | localStorage key for session ID  | Session management           | No                   |
| **THEME_KEY**            | `'dispatch-theme'`      | **Client** | Client-Specific | localStorage key for theme       | Theme switching              | No                   |
| **SETTINGS_KEY**         | `'dispatch-settings'`   | **Client** | Client-Specific | localStorage key for settings    | Client settings storage      | No                   |
| **TEMP_DATA_KEY**        | `'dispatch-temp'`       | **Client** | Client-Specific | sessionStorage key for temp data | Temporary data storage       | No                   |
| **NAVIGATION_STATE_KEY** | `'dispatch-nav'`        | **Client** | Client-Specific | sessionStorage key for nav state | Navigation state persistence | No                   |
| **MAX_STORAGE_SIZE**     | `10485760` (10MB)       | **Client** | Client-Specific | Maximum localStorage size        | Storage management           | No                   |
| **WARN_STORAGE_SIZE**    | `8388608` (8MB)         | **Client** | Client-Specific | Warning threshold for storage    | Storage management alerts    | No                   |

### Validation Configuration (src/lib/shared/constants.js - VALIDATION_CONFIG)

| Constant                 | Value                                                      | Location   | Category        | Description                  | Usage Location         | Runtime Configurable |
| ------------------------ | ---------------------------------------------------------- | ---------- | --------------- | ---------------------------- | ---------------------- | -------------------- |
| **MIN_PASSWORD_LENGTH**  | `8`                                                        | **Client** | Client-Specific | Minimum password length      | Form validation        | No                   |
| **MAX_PASSWORD_LENGTH**  | `128`                                                      | **Client** | Client-Specific | Maximum password length      | Form validation        | No                   |
| **MAX_USERNAME_LENGTH**  | `50`                                                       | **Client** | Client-Specific | Maximum username length      | Form validation        | No                   |
| **SESSION_ID_PATTERN**   | `/^[a-zA-Z0-9-_]{8,64}$/`                                  | **Client** | Client-Specific | Valid session ID pattern     | Session validation     | No                   |
| **SESSION_NAME_PATTERN** | `/^[a-zA-Z0-9\s\-_.]{1,100}$/`                             | **Client** | Client-Specific | Valid session name pattern   | Session validation     | No                   |
| **ALLOWED_MODES**        | `['claude', 'shell']`                                      | **Client** | Client-Specific | Valid terminal modes         | Mode validation        | No                   |
| **MAX_FILE_SIZE**        | `52428800` (50MB)                                          | **Client** | Client-Specific | Maximum uploadable file size | File upload validation | No                   |
| **ALLOWED_FILE_TYPES**   | `['text/*', 'application/json', 'application/javascript']` | **Client** | Client-Specific | Allowed file MIME types      | File upload validation | No                   |

### Project Configuration (src/lib/shared/constants.js - PROJECT_CONFIG)

| Constant                    | Value                                                                        | Location      | Category         | Description                         | Usage Location           | Runtime Configurable |
| --------------------------- | ---------------------------------------------------------------------------- | ------------- | ---------------- | ----------------------------------- | ------------------------ | -------------------- |
| **DEFAULT_SANDBOX_ENABLED** | `true`                                                                       | **Container** | Session-Specific | Default project sandboxing state    | Project session creation | No                   |
| **CONFIG_DIRS_TO_COPY**     | `['.claude', '.config/gh', '.config/git']`                                   | **Container** | Session-Specific | Directories to copy for sandboxing  | Project setup scripts    | No                   |
| **CONFIG_FILES_TO_COPY**    | `['.gitconfig', '.bashrc', '.profile', '.bash_profile', '.vimrc', '.zshrc']` | **Container** | Session-Specific | Files to copy for sandboxing        | Project setup scripts    | No                   |
| **CONFIG_FILE_MODE**        | `0o644`                                                                      | **Container** | Session-Specific | Permissions for copied config files | File system operations   | No                   |
| **CONFIG_DIR_MODE**         | `0o755`                                                                      | **Container** | Session-Specific | Permissions for copied directories  | Directory creation       | No                   |

### Tunnel Configuration (src/lib/shared/constants.js - TUNNEL_CONFIG)

| Constant                  | Value   | Location   | Category              | Description                   | Usage Location    | Runtime Configurable |
| ------------------------- | ------- | ---------- | --------------------- | ----------------------------- | ----------------- | -------------------- |
| **TUNNEL_TIMEOUT**        | `10000` | **Client** | Container Environment | LocalTunnel timeout (ms)      | Tunnel management | No                   |
| **TUNNEL_RETRY_ATTEMPTS** | `3`     | **Client** | Container Environment | Maximum tunnel retry attempts | Tunnel management | No                   |

### API and File Size Limits

| Constant               | Value               | Location   | Category         | Description                    | Usage Location             | Runtime Configurable |
| ---------------------- | ------------------- | ---------- | ---------------- | ------------------------------ | -------------------------- | -------------------- |
| **MAX_FILE_SIZE**      | `52428800` (50MB)   | **Server** | Session-Specific | Per-file upload limit          | File upload API            | No                   |
| **MAX_TOTAL_SIZE**     | `209715200` (200MB) | **Server** | Session-Specific | Total upload batch limit       | File upload API            | No                   |
| **MAX_FILE_SIZE_READ** | `10485760` (10MB)   | **Server** | Session-Specific | File read size limit           | File reading API           | No                   |
| **MAX_BYTES**          | `1048576` (1MB)     | **Server** | Session-Specific | Default log/content byte limit | Claude session content API | No                   |

### Default Window Manager Keymap

| Constant           | Value                          | Location   | Category      | Description                | Usage Location           | Runtime Configurable |
| ------------------ | ------------------------------ | ---------- | ------------- | -------------------------- | ------------------------ | -------------------- |
| **DEFAULT_KEYMAP** | `{ /* keyboard shortcuts */ }` | **Client** | User Settings | Default keyboard shortcuts | Window manager component | No                   |

## Docker Volume Mounts

| Mount Point   | Host Path              | Container Path           | Category         | Description              | Configurable Via      |
| ------------- | ---------------------- | ------------------------ | ---------------- | ------------------------ | --------------------- |
| **Config**    | `./dispatch-config`    | `/config`                | Global Workspace | Configuration files      | docker-compose.yml    |
| **Projects**  | `./dispatch-projects`  | `/projects`              | Global Workspace | Project files            | docker-compose.yml    |
| **Workspace** | `./dispatch-workspace` | `/workspace`             | Global Workspace | Temporary workspace      | docker-compose.yml    |
| **SSH**       | `~/.ssh`               | `/home/dispatch/.ssh`    | Global Workspace | SSH keys (optional)      | CLI flags, docker run |
| **Claude**    | `~/.claude`            | `/home/dispatch/.claude` | Global Workspace | Claude config (optional) | CLI flags, docker run |

## NPM Script Environment Overrides

These environment variables are set by specific NPM scripts in package.json:

| Script            | Environment Variables                                                                                         | Category    | Purpose                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------- |
| **dev**           | `TERMINAL_KEY='testkey12345'`, `HOME=$(pwd)/.testing-home`, `WORKSPACES_ROOT=$(pwd)/.testing-home/workspaces` | Development | Development with test environment        |
| **dev:local**     | `TERMINAL_KEY='testkey12345'`, `WORKSPACES_ROOT=$HOME/code`                                                   | Development | Development with local code directory    |
| **dev:no-key**    | `TERMINAL_KEY=''`                                                                                             | Development | Development without authentication       |
| **dev:tunnel**    | `TERMINAL_KEY='testkey12345'`, `ENABLE_TUNNEL=true`                                                           | Development | Development with LocalTunnel             |
| **start**         | `PORT=5170`, `TERMINAL_KEY='testkey12345'`, `ENABLE_TUNNEL=true`                                              | Development | Production-like start with tunnel        |
| **test:original** | `USE_SIMPLIFIED_SESSIONS=false`                                                                               | Development | Testing with original session management |
| **test:e2e**      | `TERMINAL_KEY='testkey12345'`, `NODE_ENV=test`                                                                | Development | End-to-end testing environment           |
| **test:ui**       | `TERMINAL_KEY='testkey12345'`                                                                                 | Development | UI testing environment                   |

## Configuration API Endpoints

The system provides REST API endpoints for managing configuration:

| Endpoint        | Method | Category      | Description                   | Authentication Required | Usage Location                |
| --------------- | ------ | ------------- | ----------------------------- | ----------------------- | ----------------------------- |
| `/api/settings` | GET    | User Settings | Retrieve settings by category | Optional (metadata)     | SettingsService, admin UI     |
| `/api/settings` | POST   | User Settings | Update settings for category  | Yes                     | Settings UI, admin operations |
| `/api/settings` | DELETE | User Settings | Delete settings category      | Yes                     | Admin operations              |

## CLI Configuration (~/.dispatch/config.json)

The CLI tool loads configuration from `~/.dispatch/config.json` with the following structure:

| Setting                           | Default                                | Location | Category              | Description                       | Usage Location         | Runtime Configurable |
| --------------------------------- | -------------------------------------- | -------- | --------------------- | --------------------------------- | ---------------------- | -------------------- |
| **image**                         | `fwdslsh/dispatch:latest`              | **Host** | Container Environment | Docker image to use               | CLI Docker run command | Yes - via CLI        |
| **port**                          | `3030`                                 | **Host** | Container Environment | Host port mapping                 | CLI Docker run command | Yes - via CLI        |
| **terminalKey**                   | Generated                              | **Host** | Container Environment | Terminal authentication key       | CLI Docker run command | Yes - via CLI        |
| **enableTunnel**                  | `false`                                | **Host** | Container Environment | Enable LocalTunnel                | CLI Docker run command | Yes - via CLI        |
| **ltSubdomain**                   | `null`                                 | **Host** | Container Environment | LocalTunnel subdomain             | CLI Docker run command | Yes - via CLI        |
| **ptyMode**                       | `shell`                                | **Host** | User Settings         | Default terminal mode             | CLI Docker run command | Yes - via CLI        |
| **volumes.projects**              | `~/dispatch/projects`                  | **Host** | Global Workspace      | Projects directory mount          | CLI Docker run command | Yes - via CLI        |
| **volumes.home**                  | `~/dispatch/home`                      | **Host** | Global Workspace      | Home directory mount              | CLI Docker run command | Yes - via CLI        |
| **volumes.ssh**                   | `null`                                 | **Host** | Global Workspace      | SSH directory mount (optional)    | CLI Docker run command | Yes - via CLI        |
| **volumes.claude**                | `null`                                 | **Host** | Global Workspace      | Claude directory mount (optional) | CLI Docker run command | Yes - via CLI        |
| **volumes.config**                | `null`                                 | **Host** | Global Workspace      | Additional config directory mount | CLI Docker run command | Yes - via CLI        |
| **build**                         | `false`                                | **Host** | Development           | Build image locally               | CLI build logic        | Yes - via CLI        |
| **openBrowser**                   | `false`                                | **Host** | User Settings         | Auto-open browser on start        | CLI post-start actions | Yes - via CLI        |
| **notifications.enabled**         | `false`                                | **Host** | User Settings         | Enable webhook notifications      | CLI notification logic | Yes - via CLI        |
| **notifications.webhook.url**     | `null`                                 | **Host** | User Settings         | Webhook URL                       | CLI notification logic | Yes - via CLI        |
| **notifications.webhook.headers** | `{'Content-Type': 'application/json'}` | **Host** | User Settings         | Webhook headers                   | CLI notification logic | Yes - via CLI        |

## Environment Configuration Files

### ~/.dispatch/.env (CLI Environment File)

The CLI creates this file during `dispatch init` with the following variables:

| Variable                   | Default              | Category              | Description                   | Required |
| -------------------------- | -------------------- | --------------------- | ----------------------------- | -------- |
| **TERMINAL_KEY**           | Generated secure key | Container Environment | Authentication key for web UI | Yes      |
| **PORT**                   | `3030`               | Container Environment | Server port                   | No       |
| **ENABLE_TUNNEL**          | `false`              | Container Environment | Enable public URL tunnel      | No       |
| **LT_SUBDOMAIN**           | `''`                 | Container Environment | Custom tunnel subdomain       | No       |
| **DISPATCH_CONFIG_DIR**    | `/config`            | Global Workspace      | Configuration directory path  | No       |
| **DISPATCH_WORKSPACE_DIR** | `/workspace`         | Global Workspace      | Workspace directory path      | No       |

## Configuration Inheritance Chain

The configuration inheritance follows this priority order (highest to lowest):

1. **CLI flags** (--key, --port, etc.) - Highest priority
2. **Environment variables** (process.env)
3. **~/.dispatch/.env file** (CLI environment file)
4. **docker-compose.yml environment** (Docker deployment)
5. **~/.dispatch/config.json** (CLI configuration file)
6. **Database settings** (server-side stored preferences)
7. **localStorage overrides** (client-side preferences)
8. **Application defaults** (hardcoded constants)
9. **Build-time defaults** (Dockerfile ENV) - Lowest priority

## Deprecated/Inconsistent Configuration References

### Inconsistent Authentication Key Names

There are inconsistent localStorage key names for authentication across the codebase:

| Key Name                | File Count | Usage Context                     | Recommendation                       |
| ----------------------- | ---------- | --------------------------------- | ------------------------------------ |
| **dispatch-auth-key**   | Primary    | Main application, most components | **Keep as standard**                 |
| **dispatch-auth-token** | 8 files    | E2E tests only                    | **Standardize to dispatch-auth-key** |
| **terminalKey**         | 1 file     | One E2E test file                 | **Standardize to dispatch-auth-key** |

### Files with Inconsistent Auth Key References

**Cleanup Required:**

- [ ] `e2e/project-page-claude-sessions.spec.js` - Line 4: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/claude-session-resumption.spec.js` - Line 9: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/socket-reconnection.spec.js` - Line 10: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/comprehensive-ui.spec.js` - Line 17: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/terminal-session-resumption.spec.js` - Line 19: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/working-directory-validation.spec.js` - Line 20: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/terminal-session-simple.spec.js` - Line 26: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/workspace-terminal-interactions.spec.js` - Line 29: Change `dispatch-auth-token` to `dispatch-auth-key`
- [ ] `e2e/inspect-session-menu.spec.js` - Line 32: Change `terminalKey` to `dispatch-auth-key`

### Unused Configuration References

**No references found to deprecated configuration that needs removal** - the codebase appears to be clean of truly unused configuration.

### Documentation Inconsistencies

**Minor issues found:**

- [ ] Some documentation references need to be updated to reflect current localStorage key names
- [ ] E2E test setup could be standardized to use consistent auth key names

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

- Clearly namespace container-specific variables (DISPATCH*CONTAINER*\*)
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

The Dispatch system configuration analysis reveals:

### Current State Assessment

**Strengths:**

- Well-organized constants in `src/lib/shared/constants.js`
- Centralized database settings management with API
- Clear separation between container and host configuration
- Comprehensive CLI configuration system

**Areas for Improvement:**

- Inconsistent localStorage key naming in test files
- Limited runtime configurability (most changes require restart)
- No configuration validation or schema
- Scattered configuration sources without central management

### Configuration Distribution

| Category              | Count | Location                    | Runtime Configurable |
| --------------------- | ----- | --------------------------- | -------------------- |
| Environment Variables | 28    | Various files, Dockerfile   | Mostly No            |
| Database Settings     | 8     | SQLite database             | Yes                  |
| Client Storage Keys   | 11    | localStorage/sessionStorage | Yes                  |
| Constants             | 25+   | src/lib/shared/constants.js | No                   |
| CLI Settings          | 14    | ~/.dispatch/config.json     | Yes                  |

### Key Issues Identified

1. **Authentication Key Inconsistency**: 9 E2E test files use inconsistent localStorage key names
2. **Limited Runtime Flexibility**: Most environment variables require container restart
3. **No Configuration Validation**: Missing schema validation and type safety
4. **Documentation Gaps**: Some configuration options lack complete documentation

### Cleanup Checklist

- [ ] **High Priority**: Standardize auth key names in 9 E2E test files
- [ ] **Medium Priority**: Add configuration schema validation
- [ ] **Medium Priority**: Implement more runtime-configurable settings
- [ ] **Low Priority**: Create centralized configuration service
- [ ] **Low Priority**: Add configuration UI/dashboard

The system is generally well-configured with room for standardization and improved runtime flexibility.

Fixes #102.
