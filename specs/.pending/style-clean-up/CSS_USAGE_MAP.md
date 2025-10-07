# CSS Usage Map

Generated on 10/7/2025, 3:19:57 PM

> This document shows where CSS files are used throughout the codebase.
> Each CSS file lists the Svelte components that use classes defined in that file.

## Summary

- **Total CSS Files:** 16
- **Total CSS Classes:** 243
- **Used Classes:** 237 (97.5%)
- **Unused Classes:** 6 (2.5%)

---

## src/lib/client/shared/styles/retro.css

**Classes:** 45 total, 43 used, 2 unused

**Used by 95 file(s):**

- `src/lib/client/claude/ClaudeHeader.svelte`
- `src/lib/client/claude/ClaudePane.svelte`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/claude/ClaudeSettings.svelte`
- `src/lib/client/claude/activity-summaries/ActivitySummary.svelte`
- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/activity-summaries/ReadActivity.svelte`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
- `src/lib/client/claude/components/InputArea.svelte`
- `src/lib/client/claude/components/MessageList.svelte`
- `src/lib/client/file-editor/FileEditorPane.svelte`
- `src/lib/client/onboarding/AuthenticationStep.svelte`
- `src/lib/client/onboarding/OnboardingFlow.svelte`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/settings/GlobalSettings.svelte`
- `src/lib/client/settings/GlobalSettingsSection.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/settings/RetentionSettings.svelte`
- `src/lib/client/settings/ThemePreviewCard.svelte`
- `src/lib/client/settings/ThemeSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte`
- `src/lib/client/settings/sections/OAuthSettings.svelte`
- `src/lib/client/settings/sections/StorageSettings.svelte`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte`
- `src/lib/client/settings/sections/TunnelControl.svelte`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte`
- `src/lib/client/shared/components/AppVersion.svelte`
- `src/lib/client/shared/components/AugButton.svelte`
- `src/lib/client/shared/components/AuthStatus.svelte`
- `src/lib/client/shared/components/BrandLogo.svelte`
- `src/lib/client/shared/components/Button.svelte`
- `src/lib/client/shared/components/ConfirmationDialog.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/ErrorDisplay.svelte`
- `src/lib/client/shared/components/FileEditor.svelte`
- `src/lib/client/shared/components/FormSection.svelte`
- `src/lib/client/shared/components/GitOperations.svelte`
- `src/lib/client/shared/components/HelpModal.svelte`
- `src/lib/client/shared/components/IconButton.svelte`
- `src/lib/client/shared/components/Input.svelte`
- `src/lib/client/shared/components/LiveIconStrip.svelte`
- `src/lib/client/shared/components/LoadingSpinner.svelte`
- `src/lib/client/shared/components/Modal.svelte`
- `src/lib/client/shared/components/PWAInstallPrompt.svelte`
- `src/lib/client/shared/components/PWAUpdateNotification.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte`
- `src/lib/client/shared/components/SessionCard.svelte`
- `src/lib/client/shared/components/SettingField.svelte`
- `src/lib/client/shared/components/Shell.svelte`
- `src/lib/client/shared/components/StatusBar.svelte`
- `src/lib/client/shared/components/TunnelIndicator.svelte`
- `src/lib/client/shared/components/TypeCard.svelte`
- `src/lib/client/shared/components/WorkspaceSelector.svelte`
- `src/lib/client/shared/components/WorktreeManager.svelte`
- `src/lib/client/shared/components/window-manager/TileControls.svelte`
- `src/lib/client/shared/components/window-manager/WindowManager.svelte`
- `src/lib/client/shared/components/workspace/CreateSessionButton.svelte`
- `src/lib/client/shared/components/workspace/EmptySessionPane.svelte`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/MobileNavigation.svelte`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/lib/client/shared/components/workspace/SingleSessionView.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceHeader.svelte`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceStatusBar.svelte`
- `src/lib/client/terminal/MobileTerminalInput.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/lib/client/terminal/TerminalHeader.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/routes/+layout.svelte`
- `src/routes/+page.svelte`
- `src/routes/_testing/+page.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`
- `src/routes/_testing/_tiles/+page.svelte`
- `src/routes/auth/callback/+page.svelte`
- `src/routes/console/+page.svelte`
- `src/routes/onboarding/+page.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/utilities.css

**Classes:** 80 total, 80 used, 0 unused

**Used by 85 file(s):**

- `src/lib/client/claude/ClaudeHeader.svelte`
- `src/lib/client/claude/ClaudePane.svelte`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
- `src/lib/client/claude/components/InputArea.svelte`
- `src/lib/client/claude/components/MessageList.svelte`
- `src/lib/client/onboarding/AuthenticationStep.svelte`
- `src/lib/client/onboarding/OnboardingFlow.svelte`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/settings/GlobalSettings.svelte`
- `src/lib/client/settings/GlobalSettingsSection.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/settings/RetentionSettings.svelte`
- `src/lib/client/settings/ThemePreviewCard.svelte`
- `src/lib/client/settings/ThemeSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte`
- `src/lib/client/settings/sections/OAuthSettings.svelte`
- `src/lib/client/settings/sections/StorageSettings.svelte`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte`
- `src/lib/client/settings/sections/TunnelControl.svelte`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte`
- `src/lib/client/shared/components/AppVersion.svelte`
- `src/lib/client/shared/components/AugButton.svelte`
- `src/lib/client/shared/components/AuthStatus.svelte`
- `src/lib/client/shared/components/BrandLogo.svelte`
- `src/lib/client/shared/components/ConfirmationDialog.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/ErrorDisplay.svelte`
- `src/lib/client/shared/components/FileEditor.svelte`
- `src/lib/client/shared/components/GitOperations.svelte`
- `src/lib/client/shared/components/Header.svelte`
- `src/lib/client/shared/components/HelpModal.svelte`
- `src/lib/client/shared/components/Input.svelte`
- `src/lib/client/shared/components/LiveIconStrip.svelte`
- `src/lib/client/shared/components/LoadingSpinner.svelte`
- `src/lib/client/shared/components/Markdown.svelte`
- `src/lib/client/shared/components/Modal.svelte`
- `src/lib/client/shared/components/PWAInstallPrompt.svelte`
- `src/lib/client/shared/components/PWAUpdateNotification.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte`
- `src/lib/client/shared/components/SessionCard.svelte`
- `src/lib/client/shared/components/SettingField.svelte`
- `src/lib/client/shared/components/Shell.svelte`
- `src/lib/client/shared/components/TunnelIndicator.svelte`
- `src/lib/client/shared/components/WorktreeManager.svelte`
- `src/lib/client/shared/components/window-manager/Split.svelte`
- `src/lib/client/shared/components/window-manager/WindowManager.svelte`
- `src/lib/client/shared/components/workspace/CreateSessionButton.svelte`
- `src/lib/client/shared/components/workspace/EmptySessionPane.svelte`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/MobileNavigation.svelte`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/lib/client/shared/components/workspace/SingleSessionView.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceHeader.svelte`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
- `src/lib/client/terminal/MobileTerminalInput.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/lib/client/terminal/TerminalHeader.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/routes/+page.svelte`
- `src/routes/_testing/+page.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`
- `src/routes/_testing/_tiles/+page.svelte`
- `src/routes/auth/callback/+page.svelte`
- `src/routes/console/+page.svelte`
- `src/routes/onboarding/+page.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/buttons.css

**Classes:** 12 total, 12 used, 0 unused

**Used by 80 file(s):**

- `src/lib/client/claude/ClaudeHeader.svelte`
- `src/lib/client/claude/ClaudePane.svelte`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/components/InputArea.svelte`
- `src/lib/client/claude/components/MessageList.svelte`
- `src/lib/client/file-editor/FileEditorPane.svelte`
- `src/lib/client/onboarding/AuthenticationStep.svelte`
- `src/lib/client/onboarding/OnboardingFlow.svelte`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/settings/GlobalSettings.svelte`
- `src/lib/client/settings/GlobalSettingsSection.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/settings/RetentionSettings.svelte`
- `src/lib/client/settings/ThemePreviewCard.svelte`
- `src/lib/client/settings/ThemeSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte`
- `src/lib/client/settings/sections/OAuthSettings.svelte`
- `src/lib/client/settings/sections/StorageSettings.svelte`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte`
- `src/lib/client/settings/sections/TunnelControl.svelte`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte`
- `src/lib/client/shared/components/AppVersion.svelte`
- `src/lib/client/shared/components/AugButton.svelte`
- `src/lib/client/shared/components/AuthStatus.svelte`
- `src/lib/client/shared/components/BrandLogo.svelte`
- `src/lib/client/shared/components/Button.svelte`
- `src/lib/client/shared/components/ConfirmationDialog.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/ErrorDisplay.svelte`
- `src/lib/client/shared/components/FileEditor.svelte`
- `src/lib/client/shared/components/GitOperations.svelte`
- `src/lib/client/shared/components/HelpModal.svelte`
- `src/lib/client/shared/components/IconButton.svelte`
- `src/lib/client/shared/components/Input.svelte`
- `src/lib/client/shared/components/LiveIconStrip.svelte`
- `src/lib/client/shared/components/LoadingSpinner.svelte`
- `src/lib/client/shared/components/Modal.svelte`
- `src/lib/client/shared/components/PWAInstallPrompt.svelte`
- `src/lib/client/shared/components/PWAUpdateNotification.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte`
- `src/lib/client/shared/components/SessionCard.svelte`
- `src/lib/client/shared/components/SettingField.svelte`
- `src/lib/client/shared/components/Shell.svelte`
- `src/lib/client/shared/components/StatusBar.svelte`
- `src/lib/client/shared/components/TunnelIndicator.svelte`
- `src/lib/client/shared/components/TypeCard.svelte`
- `src/lib/client/shared/components/WorktreeManager.svelte`
- `src/lib/client/shared/components/window-manager/TileControls.svelte`
- `src/lib/client/shared/components/workspace/CreateSessionButton.svelte`
- `src/lib/client/shared/components/workspace/EmptySessionPane.svelte`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceHeader.svelte`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceStatusBar.svelte`
- `src/lib/client/terminal/MobileTerminalInput.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/lib/client/terminal/TerminalHeader.svelte`
- `src/routes/+layout.svelte`
- `src/routes/+page.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`
- `src/routes/auth/callback/+page.svelte`
- `src/routes/console/+page.svelte`
- `src/routes/onboarding/+page.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/menu-panel.css

