# TODOs

> **Note**: This file was triaged on 2025-09-12 as part of issue #44. All actionable items have been converted to GitHub issues or marked with their current status.

## Completed Items
- [DONE] The session prev/next buttons on mobile view should be located at the bottom of the view port to the left and the side bar toggle should be in the same row on the right side of the screen
- [DONE] The ProjectSessionMenu should include a way to select the session type and then load the given projects and session for the selected type.
  - [DONE] The new session buttons should be moved to the ProjectSessionMenu and displayed based on the type of session that is selected.
- [DONE] Add a list of active sockets/sessions in a new section of the project session menu
- [FIXED] Mobile height is slightly off and has overflow on small screens. we need to ensure the layout does not exceed the viewport when on mobile

## Triaged Items (Converted to GitHub Issues)

- [TRIAGED → ISSUE TBD] **BUG: Reconnect to an active socket with the appropriate session pane/component**
  - Status: Needs verification - possibly fixed in PR #38
  - Priority: High
  - Action: Create verification issue

- [TRIAGED → ISSUE TBD] **Create a ClaudeCommands component** that will handle parsing available slashCommands for a given session by parsing jsonl files or websocket messages.
  - It will then provide a button in a toolbar above the message and send controls
  - Click the button will allow you to easily pick a command and enter some additional text before sending the message. This can simply insert the command at the beginning of the message control
  - Priority: Medium
  - Action: Feature issue created

- [TRIAGED → ISSUE TBD] **Add quick launch button to the claude toolbar** that will open a PTY terminal session in Claude cwd
  - It should automatically become the active session on mobile view
  - Priority: Medium
  - Action: Feature issue created

- [TRIAGED → ISSUE TBD] **Integrate ~/.bash_sessions** to resume previous terminal sessions
  - Terminal sessions need to be updated to use something like screen, tmux, or tee to capture full session input and output
  - The user should be able to browser previous sessions and restore the history based on the content from the session logging tool
  - Priority: Low
  - Action: Feature issue created

- [TRIAGED → ISSUE TBD] **Add a "custom" layout option** (only available on desktop) that allows the user to make session viewports sizable and place them wherever they like in the session grid. The layout configuration should be saved to local storage
  - Priority: Low
  - Action: Feature issue created 