/**
 * Socket Service
 * 
 * Straightforward socket service without unnecessary complexity.
 * Follows clean service patterns with minimal dependencies.
 */

/**
 * Socket Service
 */
export class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  /**
   * Connect to socket server
   */
  async connect(url = '') {
    try {
      if (this.socket?.connected) {
        return { success: true };
      }

      const { io } = await import('socket.io-client');
      this.socket = io(url);

      await new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          this.isConnected = true;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          reject(error);
        });
      });

      return { success: true };
    } catch (error) {
      console.error('SocketService: Connect failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit event to server with callback
   */
  async emit(event, data = {}) {
    try {
      if (!this.socket?.connected) {
        return { success: false, error: 'Not connected' };
      }

      const response = await new Promise((resolve) => {
        this.socket.emit(event, data, resolve);
      });

      return response || { success: true };
    } catch (error) {
      console.error('SocketService: Emit failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Listen for events from server
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Simple cleanup
   */
  destroy() {
    this.disconnect();
  }
}