# Component Styles Analysis Report

Generated on 10/7/2025, 3:36:21 PM

> This document analyzes how Svelte components use styles (scoped vs external CSS).

## Architecture Overview

**Total Components:** 185

| Style Approach | Count | Percentage |
| -------------- | ----- | ---------- |
| Scoped Only    | 13    | 7.0%       |
| External Only  | 10    | 5.4%       |
| Mixed          | 75    | 40.5%      |
| No Styles      | 87    | 47.0%      |

---

## Scoped-Only Components

Components using only scoped `<style>` blocks: **13**

- `src/lib/client/shared/components/AppVersion.svelte`
- `src/lib/client/shared/components/BrandLogo.svelte`
- `src/lib/client/shared/components/PWAUpdateNotification.svelte`
- `src/lib/client/shared/components/Shell.svelte`
- `src/lib/client/shared/components/window-manager/WindowManager.svelte`
- `src/lib/client/shared/components/workspace/CreateSessionButton.svelte`
- `src/lib/client/shared/components/workspace/EmptySessionPane.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte`
- `src/lib/client/shared/components/workspace/SessionHeaderRenderer.svelte`
- `src/lib/client/shared/components/workspace/SingleSessionView.svelte`
- `src/routes/_testing/+page.svelte`
- `src/routes/workspace/+page.svelte`

---

## External-Only Components

Components using only external CSS files: **10**

