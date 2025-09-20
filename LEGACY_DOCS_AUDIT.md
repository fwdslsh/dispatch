# Legacy Documentation Files (Outdated)

These documentation files contain references to the old session architecture and should be updated or archived:

## Files to Archive/Update

1. **docs/session-architecture.md** - Contains old socket.emit patterns like `session.start`, `session.input`, `session.output`
2. **docs/SESSION_THINKING_FIX.md** - References legacy `claude.message.delta`, `claude.message.complete` events
3. **docs/socket-reconnection-verification.md** - Contains old `session.catchup` event patterns
4. **.reference/EXISTING_API_CONTRACTS.md** - Documents legacy `terminal.start`, `terminal.write`, `claude.send` events

## Recommendation

These files should either be:
- Updated to reflect the unified session architecture with `run:*` events
- Moved to a `legacy/` or `archived/` directory 
- Deleted if no longer relevant

The current unified architecture uses only:
- `run:attach` - Attach to run session
- `run:input` - Send input to session  
- `run:resize` - Resize terminal
- `run:close` - Close session
- `run:event` - Receive session events