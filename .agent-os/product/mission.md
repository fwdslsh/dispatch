# Product Mission

> Last Updated: 2025-08-30
> Version: 1.0.0

## Pitch

Dispatch is a containerized web-based terminal application that provides sandboxed environments for autonomous AI agents, allowing users to interact with them through both terminal and web interfaces. It bridges the gap between AI-assisted development and secure, isolated execution environments by offering real-time terminal access through modern web browsers with full session management and sharing capabilities.

## Users

**Primary Users:**

- Developers working with autonomous AI agents who need secure, isolated environments
- Teams requiring remote terminal access with session sharing capabilities
- AI researchers and engineers building and testing AI-powered development workflows
- DevOps professionals managing containerized development environments

**Secondary Users:**

- Educational institutions teaching AI development and terminal skills
- Remote development teams needing shared sandboxed environments
- Organizations requiring secure, auditable development environments

## The Problem

Current AI agent development and remote terminal access solutions are fragmented and often insecure:

1. **Lack of Isolation**: Most AI agents run in the same environment as the host system, creating security risks
2. **Poor Web Integration**: Traditional terminal access requires SSH or complex setups that don't work well in web contexts
3. **Session Management**: Existing solutions don't provide proper session persistence, sharing, or management
4. **Authentication Gaps**: Many terminal sharing solutions lack proper authentication or are overly complex
5. **Mobile Limitations**: Terminal access on mobile devices is often poor or non-existent

## Differentiators

**Key Advantages:**

1. **Container-Native Design**: Built from the ground up for containerized environments with proper isolation
2. **Web-First Architecture**: Modern SvelteKit + Socket.IO stack provides real-time, responsive terminal experience
3. **AI Agent Integration**: Native support for Claude Code sessions with easy mode switching
4. **Session Persistence**: Full session management with JSON-based storage and sharing capabilities
5. **Security-Focused**: Non-root execution, shared secret authentication, and isolated session directories
6. **Mobile-Responsive**: Augmented-UI styling with proper mobile keyboard and viewport handling
7. **Public Sharing**: Optional LocalTunnel integration for instant public URL sharing

## Key Features

**Core Terminal Functionality:**

- Web-based terminal interface using xterm.js with full terminal emulation
- Real-time bidirectional communication via Socket.IO
- PTY session management with complete process isolation
- Multiple concurrent sessions with independent environments

**Security & Isolation:**

- Shared secret authentication (TERMINAL_KEY)
- Each session runs in isolated directory (/tmp/dispatch-sessions/{uuid})
- Docker multi-stage build with non-root user execution
- Container security with minimal attack surface

**Session Management:**

- Session persistence with JSON storage
- Session metadata tracking and management interface
- Attach/detach from sessions without termination
- Session cleanup and resource management

**AI Integration:**

- Native Claude Code mode support
- Easy switching between AI agent and shell modes
- Environment setup for AI-assisted development workflows
- Integration with autonomous AI agent workflows

**Sharing & Collaboration:**

- Optional LocalTunnel public URL sharing
- Session sharing via unique URLs
- Remote access capabilities for team collaboration
- Mobile-responsive design for access from any device

**Technical Excellence:**

- Modern tech stack (SvelteKit v2, Node.js 22+, Socket.IO v4)
- Responsive UI with augmented-ui futuristic styling
- Volume mounting for persistent storage options
- Production-ready containerization with proper health checks
