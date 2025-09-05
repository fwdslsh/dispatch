/**
 * Project View Model - Uses Svelte 5 runes for reactivity
 */
import { io } from "socket.io-client";

export class ProjectViewModel {
    // Reactive state using $state rune
    socket = $state(null);
    project = $state(null);
    sessions = $state([]);
    activeSessionId = $state(null);
    loading = $state(true);
    error = $state(null);
    
    constructor(projectId) {
        this.projectId = projectId;
    }

    // Initialize and connect
    async initialize() {
        this.socket = io();
        
        return new Promise((resolve) => {
            this.socket.on("connect", () => {
                const authToken = localStorage.getItem("dispatch-auth-token") || "testkey12345";
                this.socket.emit("auth", authToken, (response) => {
                    if (response?.success || response?.ok) {
                        this.loadProject().then(resolve);
                    } else {
                        this.error = "Authentication failed";
                        this.loading = false;
                        resolve(false);
                    }
                });
            });

            // Set up event listeners
            this.socket.on("sessions-updated", (data) => {
                console.log("sessions-updated event received:", data);
                this.loadSessions();
            });

            this.socket.on("output", (data) => {
                // Terminal component will handle this
            });

            this.socket.on("ended", () => {
                this.loadSessions();
                this.activeSessionId = null;
            });
        });
    }

    // Clean up
    destroy() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Load project data
    async loadProject() {
        this.loading = true;
        this.error = null;

        return new Promise((resolve) => {
            this.socket.emit("list-projects", (response) => {
                if (response?.success && response.projects) {
                    this.project = response.projects.find(p => p.id === this.projectId);
                    if (!this.project) {
                        this.error = "Project not found";
                        this.loading = false;
                        resolve(false);
                    } else {
                        this.loadSessions().then(() => resolve(true));
                    }
                } else {
                    this.error = "Failed to load project";
                    this.loading = false;
                    resolve(false);
                }
            });
        });
    }

    // Load sessions
    async loadSessions() {
        return new Promise((resolve) => {
            this.socket.emit("list", (response) => {
                console.log("loadSessions response:", response);
                if (response?.success && response.sessions) {
                    const projectSessions = response.sessions.filter(s => s.projectId === this.projectId);
                    console.log(`Found ${projectSessions.length} sessions for project ${this.projectId}:`, projectSessions);
                    this.sessions = projectSessions;
                } else {
                    console.warn("Failed to load sessions:", response);
                    this.sessions = [];
                }
                this.loading = false;
                resolve();
            });
        });
    }

    // Create session
    async createSession(name, mode = "shell") {
        if (!name?.trim()) {
            throw new Error("Session name is required");
        }

        return new Promise((resolve, reject) => {
            const options = {
                mode,
                name: name.trim(),
                cols: 120,
                rows: 30,
                project: this.projectId
            };

            this.socket.emit("create", options, async (response) => {
                if (response?.success) {
                    console.log("Session created successfully:", response.sessionId);
                    // Wait for session to be loaded before resolving
                    await this.loadSessions();
                    if (response.sessionId) {
                        await this.attachToSession(response.sessionId);
                    }
                    resolve(response.sessionId);
                } else {
                    console.error("Failed to create session:", response?.error);
                    reject(new Error(response?.error || "Failed to create session"));
                }
            });
        });
    }

    // Attach to session
    async attachToSession(sessionId) {
        return new Promise((resolve) => {
            this.socket.emit("attach", {
                sessionId,
                cols: 120,
                rows: 30
            }, (response) => {
                if (response?.success) {
                    this.activeSessionId = sessionId;
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // End session
    async endSession(sessionId) {
        return new Promise((resolve) => {
            this.socket.emit("end", sessionId, (response) => {
                if (response?.success) {
                    if (this.activeSessionId === sessionId) {
                        this.activeSessionId = null;
                    }
                    this.loadSessions();
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Send input to active session
    sendInput(data) {
        if (this.socket && this.activeSessionId) {
            this.socket.emit("input", data);
        }
    }

    // Resize terminal
    resize(cols, rows) {
        if (this.socket && this.activeSessionId) {
            this.socket.emit("resize", { cols, rows });
        }
    }
}