- `src/lib/client/claude/activity-summaries/ReadActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
- `src/lib/client/claude/ClaudeSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
- `src/lib/client/onboarding/OnboardingFlow.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/animations.css`
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/Button.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
- `src/lib/client/shared/components/FormSection.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/IconButton.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/animations.css`
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/misc.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/TypeCard.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/type-card.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/window-manager/TileControls.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/misc.css`
- `src/lib/client/shared/components/workspace/WorkspaceStatusBar.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/status-bar.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/WorkspaceSelector.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/retro.css`

---

## Mixed Approach Components

**Warning:** These components use both scoped styles and external CSS. Consider consolidating.

Components using mixed approach: **75**

- `src/lib/client/claude/activity-summaries/ActivitySummary.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
- `src/lib/client/claude/activity-summaries/BashActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/activity-summaries/GlobActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
- `src/lib/client/claude/activity-summaries/GrepActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/ClaudeHeader.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/claude/ClaudePane.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/ClaudeProjectPicker.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/components/InputArea.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/claude/components/MessageList.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/file-editor/FileEditorPane.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/onboarding/AuthenticationStep.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/AuthenticationSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/animations.css`
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/GlobalSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/GlobalSettingsSection.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/PreferencesPanel.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/RetentionSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/sections/ClaudeAuth.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/sections/OAuthSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
- `src/lib/client/settings/sections/StorageSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
- `src/lib/client/settings/sections/TunnelControl.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/settings/ThemePreviewCard.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/type-card.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/settings/ThemeSettings.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/modal.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/AugButton.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
- `src/lib/client/shared/components/AuthStatus.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
- `src/lib/client/shared/components/ConfirmationDialog.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/CreateSessionModal.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/modal.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/misc.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/ErrorDisplay.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/FileEditor.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/GitOperations.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/Header.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/HelpModal.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/Input.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/LiveIconStrip.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/LoadingSpinner.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/Markdown.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/misc.css`
- `src/lib/client/shared/components/Modal.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/modal.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/session-card.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/PWAInstallPrompt.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/animations.css`
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/SessionCard.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/session-card.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/SettingField.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/StatusBar.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/status-bar.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/TunnelIndicator.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/type-card.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/modal.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/shared/components/workspace/MobileNavigation.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/status-bar.css`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/animations.css`
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/misc.css`
    - `src/lib/client/shared/styles/components/type-card.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/workspace/WorkspaceHeader.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/modal.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/shared/components/WorktreeManager.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/forms.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`
- `src/lib/client/terminal/MobileTerminalInput.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/terminal/MobileTerminalView.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
- `src/lib/client/terminal/TerminalHeader.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/retro.css`
- `src/lib/client/terminal/TerminalPane.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/_testing/_session-tiles/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/animations.css`
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/_testing/_tiles/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/misc.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/auth/callback/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/console/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/type-card.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/onboarding/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/claude.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/retro.css`
- `src/routes/settings/+page.svelte`
  - External CSS:
    - `src/lib/client/shared/styles/components/buttons.css`
    - `src/lib/client/shared/styles/components/menu-panel.css`
    - `src/lib/client/shared/styles/components/type-card.css`
    - `src/lib/client/shared/styles/retro.css`
    - `src/lib/client/shared/styles/utilities.css`

---

## Single-Component CSS Files

CSS files used by only one component. **Candidates for migration to scoped styles.**

Single-component CSS files: **0**

_No single-component CSS files found._

---

## Components Without Styles

Components with no styling (neither scoped nor external): **87**

<details>
<summary>View components without styles</summary>

- `src/lib/client/shared/components/Icons/BackIcon.svelte`
- `src/lib/client/shared/components/Icons/ClaudeIcon.svelte`
- `src/lib/client/shared/components/Icons/DeleteProject.svelte`
- `src/lib/client/shared/components/Icons/EditIcon.svelte`
- `src/lib/client/shared/components/Icons/EndSessionIcon.svelte`
- `src/lib/client/shared/components/Icons/ExitIcon.svelte`
- `src/lib/client/shared/components/Icons/IconActivity.svelte`
- `src/lib/client/shared/components/Icons/IconAdjustmentsAlt.svelte`
- `src/lib/client/shared/components/Icons/IconAlertTriangle.svelte`
- `src/lib/client/shared/components/Icons/IconAppWindow.svelte`
- `src/lib/client/shared/components/Icons/IconArchive.svelte`
- `src/lib/client/shared/components/Icons/IconArrowDown.svelte`
- `src/lib/client/shared/components/Icons/IconArrowLeft.svelte`
- `src/lib/client/shared/components/Icons/IconArrowRight.svelte`
- `src/lib/client/shared/components/Icons/IconArrowUp.svelte`
- `src/lib/client/shared/components/Icons/IconAsterisk.svelte`
- `src/lib/client/shared/components/Icons/IconBolt.svelte`
- `src/lib/client/shared/components/Icons/IconBrain.svelte`
- `src/lib/client/shared/components/Icons/IconCheck.svelte`
- `src/lib/client/shared/components/Icons/IconChecklist.svelte`
- `src/lib/client/shared/components/Icons/IconChevronDown.svelte`
- `src/lib/client/shared/components/Icons/IconCircle.svelte`
- `src/lib/client/shared/components/Icons/IconCircleCheck.svelte`
- `src/lib/client/shared/components/Icons/IconClaude.svelte`
- `src/lib/client/shared/components/Icons/IconCloud.svelte`
- `src/lib/client/shared/components/Icons/IconCloudCheck.svelte`
- `src/lib/client/shared/components/Icons/IconCloudX.svelte`
- `src/lib/client/shared/components/Icons/IconCodeDots.svelte`
- `src/lib/client/shared/components/Icons/IconCodeMinus.svelte`
- `src/lib/client/shared/components/Icons/IconDeviceDesktop.svelte`
- `src/lib/client/shared/components/Icons/IconDots.svelte`
- `src/lib/client/shared/components/Icons/IconDownload.svelte`
- `src/lib/client/shared/components/Icons/IconEdit.svelte`
- `src/lib/client/shared/components/Icons/IconExternalLink.svelte`
- `src/lib/client/shared/components/Icons/IconEye.svelte`
- `src/lib/client/shared/components/Icons/IconEyeOff.svelte`
- `src/lib/client/shared/components/Icons/IconFile.svelte`
- `src/lib/client/shared/components/Icons/IconFileCode.svelte`
- `src/lib/client/shared/components/Icons/IconFileText.svelte`
- `src/lib/client/shared/components/Icons/IconFolder.svelte`
- `src/lib/client/shared/components/Icons/IconFolderClone.svelte`
- `src/lib/client/shared/components/Icons/IconFolderPlus.svelte`
- `src/lib/client/shared/components/Icons/IconGitBranch.svelte`
- `src/lib/client/shared/components/Icons/IconGitCommit.svelte`
- `src/lib/client/shared/components/Icons/IconGitFork.svelte`
- `src/lib/client/shared/components/Icons/IconGitMerge.svelte`
- `src/lib/client/shared/components/Icons/IconGitPull.svelte`
- `src/lib/client/shared/components/Icons/IconGitWorktree.svelte`
- `src/lib/client/shared/components/Icons/IconHistory.svelte`
- `src/lib/client/shared/components/Icons/IconHourglassEmpty.svelte`
- `src/lib/client/shared/components/Icons/IconInfoCircle.svelte`
- `src/lib/client/shared/components/Icons/IconKey.svelte`
- `src/lib/client/shared/components/Icons/IconKeyboard.svelte`
- `src/lib/client/shared/components/Icons/IconLayoutGrid.svelte`
- `src/lib/client/shared/components/Icons/IconLoader.svelte`
- `src/lib/client/shared/components/Icons/IconLogout.svelte`
- `src/lib/client/shared/components/Icons/IconMessage.svelte`
- `src/lib/client/shared/components/Icons/IconMinus.svelte`
- `src/lib/client/shared/components/Icons/IconPin.svelte`
- `src/lib/client/shared/components/Icons/IconPinnedOff.svelte`
- `src/lib/client/shared/components/Icons/IconPlayerTrackNext.svelte`
- `src/lib/client/shared/components/Icons/IconPlayerTrackPrev.svelte`
- `src/lib/client/shared/components/Icons/IconPlus.svelte`
- `src/lib/client/shared/components/Icons/IconProgressDown.svelte`
- `src/lib/client/shared/components/Icons/IconReceipt.svelte`
- `src/lib/client/shared/components/Icons/IconRobot.svelte`
- `src/lib/client/shared/components/Icons/IconSearch.svelte`
- `src/lib/client/shared/components/Icons/IconSettings.svelte`
- `src/lib/client/shared/components/Icons/IconSparkles.svelte`
- `src/lib/client/shared/components/Icons/IconSquareCheck.svelte`
- `src/lib/client/shared/components/Icons/IconTerminal.svelte`
- `src/lib/client/shared/components/Icons/IconTerminal2.svelte`
- `src/lib/client/shared/components/Icons/IconTool.svelte`
- `src/lib/client/shared/components/Icons/IconTrash.svelte`
- `src/lib/client/shared/components/Icons/IconUpload.svelte`
- `src/lib/client/shared/components/Icons/IconUser.svelte`
- `src/lib/client/shared/components/Icons/IconUserCode.svelte`
- `src/lib/client/shared/components/Icons/IconWorld.svelte`
- `src/lib/client/shared/components/Icons/IconX.svelte`
- `src/lib/client/shared/components/Icons/SessionIcon.svelte`
- `src/lib/client/shared/components/Icons/ShellIcon.svelte`
- `src/lib/client/shared/components/Icons/StartSession.svelte`
- `src/lib/client/shared/components/Icons/TerminalIcon.svelte`
- `src/lib/client/shared/components/Icons/XIcon.svelte`
- `src/lib/client/shared/components/window-manager/Split.svelte`
- `src/lib/client/shared/components/window-manager/Tile.svelte`
- `src/routes/+layout.svelte`

</details>

---

## Recommended Actions

### 1. Fix Mixed Approach Components (75)

Components using both scoped and external CSS should consolidate to one approach:

- Move external CSS into scoped `<style>` blocks, OR
- Move scoped styles to external CSS files

**Priority:** High - Inconsistent architecture
