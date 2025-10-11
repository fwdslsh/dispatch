# CSS Tokens Audit Report

Generated on 10/7/2025, 3:37:23 PM

> This report identifies hardcoded values that should use CSS variables (design tokens).

## Summary

- **Tokenization Score:** 55.2% (⚠️ Fair)
- **Files Scanned:** 201
- **Hardcoded Colors:** 578
- **Hardcoded Spacing:** 573
- **Hardcoded Sizes:** 708
- **Total Hardcoded Values:** 1859

---

## Hardcoded Colors

Found 578 hardcoded color values:

### `transparent` (79 occurrences)

**Suggested replacement:** `transparent`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css**
  ```css
  border-color: transparent;
  ```
- **src/lib/client/shared/styles/animations.css**
  ```css
  border: 1px solid transparent;
  ```
- **src/lib/client/shared/styles/components/misc.css**
  ```css
  background: linear-gradient(90deg, transparent, var(--surface-border), transparent);
  ```
- **src/lib/client/shared/styles/components/misc.css**
  ```css
  background: linear-gradient(90deg, transparent, var(--surface-border), transparent);
  ```
- **src/lib/client/shared/styles/components/type-card.css**
  ```css
  background: linear-gradient(90deg, transparent, var(--primary-glow-10), transparent);
  ```
- **src/lib/client/shared/styles/components/type-card.css**
  ```css
  background: linear-gradient(90deg, transparent, var(--primary-glow-10), transparent);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  background: transparent;
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  --btn-bg: transparent;
  ```

... and 69 more

</details>

### `#333` (20 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte**
  ```css
  background: #333;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  border: 1px solid var(--surface-border, #333);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  border-bottom: 1px solid var(--surface-border, #333);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  border: 1px solid var(--surface-border, #333);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: var(--surface-active, #333);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  border-top: 1px solid var(--surface-border, #333);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-bottom: 1px solid #333;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-bottom: 1px solid #333;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #333;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #333;
  ```

... and 10 more

</details>

### `rgba(0, 0, 0, 0.1)` (17 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css**
  ```css
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  0 2px 20px -8px rgba(0, 0, 0, 0.1),
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  0 8px 32px -12px rgba(0, 0, 0, 0.1),
  ```
- **src/lib/client/shared/styles/utilities.css**
  ```css
  .shadow-md {
  	box-shadow:
  		0 4px 6px -1px rgba(0, 0, 0, 0.1),
  		0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  ```
- **src/lib/client/shared/styles/utilities.css**
  ```css
  .shadow-lg {
  	box-shadow:
  		0 10px 15px -3px rgba(0, 0, 0, 0.1),
  		0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  ```
- **src/lib/client/claude/components/InputArea.svelte**
  ```css
  0 4px 16px -8px rgba(0, 0, 0, 0.1),
  ```
- **src/lib/client/claude/components/MessageList.svelte**
  ```css
  0 8px 32px -12px rgba(0, 0, 0, 0.1),
  ```
- **src/lib/client/claude/components/MessageList.svelte**
  ```css
  0 8px 32px -12px rgba(0, 0, 0, 0.1),
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  ```

... and 7 more

</details>

### `white` (17 occurrences)

**Suggested replacement:** `var(--text)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background: white;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: white;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background: white;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border-top: 3px solid white;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background: white;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: white;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background: white;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-white']
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-bright-white']
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  theme.white
  ```

... and 7 more

</details>

