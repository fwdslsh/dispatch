# Feature Specification: Secure, resumable multi-session AI development environment

**Feature Branch**: `001-dispatch-is-an`  
**Created**: 2025-09-27  
**Status**: Draft  
**Input**: User description: "Dispatch is an open-source, containerized development environment designed to securely run Claude AI and other AI code assistance CLI agents in isolation. By leveraging a sandboxed Docker container, Dispatch ensures that all agent activity is separated from your host system, providing robust security to prevent damage to the host system. Its event-sourced architecture preserves every session's state, enabling seamless resumption of work across devices and even after interruptions or crashes. Users can start a session on one device and continue on another, with full command history. Dispatch is designed to be used by a single user and can be hosted locally or in a remote container instance.

Key features of Dispatch include support for multiple session types—such as Terminal, Claude AI, and File Editor—each running in a given workspace. The user can have multiple workspaces, running various session types in each workspace simultaneously. The platform integrates real-time updates and persistent event storage, and offers VS Code Remote Tunnel integration for direct IDE access. Dispatch is local-first, with no vendor lock-in or usage limits, and is highly configurable through environment variables. It is ideal for AI-assisted development workflows, automation, and any scenario where secure, resumable execution is required."

## Implementation Status

**Current State**: Dispatch is a mature, production-ready application with most core features already implemented:

### ✅ **Fully Implemented Features**
- **Event-Sourced Session Management**: Complete RunSessionManager with sequence numbers and state recovery
- **Multi-Session Support**: Three session types (Terminal, Claude AI, File Editor) with adapter pattern
- **Real-Time Communication**: Socket.IO with multi-client synchronization and event replay
- **Session Persistence**: Database-backed session history with cross-device resumption
- **Frontend Architecture**: Svelte 5 with ViewModels, state management, and reactive UI
- **Authentication**: Key-based authentication system
- **VS Code Integration**: Remote Tunnel support with device authentication
- **API Layer**: Session management endpoints (`/api/sessions/`)
- **Database Schema**: Complete schema with sessions, events, workspaces tables
- **Container Security**: Docker isolation with non-root execution

### 🔄 **Gaps Identified for Enhancement**
- **Workspace Management API**: Missing dedicated workspace CRUD endpoints (`/api/workspaces/`)
- **Service Organization**: Some logic could be extracted into dedicated services
- **Multi-Auth Methods**: Only key-based auth implemented (sufficient for single-user)
- **Retention Policies**: No automated cleanup (low priority for single-user)

This specification focuses on the workspace management API gap and optional organizational improvements.

## Execution Flow (main)

