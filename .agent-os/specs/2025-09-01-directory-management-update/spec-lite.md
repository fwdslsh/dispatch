# Spec Summary (Lite)

Update Dispatch to implement hierarchical directory management with project-based organization, separating configuration (~/.config/dispatch) from project data (~/dispatch-projects). Each project contains isolated sessions with millisecond-timestamp directories, persistent workspace storage, and metadata tracking. Implement comprehensive path validation to prevent directory traversal attacks and update all application components including Docker configuration to follow these standards.
