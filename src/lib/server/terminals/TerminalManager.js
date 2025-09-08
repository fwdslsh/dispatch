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
  
  start({ workspacePath, shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash', env = {} }) {
    if (!pty) {
      console.error('Cannot start terminal: node-pty is not available');
      throw new Error('Terminal functionality not available - node-pty failed to load');
    }
    
    const id = `pty_${this.nextId++}`;
    console.log(`Creating terminal ${id} with shell ${shell} in ${workspacePath}`);
    
    try {
      const term = pty.spawn(shell, [], { name: 'xterm-color', cwd: workspacePath, env: { ...process.env, ...env } });
      this.terminals.set(id, { term, workspacePath });
      
      term.onData(data => {
        this.io.io.to(`terminal:${id}`).emit('data', data);
      });
      
      term.onExit(({ exitCode }) => { 
        this.io.io.to(`terminal:${id}`).emit('exit', { exitCode });
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
    console.log(`Writing to terminal ${id}:`, JSON.stringify(data));
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
