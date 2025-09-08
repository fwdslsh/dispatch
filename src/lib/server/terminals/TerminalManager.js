import os from 'node:os';

let pty;
try {
  pty = await import('node-pty');
  console.log('node-pty loaded successfully');
} catch (err) {
  console.error('Failed to load node-pty:', err);
  pty = null;
}

export class TerminalManager {
  constructor({ io }) {
    this.io = io;
    this.terminals = new Map(); // id -> { term, workspacePath }
    this.nextId = 1;
  }
  
  setSocketIO(io) {
    this.io = io;
    // Update socket reference for all existing terminals
    for (const [id, terminalData] of this.terminals) {
      terminalData.socket = io;
    }
  }
  
  start({ workspacePath, shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash', env = {} }) {
    if (!pty) {
      console.error('Cannot start terminal: node-pty is not available');
      throw new Error('Terminal functionality not available - node-pty failed to load');
    }
    
    const id = `pty_${this.nextId++}`;
    console.log(`Creating terminal ${id} with shell ${shell} in ${workspacePath}`);
    
    try {
      const term = pty.spawn(shell, [], { 
        name: 'xterm-color', 
        cwd: workspacePath, 
        env: { 
          ...process.env, 
          ...env,
          TERM: 'xterm-256color',
          PS1: '\\u@\\h:\\w$ '
        } 
      });
      this.terminals.set(id, { term, workspacePath, socket: this.io });
      
      term.onData(data => {
        const terminalData = this.terminals.get(id);
        if (terminalData && terminalData.socket) {
          terminalData.socket.emit('data', data);
        }
      });
      
      term.onExit(({ exitCode }) => { 
        const terminalData = this.terminals.get(id);
        if (terminalData && terminalData.socket) {
          terminalData.socket.emit('exit', { exitCode });
        }
        this.terminals.delete(id); 
      });
      
      console.log(`Terminal ${id} created successfully`);
      return { id };
    } catch (err) {
      console.error(`Failed to create terminal ${id}:`, err);
      throw err;
    }
  }
  
  write(id, data) { 
    const terminal = this.terminals.get(id);
    if (!terminal) {
      console.error(`Terminal ${id} not found. Available terminals:`, Array.from(this.terminals.keys()));
      return;
    }
    terminal.term.write(data); 
  }
  
  resize(id, cols, rows) { 
    console.log(`Resizing terminal ${id} to ${cols}x${rows}`);
    const terminal = this.terminals.get(id);
    if (terminal) terminal.term.resize(cols, rows);
  }
  
  stop(id) { this.terminals.get(id)?.term.kill(); }
}
