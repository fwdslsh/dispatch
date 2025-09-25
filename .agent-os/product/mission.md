# Product Mission

## Pitch

Dispatch is a containerized web-based terminal and AI development environment that provides secure sandboxed execution for Claude AI and CLI agents, enabling AI-assisted development in isolated Docker containers with resumable sessions, real-time collaboration, and cross-device continuity.

## Users

### Primary Customers

- **Individual Developers**: Solo developers seeking AI-powered development environments with secure isolation and persistent sessions
- **Development Teams**: Small to medium teams requiring collaborative AI-assisted development with shared workspace access
- **Enterprise Developers**: Large organizations needing secure, auditable AI development environments with compliance controls

### User Personas

**AI-Powered Developer** (25-45 years old)
- **Role:** Software Engineer, Full-Stack Developer, DevOps Engineer
- **Context:** Working with AI coding assistants, needs reliable environment for AI-assisted development
- **Pain Points:** Inconsistent AI development environments, lost session state, security concerns with AI code execution
- **Goals:** Seamless AI development workflow, persistent sessions across devices, secure code execution

**Remote Team Lead** (30-50 years old)
- **Role:** Engineering Manager, Tech Lead, Senior Developer
- **Context:** Managing distributed teams, coordinating development workflows
- **Pain Points:** Difficulty sharing development environments, inconsistent tooling across team members, security compliance
- **Goals:** Standardized team environments, real-time collaboration capabilities, audit trails for development activities

## The Problem

### Fragmented AI Development Experience

Current AI coding assistants lack persistent, secure execution environments, forcing developers to switch between multiple tools and losing context between sessions. This fragmentation reduces productivity by 30-40% and creates security vulnerabilities when executing AI-generated code.

**Our Solution:** Unified containerized environment combining terminal access, AI assistance, and persistent sessions in a single secure platform.

### Session Continuity Challenges

Developers lose valuable work when switching devices or experiencing connection interruptions, as most development environments don't maintain session state across disconnections or device changes.

**Our Solution:** Event-sourced session architecture with cross-device synchronization and automatic session recovery.

### Security and Isolation Concerns

Organizations struggle to provide secure environments for AI-assisted development, especially when AI agents need to execute code or access sensitive systems.

**Our Solution:** Docker-based isolation with granular permission controls and comprehensive audit logging.

### Collaboration Friction

Development teams lack effective ways to share AI-assisted development sessions, making pair programming and knowledge transfer inefficient.

**Our Solution:** Real-time session sharing with multi-client synchronization and collaborative terminal access.

## Differentiators

### Unified Session Architecture

Unlike traditional terminal multiplexers or separate AI tools, Dispatch provides a unified session management system that handles Terminal/PTY, Claude AI, and File Editor sessions through a single event-sourced architecture. This results in consistent behavior, simplified state management, and seamless session transitions.

### AI-First Design with Security

Unlike general-purpose container platforms or traditional IDEs, Dispatch is specifically architected for AI-assisted development with built-in Claude AI integration, secure code execution sandboxing, and audit trails optimized for AI workflows. This provides 10x faster AI development setup compared to manual environment configuration.

### Cross-Device Session Continuity

Unlike browser-based terminals or local development environments, Dispatch maintains complete session state across devices and network interruptions through event sourcing and monotonic sequence numbers. This eliminates context switching overhead and enables true mobile-to-desktop development workflows.

## Key Features

### Core Features

- **Multi-Session Architecture:** Unified management of Terminal/PTY, Claude AI, and File Editor sessions through event-sourced persistence
- **Docker Containerization:** Secure, isolated development environments with customizable toolchains and dependencies
- **Real-time Synchronization:** WebSocket-based communication with Socket.IO for instant updates across all connected clients
- **Session Persistence:** Event-sourced architecture enabling complete session replay and recovery after disconnections
- **Authentication System:** TERMINAL_KEY-based access control with configurable security policies

### AI Integration Features

- **Native Claude AI Support:** Built-in @anthropic-ai/claude-code integration with seamless terminal interaction
- **AI Session Management:** Dedicated session type for AI interactions with context preservation and conversation history
- **Secure Code Execution:** AI-generated code runs in isolated Docker containers with configurable permissions
- **AI Workflow Optimization:** Purpose-built interface for AI-assisted development patterns and workflows

### Collaboration Features

- **Multi-Client Sessions:** Multiple users can attach to the same session with synchronized views and shared control
- **Cross-Device Continuity:** Resume sessions seamlessly across laptops, tablets, and mobile devices
- **Real-time Sharing:** Instant session state updates with conflict resolution and collaborative editing support
- **Public URL Generation:** LocalTunnel integration for secure sharing of development environments with external collaborators