### `#ff6b6b` (16 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color-mix(in oklab, var(--error, #ff6b6b) 15%, var(--surface)),
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color-mix(in oklab, var(--error, #ff6b6b) 8%, var(--surface))
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  border-color: color-mix(in oklab, var(--error, #ff6b6b) 35%, transparent);
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color: var(--error, #ff6b6b);
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color-mix(in oklab, var(--error, #ff6b6b) 20%, transparent),
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color-mix(in oklab, var(--error, #ff6b6b) 10%, transparent)
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  border-color: color-mix(in oklab, var(--error, #ff6b6b) 40%, transparent);
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color: var(--error, #ff6b6b);
  ```
- **src/lib/client/shared/styles/components/claude.css**
  ```css
  color: var(--error, #ff6b6b);
  ```
- **src/lib/client/claude/ClaudeProjectPicker.svelte**
  ```css
  color: var(--error, #ff6b6b);
  ```

... and 6 more

</details>

### `#0066cc` (15 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--primary, #0066cc);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--primary, #0066cc);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: linear-gradient(45deg, #0066cc, #00ccff);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #0066cc;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  box-shadow: inset 0 0 0 2px #0066cc;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-top: 3px solid #0066cc;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: linear-gradient(45deg, #0066cc, #00ccff);
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border-color: #0066cc;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  color: #0066cc;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  box-shadow: inset 0 0 0 2px #0066cc;
  ```

... and 5 more

</details>

### `green` (14 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  /* Primary Phosphor Green Family */
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  let selectedThemeId = $state('phosphor-green'); // Default selection
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  // Handle skip (keep default phosphor-green theme)
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  green: cv[ '--theme-ansi-green'] || '#00ff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  green: theme.green || '#00ff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-green'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-bright-green'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  theme.green,
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  <span class="dot dot-green" aria-hidden="true"></span>
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  <span class="prompt" style="color: {colors.green};">$</span>
  ```

... and 4 more

</details>

### `#fff` (14 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-primary, #fff);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-primary, #fff);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-primary, #fff);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-primary, #fff);
  ```
- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte**
  ```css
  color: var(--warning-contrast, #fff);
  ```
- **src/routes/\_testing/+page.svelte**
  ```css
  background: var(--surface, #fff);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #fff;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #fff;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  color: #fff;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  color: #fff;
  ```

... and 4 more

</details>

### `#6b7280` (12 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #6b7280;
  ```
- **src/lib/client/shared/components/AppVersion.svelte**
  ```css
  color: var(--text-primary, #6b7280);
  ```

... and 2 more

</details>

### `#555` (12 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #555;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #555;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #555;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border: 1px solid #555;
  ```

... and 2 more

</details>

### `#3b82f6` (11 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border-color: #3b82f6;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background-color: #3b82f6;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  outline: 2px solid #3b82f6;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  outline: 3px solid #3b82f6;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  border-top: 3px solid #3b82f6;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border-color: #3b82f6;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #3b82f6;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border-top: 2px solid #3b82f6;
  ```
- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  color: #3b82f6;
  ```
- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  color: #3b82f6;
  ```

... and 1 more

</details>

### `#444` (11 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  border: 1px solid var(--surface-border, #444);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  box-shadow: 0 2px 0 var(--surface-border, #444);
  ```
- **src/routes/\_testing/+page.svelte**
  ```css
  color: #444;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-bottom: 1px solid #444;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #444;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border: 2px dashed #444;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #444;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border: 1px solid #444;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border-bottom: 1px solid #444;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #444;
  ```

... and 1 more

</details>

### `rgba(0, 0, 0, 0.3)` (10 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css**
  ```css
  0 6px 16px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/shared/styles/components/type-card.css**
  ```css
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/claude/ClaudeProjectPicker.svelte**
  ```css
  0 4px 16px rgba(0, 0, 0, 0.3),
  ```
- **src/lib/client/settings/PreferencesPanel.svelte**
  ```css
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/shared/components/SettingField.svelte**
  ```css
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/shared/components/SettingField.svelte**
  ```css
  inset 0 1px 3px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/shared/components/SettingField.svelte**
  ```css
  inset 0 1px 3px rgba(0, 0, 0, 0.3);
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte**
  ```css
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.3);
  ```

</details>

### `yellow` (10 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  yellow: cv[ '--theme-ansi-yellow'] || '#ffff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  yellow: theme.yellow || '#ffff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-yellow'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-bright-yellow'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  theme.yellow,
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  <span class="dot dot-yellow" aria-hidden="true"></span>
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  <span class="arg" style="color: {colors.yellow};">--theme</span>
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  .dot-yellow {
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  yellow: getCssVar('--theme-ansi-yellow') || '#ffd166';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightyellow: getCssVar('--theme-ansi-bright-yellow') || '#ffd166';
  ```

</details>

### `#dc2626` (9 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border-color: #dc2626;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #dc2626;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  color: #dc2626;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  color: #dc2626;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border-color: #dc2626;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #dc2626;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #dc2626;
  ```
- **src/lib/client/settings/sections/HomeDirectoryManager.svelte**
  ```css
  background: var(--color-error, #dc2626);
  ```
- **src/routes/onboarding/+page.svelte**
  ```css
  color: #dc2626;
  ```

</details>

### `#1a1a1a` (9 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: var(--bg, #1a1a1a);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #1a1a1a;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #1a1a1a;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #1a1a1a;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #1a1a1a;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #1a1a1a;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #1a1a1a;
  ```

</details>

### `rgba(46, 230, 107, 0.2)` (8 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeProjectPicker.svelte**
  ```css
  box-shadow: 0 0 0 2px rgba(46, 230, 107, 0.2);
  ```
- **src/lib/client/claude/ClaudeProjectPicker.svelte**
  ```css
  box-shadow: 0 0 6px rgba(46, 230, 107, 0.2);
  ```
- **src/lib/client/claude/ClaudeProjectPicker.svelte**
  ```css
  0 0 0 1px rgba(46, 230, 107, 0.2);
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  0 4px 12px rgba(46, 230, 107, 0.2);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  border-bottom: 1px solid rgba(46, 230, 107, 0.2);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  border: 1px solid rgba(46, 230, 107, 0.2);
  ```
- **src/routes/settings/+page.svelte**
  ```css
  border: 1px solid rgba(46, 230, 107, 0.2);
  ```
- **src/routes/settings/+page.svelte**
  ```css
  border: 1px solid rgba(46, 230, 107, 0.2);
  ```

</details>

### `#e5e7eb` (8 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border: 1px solid #e5e7eb;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background-color: #e5e7eb;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border: 1px solid #e5e7eb;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  border: 3px solid #e5e7eb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border: 1px solid #e5e7eb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #e5e7eb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border: 1px solid #e5e7eb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border: 2px solid #e5e7eb;
  ```

</details>

### `#2a2a2a` (8 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/AuthStatus.svelte**
  ```css
  background: var(--surface-elevated, #2a2a2a);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: var(--surface-hover, #2a2a2a);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #2a2a2a;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #2a2a2a;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #2a2a2a;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #2a2a2a;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #2a2a2a;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #2a2a2a;
  ```

</details>

### `rgba(0, 0, 0, 0.2)` (7 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css**
  ```css
  0 6px 16px rgba(0, 0, 0, 0.2);
  ```
- **src/lib/client/shared/styles/animations.css**
  ```css
  0 4px 12px rgba(0, 0, 0, 0.2);
  ```
- **src/lib/client/shared/styles/components/buttons.css**
  ```css
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  border: 1px solid rgba(0, 0, 0, 0.2);
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  border: 1px solid rgba(0, 0, 0, 0.2);
  ```
- **src/lib/client/shared/components/HelpModal.svelte**
  ```css
  0 2px 4px rgba(0, 0, 0, 0.2),
  ```

</details>

### `#ffffff` (7 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  --text: #ffffff;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  foreground: '#ffffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cursor: '#ffffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  foreground: cv[ '--theme-foreground'] || '#ffffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cursor: cv[ '--theme-cursor'] || '#ffffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  foreground: theme.foreground || '#ffffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cursor: theme.cursor || '#ffffff';
  ```

</details>

### `rgba(255, 255, 255, 0.1)` (6 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/type-card.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte**
  ```css
  inset 0 1px 4px rgba(255, 255, 255, 0.1);
  ```

</details>

### `#ef476f` (6 occurrences)

**Suggested replacement:** `var(--err)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --err: light-dark(#ef476f, #ef476f);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --err: light-dark(#ef476f, #ef476f);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  red: getCssVar('--theme-ansi-red') || '#ef476f';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightred: getCssVar('--theme-ansi-bright-red') || '#ef476f';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  color-mix(in oklab, var(--bg) 95%, #ef476f 5%),
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  color: #ef476f;
  ```

</details>

### `black` (6 occurrences)

**Suggested replacement:** `var(--bg)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  brightblack: cv[ '--theme-ansi-bright-black'] || '#555555';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-black'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-bright-black'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  theme.black,
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  black: getCssVar('--theme-ansi-black') || '#121a17';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightblack: getCssVar('--theme-ansi-bright-black') || '#8aa699';
  ```

</details>

### `red` (6 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-red'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-bright-red'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  theme.red,
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  <span class="dot dot-red" aria-hidden="true"></span>
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  red: getCssVar('--theme-ansi-red') || '#ef476f';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightred: getCssVar('--theme-ansi-bright-red') || '#ef476f';
  ```

</details>

### `blue` (6 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-blue'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cv['--theme-ansi-bright-blue'],
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  theme.blue,
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  <strong>Focus management:</strong> The focused tile has a blue border and receives keyboard
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  blue: getCssVar('--theme-ansi-blue') || '#00c2ff';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightblue: getCssVar('--theme-ansi-bright-blue') || '#00c2ff';
  ```

</details>

### `#888` (6 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-muted, #888);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-muted, #888);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-muted, #888);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  color: var(--text-muted, #888);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #888;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #888;
  ```

</details>

### `rgba(255, 255, 255, 0.05)` (5 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/modal.css**
  ```css
  inset 0 1px 2px rgba(255, 255, 255, 0.05);
  ```
- **src/lib/client/claude/components/MessageList.svelte**
  ```css
  inset 0 1px 2px rgba(255, 255, 255, 0.05);
  ```
- **src/lib/client/claude/components/MessageList.svelte**
  ```css
  inset 0 1px 2px rgba(255, 255, 255, 0.05);
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte**
  ```css
  inset 0 1px 2px rgba(255, 255, 255, 0.05);
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  background: rgba(255, 255, 255, 0.05);
  ```

</details>

### `#ffd166` (5 occurrences)

**Suggested replacement:** `var(--accent-amber)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --accent-2: light-dark(#ffd166, #ffd166);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --accent-2: light-dark(#ffd166, #ffd166);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --accent-amber: #ffd166;
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  yellow: getCssVar('--theme-ansi-yellow') || '#ffd166';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightyellow: getCssVar('--theme-ansi-bright-yellow') || '#ffd166';
  ```

</details>

### `#00c2ff` (5 occurrences)

**Suggested replacement:** `var(--info)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --info: light-dark(#00c2ff, #00c2ff);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --info: light-dark(#00c2ff, #00c2ff);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --accent-cyan: #00c2ff;
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  blue: getCssVar('--theme-ansi-blue') || '#00c2ff';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightblue: getCssVar('--theme-ansi-bright-blue') || '#00c2ff';
  ```

</details>

### `#374151` (5 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #374151;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #374151;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #374151;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #374151;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #374151;
  ```

</details>

### `rgba(46, 230, 107, 0.15)` (5 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: linear-gradient(135deg, rgba(46, 230, 107, 0.15), rgba(46, 230, 107, 0.05));
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  border: 1px solid rgba(46, 230, 107, 0.15);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: rgba(46, 230, 107, 0.15);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  border: 1px solid rgba(46, 230, 107, 0.15);
  ```
- **src/routes/settings/+page.svelte**
  ```css
  background: rgba(46, 230, 107, 0.15);
  ```

</details>

### `#f59e0b` (5 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/TunnelControl.svelte**
  ```css
  color: #f59e0b;
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  border-color: #f59e0b;
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  color: #f59e0b;
  ```
- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte**
  ```css
  background: var(--warning, #f59e0b);
  ```
- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte**
  ```css
  border-left: 2px solid var(--warning, #f59e0b);
  ```

</details>

### `#222` (5 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: var(--surface-elevated, #222);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: var(--surface-elevated, #222);
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: var(--surface-elevated, #222);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #222;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #222;
  ```

</details>

### `rgba(46, 230, 107, 0.1)` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css**
  ```css
  text-shadow: 0 0 1px rgba(46, 230, 107, 0.1);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  box-shadow: 0 0 20px rgba(46, 230, 107, 0.1);
  ```
- **src/lib/client/shared/components/HelpModal.svelte**
  ```css
  inset 0 1px 2px rgba(46, 230, 107, 0.1);
  ```
- **src/routes/settings/+page.svelte**
  ```css
  background: rgba(46, 230, 107, 0.1);
  ```

</details>

### `rgba(255, 255, 255, 0.2)` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/type-card.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  inset 0 0 0 1px rgba(255, 255, 255, 0.2),
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
  ```

</details>

### `#000000` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  --bg: #000000;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  background: '#000000';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  background: cv[ '--theme-background'] || '#000000';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  background: theme.background || '#000000';
  ```

</details>

### `rgba(0, 0, 0, 0.05)` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/utilities.css**
  ```css
  .shadow-sm {
  	box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }
  ```
- **src/lib/client/shared/styles/utilities.css**
  ```css
  .shadow-lg {
  	box-shadow:
  		0 10px 15px -3px rgba(0, 0, 0, 0.1),
  		0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte**
  ```css
  inset 0 1px 3px rgba(0, 0, 0, 0.05),
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte**
  ```css
  inset 0 1px 4px rgba(0, 0, 0, 0.05),
  ```

</details>

### `#0c1210` (4 occurrences)

**Suggested replacement:** `var(--bg)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --bg: light-dark(#0c1210, #0c1210);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --bg: light-dark(#0c1210, #0c1210);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  background: getCssVar('--theme-background') || '#0c1210';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  cursoraccent: getCssVar('--theme-cursor-accent') || '#0c1210';
  ```

</details>

### `#2ee66b` (4 occurrences)

**Suggested replacement:** `var(--primary)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --primary: #2ee66b;
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --primary-gradient: linear-gradient(135deg, #2ee66b, #4eff82);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  cursor: getCssVar('--theme-cursor') || '#2ee66b';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  green: getCssVar('--theme-ansi-green') || '#2ee66b';
  ```

</details>

### `#d1d5db` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border: 2px solid #d1d5db;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background-color: #d1d5db;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border: 2px solid #d1d5db;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #d1d5db;
  ```

</details>

### `rgba(255, 255, 255, 0.02)` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: rgba(255, 255, 255, 0.02);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: rgba(255, 255, 255, 0.02);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: rgba(255, 255, 255, 0.02);
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: rgba(255, 255, 255, 0.02);
  ```

</details>

### `#4ade80` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/TunnelControl.svelte**
  ```css
  color: #4ade80;
  ```
- **src/lib/client/settings/sections/TunnelControl.svelte**
  ```css
  color: #4ade80;
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  border-color: #4ade80;
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  color: #4ade80;
  ```

</details>

### `#ccc` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte**
  ```css
  color: #ccc;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #ccc;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #ccc;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #ccc;
  ```

</details>

### `#aaa` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte**
  ```css
  color: #aaa;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte**
  ```css
  color: #aaa;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #aaa;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  color: #aaa;
  ```

</details>

### `#666` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-color: #666;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  color: #666;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  color: #666;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border-color: #666;
  ```

</details>

### `#cc4444` (4 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #cc4444;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-color: #cc4444;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #cc4444;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  border-color: #cc4444;
  ```

</details>

### `#121a17` (3 occurrences)

**Suggested replacement:** `var(--surface)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --surface: light-dark(#121a17, #121a17);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --surface: light-dark(#121a17, #121a17);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  black: getCssVar('--theme-ansi-black') || '#121a17';
  ```

</details>

### `#d9ffe6` (3 occurrences)

**Suggested replacement:** `var(--text)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --text: light-dark(#cfe7d8, #d9ffe6);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  foreground: getCssVar('--theme-foreground') || '#d9ffe6';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightwhite: getCssVar('--theme-ansi-bright-white') || '#d9ffe6';
  ```

</details>

### `#4eff82` (3 occurrences)

**Suggested replacement:** `var(--primary-bright)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --primary-bright: #4eff82;
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --primary-gradient: linear-gradient(135deg, #2ee66b, #4eff82);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightgreen: getCssVar('--theme-ansi-bright-green') || '#4eff82';
  ```

</details>

### `#ff6b9d` (3 occurrences)

**Suggested replacement:** `var(--accent-magenta)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --accent-magenta: #ff6b9d;
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  magenta: getCssVar('--theme-ansi-magenta') || '#ff6b9d';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightmagenta: getCssVar('--theme-ansi-bright-magenta') || '#ff6b9d';
  ```

</details>

### `#1f2937` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #1f2937;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  color: #1f2937;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #1f2937;
  ```

</details>

### `#f9fafb` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background-color: #f9fafb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #f9fafb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #f9fafb;
  ```

</details>

### `#2563eb` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background-color: #2563eb;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #2563eb;
  ```
- **src/routes/onboarding/+page.svelte**
  ```css
  background: #2563eb;
  ```

</details>

### `rgba(59, 130, 246, 0.1)` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  ```
- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  background: rgba(59, 130, 246, 0.1);
  ```

</details>

### `rgba(0, 0, 0, 0.5)` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  background: rgba(0, 0, 0, 0.5);
  ```
- **src/lib/client/settings/ThemeSettings.svelte**
  ```css
  0 8px 24px rgba(0, 0, 0, 0.5),
  ```
- **src/lib/client/shared/components/GitOperations.svelte**
  ```css
  background: rgba(0, 0, 0, 0.5);
  ```

</details>

### `#00ff00` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  green: '#00ff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  green: cv[ '--theme-ansi-green'] || '#00ff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  green: theme.green || '#00ff00';
  ```

</details>

### `#00ffff` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cyan: '#00ffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cyan: cv[ '--theme-ansi-cyan'] || '#00ffff';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  cyan: theme.cyan || '#00ffff';
  ```

</details>

### `#ffff00` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  yellow: '#ffff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  yellow: cv[ '--theme-ansi-yellow'] || '#ffff00';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  yellow: theme.yellow || '#ffff00';
  ```

</details>

### `#555555` (3 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  brightblack: '#555555';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  brightblack: cv[ '--theme-ansi-bright-black'] || '#555555';
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  brightblack: theme.brightBlack || '#555555';
  ```

</details>

### `rgba(0, 0, 0, 0.15)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css**
  ```css
  0 4px 12px rgba(0, 0, 0, 0.15);
  ```
- **src/lib/client/shared/styles/animations.css**
  ```css
  0 4px 12px rgba(0, 0, 0, 0.15);
  ```

</details>

### `rgba(255, 255, 255, 0.5)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/type-card.css**
  ```css
  filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.5));
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.5));
  ```

</details>

### `#00ff88` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  --accent: #00ff88;
  ```
- **src/lib/client/shared/styles/retro.css**
  ```css
  --primary: #00ff88;
  ```

</details>

### `#18231f` (2 occurrences)

**Suggested replacement:** `var(--elev)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --elev: light-dark(#18231f, #18231f);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --elev: light-dark(#18231f, #18231f);
  ```

</details>

### `#cfe7d8` (2 occurrences)

**Suggested replacement:** `var(--text)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --text: light-dark(#cfe7d8, #d9ffe6);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  white: getCssVar('--theme-ansi-white') || '#cfe7d8';
  ```

</details>

### `#8aa699` (2 occurrences)

**Suggested replacement:** `var(--muted)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --muted: light-dark(#8aa699, #92b3a4);
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightblack: getCssVar('--theme-ansi-bright-black') || '#8aa699';
  ```

</details>

### `#26d07c` (2 occurrences)

**Suggested replacement:** `var(--ok)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --ok: light-dark(#26d07c, #26d07c);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --ok: light-dark(#26d07c, #26d07c);
  ```

</details>

### `#ffb703` (2 occurrences)

**Suggested replacement:** `var(--warn)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --warn: light-dark(#ffb703, #ffb703);
  ```
- **src/lib/client/shared/styles/variables.css**
  ```css
  --warn: light-dark(#ffb703, #ffb703);
  ```

</details>

### `rgba(0, 0, 0, 0.4)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeSessionPicker.svelte**
  ```css
  0 8px 32px rgba(0, 0, 0, 0.4),
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  ```

</details>

### `#16a34a` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  color: #16a34a;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #16a34a;
  ```

</details>

### `rgba(255, 255, 255, 0.3)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte**
  ```css
  border: 3px solid rgba(255, 255, 255, 0.3);
  ```
- **src/routes/onboarding/+page.svelte**
  ```css
  border: 3px solid rgba(255, 255, 255, 0.3);
  ```

</details>

### `#fee` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  background: #fee;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  background: #fee;
  ```

</details>

### `#fcc` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  border: 1px solid #fcc;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte**
  ```css
  border: 1px solid #fcc;
  ```

</details>

### `rgba(0, 0, 0, 0.8)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemeSettings.svelte**
  ```css
  background: rgba(0, 0, 0, 0.8);
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: rgba(0, 0, 0, 0.8);
  ```

</details>

### `#ff6347` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/TunnelControl.svelte**
  ```css
  color: #ff6347;
  ```
- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  color: #ff6347;
  ```

</details>

### `#a0a0a0` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/AuthStatus.svelte**
  ```css
  color: var(--text-secondary, #a0a0a0);
  ```
- **src/lib/client/shared/components/AuthStatus.svelte**
  ```css
  color: var(--text-secondary, #a0a0a0);
  ```

</details>

### `rgba(0, 0, 0, 0.95)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte**
  ```css
  background: rgba(0, 0, 0, 0.95);
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte**
  ```css
  background: rgba(0, 0, 0, 0.95);
  ```

</details>

### `rgba(46, 230, 107, 0.3)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte**
  ```css
  box-shadow: 0 2px 8px rgba(46, 230, 107, 0.3);
  ```
- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte**
  ```css
  box-shadow: 0 2px 8px rgba(46, 230, 107, 0.3);
  ```

</details>

### `rgba(46, 230, 107, 0.4)` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte**
  ```css
  box-shadow: 0 4px 12px rgba(46, 230, 107, 0.4);
  ```
- **src/routes/settings/+page.svelte**
  ```css
  border: 1px solid rgba(46, 230, 107, 0.4);
  ```

</details>

### `#56b6c2` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  cyan: getCssVar('--theme-ansi-cyan') || '#56b6c2';
  ```
- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  brightcyan: getCssVar('--theme-ansi-bright-cyan') || '#56b6c2';
  ```

</details>

### `#111` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
  ```

</details>

### `#00ccff` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: linear-gradient(45deg, #0066cc, #00ccff);
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: linear-gradient(45deg, #0066cc, #00ccff);
  ```

</details>

### `#777` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_session-tiles/+page.svelte**
  ```css
  background: #777;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #777;
  ```

</details>

### `#0088ff` (2 occurrences)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #0088ff;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border-color: #0088ff;
  ```

</details>

### `#111111` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  --surface: #111111;
  ```

</details>

### `#444444` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  --line: #444444;
  ```

</details>

### `rgba(0, 0, 0, 0)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  ```

</details>

### `rgba(255, 107, 107, 0.2)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css**
  ```css
  0 0 20px rgba(255, 107, 107, 0.2),
  ```

</details>

### `rgba(0, 0, 0, 0.06)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/utilities.css**
  ```css
  .shadow-md {
  	box-shadow:
  		0 4px 6px -1px rgba(0, 0, 0, 0.1),
  		0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  ```

</details>

### `#92b3a4` (1 occurrence)

**Suggested replacement:** `var(--muted)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --muted: light-dark(#8aa699, #92b3a4);
  ```

</details>

### `#1ea851` (1 occurrence)

**Suggested replacement:** `var(--primary-dim)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --primary-dim: #1ea851;
  ```

</details>

### `#2ee66b80` (1 occurrence)

**Suggested replacement:** `var(--primary-muted)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --primary-muted: #2ee66b80;
  ```

</details>

### `#ff8c42` (1 occurrence)

**Suggested replacement:** `var(--accent-warning)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css**
  ```css
  --accent-warning: #ff8c42;
  ```

</details>

### `rgba(0, 194, 255, 0.2)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeSessionPicker.svelte**
  ```css
  box-shadow: 0 0 0 2px rgba(0, 194, 255, 0.2);
  ```

</details>

### `rgba(0, 194, 255, 0.3)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeSessionPicker.svelte**
  ```css
  box-shadow: 0 0 10px rgba(0, 194, 255, 0.3);
  ```

</details>

### `rgba(0, 194, 255, 0.1)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeSessionPicker.svelte**
  ```css
  0 0 0 1px rgba(0, 194, 255, 0.1);
  ```

</details>

### `#fef2f2` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #fef2f2;
  ```

</details>

### `#fecaca` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border: 1px solid #fecaca;
  ```

</details>

### `#f0f9ff` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  background-color: #f0f9ff;
  ```

</details>

### `#bae6fd` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  border: 1px solid #bae6fd;
  ```

</details>

### `#0369a1` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #0369a1;
  ```

</details>

### `#0c4a6e` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte**
  ```css
  color: #0c4a6e;
  ```

</details>

### `#dc3545` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/AuthenticationSettingsSection.svelte**
  ```css
  color: var(--error-color, #dc3545);
  ```

</details>

### `#123` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/GlobalSettings.svelte**
  ```css
  placeholder="&#123;&#125;"
  ```

</details>

### `#125` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/GlobalSettings.svelte**
  ```css
  placeholder="&#123;&#125;"
  ```

</details>

### `#ff5f56` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  background: #ff5f56;
  ```

</details>

### `#ffbd2e` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  background: #ffbd2e;
  ```

</details>

### `#27c93f` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/ThemePreviewCard.svelte**
  ```css
  background: #27c93f;
  ```

</details>

### `rgba(46, 230, 107, 0.05)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/ClaudeAuth.svelte**
  ```css
  background: linear-gradient(135deg, rgba(46, 230, 107, 0.15), rgba(46, 230, 107, 0.05));
  ```

</details>

### `#22c55e` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  color: #22c55e;
  ```

</details>

### `rgba(255, 99, 71, 0.1)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  background: rgba(255, 99, 71, 0.1);
  ```

</details>

### `rgba(255, 99, 71, 0.3)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  border: 1px solid rgba(255, 99, 71, 0.3);
  ```

</details>

### `rgba(34, 197, 94, 0.1)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  background: rgba(34, 197, 94, 0.1);
  ```

</details>

### `rgba(59, 130, 246, 0.3)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte**
  ```css
  border: 1px solid rgba(59, 130, 246, 0.3);
  ```

</details>

### `#3a3a3a` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/AuthStatus.svelte**
  ```css
  border: 1px solid var(--border-color, #3a3a3a);
  ```

</details>

### `#e0e0e0` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/AuthStatus.svelte**
  ```css
  color: var(--text-primary, #e0e0e0);
  ```

</details>

### `#60a5fa` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/AuthStatus.svelte**
  ```css
  color: var(--accent-color, #60a5fa);
  ```

</details>

### `#00a8ff` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAUpdateNotification.svelte**
  ```css
  color: #00a8ff;
  ```

</details>

### `rgba(26, 26, 26, 0.9)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PublicUrlDisplay.svelte**
  ```css
  background: rgba(26, 26, 26, 0.9);
  ```

</details>

### `rgba(0, 255, 136, 0.15)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PublicUrlDisplay.svelte**
  ```css
  border: 1px solid rgba(0, 255, 136, 0.15);
  ```

</details>

### `rgba(255, 255, 255, 0.08)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  background: rgba(255, 255, 255, 0.08);
  ```

</details>

### `rgba(76, 222, 128, 0.1)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  background: rgba(76, 222, 128, 0.1);
  ```

</details>

### `rgba(76, 222, 128, 0.2)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  background: rgba(76, 222, 128, 0.2);
  ```

</details>

### `rgba(245, 158, 11, 0.1)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/TunnelIndicator.svelte**
  ```css
  background: rgba(245, 158, 11, 0.1);
  ```

</details>

### `rgba(46, 230, 107, 0.5)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte**
  ```css
  box-shadow: 0 4px 16px rgba(46, 230, 107, 0.5);
  ```

</details>

### `#0066cc40` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  border: 1px solid var(--primary-muted, #0066cc40);
  ```

</details>

### `rgba(0, 0, 0, 0.75)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  background: rgba(0, 0, 0, 0.75);
  ```

</details>

### `gray` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte**
  ```css
  <strong>Drag to resize:</strong> Click and drag the gray dividers between tiles to adjust
  ```

</details>

### `rgba(0, 0, 0, 0.03)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/terminal/MobileTerminalInput.svelte**
  ```css
  inset 0 1px 4px rgba(0, 0, 0, 0.03),
  ```

</details>

### `#2ee66b40` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/lib/client/terminal/TerminalPane.svelte**
  ```css
  selectionbackground: getCssVar('--theme-selection-bg') || '#2ee66b40';
  ```

</details>

### `#ddd` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/+page.svelte**
  ```css
  border: 1px solid var(--border-color, #ddd);
  ```

</details>

### `#cc3300` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  background: #cc3300;
  ```

</details>

### `#ff4411` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  border-color: #ff4411;
  ```

</details>

### `#00cc66` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/\_testing/\_tiles/+page.svelte**
  ```css
  color: #00cc66;
  ```

</details>

### `#ef4444` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/settings/+page.svelte**
  ```css
  color: var(--color-error, #ef4444);
  ```

</details>

### `rgba(239, 68, 68, 0.12)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/settings/+page.svelte**
  ```css
  background: rgba(239, 68, 68, 0.12);
  ```

</details>

### `rgba(239, 68, 68, 0.3)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/settings/+page.svelte**
  ```css
  border: 1px solid rgba(239, 68, 68, 0.3);
  ```

</details>

### `rgba(46, 230, 107, 0.12)` (1 occurrence)

**Suggested replacement:** Consider adding to design system

<details>
<summary>Show occurrences</summary>

- **src/routes/settings/+page.svelte**
  ```css
  background: rgba(46, 230, 107, 0.12);
  ```

</details>

## Hardcoded Spacing

Found 573 hardcoded spacing values:

### `1px` (78 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (bottom)
  ```css
  border-bottom: 1px solid var(--primary-dim);
  ```
- **src/lib/client/shared/styles/components/claude.css** (bottom)
  ```css
  border-bottom: 1px solid var(--primary-dim);
  ```
- **src/lib/client/shared/styles/components/claude.css** (bottom)
  ```css
  border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
  ```
- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
  ```
- **src/lib/client/shared/styles/components/menu-panel.css** (bottom)
  ```css
  border-bottom: 1px solid var(--surface-border);
  ```
- **src/lib/client/shared/styles/components/misc.css** (bottom)
  ```css
  border-bottom: 1px solid var(--surface-border);
  ```
- **src/lib/client/shared/styles/components/misc.css** (bottom)
  ```css
  border-bottom: 1px solid var(--surface-border);
  ```
- **src/lib/client/shared/styles/components/misc.css** (left)
  ```css
  text-align: left;
  ```
- **src/lib/client/shared/styles/components/modal.css** (top)
  ```css
  border-top: 1px solid var(--surface-border);
  ```
- **src/lib/client/shared/styles/components/modal.css** (bottom)
  ```css
  border-bottom: 1px solid var(--surface-border);
  ```

... and 68 more

</details>

### `1rem` (69 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css** (left)
  ```css
  left: -1rem;
  ```
- **src/lib/client/shared/styles/components/type-card.css** (padding)
  ```css
  padding: 1.5rem 1rem;
  ```
- **src/lib/client/shared/styles/components/type-card.css** (gap)
  ```css
  gap: 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 1rem 1.25rem;
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 1.5rem 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (margin)
  ```css
  margin: 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (margin)
  ```css
  margin-bottom: 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 1rem;
  ```

... and 59 more

</details>

### `0.5rem` (66 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/forms.css** (gap)
  ```css
  gap: 0.5rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (padding)
  ```css
  padding: 0.3rem 0.5rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (margin)
  ```css
  margin-right: 0.5rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (gap)
  ```css
  gap: 0.5rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (gap)
  ```css
  gap: 0.5rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (right)
  ```css
  margin-right: 0.5rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 0.5rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin: 0 0 0.5rem 0;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin-bottom: 0.5rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin-top: 0.5rem;
  ```

... and 56 more

</details>

### `8px` (45 occurrences)

**Suggested replacement:** `var(--space-2)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
  ```
- **src/lib/client/shared/styles/components/forms.css** (inset)
  ```css
  inset 0 0 20px color-mix(in oklab, var(--bg) 50%, black),
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 2px 8px;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (padding)
  ```css
  padding: 2px 8px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (top)
  ```css
  border-top-right-radius: 8px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (right)
  ```css
  border-top-right-radius: 8px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (bottom)
  ```css
  border-bottom-left-radius: 8px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (bottom)
  ```css
  border-bottom-left-radius: 8px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (left)
  ```css
  border-bottom-left-radius: 8px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (left)
  ```css
  border-bottom-left-radius: 8px;
  ```

... and 35 more

</details>

### `2rem` (45 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/forms.css** (margin)
  ```css
  margin-bottom: 2rem;
  ```
- **src/lib/client/shared/styles/components/forms.css** (bottom)
  ```css
  margin-bottom: 2rem;
  ```
- **src/lib/client/shared/styles/retro.css** (margin)
  ```css
  margin-bottom: 2rem;
  ```
- **src/lib/client/shared/styles/retro.css** (bottom)
  ```css
  margin-bottom: 2rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 2rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 2rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 3rem 2rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin-bottom: 2rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin-top: 2rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (top)
  ```css
  margin-top: 2rem;
  ```

... and 35 more

</details>

### `2px` (41 occurrences)

**Suggested replacement:** `var(--space-0)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
  ```
- **src/lib/client/shared/styles/components/menu-panel.css** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/shared/styles/components/misc.css** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/shared/styles/components/misc.css** (bottom)
  ```css
  border-bottom: 2px solid var(--surface-border);
  ```
- **src/lib/client/shared/styles/components/type-card.css** (inset)
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 2px 8px;
  ```
- **src/lib/client/shared/styles/retro.css** (inset)
  ```css
  box-shadow: inset 2px 0 0 color-mix(in oklab, var(--accent) 40%, transparent);
  ```
- **src/lib/client/shared/styles/retro.css** (inset)
  ```css
  inset 0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent),
  ```
- **src/lib/client/shared/styles/retro.css** (inset)
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
  ```
- **src/lib/client/shared/styles/retro.css** (inset)
  ```css
  0 0 0 2px var(--primary) inset,
  ```

... and 31 more

</details>

### `0.25rem` (34 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (gap)
  ```css
  gap: 0.25rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (right)
  ```css
  .status-bar-group.status-bar-right {
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (left)
  ```css
  .status-bar-group.status-bar-left,
  ```
- **src/lib/client/shared/styles/components/type-card.css** (gap)
  ```css
  gap: 0.25rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 0.25rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin-top: 0.25rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (top)
  ```css
  margin-top: 0.25rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (margin)
  ```css
  margin-top: 0.25rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (top)
  ```css
  margin-top: 0.25rem;
  ```
- **src/lib/client/shared/components/Input.svelte** (margin)
  ```css
  margin-right: 0.25rem;
  ```

... and 24 more

</details>

### `12px` (28 occurrences)

**Suggested replacement:** `var(--space-3)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (padding)
  ```css
  padding: 8px 12px;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (margin)
  ```css
  <div class="flex gap-2" style="margin-bottom: 12px;">
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (margin)
  ```css
  style="margin-bottom: 12px;"
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (margin)
  ```css
  margin: 0 0 12px 0;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (margin)
  ```css
  margin-bottom: 12px;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (gap)
  ```css
  <div class="flex gap-1">
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (gap)
  ```css
  <div class="flex-col gap-1">
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (bottom)
  ```css
  <div class="flex gap-2" style="margin-bottom: 12px;">
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (bottom)
  ```css
  style="margin-bottom: 12px;"
  ```

... and 18 more

</details>

### `1.5rem` (26 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/type-card.css** (padding)
  ```css
  padding: 1.5rem 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 1.5rem 1rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 0.75rem 1.5rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 1.5rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (margin)
  ```css
  margin-bottom: 1.5rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (bottom)
  ```css
  margin-bottom: 1.5rem;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (gap)
  ```css
  gap: 1.5rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (padding)
  ```css
  padding: 0.75rem 1.5rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (padding)
  ```css
  padding: 1.5rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (padding)
  ```css
  padding-left: 1.5rem;
  ```

... and 16 more

</details>

### `4px` (23 occurrences)

**Suggested replacement:** `var(--space-1)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
  ```
- **src/lib/client/shared/styles/components/misc.css** (left)
  ```css
  border-left: 4px solid var(--primary);
  ```
- **src/lib/client/shared/styles/components/misc.css** (left)
  ```css
  border-left: 4px solid var(--primary);
  ```
- **src/lib/client/settings/sections/WorkspaceEnvSettings.svelte** (padding)
  ```css
  padding: 2px 4px;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (padding)
  ```css
  padding: 4px 0;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (padding)
  ```css
  padding: 2px 4px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (margin)
  ```css
  margin: 4px 0 0 16px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (gap)
  ```css
  gap: 4px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (gap)
  ```css
  gap: 4px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (gap)
  ```css
  gap: 4px;
  ```

... and 13 more

</details>

### `0.75rem` (19 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 0.75rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 0.75rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 0.75rem;
  ```
- **src/lib/client/shared/styles/retro.css** (gap)
  ```css
  gap: 0.75rem;
  ```
- **src/lib/client/file-editor/FileEditorPane.svelte** (padding)
  ```css
  padding: 0.75rem 1rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 0.75rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 0.75rem 1.5rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (padding)
  ```css
  padding: 0.75rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (padding)
  ```css
  padding: 0.75rem 1.5rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (gap)
  ```css
  gap: 0.75rem;
  ```

... and 9 more

</details>

### `6px` (18 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/menu-panel.css** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/shared/styles/components/misc.css** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/activity-summaries/BashActivity.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/activity-summaries/EditActivity.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/activity-summaries/GrepActivity.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/claude/activity-summaries/WriteActivity.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (padding)
  ```css
  padding: 2px 6px;
  ```

... and 8 more

</details>

### `3px` (14 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css** (right)
  ```css
  border-color: var(--primary-bright);
  ```
- **src/lib/client/shared/styles/components/type-card.css** (inset)
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
  ```
- **src/lib/client/shared/styles/retro.css** (inset)
  ```css
  box-shadow: inset 2px 0 0 color-mix(in oklab, var(--accent) 40%, transparent);
  ```
- **src/lib/client/shared/styles/retro.css** (inset)
  ```css
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (top)
  ```css
  border-top: 3px solid white;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (top)
  ```css
  border-top: 3px solid #3b82f6;
  ```
- **src/lib/client/settings/RetentionSettings.svelte** (left)
  ```css
  border-left: 3px solid var(--primary);
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (left)
  ```css
  border-left: 3px solid var(--accent-amber);
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (left)
  ```css
  border-left: 3px solid color-mix(in oklab, var(--primary) 30%, transparent);
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (top)
  ```css
  border-top: 3px solid #0066cc;
  ```

... and 4 more

</details>

### `16px` (8 occurrences)

**Suggested replacement:** `var(--space-4)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/GitOperations.svelte** (padding)
  ```css
  padding: 16px;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (padding)
  ```css
  padding: 16px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (margin)
  ```css
  margin: 4px 0 0 16px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (margin)
  ```css
  margin-top: 16px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (top)
  ```css
  margin-top: 16px;
  ```
- **src/routes/\_testing/+page.svelte** (padding)
  ```css
  padding: 16px;
  ```
- **src/routes/\_testing/+page.svelte** (margin)
  ```css
  margin-left: 16px;
  ```
- **src/routes/\_testing/+page.svelte** (left)
  ```css
  margin-left: 16px;
  ```

</details>

### `3rem` (7 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte** (padding)
  ```css
  padding: 3rem 2rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (padding)
  ```css
  padding: 3rem 2rem;
  ```
- **src/lib/client/settings/AuthenticationSettingsSection.svelte** (padding)
  ```css
  padding: 3rem;
  ```
- **src/lib/client/settings/AuthenticationSettingsSection.svelte** (padding)
  ```css
  padding: 3rem;
  ```
- **src/lib/client/settings/sections/TerminalKeySettings.svelte** (padding)
  ```css
  padding-right: 3rem; /* Space for toggle button */
  ```
- **src/lib/client/settings/sections/TerminalKeySettings.svelte** (right)
  ```css
  padding-right: 3rem; /* Space for toggle button */
  ```
- **src/routes/onboarding/+page.svelte** (padding)
  ```css
  padding: 3rem;
  ```

</details>

### `0.4rem` (5 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (padding)
  ```css
  padding: 0.4rem 0.6rem;
  ```
- **src/lib/client/shared/components/Shell.svelte** (padding)
  ```css
  padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
  ```
- **src/lib/client/shared/components/Shell.svelte** (bottom)
  ```css
  padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (padding)
  ```css
  padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (bottom)
  ```css
  padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
  ```

</details>

### `20px` (5 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (bottom)
  ```css
  bottom: 20px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (top)
  ```css
  top: 20px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (right)
  ```css
  right: 20px;
  ```
- **src/lib/client/shared/components/WorktreeManager.svelte** (padding)
  ```css
  padding: 20px;
  ```
- **src/routes/+page.svelte** (right)
  ```css
  filter: brightness(1);
  ```

</details>

### `40px` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
  ```
- **src/lib/client/shared/components/Header.svelte** (gap)
  ```css
  <div class="flex gap-3">
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (gap)
  ```css
  class="flex flex-wrap gap-2 m-3 {staticMode ? 'static' : ''}"
  ```
- **src/routes/+page.svelte** (right)
  ```css
  filter: brightness(1);
  ```

</details>

### `1.25rem` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 1rem 1.25rem;
  ```
- **src/lib/client/shared/styles/retro.css** (padding)
  ```css
  padding: 1.25rem;
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (padding)
  ```css
  padding-left: 1.25rem;
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (left)
  ```css
  padding-left: 1.25rem;
  ```

</details>

### `4rem` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (padding)
  ```css
  padding: 4rem 2rem;
  ```
- **src/routes/settings/+page.svelte** (padding)
  ```css
  padding: 4rem 2rem;
  ```
- **src/routes/settings/+page.svelte** (padding)
  ```css
  padding: 4rem 2rem;
  ```

</details>

### `10px` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (top)
  ```css
  top: 10px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (right)
  ```css
  right: 10px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (left)
  ```css
  left: 10px;
  ```

</details>

### `0.3rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (padding)
  ```css
  padding: 0.3rem 0.5rem;
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (padding)
  ```css
  padding: 0.1rem 0.3rem;
  ```

</details>

### `200px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (gap)
  ```css
  <div class="flex gap-4 flex-wrap">
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (gap)
  ```css
  <div class="flex gap-4 flex-wrap">
  ```

</details>

### `2.5rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/SessionCard.svelte** (gap)
  ```css
  <div class="title-text text-base flex items-center gap-2">{session.title} ({sessionId})</div>
  ```
- **src/lib/client/shared/components/SessionCard.svelte** (top)
  ```css
  e.stopPropagation();
  ```

</details>

### `0.375rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (padding)
  ```css
  padding: 0.125rem 0.375rem;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (padding)
  ```css
  padding: 0.375rem;
  ```

</details>

### `769px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/MobileNavigation.svelte** (top)
  ```css
  /* Hide on desktop */
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (top)
  ```css
  /* Hide on desktop */
  ```

</details>

### `36px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/terminal/MobileTerminalInput.svelte** (padding)
  ```css
  padding 0.15s ease;
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (left)
  ```css
  .left-keys :global(.button) {
  ```

</details>

### `300px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css** (top)
  ```css
  @keyframes desktop-to-mobile {
  ```

</details>

### `24px` (1 occurrence)

**Suggested replacement:** `var(--space-5)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (inset)
  ```css
  inset 0 2px 4px color-mix(in oklab, var(--accent-cyan) 15%, transparent),
  ```

</details>

### `0.6rem` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (padding)
  ```css
  padding: 0.4rem 0.6rem;
  ```

</details>

### `768px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudePane.svelte** (right)
  ```css
  text-align: right;
  ```

</details>

### `38px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/TerminalKeySettings.svelte** (top)
  ```css
  top: 38px; /* Align with input field after label */
  ```

</details>

### `600px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte** (top)
  ```css
  {tunnelStatus.running ? 'Running' : 'Stopped'}
  ```

</details>

### `520px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/CreateSessionModal.svelte** (gap)
  ```css
  <div class="modal-content p-5 flex flex-col gap-4">
  ```

</details>

### `0.875rem` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/GitOperations.svelte** (gap)
  ```css
  <div class="git-info flex gap-2" style="font-size: 0.875rem;">
  ```

</details>

### `0.1rem` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (padding)
  ```css
  padding: 0.1rem 0.3rem;
  ```

</details>

### `0.2rem` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (margin)
  ```css
  margin: 0 0.2rem;
  ```

</details>

### `0.125rem` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (padding)
  ```css
  padding: 0.125rem 0.375rem;
  ```

</details>

### `56px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (inset)
  ```css
  padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
  ```

</details>

### `60px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/terminal/MobileTerminalInput.svelte** (right)
  ```css
  .right-keys :global(.button) {
  ```

</details>

### `25px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/routes/+page.svelte** (right)
  ```css
  filter: brightness(1.1);
  ```

</details>

### `50px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/routes/+page.svelte** (right)
  ```css
  filter: brightness(1.1);
  ```

</details>

### `75px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/routes/+page.svelte** (right)
  ```css
  filter: brightness(1.1);
  ```

</details>

## Hardcoded Sizes

Found 708 hardcoded size values:

### `768px` (44 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/components/claude.css** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 768px) and (orientation: landscape) {
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 768px) and (orientation: landscape) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 768px) {
  ```

... and 34 more

</details>

### `0.875rem` (35 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/buttons.css** (font-size)
  ```css
  font-size: 0.875rem;
  ```
- **src/lib/client/shared/styles/components/buttons.css** (font-size)
  ```css
  font-size: 0.875rem;
  ```
- **src/lib/client/shared/styles/components/forms.css** (font-size)
  ```css
  font-size: 0.875rem;
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 768px) and (orientation: landscape) {
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/styles/retro.css** (min-width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 768px) and (orientation: landscape) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/styles/utilities.css** (font-size)
  ```css
  .text-sm {
  	font-size: 0.875rem;
  }
  ```
- **src/lib/client/file-editor/FileEditorPane.svelte** (font-size)
  ```css
  font-size: 0.875rem;
  ```

... and 25 more

</details>

### `1rem` (35 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 1rem;
  ```
- **src/lib/client/shared/styles/utilities.css** (width)
  ```css
  .w-4 {
  	width: 1rem;
  }
  ```
- **src/lib/client/shared/styles/utilities.css** (height)
  ```css
  .h-4 {
  	height: 1rem;
  }
  ```
- **src/lib/client/shared/styles/utilities.css** (font-size)
  ```css
  .text-base {
  	font-size: 1rem;
  }
  ```
- **src/lib/client/claude/ClaudePane.svelte** (font-size)
  ```css
  font-size: 1rem;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (font-size)
  ```css
  font-size: 1rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 1rem;
  ```

... and 25 more

</details>

### `40px` (34 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (width)
  ```css
  min-width: 40px;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (min-width)
  ```css
  min-width: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  min-width: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  min-width: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (height)
  ```css
  min-height: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (height)
  ```css
  min-height: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (min-width)
  ```css
  min-width: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (min-width)
  ```css
  min-width: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (min-height)
  ```css
  min-height: 40px;
  ```
- **src/lib/client/shared/styles/retro.css** (min-height)
  ```css
  min-height: 40px;
  ```

... and 24 more

</details>

### `32px` (28 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (width)
  ```css
  width: 32px;
  ```
- **src/lib/client/shared/styles/components/claude.css** (height)
  ```css
  height: 32px;
  ```
- **src/lib/client/shared/styles/components/misc.css** (width)
  ```css
  min-width: 32px;
  ```
- **src/lib/client/shared/styles/components/misc.css** (height)
  ```css
  height: 32px;
  ```
- **src/lib/client/shared/styles/components/misc.css** (min-width)
  ```css
  min-width: 32px;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (width)
  ```css
  width: 32px;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (height)
  ```css
  height: 32px;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (width)
  ```css
  width: 32px;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (height)
  ```css
  height: 32px;
  ```
- **src/lib/client/settings/AuthenticationSettings.svelte** (width)
  ```css
  width: 32px;
  ```

... and 18 more

</details>

### `0.75rem` (28 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 0.75rem;
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (font-size)
  ```css
  font-size: 0.75rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-0: 0.75rem;
  ```
- **src/lib/client/shared/styles/utilities.css** (font-size)
  ```css
  .text-xs {
  	font-size: 0.75rem;
  }
  ```
- **src/lib/client/claude/components/MessageList.svelte** (font-size)
  ```css
  font-size: 0.75rem;
  ```
- **src/lib/client/shared/components/AppVersion.svelte** (font-size)
  ```css
  font-size: 0.75rem;
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (font-size)
  ```css
  font-size: 0.75rem;
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (font-size)
  ```css
  font-size: 0.75rem;
  ```

... and 18 more

</details>

### `0.9rem` (23 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/shared/styles/components/forms.css** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/settings/sections/ClaudeDefaults.svelte** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/settings/sections/TunnelControl.svelte** (font-size)
  ```css
  font-size: 0.9rem;
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (font-size)
  ```css
  font-size: 0.9rem;
  ```

... and 13 more

</details>

### `400px` (22 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 400px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 400px) {
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (height)
  ```css
  max-height: 400px;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (max-height)
  ```css
  max-height: 400px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (width)
  ```css
  max-width: 400px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (max-width)
  ```css
  max-width: 400px;
  ```
- **src/lib/client/settings/PreferencesPanel.svelte** (width)
  ```css
  max-width: 400px;
  ```
- **src/lib/client/settings/PreferencesPanel.svelte** (max-width)
  ```css
  max-width: 400px;
  ```
- **src/lib/client/settings/ThemeSettings.svelte** (width)
  ```css
  max-width: 400px;
  ```
- **src/lib/client/settings/ThemeSettings.svelte** (max-width)
  ```css
  max-width: 400px;
  ```

... and 12 more

</details>

### `24px` (21 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (width)
  ```css
  width: 24px;
  ```
- **src/lib/client/shared/styles/components/claude.css** (width)
  ```css
  width: 24px;
  ```
- **src/lib/client/shared/styles/components/claude.css** (height)
  ```css
  height: 24px;
  ```
- **src/lib/client/shared/styles/components/claude.css** (height)
  ```css
  height: 24px;
  ```
- **src/lib/client/settings/GlobalSettingsSection.svelte** (width)
  ```css
  width: 24px;
  ```
- **src/lib/client/settings/GlobalSettingsSection.svelte** (height)
  ```css
  height: 24px;
  ```
- **src/lib/client/settings/ThemeSettings.svelte** (font-size)
  ```css
  font-size: 24px;
  ```
- **src/lib/client/settings/sections/ClaudeDefaults.svelte** (height)
  ```css
  min-height: 24px;
  ```
- **src/lib/client/settings/sections/ClaudeDefaults.svelte** (min-height)
  ```css
  min-height: 24px;
  ```
- **src/lib/client/settings/sections/StorageSettings.svelte** (height)
  ```css
  min-height: 24px;
  ```

... and 11 more

</details>

### `44px` (18 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeHeader.svelte** (height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (min-height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (min-height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (min-height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (min-height)
  ```css
  min-height: 44px;
  ```
- **src/lib/client/shared/components/SettingField.svelte** (height)
  ```css
  min-height: 44px; /* WCAG touch target */
  ```
- **src/lib/client/shared/components/SettingField.svelte** (min-height)
  ```css
  min-height: 44px; /* WCAG touch target */
  ```

... and 8 more

</details>

### `120px` (16 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeHeader.svelte** (width)
  ```css
  max-width: 120px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (max-width)
  ```css
  max-width: 120px;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (width)
  ```css
  min-width: 120px;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (min-width)
  ```css
  min-width: 120px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (height)
  ```css
  min-height: 120px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (min-height)
  ```css
  min-height: 120px;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (width)
  ```css
  min-width: 120px;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (min-width)
  ```css
  min-width: 120px;
  ```
- **src/lib/client/shared/components/workspace/SessionHeader.svelte** (width)
  ```css
  max-width: 120px;
  ```
- **src/lib/client/shared/components/workspace/SessionHeader.svelte** (max-width)
  ```css
  max-width: 120px;
  ```

... and 6 more

</details>

### `1.5rem` (15 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/buttons.css** (width)
  ```css
  width: 1.5rem;
  ```
- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-5: 1.5rem;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/shared/components/AuthStatus.svelte** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/shared/components/BrandLogo.svelte** (font-size)
  ```css
  font-size: 1.5rem;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (font-size)
  ```css
  font-size: 1.5rem;
  ```

... and 5 more

</details>

### `0.85rem` (15 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/shared/styles/components/type-card.css** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-1: 0.85rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/settings/sections/ClaudeDefaults.svelte** (font-size)
  ```css
  font-size: 0.85rem;
  ```
- **src/lib/client/settings/sections/TunnelControl.svelte** (font-size)
  ```css
  font-size: 0.85rem;
  ```

... and 5 more

</details>

### `20px` (14 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/menu-panel.css** (width)
  ```css
  min-width: 20px;
  ```
- **src/lib/client/shared/styles/components/menu-panel.css** (min-width)
  ```css
  min-width: 20px;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (width)
  ```css
  min-width: 20px;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (min-width)
  ```css
  min-width: 20px;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (width)
  ```css
  width: 20px;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (height)
  ```css
  height: 20px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (width)
  ```css
  width: 20px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (height)
  ```css
  height: 20px;
  ```
- **src/lib/client/settings/sections/WorkspaceEnvSettings.svelte** (width)
  ```css
  min-width: 20px;
  ```
- **src/lib/client/settings/sections/WorkspaceEnvSettings.svelte** (min-width)
  ```css
  min-width: 20px;
  ```

... and 4 more

</details>

### `480px` (14 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/Shell.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/Shell.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```

... and 4 more

</details>

### `48px` (14 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudePane.svelte** (width)
  ```css
  width: 48px;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (height)
  ```css
  height: 48px;
  ```
- **src/lib/client/claude/ClaudeProjectPicker.svelte** (width)
  ```css
  min-width: 48px;
  ```
- **src/lib/client/claude/ClaudeProjectPicker.svelte** (min-width)
  ```css
  min-width: 48px;
  ```
- **src/lib/client/claude/ClaudeSessionPicker.svelte** (width)
  ```css
  min-width: 48px;
  ```
- **src/lib/client/claude/ClaudeSessionPicker.svelte** (min-width)
  ```css
  min-width: 48px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (width)
  ```css
  width: 48px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (height)
  ```css
  min-height: 48px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (height)
  ```css
  height: 48px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (min-height)
  ```css
  min-height: 48px;
  ```

... and 4 more

</details>

### `2px` (13 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/settings/AuthenticationSettings.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/settings/GlobalSettings.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/settings/ThemeSettings.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/settings/sections/OAuthSettings.svelte** (width)
  ```css
  border-width: 2px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  border-width: 2px;
  ```

... and 3 more

</details>

### `16px` (13 occurrences)

**Suggested replacement:** `var(--font-size-2)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 16px;
  ```
- **src/lib/client/shared/styles/variables.css** (font-size)
  ```css
  --font-size-2: 16px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (font-size)
  ```css
  font-size: 16px; /* Prevents iOS zoom on focus */
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (height)
  ```css
  height: 16px;
  ```
- **src/lib/client/shared/components/AugButton.svelte** (width)
  ```css
  width: 16px;
  ```
- **src/lib/client/shared/components/AugButton.svelte** (height)
  ```css
  height: 16px;
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (font-size)
  ```css
  font-size: 16px; /* Prevent zoom on iOS */
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  width: 16px;
  ```

... and 3 more

</details>

### `1.1rem` (12 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/styles/components/modal.css** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/styles/components/type-card.css** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/components/ConfirmationDialog.svelte** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (font-size)
  ```css
  font-size: 1.1rem;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (font-size)
  ```css
  font-size: 1.1rem;
  ```

... and 2 more

</details>

### `100px` (12 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/session-card.css** (height)
  ```css
  min-height: 100px;
  ```
- **src/lib/client/shared/styles/components/session-card.css** (min-height)
  ```css
  min-height: 100px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (width)
  ```css
  max-width: 100px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (max-width)
  ```css
  max-width: 100px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (height)
  ```css
  min-height: 100px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (min-height)
  ```css
  min-height: 100px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (height)
  ```css
  min-height: 100px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (min-height)
  ```css
  min-height: 100px;
  ```
- **src/lib/client/shared/components/workspace/SessionHeader.svelte** (width)
  ```css
  max-width: 100px;
  ```
- **src/lib/client/shared/components/workspace/SessionHeader.svelte** (max-width)
  ```css
  max-width: 100px;
  ```

... and 2 more

</details>

### `60px` (12 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeSessionPicker.svelte** (max-height)
  ```css
  max-height: calc(45vh - 60px);
  ```
- **src/lib/client/claude/components/InputArea.svelte** (height)
  ```css
  min-height: 60px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (min-height)
  ```css
  min-height: 60px;
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (min-height)
  ```css
  min-height: calc(100% - 60px);
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (width)
  ```css
  min-width: 60px;
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (min-width)
  ```css
  min-width: 60px;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (width)
  ```css
  min-width: 60px;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (min-width)
  ```css
  min-width: 60px;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (width)
  ```css
  min-width: 60px;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (min-width)
  ```css
  min-width: 60px;
  ```

... and 2 more

</details>

### `0.9em` (11 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/BashActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GlobActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GlobActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/claude/activity-summaries/GrepActivity.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (font-size)
  ```css
  font-size: 0.9em;
  ```

... and 1 more

</details>

### `1.125rem` (11 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 400px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 400px) {
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-4: 1.125rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (font-size)
  ```css
  font-size: 1.125rem;
  ```

... and 1 more

</details>

### `8px` (10 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeHeader.svelte** (width)
  ```css
  width: 8px;
  ```
- **src/lib/client/claude/ClaudeHeader.svelte** (height)
  ```css
  height: 8px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (width)
  ```css
  width: 8px;
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (width)
  ```css
  width: 8px;
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (height)
  ```css
  height: 8px;
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (width)
  ```css
  width: 8px;
  ```
- **src/lib/client/shared/components/workspace/SessionHeader.svelte** (width)
  ```css
  width: 8px;
  ```
- **src/lib/client/shared/components/workspace/SessionHeader.svelte** (height)
  ```css
  height: 8px;
  ```
- **src/lib/client/terminal/TerminalHeader.svelte** (width)
  ```css
  width: 8px;
  ```
- **src/lib/client/terminal/TerminalHeader.svelte** (height)
  ```css
  height: 8px;
  ```

</details>

### `80px` (10 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/components/InputArea.svelte** (width)
  ```css
  min-width: 80px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (height)
  ```css
  min-height: 80px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (min-width)
  ```css
  min-width: 80px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (min-height)
  ```css
  min-height: 80px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (width)
  ```css
  width: 80px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (height)
  ```css
  height: 80px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (height)
  ```css
  min-height: 80px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (min-height)
  ```css
  min-height: 80px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (max-width)
  ```css
  @media (max-width: 768px) {
  ```

</details>

### `640px` (10 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/shared/components/TunnelIndicator.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/routes/onboarding/+page.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/routes/onboarding/+page.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```

</details>

### `1px` (9 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css** (height)
  ```css
  height: 1px;
  ```
- **src/lib/client/shared/styles/utilities.css** (width)
  ```css
  .border {
  	border-width: 1px;
  	border-style: solid;
  }
  ```
- **src/lib/client/shared/styles/utilities.css** (width)
  ```css
  .border-b {
  	border-bottom-width: 1px;
  	border-bottom-style: solid;
  }
  ```
- **src/lib/client/shared/styles/utilities.css** (width)
  ```css
  width: 1px;
  ```
- **src/lib/client/shared/styles/utilities.css** (height)
  ```css
  height: 1px;
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (height)
  ```css
  <div class="flex-grow bg-surface-border" style="height: 1px;"></div>
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (height)
  ```css
  <div class="flex-grow bg-surface-border" style="height: 1px;"></div>
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  width: 1px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (height)
  ```css
  height: 1px;
  ```

</details>

### `2rem` (9 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 2rem;
  ```
- **src/lib/client/shared/styles/components/type-card.css** (font-size)
  ```css
  font-size: 2rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 2rem;
  ```
- **src/lib/client/settings/AuthenticationSettingsSection.svelte** (width)
  ```css
  width: 2rem;
  ```
- **src/lib/client/settings/AuthenticationSettingsSection.svelte** (height)
  ```css
  height: 2rem;
  ```
- **src/lib/client/settings/sections/TerminalKeySettings.svelte** (width)
  ```css
  width: 2rem;
  ```
- **src/lib/client/settings/sections/TerminalKeySettings.svelte** (height)
  ```css
  height: 2rem;
  ```
- **src/lib/client/shared/components/AuthStatus.svelte** (font-size)
  ```css
  font-size: 2rem;
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (font-size)
  ```css
  font-size: 2rem;
  ```

</details>

### `1.25rem` (9 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1.25rem;
  ```
- **src/lib/client/shared/styles/components/misc.css** (font-size)
  ```css
  font-size: 1.25rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-4: 1.25rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-5: 1.25rem;
  ```
- **src/lib/client/settings/sections/HomeDirectoryManager.svelte** (font-size)
  ```css
  font-size: 1.25rem;
  ```
- **src/lib/client/settings/sections/OAuthSettings.svelte** (font-size)
  ```css
  font-size: 1.25rem;
  ```
- **src/lib/client/settings/sections/OAuthSettings.svelte** (font-size)
  ```css
  font-size: 1.25rem;
  ```
- **src/lib/client/shared/components/BrandLogo.svelte** (font-size)
  ```css
  font-size: 1.25rem;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (font-size)
  ```css
  font-size: 1.25rem;
  ```

</details>

### `12px` (9 occurrences)

**Suggested replacement:** `var(--font-size-0)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css** (font-size)
  ```css
  --font-size-0: 12px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (width)
  ```css
  width: 12px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (height)
  ```css
  height: 12px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (width)
  ```css
  width: 12px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (height)
  ```css
  height: 12px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (font-size)
  ```css
  font-size: 12px;
  ```
- **src/lib/client/settings/sections/StorageSettings.svelte** (height)
  ```css
  height: 12px;
  ```

</details>

### `36px` (9 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/components/MessageList.svelte** (width)
  ```css
  width: 36px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (height)
  ```css
  height: 36px;
  ```
- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte** (height)
  ```css
  height: 36px;
  ```
- **src/lib/client/shared/components/workspace/CreateSessionButton.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (width)
  ```css
  min-width: 36px;
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (height)
  ```css
  min-height 0.15s ease,
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (min-width)
  ```css
  min-width: 36px;
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (min-height)
  ```css
  min-height 0.15s ease,
  ```

</details>

### `0.8rem` (8 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/lib/client/shared/styles/components/claude.css** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (font-size)
  ```css
  font-size: 0.8rem;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (font-size)
  ```css
  font-size: 0.8rem;
  ```

</details>

### `200px` (8 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/activity-summaries/GlobActivity.svelte** (height)
  ```css
  max-height: 200px;
  ```
- **src/lib/client/claude/activity-summaries/GlobActivity.svelte** (max-height)
  ```css
  max-height: 200px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (height)
  ```css
  max-height: 200px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (max-height)
  ```css
  max-height: 200px;
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (width)
  ```css
  <div class="flex-1" style="min-width: 200px;">
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (width)
  ```css
  <div class="flex-1" style="min-width: 200px;">
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (min-width)
  ```css
  <div class="flex-1" style="min-width: 200px;">
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (min-width)
  ```css
  <div class="flex-1" style="min-width: 200px;">
  ```

</details>

### `500px` (8 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte** (width)
  ```css
  max-width: 500px;
  ```
- **src/lib/client/onboarding/AuthenticationStep.svelte** (max-width)
  ```css
  max-width: 500px;
  ```
- **src/lib/client/shared/components/workspace/LayoutControls.svelte** (width)
  ```css
  @media (max-width: 500px) {
  ```
- **src/lib/client/shared/components/workspace/LayoutControls.svelte** (max-width)
  ```css
  @media (max-width: 500px) {
  ```
- **src/routes/auth/callback/+page.svelte** (width)
  ```css
  max-width: 500px;
  ```
- **src/routes/auth/callback/+page.svelte** (max-width)
  ```css
  max-width: 500px;
  ```
- **src/routes/onboarding/+page.svelte** (width)
  ```css
  max-width: 500px;
  ```
- **src/routes/onboarding/+page.svelte** (max-width)
  ```css
  max-width: 500px;
  ```

</details>

### `0.5rem` (7 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/Input.svelte** (font-size)
  ```css
  font-size: 0.5rem;
  ```
- **src/lib/client/shared/components/Input.svelte** (font-size)
  ```css
  font-size: 0.5rem;
  ```
- **src/lib/client/shared/components/Input.svelte** (font-size)
  ```css
  font-size: 0.5rem;
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (width)
  ```css
  <div class="flex gap-2 mobile-full-width" style="margin-top: 0.5rem;">
  ```
- **src/lib/client/shared/components/PWAInstallPrompt.svelte** (width)
  ```css
  <div class="flex gap-2 mobile-full-width" style="margin-top: 0.5rem;">
  ```

</details>

### `10px` (7 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  width: 10px;
  ```
- **src/lib/client/shared/styles/retro.css** (height)
  ```css
  height: 10px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (width)
  ```css
  width: 10px;
  ```
- **src/lib/client/claude/components/MessageList.svelte** (height)
  ```css
  height: 10px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (font-size)
  ```css
  font-size: 10px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```

</details>

### `3px` (6 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css** (width)
  ```css
  border-width: 3px;
  ```
- **src/lib/client/claude/ClaudePane.svelte** (width)
  ```css
  border-width: 3px;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (width)
  ```css
  border-width: 3px;
  ```
- **src/lib/client/settings/AuthenticationSettings.svelte** (width)
  ```css
  border-width: 3px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  border-width: 3px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  border-width: 3px;
  ```

</details>

### `1200px` (6 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  max-width: 1200px;
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  max-width: 1200px;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (width)
  ```css
  max-width: 1200px;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (max-width)
  ```css
  max-width: 1200px;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (width)
  ```css
  max-width: 1200px;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (max-width)
  ```css
  max-width: 1200px;
  ```

</details>

### `769px` (6 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/styles/retro.css** (min-width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/components/workspace/MobileNavigation.svelte** (width)
  ```css
  @media (min-width: 769px) {
  ```
- **src/lib/client/shared/components/workspace/MobileNavigation.svelte** (min-width)
  ```css
  @media (min-width: 769px) {
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (width)
  ```css
  @media (min-width: 769px) {
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (min-width)
  ```css
  @media (min-width: 769px) {
  ```

</details>

### `0.95rem` (6 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-2: 0.95rem;
  ```
- **src/lib/client/claude/components/InputArea.svelte** (font-size)
  ```css
  font-size: 0.95rem;
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (font-size)
  ```css
  font-size: 0.95rem;
  ```
- **src/lib/client/settings/sections/ClaudeAuth.svelte** (font-size)
  ```css
  font-size: 0.95rem;
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (font-size)
  ```css
  font-size: 0.95rem;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (font-size)
  ```css
  font-size: 0.95rem;
  ```

</details>

### `28px` (6 occurrences)

**Suggested replacement:** `var(--font-size-5)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css** (font-size)
  ```css
  --font-size-5: 28px;
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (width)
  ```css
  width: 28px;
  ```
- **src/lib/client/shared/components/DirectoryBrowser.svelte** (height)
  ```css
  height: 28px;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (width)
  ```css
  @media (max-width: 640px) {
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (height)
  ```css
  height: 28px;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (max-width)
  ```css
  @media (max-width: 640px) {
  ```

</details>

### `300px` (6 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/activity-summaries/BashActivity.svelte** (height)
  ```css
  max-height: 300px;
  ```
- **src/lib/client/claude/activity-summaries/BashActivity.svelte** (max-height)
  ```css
  max-height: 300px;
  ```
- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte** (width)
  ```css
  max-width: 300px;
  ```
- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte** (max-width)
  ```css
  max-width: 300px;
  ```
- **src/routes/console/+page.svelte** (height)
  ```css
  max-height: 300px;
  ```
- **src/routes/console/+page.svelte** (max-height)
  ```css
  max-height: 300px;
  ```

</details>

### `4px` (6 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (width)
  ```css
  outline-width: 4px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  border-width: 4px;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (width)
  ```css
  width: 4px;
  ```
- **src/routes/\_testing/\_session-tiles/+page.svelte** (height)
  ```css
  height: 4px;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (width)
  ```css
  width: 4px;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (height)
  ```css
  height: 4px;
  ```

</details>

### `1024px` (5 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/styles/retro.css** (min-width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (min-width: 769px) and (max-width: 1024px) {
  ```
- **src/routes/settings/+page.svelte** (width)
  ```css
  @media (max-width: 1024px) {
  ```
- **src/routes/settings/+page.svelte** (max-width)
  ```css
  @media (max-width: 1024px) {
  ```

</details>

### `6px` (5 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeProjectPicker.svelte** (width)
  ```css
  width: 6px;
  ```
- **src/lib/client/claude/ClaudeSessionPicker.svelte** (width)
  ```css
  width: 6px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  width: 6px;
  ```
- **src/lib/client/shared/components/LoadingSpinner.svelte** (height)
  ```css
  height: 6px;
  ```
- **src/lib/client/terminal/MobileTerminalInput.svelte** (width)
  ```css
  width: 6px;
  ```

</details>

### `900px` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  max-width: 900px;
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  max-width: 900px;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (width)
  ```css
  max-width: 900px;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (max-width)
  ```css
  max-width: 900px;
  ```

</details>

### `2.5rem` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  width: 2.5rem;
  ```
- **src/lib/client/shared/styles/retro.css** (height)
  ```css
  height: 2.5rem;
  ```
- **src/lib/client/shared/components/SessionCard.svelte** (height)
  ```css
  min-height: 2.5rem;
  ```
- **src/lib/client/shared/components/SessionCard.svelte** (min-height)
  ```css
  min-height: 2.5rem;
  ```

</details>

### `14px` (4 occurrences)

**Suggested replacement:** `var(--font-size-1)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css** (font-size)
  ```css
  --font-size-1: 14px;
  ```
- **src/lib/client/settings/ThemePreviewCard.svelte** (font-size)
  ```css
  font-size: 14px;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (width)
  ```css
  width: 14px;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (height)
  ```css
  height: 14px;
  ```

</details>

### `600px` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (width)
  ```css
  max-width: 600px;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (max-width)
  ```css
  max-width: 600px;
  ```
- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte** (width)
  ```css
  max-width: 600px;
  ```
- **src/lib/client/settings/sections/VSCodeTunnelControl.svelte** (max-width)
  ```css
  max-width: 600px;
  ```

</details>

### `140px` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (width)
  ```css
  min-width: 140px;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (min-width)
  ```css
  min-width: 140px;
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (width)
  ```css
  min-width: 140px;
  ```
- **src/lib/client/shared/components/HelpModal.svelte** (min-width)
  ```css
  min-width: 140px;
  ```

</details>

### `320px` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/ConfirmationDialog.svelte** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/components/ConfirmationDialog.svelte** (max-width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/routes/+page.svelte** (width)
  ```css
  min-width: 320px;
  ```
- **src/routes/+page.svelte** (min-width)
  ```css
  min-width: 320px;
  ```

</details>

### `150px` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (width)
  ```css
  min-width: 150px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (min-width)
  ```css
  min-width: 150px;
  ```
- **src/routes/console/+page.svelte** (width)
  ```css
  min-width: 150px;
  ```
- **src/routes/console/+page.svelte** (min-width)
  ```css
  min-width: 150px;
  ```

</details>

### `0.4rem` (4 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/Shell.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/Shell.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (max-width)
  ```css
  @media (max-width: 480px) {
  ```

</details>

### `1.2rem` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/buttons.css** (font-size)
  ```css
  font-size: 1.2rem;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 1.2rem;
  ```
- **src/lib/client/shared/components/ConfirmationDialog.svelte** (font-size)
  ```css
  font-size: 1.2rem;
  ```

</details>

### `0.85em` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 0.85em;
  ```
- **src/lib/client/claude/activity-summaries/GenericActivity.svelte** (font-size)
  ```css
  font-size: 0.85em;
  ```
- **src/lib/client/shared/components/LiveIconStrip.svelte** (font-size)
  ```css
  font-size: 0.85em;
  ```

</details>

### `0.75em` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/activity-summaries/BashActivity.svelte** (font-size)
  ```css
  font-size: 0.75em;
  ```
- **src/lib/client/claude/activity-summaries/EditActivity.svelte** (font-size)
  ```css
  font-size: 0.75em;
  ```
- **src/lib/client/claude/activity-summaries/WriteActivity.svelte** (font-size)
  ```css
  font-size: 0.75em;
  ```

</details>

### `1.75rem` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 1.75rem;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (font-size)
  ```css
  font-size: 1.75rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (font-size)
  ```css
  font-size: 1.75rem;
  ```

</details>

### `0.7rem` (3 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/SessionCard.svelte** (font-size)
  ```css
  font-size: 0.7rem;
  ```
- **src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte** (font-size)
  ```css
  font-size: 0.7rem;
  ```
- **src/routes/\_testing/\_tiles/+page.svelte** (font-size)
  ```css
  font-size: 0.7rem;
  ```

</details>

### `1em` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/animations.css** (width)
  ```css
  width: 1em;
  ```
- **src/lib/client/shared/styles/animations.css** (height)
  ```css
  height: 1em;
  ```

</details>

### `1.1em` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/forms.css** (font-size)
  ```css
  font-size: 1.1em;
  ```
- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 1.1em;
  ```

</details>

### `0.3rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/components/status-bar.css** (width)
  ```css
  @media (max-width: 480px) {
  ```
- **src/lib/client/shared/styles/components/status-bar.css** (max-width)
  ```css
  @media (max-width: 480px) {
  ```

</details>

### `0.125rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  @media (max-width: 768px) {
  ```
- **src/lib/client/shared/styles/retro.css** (max-width)
  ```css
  @media (max-width: 768px) {
  ```

</details>

### `1.05rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  --font-size-3: 1.05rem;
  ```
- **src/lib/client/shared/components/workspace/EmptySessionPane.svelte** (font-size)
  ```css
  font-size: 1.05rem;
  ```

</details>

### `1.2em` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 1.2em;
  ```
- **src/lib/client/shared/components/FileEditor.svelte** (font-size)
  ```css
  font-size: 1.2em;
  ```

</details>

### `3rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/AuthenticationStep.svelte** (font-size)
  ```css
  font-size: 3rem;
  ```
- **src/lib/client/onboarding/WorkspaceCreationStep.svelte** (font-size)
  ```css
  font-size: 3rem;
  ```

</details>

### `1100px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (width)
  ```css
  max-width: 1100px;
  ```
- **src/lib/client/onboarding/ThemeSelectionStep.svelte** (max-width)
  ```css
  max-width: 1100px;
  ```

</details>

### `1.4rem` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/settings/sections/ClaudeAuth.svelte** (font-size)
  ```css
  font-size: 1.4rem;
  ```
- **src/lib/client/settings/sections/ClaudeDefaults.svelte** (font-size)
  ```css
  font-size: 1.4rem;
  ```

</details>

### `800px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/GitOperations.svelte** (width)
  ```css
  max-width: 800px;
  ```
- **src/lib/client/shared/components/GitOperations.svelte** (max-width)
  ```css
  max-width: 800px;
  ```

</details>

### `350px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (width)
  ```css
  max-width: 350px;
  ```
- **src/lib/client/shared/components/PWAUpdateNotification.svelte** (max-width)
  ```css
  max-width: 350px;
  ```

</details>

### `220px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte** (width)
  ```css
  min-width: 220px;
  ```
- **src/lib/client/shared/components/workspace/SessionWindowManager.svelte** (min-width)
  ```css
  min-width: 220px;
  ```

</details>

### `280px` (2 occurrences)

<details>
<summary>Show occurrences</summary>

- **src/routes/+page.svelte** (width)
  ```css
  min-width: 280px;
  ```
- **src/routes/+page.svelte** (min-width)
  ```css
  min-width: 280px;
  ```

</details>

### `0.5px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (width)
  ```css
  border-width: 0.5px;
  ```

</details>

### `0.95em` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/retro.css** (font-size)
  ```css
  font-size: 0.95em;
  ```

</details>

### `18px` (1 occurrence)

**Suggested replacement:** `var(--font-size-3)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css** (font-size)
  ```css
  --font-size-3: 18px;
  ```

</details>

### `22px` (1 occurrence)

**Suggested replacement:** `var(--font-size-4)`

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/styles/variables.css** (font-size)
  ```css
  --font-size-4: 22px;
  ```

</details>

### `50px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/ClaudeProjectPicker.svelte** (max-height)
  ```css
  max-height: calc(35vh - 50px);
  ```

</details>

### `0.8em` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/claude/activity-summaries/GrepActivity.svelte** (font-size)
  ```css
  font-size: 0.8em;
  ```

</details>

### `520px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/CreateSessionModal.svelte** (width)
  ```css
  width: 520px;
  ```

</details>

### `2.5px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/LoadingSpinner.svelte** (width)
  ```css
  border-width: 2.5px;
  ```

</details>

### `56px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/lib/client/shared/components/workspace/WorkspacePage.svelte** (min-height)
  ```css
  min-height: calc(100% - 56px);
  ```

</details>

### `240px` (1 occurrence)

<details>
<summary>Show occurrences</summary>

- **src/routes/settings/+page.svelte** (width)
  ```css
  width: 240px;
  ```

</details>

## Auto-Migration Snippets

Use these commands to automatically replace hardcoded values:

```bash
# Color replacements
find src -name "*.css" -o -name "*.svelte" | xargs sed -i 's/transparent/transparent/g'
find src -name "*.css" -o -name "*.svelte" | xargs sed -i 's/white/var(--text)/g'

# Spacing replacements
find src -name "*.css" -o -name "*.svelte" | xargs sed -i 's/8px/var(--space-2)/g'
```

⚠️ **Warning:** Always review changes before committing. Test thoroughly after running migrations.

## Before/After Examples