**Classes:** 14 total, 14 used, 0 unused

**Used by 63 file(s):**

- `src/lib/client/claude/ClaudeHeader.svelte`
- `src/lib/client/claude/ClaudePane.svelte`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/claude/activity-summaries/ActivitySummary.svelte`
- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/activity-summaries/ReadActivity.svelte`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
- `src/lib/client/claude/components/MessageList.svelte`
- `src/lib/client/file-editor/FileEditorPane.svelte`
- `src/lib/client/onboarding/AuthenticationStep.svelte`
- `src/lib/client/onboarding/OnboardingFlow.svelte`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/settings/GlobalSettings.svelte`
- `src/lib/client/settings/GlobalSettingsSection.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/settings/RetentionSettings.svelte`
- `src/lib/client/settings/ThemeSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte`
- `src/lib/client/settings/sections/StorageSettings.svelte`
- `src/lib/client/settings/sections/TunnelControl.svelte`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte`
- `src/lib/client/shared/components/AppVersion.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/ErrorDisplay.svelte`
- `src/lib/client/shared/components/GitOperations.svelte`
- `src/lib/client/shared/components/Input.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte`
- `src/lib/client/shared/components/SettingField.svelte`
- `src/lib/client/shared/components/StatusBar.svelte`
- `src/lib/client/shared/components/TunnelIndicator.svelte`
- `src/lib/client/shared/components/WorktreeManager.svelte`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte`
- `src/lib/client/shared/components/workspace/SessionHeaderRenderer.svelte`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceStatusBar.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/lib/client/terminal/TerminalHeader.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/routes/+layout.svelte`
- `src/routes/+page.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`
- `src/routes/_testing/_tiles/+page.svelte`
- `src/routes/auth/callback/+page.svelte`
- `src/routes/console/+page.svelte`
- `src/routes/onboarding/+page.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/claude.css

**Classes:** 36 total, 36 used, 0 unused

**Used by 50 file(s):**

- `src/lib/client/claude/ClaudePane.svelte`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/claude/ClaudeSettings.svelte`
- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/activity-summaries/ReadActivity.svelte`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
- `src/lib/client/claude/components/InputArea.svelte`
- `src/lib/client/claude/components/MessageList.svelte`
- `src/lib/client/file-editor/FileEditorPane.svelte`
- `src/lib/client/onboarding/AuthenticationStep.svelte`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/settings/GlobalSettings.svelte`
- `src/lib/client/settings/GlobalSettingsSection.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/settings/RetentionSettings.svelte`
- `src/lib/client/settings/ThemeSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte`
- `src/lib/client/settings/sections/OAuthSettings.svelte`
- `src/lib/client/settings/sections/StorageSettings.svelte`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte`
- `src/lib/client/settings/sections/TunnelControl.svelte`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
- `src/lib/client/shared/components/AuthStatus.svelte`
- `src/lib/client/shared/components/ConfirmationDialog.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/ErrorDisplay.svelte`
- `src/lib/client/shared/components/FileEditor.svelte`
- `src/lib/client/shared/components/GitOperations.svelte`
- `src/lib/client/shared/components/Input.svelte`
- `src/lib/client/shared/components/Markdown.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/SettingField.svelte`
- `src/lib/client/shared/components/WorktreeManager.svelte`
- `src/lib/client/terminal/MobileTerminalInput.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/routes/auth/callback/+page.svelte`
- `src/routes/console/+page.svelte`
- `src/routes/onboarding/+page.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/type-card.css

**Classes:** 7 total, 7 used, 0 unused

**Used by 25 file(s):**

- `src/lib/client/claude/ClaudePane.svelte`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/ThemePreviewCard.svelte`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte`
- `src/lib/client/shared/components/AugButton.svelte`
- `src/lib/client/shared/components/AuthStatus.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/GitOperations.svelte`
- `src/lib/client/shared/components/HelpModal.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/SessionCard.svelte`
- `src/lib/client/shared/components/TunnelIndicator.svelte`
- `src/lib/client/shared/components/TypeCard.svelte`
- `src/lib/client/shared/components/workspace/CreateSessionButton.svelte`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/routes/+layout.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`
- `src/routes/console/+page.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/index.css

**Classes:** 1 total, 1 used, 0 unused

**Used by 19 file(s):**

- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/activity-summaries/ReadActivity.svelte`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
- `src/lib/client/shared/components/AugButton.svelte`
- `src/lib/client/shared/components/Button.svelte`
- `src/lib/client/shared/components/FileEditor.svelte`
- `src/lib/client/shared/components/FormSection.svelte`
- `src/lib/client/shared/components/Markdown.svelte`
- `src/lib/client/shared/components/Shell.svelte`
- `src/lib/client/shared/components/TypeCard.svelte`
- `src/lib/client/shared/components/WorkspaceSelector.svelte`
- `src/lib/client/shared/components/window-manager/WindowManager.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/routes/+layout.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/modal.css

