# TODOs

- [DONE] The session prev/next buttons on mobile view should be located at the bottom of the view port to the left and the side bar toggle should be in the same row on the right side of the screen
- [DONE] The ProjectSessionMenu should include a way to select the session type and then load the given projects and session for the selected type.
  - [DONE] The new session buttons should be moved to the ProjectSessionMenu and displayed based on the type of session that is selected.

- [DONE] Add a list of active sockets/sessions in a new section of the project session menu
- BUG: Reconnect to an active socket with the appropriate session pane/component
- Create a ClaudeCommands component that will handle parsing available slashCommands for a given session by parsing jsonl files or websocket messages.
  - It will then provide a button in a toolbar above the message and send controls
  - Click the button will allow you to easily pick a command and enter some additional text before sending the message. This can simply insert the command at the begining of the message control
- Add quick launch button to the claude toolbar that will open a PTY terminal session in Claude cwd
  - It should automatically become the active session on mobile view
- Integrate ~/.bash_sessions to resume previous terminal sessions
  - Terminal sessions need to be updated to use something like screen, tmux, or tee to capture full session input and output
  - The user should be able to browser previous sessions and restore the history based on the content from the session logging tool
- FIXED: Mobile height is slightly off and has overflow on small screens. we need to ensure the layout does not exceed the viewport when on mobile