```text
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation

When creating this spec from a user prompt:

1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## Clarifications

### Session 2025-09-27

- Q: What’s the intended authentication model for resuming sessions from another device? → A: Shared key + OAuth; device pairing; WebAuthn; default: prompt user to choose.
- Q: What is the target session history retention policy? → A: User-configurable (time/size quotas).
- Q: Which session types must be included in the initial release? → A: Terminal + Claude AI + File Editor.
- Q: What’s the target reconnection experience during brief network drops? → A: Hybrid: auto‑reconnect with buffered output; if uncertainty/sensitive state, reattach read‑only until user confirms.
- Q: What’s the minimum acceptable performance target for session UI responsiveness under normal load? → A: Best effort (no strict target).

---

## User Scenarios & Testing (mandatory)

### Primary User Story

As a single user, I want a secure, local-first development environment where I can create multiple workspaces and run different types of interactive sessions (Terminal, AI assistant, File Editor) in each workspace, so I can work efficiently and safely, and seamlessly resume my work on another device with full history if I disconnect.

### Acceptance Scenarios

1. Given I have created a workspace, When I start Terminal, AI assistant, and File Editor sessions within that workspace, Then I can interact with each session concurrently and see real-time updates with all activity persisted to history.
2. Given I started an AI or Terminal session on Device A and then disconnect, When I open the application on Device B and attach to the same session, Then the complete command/chat history and current state are restored and I can continue seamlessly from the latest state.

### Edge Cases

- Network interruption or temporary loss of connectivity while a command is running: session state and history remain intact and replay on reconnection.
- Brief network drops: client auto‑reconnects transparently with buffered output; if potential divergence or sensitive operation is detected, session reattaches read‑only until the user confirms resume.
- App or environment restart: sessions are resumable from persisted events without data loss.
- Invalid or inaccessible workspace path: the system prevents destructive actions and shows a clear, actionable error.
- Storage pressure or quota issues: the user is informed and guided to free space or adjust retention before data loss occurs.
- Multiple tabs/devices attaching to the same session: the experience remains consistent and avoids conflicting actions in a single-user model.
- Quota enforcement: when time/size quotas are reached, the system warns the user and provides options to expand quotas, archive, or purge older events with explicit confirmation.

## Requirements (mandatory)

### Functional Requirements

- **FR-001**: The system MUST support a single-user model with the ability to create and manage multiple workspaces.
- **FR-002**: The system MUST allow creating and running multiple session types within a workspace, including Terminal, AI assistant, and File Editor sessions (initial release scope).
- **FR-003**: The system MUST provide strong isolation of session activity from the host system to prevent accidental damage to the host.
- **FR-004**: The system MUST persist all session activity as an ordered event history to enable lossless session resumption.
- **FR-005**: The user MUST be able to disconnect and later resume any session from another device with full history and current state restored.
- **FR-006**: The UI MUST reflect session activity in real time while also ensuring that the persisted history remains the source of truth.
- **FR-007**: The system MUST support multiple sessions running simultaneously across multiple workspaces.
- **FR-008**: The system MUST be configurable via environment variables for key behaviors (e.g., workspace locations, auth keys, integrations).
- **FR-009**: The product MUST be local-first with no usage limits or mandatory vendor dependencies; users retain control of their data.
- **FR-010**: The system MUST offer optional VS Code Remote Tunnel integration to open workspaces in VS Code Web or Desktop via secure tunnels with device authentication.
- **FR-011**: The system MUST clearly surface security boundaries and prevent operations that could compromise or damage the host environment.
- **FR-012**: The system MUST provide clear, actionable error messages for invalid workspace paths, permission issues, or unavailable integrations.
- **FR-013**: Session history MUST remain durable across restarts and temporary disconnections without requiring manual recovery.
- **FR-016**: The system MUST provide user-configurable retention quotas for session events (time-based and/or size-based), with safe defaults and clear warnings before enforcement.
- **FR-017**: The system MUST support key-based authentication for session access. Future versions may add OAuth, device pairing, and WebAuthn for multi-user deployments.
- **FR-018**: During brief network drops, the client MUST auto‑reconnect and present buffered output. If uncertainty or a sensitive operation is detected, the session MUST reattach in read‑only mode until the user confirms resume.
- **FR-019**: Under normal load, the product targets best‑effort session UI responsiveness with no strict P95 target, while avoiding regressions; future releases may introduce measurable SLOs.

*Implementation Status Update:*

- **FR-010**: ✅ **IMPLEMENTED** - VS Code Remote Tunnel integration is fully functional with device authentication flow and automatic tunnel naming `dispatch-{hostname}`. Access via VS Code Web at `https://vscode.dev/tunnel/{tunnel-name}/{folder}` or VS Code Desktop with Remote - Tunnels extension.

### Key Entities (include if feature involves data)

- **User**: The single individual who operates the environment; owns workspaces and sessions.
- **Workspace**: A user-defined working area that groups files and sessions; identified by a name and location.
- **Session**: A running interactive unit within a workspace (Terminal, AI assistant, File Editor); has an ID, type, status, and event history.
- **Session Event**: An append-only record of activity for a session, ordered to enable deterministic replay and resumption.
- **Session Type**: The category of a session (Terminal, AI assistant, File Editor), determining available interactions and UI.
- **Configuration**: Environment-driven settings that influence behavior (paths, keys, optional integrations) without exposing implementation details.

---

## Review & Acceptance Checklist

GATE: Automated checks run during main() execution

### Content Quality

- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status

Updated by main() during processing

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed
