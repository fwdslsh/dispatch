/**
 * Simple Project ViewModel using Svelte 5 runes
 */
export class ProjectViewModel {
  constructor() {
    this.state = $state({
      project: null,
      sessions: [],
      activeSessions: [],
      activeSessionId: null,
      loading: false,
      error: null
    });
  }

  async loadProject(projectId, socket) {
    this.state.loading = true;
    this.state.error = null;
    
    try {
      console.log('Loading project:', projectId);
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, 10000);
        
        socket.emit("get-project", { projectId }, (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });
      
      console.log('Get project response:', response);
      if (response.success) {
        this.state.project = response.project;
        console.log('Project loaded successfully:', response.project);
        this.loadSessions(socket);
      } else {
        throw new Error(response.error || "Failed to load project");
      }
    } catch (error) {
      console.error('Error loading project:', error);
      this.state.error = error.message;
    } finally {
      this.state.loading = false;
    }
  }

  loadSessions(socket) {
    socket.emit("list", (response) => {
      if (response.success) {
        this.state.sessions = response.sessions || [];
        this.state.activeSessions = this.state.sessions.filter(s => s.status === 'active');
      }
    });
  }

  setActiveSession(sessionId) {
    this.state.activeSessionId = sessionId;
  }

  updateSessionsList(sessions) {
    this.state.sessions = sessions;
    this.state.activeSessions = sessions.filter(s => s.status === 'active');
  }
}