**Classes:** 7 total, 7 used, 0 unused

**Used by 19 file(s):**

- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/settings/ThemeSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/settings/sections/StorageSettings.svelte`
- `src/lib/client/settings/sections/TunnelControl.svelte`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/HelpModal.svelte`
- `src/lib/client/shared/components/Modal.svelte`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceHeader.svelte`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
- `src/lib/client/terminal/MobileTerminalInput.svelte`
- `src/lib/client/terminal/MobileTerminalView.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`

---

## src/lib/client/shared/styles/index.css

**Classes:** 1 total, 1 used, 0 unused

**Used by 19 file(s):**

- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
- `src/lib/client/claude/activity-summaries/ReadActivity.svelte`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
- `src/lib/client/shared/components/AugButton.svelte`
- `src/lib/client/shared/components/Button.svelte`
- `src/lib/client/shared/components/FileEditor.svelte`
- `src/lib/client/shared/components/FormSection.svelte`
- `src/lib/client/shared/components/Markdown.svelte`
- `src/lib/client/shared/components/Shell.svelte`
- `src/lib/client/shared/components/TypeCard.svelte`
- `src/lib/client/shared/components/WorkspaceSelector.svelte`
- `src/lib/client/shared/components/window-manager/WindowManager.svelte`
- `src/lib/client/terminal/TerminalPane.svelte`
- `src/routes/+layout.svelte`
- `src/routes/settings/+page.svelte`

---

## src/lib/client/shared/styles/components/forms.css

**Classes:** 11 total, 10 used, 1 unused

**Used by 9 file(s):**

- `src/lib/client/onboarding/AuthenticationStep.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/settings/RetentionSettings.svelte`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
- `src/lib/client/shared/components/FormSection.svelte`
- `src/lib/client/shared/components/Input.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/WorktreeManager.svelte`

---

## src/lib/client/shared/styles/components/misc.css

**Classes:** 4 total, 4 used, 0 unused

**Used by 8 file(s):**

- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/IconButton.svelte`
- `src/lib/client/shared/components/Markdown.svelte`
- `src/lib/client/shared/components/window-manager/TileControls.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/routes/_testing/_tiles/+page.svelte`

---

## src/lib/client/shared/styles/animations.css

**Classes:** 5 total, 3 used, 2 unused

**Used by 7 file(s):**

- `src/lib/client/onboarding/OnboardingFlow.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/shared/components/IconButton.svelte`
- `src/lib/client/shared/components/PWAInstallPrompt.svelte`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`

---

## src/lib/client/shared/styles/components/session-card.css

**Classes:** 10 total, 10 used, 0 unused

**Used by 7 file(s):**

- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/shared/components/LiveIconStrip.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/SessionCard.svelte`

---

## src/lib/client/shared/styles/components/status-bar.css

**Classes:** 9 total, 9 used, 0 unused

**Used by 3 file(s):**

- `src/lib/client/shared/components/StatusBar.svelte`
- `src/lib/client/shared/components/workspace/MobileNavigation.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceStatusBar.svelte`

---

## src/lib/client/shared/styles/fonts.css

**Classes:** 1 total, 0 used, 1 unused

⚠️ **Not used by any Svelte files**

---

## src/lib/client/shared/styles/variables.css

**Classes:** 0 total, 0 used, 0 unused

⚠️ **Not used by any Svelte files**

---

