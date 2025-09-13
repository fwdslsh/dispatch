# Product Roadmap

> Last Updated: 2025-08-31
> Version: 1.0.0
> Status: Planning

## Phase 0: Already Completed (Completed)

**Goal:** Establish core terminal functionality and containerization
**Success Criteria:** Working web-based terminal with session management and Docker deployment

### Features Implemented

**Core Terminal Infrastructure:**

- Web-based terminal interface with xterm.js integration
- SvelteKit frontend with responsive design
- Socket.IO real-time bidirectional communication
- PTY session management with node-pty

**Security & Isolation:**

- Shared secret authentication via TERMINAL_KEY
- Docker multi-stage build with non-root execution (appuser, uid 10001)
- PTY session isolation (each session gets own directory)
- Container security with minimal attack surface

**Session Management:**

- Multiple concurrent session support
- Session persistence with JSON storage
- Attach/detach from sessions without termination
- Session metadata tracking and cleanup

**AI Integration:**

- Claude Code mode support
- Shell mode support
- Easy mode switching between AI agent and shell
- Environment setup for AI-assisted development

**Sharing & Access:**

- Optional LocalTunnel public URL sharing for remote access
- Volume mounting for persistent storage
- Mobile-responsive UI with augmented-ui styling
- Mobile keyboard detection and viewport management

**Technical Foundation:**

- Express v5.1.0 server with Socket.IO v4.8.1
- Modern tech stack (Node.js 22+, SvelteKit v2.36.2)
- Production-ready containerization
- Vite build system with hot reload development

## Phase 1: Component Architecture & UX Stabilization (In Progress - Beta Prep)

**Goal:** Stabilize component architecture and improve UX for beta release
**Success Criteria:** Simplified, maintainable component system with consistent UX patterns

### Features In Progress

**Component Architecture Refactoring:**

- [x] Simplified session creation modal (CreateSessionModalSimplified.svelte)
- [x] Streamlined project session menu (ProjectSessionMenuSimplified.svelte)
- [x] New reusable components (FormSection, IconButton, SessionCard, TypeCard, WorkspaceSelector)
- [x] Removed legacy components (Card, Container, HeaderToolbar, ValidationMessage)
- [x] Updated component index and styling (retro.css improvements)

**UX Improvements:**

- [x] Enhanced session management interface with search and filtering
- [x] Improved terminal sizing and font customization
- [x] Keyboard shortcuts and hotkeys for common actions
- [x] Better visual feedback for connection states and errors
- [x] Optimized mobile keyboard handling and input methods
- [x] Improved touch interactions for terminal operations
- [x] Mobile-specific UI adaptations and gestures
- [x] Better viewport management for small screens

**Stabilization Tasks:**

- [ ] Complete component refactoring on refactor/components branch
- [ ] Comprehensive testing of simplified components
- [ ] E2E test updates for new component architecture
- [ ] Settings management improvements (user preferences, session config)
- [ ] Session naming and workspace organization features

## Phase 2: Authentication & Security (3-4 weeks)

**Goal:** Implement OAuth authentication and enhance security features
**Success Criteria:** GitHub OAuth working with improved access control

### Must-Have Features

**OAuth Integration:**

- GitHub OAuth authentication provider
- User profile management and session association
- OAuth token handling and refresh logic

**Enhanced Security:**

- User-based session isolation and access control
- Audit logging for security events
- Rate limiting and abuse prevention
- Session timeout and automatic cleanup

**Additional Auth Providers:**

- Google OAuth integration
- Microsoft OAuth integration
- GitLab OAuth integration
- Enterprise SSO preparation

## Phase 3: Persistent Storage & File Management (3-4 weeks)

**Goal:** Implement better file persistence and local directory mounting
**Success Criteria:** Users can maintain persistent workspaces across sessions

### Must-Have Features

**Persistent Workspaces:**

- User-specific persistent directories
- Workspace templates and initialization
- File upload/download capabilities
- Workspace sharing between users

**Local Directory Mounting:**

- Improved mountable local directories
- Make it easier for users to launch the docker container with correct folders mounted
- Selectable home folder for session to allow multiple configurations to be saved and reused across sessions

**Storage Management:**

- Workspace size limits and monitoring
- Cleanup policies for inactive workspaces
- Storage usage analytics and reporting

## Phase 4: Collaboration & Team Features (4-5 weeks)

**Goal:** Enable team collaboration with shared sessions and workspaces
**Success Criteria:** Teams can collaboratively work in shared environments

### Must-Have Features

**Team Management:**

- Organization and team creation
- Role-based access control (admin, member, viewer)
- Team workspace sharing
- User invitation and management

**Collaborative Sessions:**

- Multi-user session sharing with permissions
- Real-time collaborative editing indicators
- Session recording and playback
- Chat integration during shared sessions

**Advanced Sharing:**

- Integration with external platforms like codespaces
- API access for workspace management

## Phase 5: Enterprise & Scalability (6-8 weeks)

**Goal:** Prepare for enterprise deployment with scalability improvements
**Success Criteria:** Support for large-scale deployments with enterprise features

### Must-Have Features

**Scalability Improvements:**

- Horizontal scaling with load balancing
- Session affinity and state management
- Database migration from JSON to proper DB (SQLite)
- Performance monitoring and optimization

**Enterprise Features:**

- SSO integration (SAML, LDAP)
- Advanced audit logging and compliance
- Resource quotas and usage controls
- Enterprise-grade security features

**DevOps Integration:**

- CI/CD pipeline integration
- Azure Container App example
- Monitoring and alerting setup
- Backup and disaster recovery
