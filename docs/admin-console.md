# Admin Console

The Dispatch Admin Console provides real-time monitoring and management capabilities for debugging and administrative tasks.

## Access

Navigate to `/console?key=your-terminal-key` to access the admin console. The same `TERMINAL_KEY` used for the main application is required for authentication.

## Features

### Active Sockets Viewer
- Lists all currently connected sockets
- Shows socket ID, IP address, connection time, uptime, and authentication status
- Real-time updates as sockets connect and disconnect

### Socket Management
- Disconnect individual sockets with confirmation dialog
- Immediate removal from active sockets list
- Events are logged for audit trail

### Socket Events Monitor
- Real-time tracking of all socket events (connect, disconnect, etc.)
- Shows event type, timestamp, socket ID, and event data
- Keeps the most recent 500 events to prevent memory issues
- Events include connection details like IP address and User Agent

### Server Logs Viewer
- Displays server logs with different levels (INFO, DEBUG, ERROR, WARN)
- Timestamps for all log entries
- Configurable log retention (default: 1000 most recent entries)
- Real-time log streaming to admin console

## API Endpoints

### Socket Management
- `GET /api/admin/sockets?key=<TERMINAL_KEY>` - List active sockets
- `POST /api/admin/sockets/{socketId}/disconnect` - Disconnect specific socket

### Monitoring
- `GET /api/admin/events?key=<TERMINAL_KEY>` - Get socket events history
- `GET /api/admin/logs?key=<TERMINAL_KEY>` - Get server logs

### Query Parameters
- `limit` - Limit number of results (default: 100)
- `level` - Filter logs by level (info, debug, error, warn)
- `socketId` - Filter events by specific socket ID

## Security

- Admin console requires the same `TERMINAL_KEY` authentication as the main application
- All API endpoints validate the authentication key
- Sensitive data in socket events (like auth keys) is redacted in logs
- Admin actions (like socket disconnections) are logged for audit

## Extensibility

The admin console is designed for easy extension with additional utilities:

1. **Add new tabs**: Modify the navigation in `/src/routes/console/+page.svelte`
2. **Add new API endpoints**: Create new files in `/src/routes/api/admin/`
3. **Add real-time features**: Use the existing Socket.IO infrastructure
4. **Add monitoring metrics**: Extend the server logging system

## Development

### Adding Server Logs
```javascript
// From any server-side module
if (typeof globalThis._addServerLog === 'function') {
    globalThis._addServerLog('info', 'Your log message');
}
```

### Adding Socket Event Tracking
Socket events are automatically tracked in the Socket.IO setup. Custom events can be logged using the `logSocketEvent` function in `/src/lib/server/socket-setup.js`.

## Future Enhancements

The admin console framework supports easy addition of:
- Performance metrics and charts
- Rate limiting toggles and configuration
- User session management
- System resource monitoring
- Application health checks
- Configuration management interface