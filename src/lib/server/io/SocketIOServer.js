import { Server } from 'socket.io';

export class SocketIOServer {
  constructor() {
    this.io = null;
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

      socket.on('subscribe', (topic) => {
        socket.join(topic);
        console.log(`Socket ${socket.id} joined room: ${topic}`);
      });

      socket.on('unsubscribe', (topic) => {
        socket.leave(topic);
        console.log(`Socket ${socket.id} left room: ${topic}`);
      });

      socket.on('terminal.write', (data) => {
        socket.emit('terminal-message', data);
      });

      socket.on('disconnect', () => {
        console.log('Socket.IO client disconnected:', socket.id);
      });
    });

    console.log('Socket.IO server attached to HTTP server');
    return this.io;
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