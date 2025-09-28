# Quickstart: Dispatch Enhanced Workspace Management

**Purpose**: Validate core functionality and new workspace management features
**Target Audience**: Developers testing the implementation
**Prerequisites**: Docker, Node.js 22+, modern web browser

**Note**: This quickstart validates both existing functionality (which is production-ready) and new workspace management API enhancements.

## Quick Setup

### 1. Environment Setup
```bash
# Clone and setup
git clone https://github.com/fwdslsh/dispatch
cd dispatch
npm install

# Set up test environment 
export TERMINAL_KEY="testkey12345"
export WORKSPACES_ROOT="$(pwd)/.testing-home/workspaces"
mkdir -p .testing-home/workspaces/test-project

# Start development server
npm run dev
```

### 2. Access Application
- Open browser to http://localhost:5173
- Enter terminal key: `testkey12345`
- You should see the main dashboard

## Core Workflow Validation

### Test 1: Workspace Management
**Goal**: Verify workspace creation and listing

1. **Create Workspace**:
   - Navigate to "Workspaces" section
   - Click "New Workspace"
   - Name: "My Test Project"
   - Path: Select `.testing-home/workspaces/test-project`
   - Click "Create"

2. **Expected Results**:
   - Workspace appears in dashboard
   - Status shows "Active" 
   - Path is correctly displayed
   - No error messages

### Test 2: Terminal Session
**Goal**: Verify basic terminal functionality and persistence

1. **Start Terminal Session**:
   - Open "My Test Project" workspace
   - Click "New Session" → "Terminal"
   - Name: "Main Terminal"
   - Click "Start"

2. **Test Terminal Features**:
   ```bash
   # Run these commands in sequence
   pwd
   ls -la
   echo "Hello Dispatch"
   mkdir test-dir
   cd test-dir
   echo "test content" > test-file.txt
   cat test-file.txt
   ```

3. **Test Session Persistence**:
   - Close browser tab
   - Reopen http://localhost:5173
   - Navigate back to workspace
   - Click on "Main Terminal" session
   - Verify all command history is visible
   - Run `pwd` - should still be in test-dir

4. **Expected Results**:
   - Commands execute correctly
   - Output displays in real-time
   - File operations succeed
   - Session state fully restored after reconnection

### Test 3: Claude AI Session  
**Goal**: Verify AI assistant integration

1. **Start Claude Session**:
   - In "My Test Project" workspace
   - Click "New Session" → "Claude AI"
   - Name: "AI Assistant"
   - Click "Start"

2. **Test AI Interaction**:
   ```
   User: Create a simple Python hello world script
   [Verify Claude responds with code]
   
   User: Explain how to run it
   [Verify Claude provides execution instructions]
   ```

3. **Test Session Resume**:
   - Disconnect and reconnect (close/reopen browser)
   - Navigate back to Claude session
   - Verify entire conversation history is preserved
   - Continue conversation to confirm state integrity

4. **Expected Results**:
   - Claude responds appropriately to requests
   - Conversation history maintained
   - Session resumes seamlessly

### Test 4: File Editor Session
**Goal**: Verify file editing capabilities

1. **Start File Editor Session**:
   - In "My Test Project" workspace  
   - Click "New Session" → "File Editor"
   - Name: "Code Editor"
   - Click "Start"

2. **Test File Operations**:
   - Create new file: `hello.py`
   - Add content:
     ```python
     def main():
         print("Hello from Dispatch!")
     
     if __name__ == "__main__":
         main()
     ```
   - Save file
   - Open existing file from terminal test: `test-dir/test-file.txt`
   - Edit and save

3. **Test Multi-Session Integration**:
   - Switch to terminal session
   - Run: `python hello.py`
   - Verify output: "Hello from Dispatch!"
   - Edit file in editor session
   - Re-run in terminal to confirm changes

4. **Expected Results**:
   - File creation and editing work correctly
   - Files persist across sessions
   - Changes immediately available in other sessions
   - No conflicts between session types

### Test 5: Multi-Device Simulation
**Goal**: Verify session resumability across "devices"

1. **Setup Multi-Tab Simulation**:
   - Keep current session open (Tab A)
   - Open new incognito/private browser window (Tab B)
   - Navigate to http://localhost:5173 in Tab B
   - Enter same terminal key

2. **Test Session Sharing**:
   - In Tab B, navigate to same workspace
   - Attach to existing "Main Terminal" session
   - In Tab A terminal: `echo "from device A"`
   - In Tab B: verify output appears immediately
   - In Tab B terminal: `echo "from device B"`
   - In Tab A: verify output appears immediately

3. **Test Concurrent Editing**:
   - In Tab B, attach to "Code Editor" session  
   - In Tab A: edit hello.py file
   - In Tab B: verify changes appear in real-time
   - Try editing in both tabs simultaneously

4. **Expected Results**:
   - Multiple clients can attach to same sessions
   - Real-time synchronization works correctly
   - No data corruption or conflicts
   - Graceful handling of concurrent access

### Test 6: Error Recovery
**Goal**: Verify robustness and error handling

1. **Test Network Interruption**:
   - Start long-running command in terminal: `ping localhost`
   - Simulate network disconnection (disable WiFi briefly)
   - Re-enable network connection
   - Verify session auto-reconnects
   - Verify ping command continued running

2. **Test Invalid Operations**:
   - Try to create workspace with invalid path
   - Try to create session in non-existent workspace
   - Try to attach to non-existent session
   - Verify appropriate error messages

3. **Test Session Cleanup**:
   - Start several sessions
   - Terminate some via UI
   - Close browser without clean disconnect
   - Reopen and verify session states are correct

4. **Expected Results**:
   - Clear, actionable error messages
   - No data loss during network issues
   - Proper cleanup of terminated sessions
   - Robust recovery from unexpected disconnections

## Performance Validation

### Response Time Checks
- Terminal input response: < 100ms typically
- Session creation: < 2 seconds
- Session attach: < 1 second  
- File save operations: < 500ms
- Session history replay: < 100ms per 100 events

### Resource Usage
- Browser memory growth should be minimal
- Docker container memory < 500MB per workspace
- Database file size grows predictably with activity

## Success Criteria

✅ All 6 test scenarios complete without errors
✅ Session data persists across browser restarts  
✅ Multi-device session sharing works correctly
✅ Performance targets met under normal load
✅ Error messages are clear and actionable
✅ No data loss or corruption observed

## Troubleshooting

### Common Issues
- **Port 5173 already in use**: Change port in vite.config.js or kill existing process
- **Docker not running**: Start Docker daemon before testing
- **Permission errors**: Ensure workspace path is readable/writable
- **WebSocket connection fails**: Check firewall settings and terminal key

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check server logs for errors
# Check browser console for client-side errors
```

### Reset Test Environment  
```bash
# Clean slate for retesting
rm -rf .testing-home/
npm run dev
```

This quickstart validates all core requirements from the feature specification and provides confidence that the implementation meets user needs.