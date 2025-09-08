import { Server } from 'socket.io';

export class SocketIOServer {
  constructor() {
    this.io = null;
    this.authenticatedSockets = new Set();
    this.terminalKey = process.env.TERMINAL_KEY || 'change-me';
  }


  /**
   * @param {number | import("http").Server | undefined} httpServer
   */
  attachTo(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Socket.IO client connected:', socket.id);

      // Handle authentication
      socket.on('auth', (key, callback) => {
        if (key === this.terminalKey) {
          this.authenticatedSockets.add(socket.id);
          console.log(`Socket ${socket.id} authenticated successfully`);
          if (callback) callback({ success: true });
        } else {
          console.log(`Socket ${socket.id} authentication failed`);
          if (callback) callback({ success: false, error: 'Invalid terminal key' });
        }
      });

      socket.on('subscribe', (topic) => {
        if (this.isAuthenticated(socket.id)) {
          socket.join(topic);
          console.log(`Socket ${socket.id} joined room: ${topic}`);
        } else {
          console.log(`Socket ${socket.id} not authenticated for subscribe`);
        }
      });

      socket.on('unsubscribe', (topic) => {
        if (this.isAuthenticated(socket.id)) {
          socket.leave(topic);
          console.log(`Socket ${socket.id} left room: ${topic}`);
        } else {
          console.log(`Socket ${socket.id} not authenticated for unsubscribe`);
        }
      });

      socket.on('terminal.write', (data) => {
        if (this.isAuthenticated(socket.id)) {
          socket.emit('terminal-message', data);
        } else {
          console.log(`Socket ${socket.id} not authenticated for terminal.write`);
        }
      });

      socket.on('disconnect', () => {
        this.authenticatedSockets.delete(socket.id);
        console.log('Socket.IO client disconnected:', socket.id);
      });
    });

    console.log('Socket.IO server attached to HTTP server');
    return this.io;
  }

  /**
   * Check if a socket is authenticated
   * @param {string} socketId 
   * @returns {boolean}
   */
  isAuthenticated(socketId) {
    return this.authenticatedSockets.has(socketId);
  }

  /**
   * Get authentication middleware for socket events
   * @returns {Function}
   */
  requireAuth() {
    return (socket, next) => {
      if (this.isAuthenticated(socket.id)) {
        next();
      } else {
        next(new Error('Authentication required'));
      }
    };
  }

  /**
   * @param {string | string[]} room
   * @param {any} event
   * @param {any} data
   */
  emit(room, event, data) {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }
}