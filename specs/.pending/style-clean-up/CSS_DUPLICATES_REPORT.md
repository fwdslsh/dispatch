# CSS Duplicate Detection Report

Generated: 2025-10-07T20:39:02.150Z
Similarity Threshold: 80%

## Summary Statistics

- **Total CSS Rules**: 1942
- **Total Lines**: 15523
- **Duplicate Lines**: 2570
- **Duplication Percentage**: 16.6%
- **Exact Duplicate Groups**: 234
- **Exact Duplicate Instances**: 652
- **Near-Duplicate Pairs**: 20 (≥80% similar)

## Exact Duplicates

These CSS rule blocks are identical and can be consolidated into a single utility class or mixin.

### Duplicate Group 1 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:1` - `@keyframes fadeInUp`
- `src/lib/client/claude/components/MessageList.svelte:261` - `@keyframes fadeIn`

**CSS:**
```css
@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { opacity: 0;
  transform: translateY(10px);
}
```

### Duplicate Group 2 (9 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:5` - `to`
- `src/lib/client/shared/styles/animations.css:80` - `to`
- `src/lib/client/shared/styles/components/claude.css:415` - `to`
- `src/lib/client/claude/components/MessageList.svelte:74` - `to`
- `src/lib/client/claude/components/MessageList.svelte:267` - `to`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte:69` - `to`
- `src/lib/client/terminal/TerminalPane.svelte:109` - `to`
- `src/routes/_testing/_session-tiles/+page.svelte:68` - `to`
- `src/routes/_testing/_tiles/+page.svelte:79` - `to`

**CSS:**
```css


	to {
		opacity: 1;
		transform: translateY(0);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 1;
  transform: translateY(0);
}
```

### Duplicate Group 3 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:10` - `}


@keyframes fadeIn`
- `src/lib/client/shared/styles/animations.css:529` - `}

	@keyframes empty-tile-appear`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte:13` - `@keyframes fadeIn`

**CSS:**
```css

}


@keyframes fadeIn {
	from {
		opacity: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { opacity: 0;
}
```

### Duplicate Group 4 (14 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:17` - `to`
- `src/lib/client/shared/styles/animations.css:115` - `50%`
- `src/lib/client/shared/styles/animations.css:159` - `50%`
- `src/lib/client/shared/styles/animations.css:344` - `to`
- `src/lib/client/shared/styles/animations.css:535` - `to`
- `src/lib/client/shared/styles/components/misc.css:17` - `.tile-controls:hover`
- `src/lib/client/shared/styles/components/session-card.css:49` - `.card-session.is-inactive:hover`
- `src/lib/client/settings/ThemeSettings.svelte:102` - `.upload-area.dragging .upload-icon`
- `src/lib/client/settings/ThemeSettings.svelte:168` - `.message-close:hover`
- `src/lib/client/shared/components/AppVersion.svelte:12` - `.version-indicator:hover`
- `src/lib/client/shared/components/PublicUrlDisplay.svelte:8` - `.public-url-container:hover`
- `src/lib/client/shared/components/StatusBar.svelte:12` - `.version-indicator:hover`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte:18` - `to`
- `src/routes/+page.svelte:246` - `.card:hover::before`

**CSS:**
```css


	to {
		opacity: 1;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 1;
}
```

### Duplicate Group 5 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:44` - `to`
- `src/lib/client/shared/styles/animations.css:68` - `100%`

**CSS:**
```css


	to {
		transform: scale(1) translateY(0);
		opacity: 1;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: scale(1) translateY(0);
  opacity: 1;
}
```

### Duplicate Group 6 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:73` - `}

@keyframes messageSlideIn`
- `src/lib/client/shared/styles/components/claude.css:408` - `}

@keyframes messageSlideIn`
- `src/lib/client/claude/components/MessageList.svelte:68` - `@keyframes slideIn`

**CSS:**
```css

}

@keyframes messageSlideIn {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { opacity: 0;
  transform: translateY(20px);
}
```

### Duplicate Group 7 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:85` - `}


@keyframes statusPulse`
- `src/lib/client/claude/components/MessageList.svelte:183` - `@keyframes typingPulse`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:78` - `}

	
	@keyframes statusPulse`
- `src/lib/client/terminal/TerminalPane.svelte:93` - `@keyframes pulse`
- `src/routes/_testing/_session-tiles/+page.svelte:207` - `@keyframes pulse`

**CSS:**
```css

}


@keyframes statusPulse {
	0%,
	100% {
		opacity: 1;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  0%, 100% { opacity: 1;
}
```

### Duplicate Group 8 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:93` - `50%`
- `src/lib/client/shared/components/AuthStatus.svelte:45` - `.auth-status-empty`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:86` - `50%`

**CSS:**
```css


	50% {
		opacity: 0.6;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 0.6;
}
```

### Duplicate Group 9 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:163` - `}


@keyframes spin`
- `src/lib/client/claude/ClaudePane.svelte:80` - `@keyframes spin`
- `src/lib/client/shared/components/TunnelIndicator.svelte:53` - `@keyframes spin`

**CSS:**
```css

}


@keyframes spin {
	from {
		transform: rotate(0deg);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { transform: rotate(0deg);
}
```

### Duplicate Group 10 (11 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:170` - `to`
- `src/lib/client/claude/ClaudePane.svelte:85` - `to`
- `src/lib/client/onboarding/AuthenticationStep.svelte:180` - `100%`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:84` - `100%`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:218` - `100%`
- `src/lib/client/settings/GlobalSettingsSection.svelte:25` - `100%`
- `src/lib/client/shared/components/TunnelIndicator.svelte:58` - `to`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte:64` - `100%`
- `src/routes/_testing/_session-tiles/+page.svelte:277` - `100%`
- `src/routes/auth/callback/+page.svelte:28` - `100%`
- `src/routes/onboarding/+page.svelte:38` - `100%`

**CSS:**
```css


	to {
		transform: rotate(360deg);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: rotate(360deg);
}
```

### Duplicate Group 11 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:208` - `}


@keyframes typingBounce`
- `src/lib/client/claude/components/MessageList.svelte:235` - `@keyframes typingBounce`

**CSS:**
```css

}


@keyframes typingBounce {
	0%,
	60%,
	100% {
		transform: translateY(0);
		opacity: 0.4;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  0%, 60%, 100% { transform: translateY(0);
  opacity: 0.4;
}
```

### Duplicate Group 12 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:263` - `}


@keyframes cursorBlink`
- `src/lib/client/shared/styles/components/misc.css:298` - `}

@keyframes blink`
- `src/lib/client/settings/ThemePreviewCard.svelte:115` - `@keyframes cursor-blink`
- `src/lib/client/shared/components/Input.svelte:60` - `@keyframes cursorBlink`

**CSS:**
```css

}


@keyframes cursorBlink {
	0%,
	50% {
		opacity: 1;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  0%, 50% { opacity: 1;
}
```

### Duplicate Group 13 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:271` - `51%,
	100%`
- `src/lib/client/shared/styles/components/misc.css:305` - `51%,
	100%`
- `src/lib/client/settings/ThemePreviewCard.svelte:121` - `51%,
		100%`
- `src/lib/client/shared/components/Input.svelte:66` - `51%,
		100%`

**CSS:**
```css


	51%,
	100% {
		opacity: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 0;
}
```

### Duplicate Group 14 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:442` - `}


@keyframes hint-float-in`
- `src/routes/+page.svelte:369` - `@keyframes errorSlideIn`

**CSS:**
```css

}


@keyframes hint-float-in {
	from {
		opacity: 0;
		transform: translateY(-10px) scale(0.95);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
```

### Duplicate Group 15 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:450` - `to`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte:42` - `to`
- `src/routes/+page.svelte:141` - `100%`
- `src/routes/+page.svelte:266` - `100%`
- `src/routes/+page.svelte:375` - `to`

**CSS:**
```css


	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

### Duplicate Group 16 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:525` - `to`
- `src/lib/client/shared/components/HelpModal.svelte:120` - `.help-content::-webkit-scrollbar-thumb:hover`

**CSS:**
```css


		to {
			background: var(--accent);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: var(--accent);
}
```

### Duplicate Group 17 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/animations.css:539` - `}

	
	@keyframes tile-focus-pulse`
- `src/lib/client/shared/styles/animations.css:548` - `}

	@keyframes divider-drag-pulse`
- `src/lib/client/shared/styles/animations.css:556` - `}

	@keyframes empty-tile-focus`
- `src/lib/client/shared/styles/animations.css:564` - `}

	@keyframes empty-tile-icon-bounce`
- `src/lib/client/shared/styles/animations.css:572` - `}

	@keyframes hint-glow`

**CSS:**
```css

	}

	
	@keyframes tile-focus-pulse {
		from,
		to {
			transform: none;
			box-shadow: none;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from, to { transform: none;
  box-shadow: none;
}
```

### Duplicate Group 18 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:6` - `.btn__spinner`
- `src/lib/client/shared/styles/utilities.css:46` - `.flex-center`
- `src/lib/client/shared/components/AugButton.svelte:112` - `.btn__spinner`

**CSS:**
```css


.btn__spinner {
	display: flex;
	align-items: center;
	justify-content: center;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Duplicate Group 19 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:27` - `.btn-icon-only:hover`
- `src/lib/client/shared/styles/components/buttons.css:31` - `.btn-icon-only.primary`
- `src/lib/client/shared/styles/components/buttons.css:52` - `.btn-icon-only.ghost:hover`

**CSS:**
```css


.btn-icon-only:hover {
	color: var(--accent);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--accent);
}
```

### Duplicate Group 20 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:35` - `.btn-icon-only.secondary,
.btn-icon-only.warn`
- `src/lib/client/settings/sections/StorageSettings.svelte:108` - `.stat-value.warning`

**CSS:**
```css


.btn-icon-only.secondary,
.btn-icon-only.warn {
	color: var(--warn);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--warn);
}
```

### Duplicate Group 21 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:44` - `.btn-icon-only.danger:hover`
- `src/lib/client/claude/activity-summaries/EditActivity.svelte:17` - `.diff-label.removed`
- `src/lib/client/settings/sections/StorageSettings.svelte:112` - `.stat-value.critical`
- `src/lib/client/settings/sections/StorageSettings.svelte:218` - `.status-message.error`
- `src/lib/client/shared/components/SettingField.svelte:17` - `.required-indicator`

**CSS:**
```css


.btn-icon-only.danger:hover {
	color: var(--err);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--err);
}
```

### Duplicate Group 22 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:48` - `.btn-icon-only.ghost`
- `src/lib/client/shared/styles/components/menu-panel.css:113` - `.loading-state`
- `src/lib/client/shared/styles/utilities.css:82` - `.text-muted`

**CSS:**
```css


.btn-icon-only.ghost {
	color: var(--muted);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--muted);
}
```

### Duplicate Group 23 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:56` - `.btn-icon-only:active,
.btn-icon-only.active`
- `src/lib/client/claude/ClaudeProjectPicker.svelte:182` - `.is-active .name`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte:54` - `.save-status.success`
- `src/lib/client/shared/components/DirectoryBrowser.svelte:140` - `.breadcrumb-item-enhanced:hover`

**CSS:**
```css


.btn-icon-only:active,
.btn-icon-only.active {
	color: var(--primary);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--primary);
}
```

### Duplicate Group 24 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:104` - `.btn-icon-only.ghost svg`
- `src/lib/client/shared/styles/components/buttons.css:112` - `.btn-icon-only:disabled svg`

**CSS:**
```css


.btn-icon-only.ghost svg {
	filter: none;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  filter: none;
}
```

### Duplicate Group 25 (8 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/buttons.css:147` - `.clone-btn:disabled`
- `src/lib/client/shared/styles/components/buttons.css:174` - `.cancel-btn:disabled`
- `src/lib/client/shared/styles/components/type-card.css:58` - `.type-card:disabled`
- `src/lib/client/shared/styles/retro.css:1033` - `.workspace-selector:disabled`
- `src/lib/client/shared/styles/retro.css:1193` - `.type-card:disabled`
- `src/lib/client/claude/components/InputArea.svelte:58` - `.message-input:disabled`
- `src/lib/client/shared/components/DirectoryBrowser.svelte:112` - `.directory-item-enhanced button:disabled`
- `src/lib/client/shared/components/workspace/MobileNavigation.svelte:6` - `:global(.nav-btn:disabled)`

**CSS:**
```css


.clone-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Duplicate Group 26 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:1` - `.claude-auth`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte:1` - `.claude-defaults`

**CSS:**
```css



.claude-auth {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	height: 100%;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
}
```

### Duplicate Group 27 (12 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:42` - `.status-info`
- `src/lib/client/shared/styles/components/claude.css:102` - `.step-content`
- `src/lib/client/shared/styles/retro.css:1019` - `.workspace-selector__path`
- `src/lib/client/settings/AuthenticationSettings.svelte:53` - `.warning-content`
- `src/lib/client/settings/RetentionSettings.svelte:6` - `.form-input`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte:46` - `.error-text`
- `src/lib/client/settings/sections/TunnelControl.svelte:43` - `.config-input-wrapper :global(input)`
- `src/lib/client/settings/sections/TunnelControl.svelte:105` - `.url-wrapper :global(input)`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:66` - `.url-wrapper :global(input)`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:91` - `.login-url-wrapper :global(input)`
- `src/lib/client/terminal/MobileTerminalInput.svelte:89` - `.bottom-actions :global(.button:first-child)`
- `src/routes/console/+page.svelte:111` - `.socket-details`

**CSS:**
```css


.status-info {
	flex: 1;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex: 1;
}
```

### Duplicate Group 28 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:53` - `.status-info p`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:120` - `.step-description`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte:21` - `.settings-description`

**CSS:**
```css


.status-info p {
	margin: 0;
	font-size: 0.9rem;
	color: var(--text-muted);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}
```

### Duplicate Group 29 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:59` - `.flow-actions`
- `src/lib/client/claude/ClaudePane.svelte:31` - `.ai-status`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte:1` - `.layout-controls`

**CSS:**
```css


.flow-actions {
	display: flex;
	gap: var(--space-3);
	align-items: center;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
```

### Duplicate Group 30 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:75` - `.flow-steps`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:126` - `.form-wrapper`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte:7` - `.setting-group`

**CSS:**
```css


.flow-steps {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

### Duplicate Group 31 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:81` - `.flow-step`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:86` - `.flow-step`

**CSS:**
```css


.flow-step {
	display: flex;
	align-items: flex-start;
	gap: var(--space-3);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
```

### Duplicate Group 32 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:132` - `.setting-group`
- `src/lib/client/settings/GlobalSettings.svelte:57` - `.setting-item`
- `src/lib/client/settings/sections/OAuthSettings.svelte:11` - `.redirect-uri-field,
	.scope-field`
- `src/lib/client/shared/components/SettingField.svelte:1` - `.setting-field`

**CSS:**
```css


.setting-group {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
```

### Duplicate Group 33 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:249` - `.ai-status`
- `src/lib/client/shared/styles/components/session-card.css:59` - `.header-layout`
- `src/lib/client/claude/ClaudePane.svelte:119` - `.chat-stats`

**CSS:**
```css


.ai-status {
	display: flex;
	align-items: center;
	gap: var(--space-4);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
```

### Duplicate Group 34 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:255` - `.ai-status.thinking`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:185` - `.is-active .id`

**CSS:**
```css


.ai-status.thinking {
	color: var(--accent-cyan);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--accent-cyan);
}
```

### Duplicate Group 35 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:324` - `.message--assistant`
- `src/routes/_testing/_session-tiles/+page.svelte:129` - `:global(.wm-split[data-dir='row'])`
- `src/routes/_testing/_tiles/+page.svelte:135` - `:global(.wm-split[data-dir='row'])`

**CSS:**
```css


.message--assistant {
	flex-direction: row;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex-direction: row;
}
```

### Duplicate Group 36 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:328` - `.message--error .message-text`
- `src/lib/client/claude/components/MessageList.svelte:326` - `.message--error .message-text`

**CSS:**
```css


.message--error .message-text {
	background: linear-gradient(
		135deg,
		color-mix(in oklab, var(--error, #ff6b6b) 15%, var(--surface)),
		color-mix(in oklab, var(--error, #ff6b6b) 8%, var(--surface))
	);
	border-color: color-mix(in oklab, var(--error, #ff6b6b) 35%, transparent);
	color: var(--error, #ff6b6b);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: linear-gradient( 135deg, color-mix(in oklab, var(--error, #ff6b6b) 15%, var(--surface)), color-mix(in oklab, var(--error, #ff6b6b) 8%, var(--surface)) );
  border-color: color-mix(in oklab, var(--error, #ff6b6b) 35%, transparent);
  color: var(--error, #ff6b6b);
}
```

### Duplicate Group 37 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:348` - `.message--error .message-role`
- `src/lib/client/claude/ClaudeProjectPicker.svelte:195` - `.err`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:198` - `.err`

**CSS:**
```css


.message--error .message-role {
	color: var(--error, #ff6b6b);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--error, #ff6b6b);
}
```

### Duplicate Group 38 (9 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/claude.css:428` - `.flow-actions`
- `src/lib/client/onboarding/AuthenticationStep.svelte:194` - `.form-actions`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:232` - `.form-actions`
- `src/lib/client/settings/ThemePreviewCard.svelte:199` - `.actions`
- `src/lib/client/settings/ThemeSettings.svelte:301` - `.modal-actions`
- `src/lib/client/settings/sections/StorageSettings.svelte:227` - `.flex-col`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:184` - `.workspace-create-form .form-actions`
- `src/routes/_testing/_session-tiles/+page.svelte:133` - `:global(.wm-split[data-dir='column'])`
- `src/routes/_testing/_tiles/+page.svelte:139` - `:global(.wm-split[data-dir='column'])`

**CSS:**
```css


	.flow-actions {
		flex-direction: column;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex-direction: column;
}
```

### Duplicate Group 39 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/forms.css:76` - `.form-section`
- `src/lib/client/shared/styles/retro.css:1059` - `}


.form-section`

**CSS:**
```css


.form-section {
	margin-bottom: 2rem;
	position: relative;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: 2rem;
  position: relative;
}
```

### Duplicate Group 40 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/forms.css:94` - `.form-section__label-icon`
- `src/lib/client/shared/styles/retro.css:1080` - `.form-section__label-icon`

**CSS:**
```css


.form-section__label-icon {
	font-size: 1.1em;
	filter: drop-shadow(0 0 6px var(--primary-glow-40));
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1.1em;
  filter: drop-shadow(0 0 6px var(--primary-glow-40));
}
```

### Duplicate Group 41 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/forms.css:99` - `.form-group`
- `src/routes/console/+page.svelte:279` - `.history-card-details`

**CSS:**
```css


.form-group {
	margin-bottom: var(--space-4);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-4);
}
```

### Duplicate Group 42 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/menu-panel.css:18` - `.panel`
- `src/lib/client/settings/sections/StorageSettings.svelte:7` - `.storage-settings`
- `src/routes/console/+page.svelte:90` - `.socket-card`

**CSS:**
```css


.panel {
	display: flex;
	flex-direction: column;
	height: 100%;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}
```

### Duplicate Group 43 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/menu-panel.css:30` - `.header-content`
- `src/lib/client/shared/styles/utilities.css:47` - `.flex-between`

**CSS:**
```css


.header-content {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

### Duplicate Group 44 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/menu-panel.css:70` - `.status-message.error`
- `src/lib/client/shared/styles/components/menu-panel.css:117` - `.error-state`

**CSS:**
```css


.status-message.error {
	color: var(--err);
	background: color-mix(in oklab, var(--err) 10%, transparent);
	border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
	border-radius: var(--radius-xs);
	margin: var(--space-2);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--err);
  background: color-mix(in oklab, var(--err) 10%, transparent);
  border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
  border-radius: var(--radius-xs);
  margin: var(--space-2);
}
```

### Duplicate Group 45 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:67` - `.markdown-content h3`
- `src/lib/client/shared/styles/components/misc.css:269` - `.markdown-content h2`

**CSS:**
```css


.markdown-content h3 {
	font-size: 1.25rem;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1.25rem;
}
```

### Duplicate Group 46 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:71` - `.markdown-content h4`
- `src/lib/client/shared/styles/components/misc.css:273` - `.markdown-content h3`
- `src/lib/client/shared/components/ConfirmationDialog.svelte:68` - `.dialog-title`

**CSS:**
```css


.markdown-content h4 {
	font-size: 1.1rem;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1.1rem;
}
```

### Duplicate Group 47 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:81` - `.markdown-content p`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:120` - `.workspace-create-form .form-group`

**CSS:**
```css



.markdown-content p {
	margin-bottom: var(--space-3);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-3);
}
```

### Duplicate Group 48 (11 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:86` - `.markdown-content p:last-child`
- `src/lib/client/shared/styles/components/misc.css:115` - `.markdown-content li:last-child`
- `src/lib/client/shared/styles/components/misc.css:196` - `.markdown-content blockquote p:last-child`
- `src/lib/client/settings/GlobalSettings.svelte:154` - `.error-item:last-child`
- `src/lib/client/settings/PreferencesPanel.svelte:36` - `.preference-section:last-child`
- `src/lib/client/settings/ThemePreviewCard.svelte:151` - `.palette-row:last-child`
- `src/lib/client/settings/sections/TunnelControl.svelte:26` - `.config-section:last-child`
- `src/lib/client/settings/sections/TunnelControl.svelte:60` - `.status-row:last-child`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:119` - `.tunnel-info p:last-child`
- `src/lib/client/shared/components/GitOperations.svelte:49` - `.file-group:last-child`
- `src/lib/client/shared/components/HelpModal.svelte:15` - `.shortcut-category:last-child`

**CSS:**
```css


.markdown-content p:last-child {
	margin-bottom: 0;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: 0;
}
```

### Duplicate Group 49 (6 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:111` - `.markdown-content li`
- `src/lib/client/claude/ClaudeProjectPicker.svelte:134` - `.list li`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:129` - `.list li`
- `src/lib/client/settings/GlobalSettings.svelte:150` - `.error-item`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte:66` - `.env-help li`
- `src/lib/client/shared/components/SettingField.svelte:75` - `.error-item:not(:last-child)`

**CSS:**
```css


.markdown-content li {
	margin-bottom: var(--space-1);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-1);
}
```

### Duplicate Group 50 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:192` - `.markdown-content blockquote p`
- `src/lib/client/shared/styles/utilities.css:29` - `.mb-2`
- `src/lib/client/settings/ThemePreviewCard.svelte:90` - `.preview-line`

**CSS:**
```css


.markdown-content blockquote p {
	margin-bottom: var(--space-2);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-2);
}
```

### Duplicate Group 51 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:224` - `.markdown-content tr:last-child td`
- `src/lib/client/settings/sections/StorageSettings.svelte:134` - `.category-row:last-child`
- `src/lib/client/settings/sections/StorageSettings.svelte:180` - `.clear-option:last-child`

**CSS:**
```css


.markdown-content tr:last-child td {
	border-bottom: none;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-bottom: none;
}
```

### Duplicate Group 52 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:265` - `.markdown-content h1`
- `src/lib/client/shared/components/AuthStatus.svelte:62` - `.auth-icon`

**CSS:**
```css


	.markdown-content h1 {
		font-size: 1.5rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1.5rem;
}
```

### Duplicate Group 53 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:277` - `.markdown-content pre`
- `src/lib/client/shared/styles/components/misc.css:282` - `.markdown-content blockquote`

**CSS:**
```css


	.markdown-content pre {
		padding: var(--space-2);
		margin: var(--space-2) 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: var(--space-2);
  margin: var(--space-2) 0;
}
```

### Duplicate Group 54 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:287` - `}

@keyframes slideInRight`
- `src/lib/client/shared/components/PWAUpdateNotification.svelte:14` - `@keyframes slideIn`

**CSS:**
```css

}

@keyframes slideInRight {
	from {
		transform: translateX(100%);
		opacity: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { transform: translateX(100%);
  opacity: 0;
}
```

### Duplicate Group 55 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/misc.css:294` - `to`
- `src/lib/client/shared/components/PWAUpdateNotification.svelte:20` - `to`

**CSS:**
```css

	to {
		transform: translateX(0);
		opacity: 1;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: translateX(0);
  opacity: 1;
}
```

### Duplicate Group 56 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/session-card.css:66` - `.info-section`
- `src/lib/client/shared/components/AuthStatus.svelte:20` - `.auth-info`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:79` - `.workspace-info`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte:149` - `.shortcut-info`

**CSS:**
```css


.info-section {
	flex: 1;
	min-width: 0;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex: 1;
  min-width: 0;
}
```

### Duplicate Group 57 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:1` - `.type-card`
- `src/lib/client/shared/styles/retro.css:1085` - `.type-card`

**CSS:**
```css


.type-card {
	padding: 1.5rem 1rem;
	background: linear-gradient(
		135deg,
		color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%),
		color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%)
	);
	border: 2px solid var(--surface-border);
	border-radius: 0;
	color: var(--text-muted);
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	text-align: left;
	position: relative;
	overflow: hidden;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: 1.5rem 1rem;
  background: linear-gradient( 135deg, color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%), color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%) );
  border: 2px solid var(--surface-border);
  border-radius: 0;
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  text-align: left;
  position: relative;
  overflow: hidden;
}
```

### Duplicate Group 58 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:19` - `.type-card::before`
- `src/lib/client/shared/styles/retro.css:1104` - `.type-card::before`
- `src/lib/client/shared/components/DirectoryBrowser.svelte:23` - `.directory-summary-enhanced::before`

**CSS:**
```css


.type-card::before {
	content: '';
	position: absolute;
	top: 0;
	left: -100%;
	width: 100%;
	height: 100%;
	background: linear-gradient(90deg, transparent, var(--primary-glow-10), transparent);
	transition: left 0.5s ease;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.absolute {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--primary-glow-10), transparent);
  transition: left 0.5s ease;
}
```

### Duplicate Group 59 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:30` - `.type-card:hover:not(:disabled)::before`
- `src/lib/client/shared/styles/retro.css:367` - `.button:hover:not(:disabled)::before`
- `src/lib/client/shared/styles/retro.css:938` - `.btn-group .button:hover:not(.active)::before`
- `src/lib/client/shared/styles/retro.css:1115` - `.type-card:hover:not(:disabled)::before`
- `src/lib/client/shared/components/DirectoryBrowser.svelte:47` - `.directory-summary-enhanced:hover::before`

**CSS:**
```css


.type-card:hover:not(:disabled)::before {
	left: 100%;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  left: 100%;
}
```

### Duplicate Group 60 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:34` - `.type-card:hover:not(:disabled)`
- `src/lib/client/shared/styles/retro.css:1153` - `.type-card:hover:not(:disabled)`

**CSS:**
```css


.type-card:hover:not(:disabled) {
	background: linear-gradient(
		135deg,
		color-mix(in oklab, var(--primary) 20%, var(--surface-hover)),
		color-mix(in oklab, var(--primary) 10%, var(--surface-hover))
	);
	border-color: var(--primary);
	box-shadow:
		0 0 20px var(--primary-glow-30),
		inset 0 1px 0 rgba(255, 255, 255, 0.1);
	transform: translateY(-2px);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: linear-gradient( 135deg, color-mix(in oklab, var(--primary) 20%, var(--surface-hover)), color-mix(in oklab, var(--primary) 10%, var(--surface-hover)) );
  border-color: var(--primary);
  box-shadow: 0 0 20px var(--primary-glow-30), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}
```

### Duplicate Group 61 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:47` - `.type-card.active`
- `src/lib/client/shared/styles/retro.css:1171` - `.type-card.active`

**CSS:**
```css


.type-card.active {
	background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
	border-color: var(--primary);
	color: var(--bg);
	box-shadow:
		0 0 30px var(--primary-glow-40),
		0 0 60px var(--primary-glow-20),
		inset 0 1px 0 rgba(255, 255, 255, 0.2);
	transform: translateY(-3px) scale(1.02);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
  border-color: var(--primary);
  color: var(--bg);
  box-shadow: 0 0 30px var(--primary-glow-40), 0 0 60px var(--primary-glow-20), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transform: translateY(-3px) scale(1.02);
}
```

### Duplicate Group 62 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:63` - `.type-card__content`
- `src/lib/client/shared/styles/retro.css:1119` - `.type-card__content`

**CSS:**
```css


.type-card__content {
	display: flex;
	align-items: center;
	gap: 1rem;
	position: relative;
	z-index: 1;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}
```

### Duplicate Group 63 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:77` - `.type-card__info`
- `src/lib/client/shared/styles/retro.css:1132` - `.type-card__info`

**CSS:**
```css


.type-card__info {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
```

### Duplicate Group 64 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:83` - `.type-card__title`
- `src/lib/client/shared/styles/retro.css:1138` - `.type-card__title`

**CSS:**
```css


.type-card__title {
	font-size: 1.1rem;
	font-weight: 700;
	color: var(--text);
	font-family: var(--font-mono);
	text-transform: uppercase;
	letter-spacing: 0.03em;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
```

### Duplicate Group 65 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:92` - `.type-card__desc`
- `src/lib/client/shared/styles/retro.css:1147` - `.type-card__desc`

**CSS:**
```css


.type-card__desc {
	font-size: 0.85rem;
	color: var(--text-muted);
	opacity: 0.8;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 0.85rem;
  color: var(--text-muted);
  opacity: 0.8;
}
```

### Duplicate Group 66 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:98` - `.type-card:hover:not(:disabled) .type-card__icon`
- `src/lib/client/shared/styles/retro.css:1166` - `.type-card:hover:not(:disabled) .type-card__icon`

**CSS:**
```css


.type-card:hover:not(:disabled) .type-card__icon {
	filter: drop-shadow(0 0 12px var(--primary-glow-60));
	transform: scale(1.1);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  filter: drop-shadow(0 0 12px var(--primary-glow-60));
  transform: scale(1.1);
}
```

### Duplicate Group 67 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:103` - `.type-card.active .type-card__title,
.type-card.active .type-card__desc`
- `src/lib/client/shared/styles/retro.css:1182` - `.type-card.active .type-card__title,
.type-card.active .type-card__desc`

**CSS:**
```css


.type-card.active .type-card__title,
.type-card.active .type-card__desc {
	color: var(--bg);
	text-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--bg);
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}
```

### Duplicate Group 68 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/components/type-card.css:109` - `.type-card.active .type-card__icon`
- `src/lib/client/shared/styles/retro.css:1188` - `.type-card.active .type-card__icon`

**CSS:**
```css


.type-card.active .type-card__icon {
	filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.5));
	transform: scale(1.15);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.5));
  transform: scale(1.15);
}
```

### Duplicate Group 69 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:51` - `::-webkit-scrollbar-track`
- `src/lib/client/shared/components/FileEditor.svelte:46` - `.editor-textarea::-webkit-scrollbar-track`

**CSS:**
```css


::-webkit-scrollbar-track {
	background: transparent;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: transparent;
}
```

### Duplicate Group 70 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:138` - `.stack > * + *`
- `src/lib/client/settings/PreferencesPanel.svelte:83` - `.success-message,
	.error-message`
- `src/lib/client/settings/RetentionSettings.svelte:70` - `.warning-message,
	.error-message`

**CSS:**
```css


.stack > * + * {
	margin-top: var(--space-4);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-top: var(--space-4);
}
```

### Duplicate Group 71 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:192` - `.card.aug`
- `src/lib/client/shared/styles/utilities.css:99` - `.bg-surface`

**CSS:**
```css


.card.aug {
	background: var(--surface);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: var(--surface);
}
```

### Duplicate Group 72 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:196` - `.panel.aug`
- `src/lib/client/shared/styles/utilities.css:104` - `.bg-surface-highlight`

**CSS:**
```css


.panel.aug {
	background: var(--elev);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: var(--elev);
}
```

### Duplicate Group 73 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:257` - `input:active:not(:disabled),
select:active:not(:disabled),
textarea:active:not(:disabled)`
- `src/lib/client/shared/styles/utilities.css:126` - `.interactive:active`

**CSS:**
```css



input:active:not(:disabled),
select:active:not(:disabled),
textarea:active:not(:disabled) {
	transform: translateY(0);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: translateY(0);
}
```

### Duplicate Group 74 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:466` - `@property --aug-l`
- `src/lib/client/shared/styles/retro.css:473` - `@property --aug-r`

**CSS:**
```css



@property --aug-l {
	syntax: '<length>';
	initial-value: 4px;
	inherits: false;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  syntax: '<length>';
  initial-value: 4px;
  inherits: false;
}
```

### Duplicate Group 75 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:690` - `.button,
	input,
	textarea,
	select`
- `src/lib/client/claude/ClaudePane.svelte:181` - `.stat-item`
- `src/lib/client/settings/ThemePreviewCard.svelte:230` - `.color-block`
- `src/lib/client/shared/components/SettingField.svelte:114` - `.error-message,
		.env-fallback`

**CSS:**
```css


	.button,
	input,
	textarea,
	select {
		border-width: 2px;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-width: 2px;
}
```

### Duplicate Group 76 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/retro.css:965` - `.spinning`
- `src/lib/client/shared/components/TunnelIndicator.svelte:49` - `.spinner`

**CSS:**
```css


.spinning {
	animation: spin 2s linear infinite;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  animation: spin 2s linear infinite;
}
```

### Duplicate Group 77 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:8` - `.p-4`
- `src/lib/client/settings/ThemeSettings.svelte:297` - `.upload-area`
- `src/lib/client/settings/sections/OAuthSettings.svelte:1` - `.oauth-settings`

**CSS:**
```css

.p-4 { padding: var(--space-4); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: var(--space-4);
}
```

### Duplicate Group 78 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:9` - `.p-5`
- `src/routes/+page.svelte:481` - `.card`

**CSS:**
```css

.p-5 { padding: var(--space-5); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: var(--space-5);
}
```

### Duplicate Group 79 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:26` - `.mt-2`
- `src/lib/client/shared/styles/utilities.css:37` - `.space-y-2 > * + *`

**CSS:**
```css


.mt-2 { margin-top: var(--space-2); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-top: var(--space-2);
}
```

### Duplicate Group 80 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:28` - `.mt-3`
- `src/lib/client/settings/ThemePreviewCard.svelte:104` - `.cursor-line`
- `src/routes/console/+page.svelte:178` - `.event-data-section`
- `src/routes/console/+page.svelte:348` - `.event-data-container`

**CSS:**
```css

.mt-3 { margin-top: var(--space-3); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-top: var(--space-3);
}
```

### Duplicate Group 81 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:30` - `.gap-1`
- `src/lib/client/settings/sections/StorageSettings.svelte:239` - `.gap-1`
- `src/lib/client/terminal/MobileTerminalInput.svelte:103` - `.left-keys`

**CSS:**
```css



.gap-1 { gap: var(--space-1); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  gap: var(--space-1);
}
```

### Duplicate Group 82 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:34` - `.gap-3`
- `src/lib/client/settings/sections/StorageSettings.svelte:243` - `.gap-3`
- `src/routes/console/+page.svelte:174` - `.event-details`

**CSS:**
```css

.gap-3 { gap: var(--space-3); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  gap: var(--space-3);
}
```

### Duplicate Group 83 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:35` - `.gap-4`
- `src/lib/client/claude/components/InputArea.svelte:75` - `.input-container`
- `src/lib/client/settings/sections/StorageSettings.svelte:247` - `.gap-4`

**CSS:**
```css

.gap-4 { gap: var(--space-4); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  gap: var(--space-4);
}
```

### Duplicate Group 84 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:36` - `.gap-6`
- `src/lib/client/settings/sections/StorageSettings.svelte:251` - `.gap-6`

**CSS:**
```css

.gap-6 { gap: var(--space-6); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  gap: var(--space-6);
}
```

### Duplicate Group 85 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:40` - `.flex`
- `src/lib/client/settings/sections/StorageSettings.svelte:222` - `.flex`

**CSS:**
```css





.flex { display: flex; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
}
```

### Duplicate Group 86 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:48` - `.flex-wrap`
- `src/lib/client/settings/sections/StorageSettings.svelte:235` - `.flex-wrap`

**CSS:**
```css

.flex-wrap { flex-wrap: wrap; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex-wrap: wrap;
}
```

### Duplicate Group 87 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:51` - `.justify-start`
- `src/lib/client/settings/sections/OAuthSettings.svelte:116` - `.scope-buttons`

**CSS:**
```css


.justify-start { justify-content: flex-start; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  justify-content: flex-start;
}
```

### Duplicate Group 88 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:53` - `.justify-center`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte:71` - `.settings-actions`

**CSS:**
```css

.justify-center { justify-content: center; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  justify-content: center;
}
```

### Duplicate Group 89 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:57` - `.shrink-0`
- `src/lib/client/settings/GlobalSettings.svelte:171` - `.env-icon`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte:67` - `.notice-icon`
- `src/lib/client/shared/components/SettingField.svelte:92` - `.env-icon`
- `src/routes/+page.svelte:439` - `:global(.button.oauth svg)`

**CSS:**
```css

.shrink-0 { flex-shrink: 0; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex-shrink: 0;
}
```

### Duplicate Group 90 (7 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:58` - `.w-full`
- `src/lib/client/onboarding/AuthenticationStep.svelte:198` - `.btn`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:132` - `.actions :global(button)`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:236` - `.btn`
- `src/lib/client/shared/components/workspace/SessionHeaderRenderer.svelte:1` - `.session-header-renderer`
- `src/routes/console/+page.svelte:380` - `.nav-tabs`
- `src/routes/console/+page.svelte:402` - `.socket-header button`

**CSS:**
```css



.w-full { width: 100%; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  width: 100%;
}
```

### Duplicate Group 91 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:63` - `.h-full`
- `src/lib/client/file-editor/FileEditorPane.svelte:12` - `.file-editor-container`
- `src/lib/client/shared/components/workspace/SingleSessionView.svelte:8` - `.single-session-view :global(.session-container)`
- `src/lib/client/terminal/MobileTerminalView.svelte:8` - `.terminal-scroll`

**CSS:**
```css

.h-full { height: 100%; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  height: 100%;
}
```

### Duplicate Group 92 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:68` - `.relative`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte:13` - `.password-field-wrapper`
- `src/lib/client/shared/components/window-manager/WindowManager.svelte:1` - `.wm-root`
- `src/routes/_testing/_tiles/+page.svelte:327` - `.tile-content`
- `src/routes/console/+page.svelte:141` - `.event-card`

**CSS:**
```css



.relative { position: relative; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  position: relative;
}
```

### Duplicate Group 93 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:76` - `.text-primary`
- `src/lib/client/shared/styles/utilities.css:81` - `.text-text`

**CSS:**
```css





.text-primary { color: var(--text); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--text);
}
```

### Duplicate Group 94 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:83` - `.text-success`
- `src/lib/client/settings/sections/WorkspaceEnvSettings.svelte:89` - `.save-status.success`

**CSS:**
```css

.text-success { color: var(--success); }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--success);
}
```

### Duplicate Group 95 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:85` - `.text-left`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:36` - `.directory-button`

**CSS:**
```css



.text-left { text-align: left; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  text-align: left;
}
```

### Duplicate Group 96 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:88` - `.text-center`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte:75` - `.save-status`
- `src/lib/client/shared/components/FileEditor.svelte:89` - `.file-info`
- `src/routes/auth/callback/+page.svelte:9` - `.loading`

**CSS:**
```css

.text-center { text-align: center; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  text-align: center;
}
```

### Duplicate Group 97 (5 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:92` - `.font-semibold`
- `src/lib/client/settings/sections/OAuthSettings.svelte:44` - `.info-content strong`
- `src/lib/client/settings/sections/OAuthSettings.svelte:106` - `.notice-content strong`
- `src/lib/client/settings/sections/TunnelControl.svelte:69` - `.status-value`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte:6` - `.layout-controls :global(.btn-icon-only.active)`

**CSS:**
```css

.font-semibold { font-weight: 600; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-weight: 600;
}
```

### Duplicate Group 98 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:93` - `.font-bold`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte:71` - `.notice-content strong`
- `src/lib/client/shared/components/SettingField.svelte:104` - `.env-content strong`

**CSS:**
```css

.font-bold { font-weight: 700; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-weight: 700;
}
```

### Duplicate Group 99 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:94` - `.text-xs`
- `src/lib/client/shared/components/LoadingSpinner.svelte:88` - `.spinner--small .spinner__text`

**CSS:**
```css



.text-xs { font-size: 0.75rem; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 0.75rem;
}
```

### Duplicate Group 100 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:98` - `.text-base`
- `src/lib/client/shared/components/HelpModal.svelte:99` - `.category-title`
- `src/lib/client/shared/components/LoadingSpinner.svelte:92` - `.spinner--large .spinner__text`

**CSS:**
```css

.text-base { font-size: 1rem; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1rem;
}
```

### Duplicate Group 101 (3 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:122` - `.interactive:hover`
- `src/lib/client/shared/components/ErrorDisplay.svelte:29` - `.error-display--error:hover,
	.error-display--warning:hover,
	.error-display--success:hover,
	.error-display--info:hover`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte:14` - `.control-btn:hover`

**CSS:**
```css


.interactive:hover {
	transform: translateY(-1px);
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: translateY(-1px);
}
```

### Duplicate Group 102 (4 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:155` - `.opacity-50`
- `src/lib/client/claude/components/MessageList.svelte:189` - `50%`
- `src/lib/client/terminal/TerminalPane.svelte:99` - `50%`
- `src/routes/_testing/_session-tiles/+page.svelte:213` - `50%`

**CSS:**
```css




.opacity-50 { opacity: 0.5; }
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 0.5;
}
```

### Duplicate Group 103 (2 occurrences)

**Locations:**
- `src/lib/client/shared/styles/utilities.css:169` - `}



.sr-only`
- `src/lib/client/shared/components/LoadingSpinner.svelte:105` - `.sr-only`

**CSS:**
```css

}



.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.absolute {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Duplicate Group 104 (3 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeHeader.svelte:27` - `.session-id`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:45` - `.session-id`
- `src/lib/client/terminal/TerminalHeader.svelte:48` - `.session-id`

**CSS:**
```css


	.session-id {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--text-muted);
		background: var(--surface-hover);
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		border: 1px solid var(--surface-border);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-family: var(--font-mono);
  font-size: var(--font-size-0);
  color: var(--text-muted);
  background: var(--surface-hover);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--surface-border);
}
```

### Duplicate Group 105 (3 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeHeader.svelte:47` - `.project-name`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:55` - `.project-name`
- `src/lib/client/terminal/TerminalHeader.svelte:68` - `.project-name`

**CSS:**
```css


	.project-name {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-family: var(--font-sans);
  font-size: var(--font-size-1);
  color: var(--text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
```

### Duplicate Group 106 (3 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeHeader.svelte:65` - `.project-name`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:73` - `.project-name`
- `src/lib/client/terminal/TerminalHeader.svelte:92` - `.project-name`

**CSS:**
```css


		.project-name {
			max-width: 100px;
			font-size: var(--font-size-0);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  max-width: 100px;
  font-size: var(--font-size-0);
}
```

### Duplicate Group 107 (4 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeHeader.svelte:70` - `.claude-session-id`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:169` - `.button-text`
- `src/lib/client/terminal/MobileTerminalInput.svelte:17` - `.mobile-input-wrapper.hidden`
- `src/lib/client/terminal/TerminalHeader.svelte:97` - `.shell-info`

**CSS:**
```css


		.claude-session-id {
			display: none; 
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  display: none;
}
```

### Duplicate Group 108 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudePane.svelte:56` - `.ai-status.thinking .ai-avatar`
- `src/lib/client/terminal/TerminalPane.svelte:88` - `.error-icon,
	.loading-icon`

**CSS:**
```css


	.ai-status.thinking .ai-avatar {
		animation: pulse 2s ease-in-out infinite;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  animation: pulse 2s ease-in-out infinite;
}
```

### Duplicate Group 109 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudePane.svelte:60` - `@keyframes pulse`
- `src/lib/client/claude/components/MessageList.svelte:289` - `@keyframes welcomePulse`

**CSS:**
```css


	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			box-shadow: 0 8px 24px -8px var(--primary-glow);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  0%, 100% { transform: scale(1);
  box-shadow: 0 8px 24px -8px var(--primary-glow);
}
```

### Duplicate Group 110 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudePane.svelte:67` - `50%`
- `src/lib/client/claude/components/MessageList.svelte:296` - `50%`

**CSS:**
```css

		50% {
			transform: scale(1.05);
			box-shadow: 0 12px 32px -8px var(--primary-glow);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: scale(1.05);
  box-shadow: 0 12px 32px -8px var(--primary-glow);
}
```

### Duplicate Group 111 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudePane.svelte:107` - `.ai-info`
- `src/lib/client/settings/sections/StorageSettings.svelte:88` - `.stat`

**CSS:**
```css


	.ai-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
```

### Duplicate Group 112 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudePane.svelte:155` - `.chat-header`
- `src/routes/console/+page.svelte:384` - `.nav-tab`

**CSS:**
```css


		.chat-header {
			padding: var(--space-3) var(--space-4);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: var(--space-3) var(--space-4);
}
```

### Duplicate Group 113 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:1` - `.cc-picker`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:1` - `.cc-session-picker`

**CSS:**
```css

	.cc-picker {
		position: relative;
		display: grid;
		gap: var(--space-3);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.grid-layout {
  position: relative;
  display: grid;
  gap: var(--space-3);
}
```

### Duplicate Group 114 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:23` - `.selected-meta`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:23` - `.selected-meta`

**CSS:**
```css


	.selected-meta {
		flex: 1;
		font-size: var(--font-size-1);
		color: var(--text-muted);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex: 1;
  font-size: var(--font-size-1);
  color: var(--text-muted);
}
```

### Duplicate Group 115 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:29` - `.row`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:29` - `.row`

**CSS:**
```css


	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		align-items: center;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.grid-layout {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
  align-items: center;
}
```

### Duplicate Group 116 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:54` - `.row input::placeholder`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:54` - `.row input::placeholder`

**CSS:**
```css


	.row input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--text-muted);
  opacity: 0.7;
}
```

### Duplicate Group 117 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:111` - `.spacer`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:106` - `.spacer`

**CSS:**
```css


	.spacer {
		visibility: hidden;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  visibility: hidden;
}
```

### Duplicate Group 118 (3 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:125` - `.list::-webkit-scrollbar`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:120` - `.list::-webkit-scrollbar`
- `src/lib/client/terminal/MobileTerminalInput.svelte:197` - `.message-input::-webkit-scrollbar`

**CSS:**
```css


	.list::-webkit-scrollbar {
		width: 6px;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  width: 6px;
}
```

### Duplicate Group 119 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:158` - `.name`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:160` - `.id`

**CSS:**
```css


	.name {
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
		font-family: var(--font-mono);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-weight: 600;
  font-size: var(--font-size-2);
  color: var(--text);
  font-family: var(--font-mono);
}
```

### Duplicate Group 120 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:171` - `.meta span:first-child`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:174` - `.meta span:first-child`

**CSS:**
```css


	.meta span:first-child {
		color: var(--accent-amber);
		font-weight: 600;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--accent-amber);
  font-weight: 600;
}
```

### Duplicate Group 121 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:186` - `.empty,
	.err`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:189` - `.empty,
	.err`

**CSS:**
```css


	.empty,
	.err {
		padding: var(--space-4);
		text-align: center;
		font-family: var(--font-mono);
		font-style: italic;
		color: var(--text-muted);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: var(--space-4);
  text-align: center;
  font-family: var(--font-mono);
  font-style: italic;
  color: var(--text-muted);
}
```

### Duplicate Group 122 (2 occurrences)

**Locations:**
- `src/lib/client/claude/ClaudeProjectPicker.svelte:199` - `.bar span:not(.spacer)`
- `src/lib/client/claude/ClaudeSessionPicker.svelte:202` - `.bar span:not(.spacer)`

**CSS:**
```css


	.bar span:not(.spacer) {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text-muted);
		font-style: italic;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  color: var(--text-muted);
  font-style: italic;
}
```

### Duplicate Group 123 (2 occurrences)

**Locations:**
- `src/lib/client/claude/activity-summaries/EditActivity.svelte:1` - `.activity-badge`
- `src/lib/client/claude/activity-summaries/WriteActivity.svelte:1` - `.activity-badge`

**CSS:**
```css

	.activity-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		font-size: 0.75em;
		font-weight: 600;
		margin-left: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 0.75em;
  font-weight: 600;
  margin-left: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Duplicate Group 124 (2 occurrences)

**Locations:**
- `src/lib/client/claude/activity-summaries/EditActivity.svelte:21` - `.diff-label.added`
- `src/lib/client/settings/sections/StorageSettings.svelte:214` - `.status-message.success`

**CSS:**
```css


	.diff-label.added {
		color: var(--ok);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--ok);
}
```

### Duplicate Group 125 (4 occurrences)

**Locations:**
- `src/lib/client/claude/components/InputArea.svelte:109` - `.message-input:focus`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:143` - `.theme-option:hover`
- `src/lib/client/settings/ThemePreviewCard.svelte:210` - `.theme-card:hover`
- `src/lib/client/settings/ThemePreviewCard.svelte:219` - `.color-block:hover`

**CSS:**
```css


		.message-input:focus {
			transform: none;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  transform: none;
}
```

### Duplicate Group 126 (2 occurrences)

**Locations:**
- `src/lib/client/claude/components/MessageList.svelte:41` - `.pulse-ring:nth-child(2)`
- `src/lib/client/claude/components/MessageList.svelte:227` - `.typing-dot:nth-child(2)`

**CSS:**
```css


	.pulse-ring:nth-child(2) {
		animation-delay: 0.2s;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  animation-delay: 0.2s;
}
```

### Duplicate Group 127 (2 occurrences)

**Locations:**
- `src/lib/client/claude/components/MessageList.svelte:45` - `.pulse-ring:nth-child(3)`
- `src/lib/client/claude/components/MessageList.svelte:231` - `.typing-dot:nth-child(3)`

**CSS:**
```css


	.pulse-ring:nth-child(3) {
		animation-delay: 0.4s;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  animation-delay: 0.4s;
}
```

### Duplicate Group 128 (2 occurrences)

**Locations:**
- `src/lib/client/claude/components/MessageList.svelte:113` - `.message-content`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:105` - `.step-content`

**CSS:**
```css


	.message-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
```

### Duplicate Group 129 (3 occurrences)

**Locations:**
- `src/lib/client/claude/components/MessageList.svelte:171` - `.typing-indicator`
- `src/lib/client/claude/components/MessageList.svelte:367` - `.typing-dot`
- `src/lib/client/settings/ThemePreviewCard.svelte:214` - `.cursor`

**CSS:**
```css


	
	.typing-indicator {
		opacity: 1;
		animation: none;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 1;
  animation: none;
}
```

### Duplicate Group 130 (2 occurrences)

**Locations:**
- `src/lib/client/file-editor/FileEditorPane.svelte:16` - `.directory-browser-container`
- `src/lib/client/shared/components/DirectoryBrowser.svelte:150` - `.directory-listing-container`

**CSS:**
```css

	.directory-browser-container {
		height: 100%;
		overflow-y: auto;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  height: 100%;
  overflow-y: auto;
}
```

### Duplicate Group 131 (3 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:7` - `.step-header`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:7` - `.step-header`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:7` - `.step-header`

**CSS:**
```css


	.step-header {
		text-align: center;
		margin-bottom: 2rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  text-align: center;
  margin-bottom: 2rem;
}
```

### Duplicate Group 132 (3 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:12` - `.step-header h2`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:12` - `.step-header h2`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:12` - `.step-header h2`

**CSS:**
```css


	.step-header h2 {
		margin: 0 0 0.5rem 0;
		color: #1f2937;
		font-size: 1.75rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.75rem;
}
```

### Duplicate Group 133 (5 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:18` - `.step-header p`
- `src/lib/client/onboarding/AuthenticationStep.svelte:143` - `.success-state p`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:18` - `.step-header p`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:18` - `.step-header p`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:189` - `.success-state > p`

**CSS:**
```css


	.step-header p {
		margin: 0;
		color: #6b7280;
		font-size: 1.125rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0;
  color: #6b7280;
  font-size: 1.125rem;
}
```

### Duplicate Group 134 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:24` - `.auth-form`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:24` - `.workspace-form`

**CSS:**
```css


	.auth-form {
		background: white;
		border-radius: var(--radius-md);
		padding: 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: white;
  border-radius: var(--radius-md);
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}
```

### Duplicate Group 135 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:32` - `.form-group`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:32` - `.form-group`

**CSS:**
```css


	.form-group {
		margin-bottom: 1.5rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: 1.5rem;
}
```

### Duplicate Group 136 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:36` - `.form-label`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:36` - `.form-label`

**CSS:**
```css


	.form-label {
		display: block;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}
```

### Duplicate Group 137 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:43` - `.form-help`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:43` - `.form-help`

**CSS:**
```css


	.form-help {
		display: block;
		font-size: 0.875rem;
		font-weight: normal;
		color: #6b7280;
		margin-top: 0.25rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  display: block;
  font-size: 0.875rem;
  font-weight: normal;
  color: #6b7280;
  margin-top: 0.25rem;
}
```

### Duplicate Group 138 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:51` - `.form-input`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:51` - `.form-input`

**CSS:**
```css


	.form-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #d1d5db;
		border-radius: var(--radius-sm);
		font-size: 1rem;
		transition: border-color 0.2s;
		box-sizing: border-box;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #d1d5db;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
```

### Duplicate Group 139 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:61` - `.form-input:focus`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:61` - `.form-input:focus`

**CSS:**
```css


	.form-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

### Duplicate Group 140 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:67` - `.form-input.error`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:67` - `.form-input.error`

**CSS:**
```css


	.form-input.error {
		border-color: #dc2626;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-color: #dc2626;
}
```

### Duplicate Group 141 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:71` - `.form-input:disabled`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:71` - `.form-input:disabled`

**CSS:**
```css


	.form-input:disabled {
		background-color: #f9fafb;
		cursor: not-allowed;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: #f9fafb;
  cursor: not-allowed;
}
```

### Duplicate Group 142 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:76` - `.error-text`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:76` - `.error-text`

**CSS:**
```css


	.error-text {
		color: #dc2626;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
```

### Duplicate Group 143 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:100` - `.btn:disabled`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:109` - `.btn:disabled`

**CSS:**
```css


	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Duplicate Group 144 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:105` - `.btn-primary`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:114` - `.btn-primary`

**CSS:**
```css


	.btn-primary {
		background-color: #3b82f6;
		color: white;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: #3b82f6;
  color: white;
}
```

### Duplicate Group 145 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:110` - `.btn-primary:hover:not(:disabled)`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:119` - `.btn-primary:hover:not(:disabled)`

**CSS:**
```css


	.btn-primary:hover:not(:disabled) {
		background-color: #2563eb;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: #2563eb;
}
```

### Duplicate Group 146 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:114` - `.btn-secondary`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:123` - `.btn-secondary`

**CSS:**
```css


	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: #e5e7eb;
  color: #374151;
}
```

### Duplicate Group 147 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:119` - `.btn-secondary:hover:not(:disabled)`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:128` - `.btn-secondary:hover:not(:disabled)`

**CSS:**
```css


	.btn-secondary:hover:not(:disabled) {
		background-color: #d1d5db;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: #d1d5db;
}
```

### Duplicate Group 148 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:123` - `.success-state`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:156` - `.success-state`

**CSS:**
```css


	.success-state {
		background: white;
		border-radius: var(--radius-md);
		padding: 3rem 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		text-align: center;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: white;
  border-radius: var(--radius-md);
  padding: 3rem 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  text-align: center;
}
```

### Duplicate Group 149 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:132` - `.success-icon`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:165` - `.success-icon`

**CSS:**
```css


	.success-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 3rem;
  margin-bottom: 1rem;
}
```

### Duplicate Group 150 (8 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:175` - `@keyframes spin`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:79` - `@keyframes spin`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:213` - `@keyframes spin`
- `src/lib/client/settings/GlobalSettingsSection.svelte:20` - `@keyframes spin`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte:57` - `}

	
	@keyframes spin`
- `src/routes/_testing/_session-tiles/+page.svelte:272` - `@keyframes spin`
- `src/routes/auth/callback/+page.svelte:23` - `@keyframes spin`
- `src/routes/onboarding/+page.svelte:33` - `@keyframes spin`

**CSS:**
```css


	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  0% { transform: rotate(0deg);
}
```

### Duplicate Group 151 (2 occurrences)

**Locations:**
- `src/lib/client/onboarding/AuthenticationStep.svelte:190` - `.auth-form`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte:228` - `.workspace-form`

**CSS:**
```css


		.auth-form {
			padding: 1.5rem;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: 1.5rem;
}
```

### Duplicate Group 152 (3 occurrences)

**Locations:**
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:147` - `.spinner`
- `src/routes/+page.svelte:492` - `.login-container::before,
		.login-container::after,
		.login-content::before`
- `src/routes/+page.svelte:498` - `.login-content h1`

**CSS:**
```css


		.spinner {
			animation: none;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  animation: none;
}
```

### Duplicate Group 153 (3 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:1` - `.authentication-settings`
- `src/lib/client/settings/GlobalSettings.svelte:1` - `.global-settings`
- `src/lib/client/settings/ThemeSettings.svelte:1` - `.theme-settings`

**CSS:**
```css


	.authentication-settings {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		padding: var(--space-5);
		margin-bottom: var(--space-5);
		container-type: inline-size;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  container-type: inline-size;
}
```

### Duplicate Group 154 (3 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:10` - `.settings-header h3`
- `src/lib/client/settings/GlobalSettings.svelte:10` - `.settings-header h3`
- `src/lib/client/settings/ThemeSettings.svelte:9` - `.settings-header h2`

**CSS:**
```css


	.settings-header h3 {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 600;
		text-shadow: 0 0 8px var(--primary-glow);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0 0 var(--space-2) 0;
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-4);
  font-weight: 600;
  text-shadow: 0 0 8px var(--primary-glow);
}
```

### Duplicate Group 155 (3 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:19` - `.settings-description`
- `src/lib/client/settings/GlobalSettings.svelte:19` - `.settings-description`
- `src/lib/client/settings/ThemeSettings.svelte:18` - `.settings-description`

**CSS:**
```css


	.settings-description {
		margin: 0 0 var(--space-5) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0 0 var(--space-5) 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  line-height: 1.5;
}
```

### Duplicate Group 156 (2 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:27` - `.settings-content`
- `src/lib/client/settings/GlobalSettings.svelte:51` - `.settings-group`

**CSS:**
```css


	.settings-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
```

### Duplicate Group 157 (2 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:63` - `.settings-actions`
- `src/lib/client/settings/GlobalSettings.svelte:183` - `.settings-actions`

**CSS:**
```css


	
	.settings-actions {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
		padding-top: var(--space-5);
		margin-top: var(--space-4);
		border-top: 1px solid var(--line);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
  padding-top: var(--space-5);
  margin-top: var(--space-4);
  border-top: 1px solid var(--line);
}
```

### Duplicate Group 158 (3 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:74` - `.success-message`
- `src/lib/client/settings/GlobalSettings.svelte:193` - `.success-message`
- `src/lib/client/settings/ThemeSettings.svelte:143` - `.success-message`

**CSS:**
```css


	
	.success-message {
		padding: var(--space-4);
		background: color-mix(in oklab, var(--ok) 15%, var(--surface));
		border: 1px solid var(--ok);
		border-radius: var(--radius-sm);
		color: var(--ok);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  padding: var(--space-4);
  background: color-mix(in oklab, var(--ok) 15%, var(--surface));
  border: 1px solid var(--ok);
  border-radius: var(--radius-sm);
  color: var(--ok);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
}
```

### Duplicate Group 159 (2 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:106` - `.loading-state .loading-spinner`
- `src/lib/client/shared/components/LoadingSpinner.svelte:51` - `.spinner--large .spinner__circle`

**CSS:**
```css


	.loading-state .loading-spinner {
		width: 32px;
		height: 32px;
		border-width: 3px;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  width: 32px;
  height: 32px;
  border-width: 3px;
}
```

### Duplicate Group 160 (4 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettings.svelte:118` - `.settings-actions`
- `src/lib/client/settings/GlobalSettings.svelte:209` - `.settings-actions`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:157` - `.flow-actions`
- `src/routes/console/+page.svelte:397` - `.socket-header`

**CSS:**
```css


		.settings-actions {
			flex-direction: column;
			align-items: stretch;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex-direction: column;
  align-items: stretch;
}
```

### Duplicate Group 161 (3 occurrences)

**Locations:**
- `src/lib/client/settings/AuthenticationSettingsSection.svelte:19` - `@keyframes spin`
- `src/lib/client/settings/ThemeSettings.svelte:281` - `@keyframes spin`
- `src/routes/settings/+page.svelte:26` - `@keyframes spin`

**CSS:**
```css


	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  to { transform: rotate(360deg);
}
```

### Duplicate Group 162 (3 occurrences)

**Locations:**
- `src/lib/client/settings/GlobalSettings.svelte:27` - `.settings-content`
- `src/lib/client/settings/ThemeSettings.svelte:26` - `.settings-content`
- `src/lib/client/settings/sections/StorageSettings.svelte:1` - `:global(.storage-settings .settings-content)`

**CSS:**
```css


	.settings-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
```

### Duplicate Group 163 (2 occurrences)

**Locations:**
- `src/lib/client/settings/GlobalSettings.svelte:33` - `.settings-section`
- `src/lib/client/settings/ThemeSettings.svelte:32` - `.theme-section`

**CSS:**
```css


	.settings-section {
		border-top: 1px solid var(--line);
		padding-top: var(--space-5);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-top: 1px solid var(--line);
  padding-top: var(--space-5);
}
```

### Duplicate Group 164 (2 occurrences)

**Locations:**
- `src/lib/client/settings/GlobalSettings.svelte:38` - `.settings-section:first-child`
- `src/lib/client/settings/ThemeSettings.svelte:38` - `.theme-section:first-child`

**CSS:**
```css


	.settings-section:first-child {
		border-top: none;
		padding-top: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-top: none;
  padding-top: 0;
}
```

### Duplicate Group 165 (2 occurrences)

**Locations:**
- `src/lib/client/settings/GlobalSettings.svelte:106` - `.setting-input.input-error,
	.setting-select.input-error`
- `src/lib/client/shared/components/SettingField.svelte:55` - `.setting-input.input-error`

**CSS:**
```css


	.setting-input.input-error,
	.setting-select.input-error {
		border-color: var(--err);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-color: var(--err);
}
```

### Duplicate Group 166 (2 occurrences)

**Locations:**
- `src/lib/client/settings/PreferencesPanel.svelte:1` - `.preferences-panel`
- `src/lib/client/settings/RetentionSettings.svelte:1` - `.retention-settings`

**CSS:**
```css


	
	.preferences-panel {
		container-type: inline-size;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  container-type: inline-size;
}
```

### Duplicate Group 167 (6 occurrences)

**Locations:**
- `src/lib/client/settings/PreferencesPanel.svelte:6` - `.preferences-panel > div:first-child`
- `src/lib/client/shared/components/HelpModal.svelte:11` - `.shortcut-category`
- `src/routes/console/+page.svelte:78` - `.tab-section h2`
- `src/routes/console/+page.svelte:256` - `.history-list-header`
- `src/routes/console/+page.svelte:293` - `.history-header`
- `src/routes/console/+page.svelte:297` - `.history-metadata,
	.history-events`

**CSS:**
```css


	.preferences-panel > div:first-child {
		margin-bottom: var(--space-5);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-5);
}
```

### Duplicate Group 168 (3 occurrences)

**Locations:**
- `src/lib/client/settings/PreferencesPanel.svelte:19` - `.preferences-panel p`
- `src/lib/client/settings/sections/StorageSettings.svelte:29` - `.settings-description`
- `src/lib/client/settings/sections/StorageSettings.svelte:190` - `.clear-description`

**CSS:**
```css


	.preferences-panel p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
		margin: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  color: var(--muted);
  margin: 0;
}
```

### Duplicate Group 169 (2 occurrences)

**Locations:**
- `src/lib/client/settings/PreferencesPanel.svelte:73` - `.loading-indicator`
- `src/lib/client/settings/RetentionSettings.svelte:61` - `.loading-indicator`

**CSS:**
```css


	
	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-6) var(--space-5);
		color: var(--muted);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-5);
  color: var(--muted);
}
```

### Duplicate Group 170 (2 occurrences)

**Locations:**
- `src/lib/client/settings/PreferencesPanel.svelte:94` - `.form-input,
		.form-select`
- `src/routes/console/+page.svelte:288` - `.history-detail`

**CSS:**
```css


		.form-input,
		.form-select {
			max-width: 100%;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  max-width: 100%;
}
```

### Duplicate Group 171 (2 occurrences)

**Locations:**
- `src/lib/client/settings/RetentionSettings.svelte:40` - `.preview-result p`
- `src/lib/client/settings/ThemeSettings.svelte:106` - `.upload-text`

**CSS:**
```css


	.preview-result p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
		margin: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  color: var(--text);
  margin: 0;
}
```

### Duplicate Group 172 (2 occurrences)

**Locations:**
- `src/lib/client/settings/ThemePreviewCard.svelte:33` - `.dots`
- `src/lib/client/terminal/MobileTerminalInput.svelte:49` - `.right-keys`

**CSS:**
```css


	.dots {
		display: flex;
		gap: var(--space-2);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  gap: var(--space-2);
}
```

### Duplicate Group 173 (2 occurrences)

**Locations:**
- `src/lib/client/settings/ThemePreviewCard.svelte:195` - `.palette-row`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:164` - `.session-type-buttons,
		.tab-buttons`

**CSS:**
```css


		.palette-row {
			gap: 2px;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  gap: 2px;
}
```

### Duplicate Group 174 (2 occurrences)

**Locations:**
- `src/lib/client/settings/ThemeSettings.svelte:305` - `}

	
	.upload-link:focus-visible,
	.message-close:focus-visible`
- `src/lib/client/shared/components/DirectoryBrowser.svelte:106` - `.directory-item-enhanced button:focus-visible`

**CSS:**
```css

	}

	
	.upload-link:focus-visible,
	.message-close:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

### Duplicate Group 175 (5 occurrences)

**Locations:**
- `src/lib/client/settings/sections/ClaudeAuth.svelte:1` - `.claude-auth`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:26` - `.auth-content`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:80` - `.flow-steps`
- `src/lib/client/settings/sections/OAuthSettings.svelte:5` - `.setting-group`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte:1` - `.terminal-key-settings`

**CSS:**
```css

	.claude-auth {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
```

### Duplicate Group 176 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/ClaudeAuth.svelte:11` - `.panel-title`
- `src/lib/client/settings/sections/ClaudeDefaults.svelte:12` - `.settings-title`

**CSS:**
```css


	.panel-title {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-family: var(--font-mono);
  font-size: 1.4rem;
  color: var(--primary);
  margin: 0 0 var(--space-2) 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

### Duplicate Group 177 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/ClaudeAuth.svelte:42` - `.status-card--checking`
- `src/lib/client/settings/sections/ClaudeAuth.svelte:50` - `.status-card--not-authenticated`

**CSS:**
```css


	.status-card--checking {
		background: rgba(255, 255, 255, 0.02);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: rgba(255, 255, 255, 0.02);
}
```

### Duplicate Group 178 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte:50` - `.directory-browser-container`
- `src/lib/client/settings/sections/HomeDirectoryManager.svelte:55` - `.file-editor-container`

**CSS:**
```css


	.directory-browser-container {
		flex: 1;
		overflow: hidden;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex: 1;
  overflow: hidden;
}
```

### Duplicate Group 179 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/OAuthSettings.svelte:18` - `.field-actions`
- `src/lib/client/settings/sections/TerminalKeySettings.svelte:50` - `.setting-helper`

**CSS:**
```css


	.field-actions {
		display: flex;
		justify-content: flex-end;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  justify-content: flex-end;
}
```

### Duplicate Group 180 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/OAuthSettings.svelte:35` - `.info-icon`
- `src/lib/client/settings/sections/OAuthSettings.svelte:101` - `.notice-icon`

**CSS:**
```css


	.info-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: 1.25rem;
  flex-shrink: 0;
}
```

### Duplicate Group 181 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/StorageSettings.svelte:95` - `.stat-label`
- `src/lib/client/settings/sections/StorageSettings.svelte:145` - `.category-count`

**CSS:**
```css


	.stat-label {
		font-size: var(--font-size-0);
		color: var(--muted);
		font-family: var(--font-mono);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-size: var(--font-size-0);
  color: var(--muted);
  font-family: var(--font-mono);
}
```

### Duplicate Group 182 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/StorageSettings.svelte:261` - `.clear-option`
- `src/lib/client/settings/sections/StorageSettings.svelte:267` - `.settings-footer`

**CSS:**
```css


		.clear-option {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-3);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
```

### Duplicate Group 183 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:8` - `.tunnel-status`
- `src/lib/client/settings/sections/TunnelControl.svelte:15` - `.tunnel-config`

**CSS:**
```css


	.tunnel-status {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		margin-bottom: var(--space-md);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}
```

### Duplicate Group 184 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:22` - `.config-section`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:40` - `.config-row`

**CSS:**
```css


	.config-section {
		margin-bottom: var(--space-sm);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-sm);
}
```

### Duplicate Group 185 (3 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:30` - `.config-label`
- `src/lib/client/settings/sections/TunnelControl.svelte:93` - `.url-label`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:54` - `.url-label`

**CSS:**
```css


	.config-label {
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: var(--space-xs);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: var(--space-xs);
}
```

### Duplicate Group 186 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:36` - `.config-input-wrapper`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:84` - `.login-url-wrapper`

**CSS:**
```css


	.config-input-wrapper {
		display: flex;
		gap: var(--space-sm);
		align-items: stretch;
		margin-bottom: var(--space-xs);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  gap: var(--space-sm);
  align-items: stretch;
  margin-bottom: var(--space-xs);
}
```

### Duplicate Group 187 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:73` - `.status-value.enabled`
- `src/lib/client/settings/sections/TunnelControl.svelte:81` - `.status-value.running`

**CSS:**
```css


	.status-value.enabled {
		color: #4ade80;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: #4ade80;
}
```

### Duplicate Group 188 (4 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:89` - `.tunnel-url`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:13` - `.tunnel-status`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:36` - `.tunnel-config`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:50` - `.tunnel-url`

**CSS:**
```css


	.tunnel-url {
		margin-bottom: var(--space-md);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin-bottom: var(--space-md);
}
```

### Duplicate Group 189 (2 occurrences)

**Locations:**
- `src/lib/client/settings/sections/TunnelControl.svelte:99` - `.url-wrapper`
- `src/lib/client/settings/sections/VSCodeTunnelControl.svelte:60` - `.url-wrapper`

**CSS:**
```css


	.url-wrapper {
		display: flex;
		gap: var(--space-sm);
		align-items: stretch;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  gap: var(--space-sm);
  align-items: stretch;
}
```

### Duplicate Group 190 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/AppVersion.svelte:16` - `@media (max-width: 400px)`
- `src/lib/client/shared/components/StatusBar.svelte:16` - `@media (max-width: 400px)`

**CSS:**
```css


	
	@media (max-width: 400px) {
		.version-indicator {
			display: none;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  .version-indicator { display: none;
}
```

### Duplicate Group 191 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/GitOperations.svelte:123` - `.diff-header h4`
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte:97` - `.category-header h3`

**CSS:**
```css


	.diff-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
```

### Duplicate Group 192 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/LoadingSpinner.svelte:1` - `.spinner-wrapper`
- `src/lib/client/shared/components/LoadingSpinner.svelte:19` - `.spinner`

**CSS:**
```css

	.spinner-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}
```

### Duplicate Group 193 (3 occurrences)

**Locations:**
- `src/lib/client/shared/components/LoadingSpinner.svelte:101` - `.spinner--inline .spinner__text`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte:44` - `.error-state p`
- `src/routes/console/+page.svelte:21` - `.console-header h1`

**CSS:**
```css


	.spinner--inline .spinner__text {
		margin: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0;
}
```

### Duplicate Group 194 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/LoadingSpinner.svelte:151` - `.spinner--secondary .spinner__circle`
- `src/lib/client/shared/components/LoadingSpinner.svelte:156` - `.spinner--muted .spinner__circle`

**CSS:**
```css


		.spinner--secondary .spinner__circle {
			border-color: transparent;
			border-top-color: currentColor;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-color: transparent;
  border-top-color: currentColor;
}
```

### Duplicate Group 195 (4 occurrences)

**Locations:**
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:21` - `.session-type-buttons`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:26` - `.tab-buttons`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte:31` - `.tab-buttons`
- `src/lib/client/terminal/MobileTerminalInput.svelte:44` - `.left-keys`

**CSS:**
```css


	.session-type-buttons {
		display: flex;
		gap: var(--space-1);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  gap: var(--space-1);
}
```

### Duplicate Group 196 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/WorktreeManager.svelte:14` - `.worktree-list`
- `src/lib/client/shared/components/WorktreeManager.svelte:118` - `.command-list`

**CSS:**
```css


	.worktree-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

### Duplicate Group 197 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/KeyboardShortcutsOverlay.svelte:235` - `.shortcut-keys`
- `src/routes/console/+page.svelte:393` - `.label`

**CSS:**
```css


		.shortcut-keys {
			min-width: auto;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  min-width: auto;
}
```

### Duplicate Group 198 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/LayoutControls.svelte:10` - `.layout-controls :global(.btn-icon-only.active svg)`
- `src/lib/client/shared/components/workspace/WorkspacePage.svelte:57` - `.pwa-instructions__steps li`

**CSS:**
```css


	.layout-controls :global(.btn-icon-only.active svg) {
		color: var(--text-primary);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  color: var(--text-primary);
}
```

### Duplicate Group 199 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/SessionContainer.svelte:13` - `.session-container:hover`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte:26` - `.session-container.claude:hover,
	.session-container.claude.focused`

**CSS:**
```css


	.session-container:hover {
		border-color: var(--primary);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-color: var(--primary);
}
```

### Duplicate Group 200 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/SessionContainer.svelte:31` - `.session-container.pty`
- `src/lib/client/shared/components/workspace/SessionContainer.svelte:35` - `.session-container.pty:hover,
	.session-container.pty.focused`

**CSS:**
```css


	.session-container.pty {
		border-color: var(--accent-amber);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-color: var(--accent-amber);
}
```

### Duplicate Group 201 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:1` - `.session-header`
- `src/lib/client/terminal/TerminalHeader.svelte:1` - `.terminal-header`

**CSS:**
```css

	.session-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: var(--space-3);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 44px;
		flex-shrink: 0;
		gap: var(--space-3);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: var(--space-3);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--primary-dim);
  min-height: 44px;
  flex-shrink: 0;
  gap: var(--space-3);
}
```

### Duplicate Group 202 (3 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:12` - `.session-status`
- `src/lib/client/terminal/TerminalHeader.svelte:12` - `.session-status`
- `src/lib/client/terminal/TerminalHeader.svelte:79` - `.terminal-actions`

**CSS:**
```css


	.session-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

### Duplicate Group 203 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:37` - `.session-info`
- `src/lib/client/terminal/TerminalHeader.svelte:40` - `.session-info`

**CSS:**
```css


	.session-info {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
```

### Duplicate Group 204 (2 occurrences)

**Locations:**
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte:62` - `@keyframes slideDown`
- `src/lib/client/terminal/TerminalPane.svelte:102` - `}

	@keyframes fadeIn`

**CSS:**
```css


	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { opacity: 0;
  transform: translateY(-8px);
}
```

### Duplicate Group 205 (2 occurrences)

**Locations:**
- `src/lib/client/terminal/MobileTerminalView.svelte:11` - `.terminal-loading`
- `src/lib/client/terminal/TerminalPane.svelte:40` - `.terminal-loading`

**CSS:**
```css

	.terminal-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--bg) 95%, var(--accent) 5%),
			color-mix(in oklab, var(--bg) 80%, transparent)
		);
		padding: var(--space-3);
		animation: fadeIn 0.3s ease-in;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.absolute {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: linear-gradient( to bottom, color-mix(in oklab, var(--bg) 95%, var(--accent) 5%), color-mix(in oklab, var(--bg) 80%, transparent) );
  padding: var(--space-3);
  animation: fadeIn 0.3s ease-in;
}
```

### Duplicate Group 206 (2 occurrences)

**Locations:**
- `src/lib/client/terminal/MobileTerminalView.svelte:25` - `.loading-message`
- `src/lib/client/terminal/TerminalPane.svelte:55` - `.loading-message`

**CSS:**
```css


	.loading-message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--accent);
		font-size: 0.875rem;
		font-family: var(--font-mono);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--accent);
  font-size: 0.875rem;
  font-family: var(--font-mono);
}
```

### Duplicate Group 207 (3 occurrences)

**Locations:**
- `src/lib/client/terminal/TerminalPane.svelte:24` - `.terminal-container :global(.xterm)`
- `src/lib/client/terminal/TerminalPane.svelte:30` - `.terminal-container :global(.xterm .xterm-viewport)`
- `src/lib/client/terminal/TerminalPane.svelte:35` - `.terminal-container :global(.xterm .xterm-screen)`

**CSS:**
```css


	
	.terminal-container :global(.xterm) {
		width: 100% !important;
		height: 100% !important;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  width: 100% !important;
  height: 100% !important;
}
```

### Duplicate Group 208 (2 occurrences)

**Locations:**
- `src/routes/+page.svelte:502` - `.card`
- `src/routes/+page.svelte:508` - `form :global(.input-group),
		form :global(button)`

**CSS:**
```css


		.card {
			animation: none;
			opacity: 1;
			transform: none;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  animation: none;
  opacity: 1;
  transform: none;
}
```

### Duplicate Group 209 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:1` - `body`
- `src/routes/_testing/_tiles/+page.svelte:1` - `body`

**CSS:**
```css

		body {
			margin: 0;
			font-family:
				system-ui,
				-apple-system,
				sans-serif;
			background: #1a1a1a;
			color: #fff;
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #1a1a1a;
  color: #fff;
}
```

### Duplicate Group 210 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:10` - `.demo-host`
- `src/routes/_testing/_tiles/+page.svelte:11` - `.demo-host`

**CSS:**
```css

	


	.demo-host {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #1a1a1a;
		color: #fff;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #fff;
}
```

### Duplicate Group 211 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:20` - `.demo-host`
- `src/routes/_testing/_tiles/+page.svelte:21` - `.demo-host`

**CSS:**
```css

	
	.demo-host {
		inline-size: 100%;
		block-size: 100vh;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  inline-size: 100%;
  block-size: 100vh;
}
```

### Duplicate Group 212 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:25` - `.demo-header`
- `src/routes/_testing/_tiles/+page.svelte:26` - `.demo-header`

**CSS:**
```css


	.demo-header {
		padding: 1rem;
		border-bottom: 1px solid #333;
		background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  padding: 1rem;
  border-bottom: 1px solid #333;
  background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

### Duplicate Group 213 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:34` - `.header-content h1`
- `src/routes/_testing/_tiles/+page.svelte:35` - `.header-content h1`

**CSS:**
```css


	.header-content h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.5rem;
		background: linear-gradient(45deg, #0066cc, #00ccff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
  background: linear-gradient(45deg, #0066cc, #00ccff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Duplicate Group 214 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:43` - `.header-content p`
- `src/routes/_testing/_tiles/+page.svelte:44` - `.header-content p`

**CSS:**
```css


	.header-content p {
		margin: 0;
		color: #aaa;
		font-size: 0.9rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0;
  color: #aaa;
  font-size: 0.9rem;
}
```

### Duplicate Group 215 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:55` - `.instructions-panel`
- `src/routes/_testing/_tiles/+page.svelte:66` - `.instructions-panel`

**CSS:**
```css


	.instructions-panel {
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		padding: 1rem;
		animation: slideDown 0.3s ease-out;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  padding: 1rem;
  animation: slideDown 0.3s ease-out;
}
```

### Duplicate Group 216 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:62` - `@keyframes slideDown`
- `src/routes/_testing/_tiles/+page.svelte:73` - `@keyframes slideDown`

**CSS:**
```css


	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  from { opacity: 0;
  transform: translateY(-10px);
}
```

### Duplicate Group 217 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:81` - `.instruction-group h3`
- `src/routes/_testing/_tiles/+page.svelte:92` - `.instruction-group h3`

**CSS:**
```css


	.instruction-group h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		color: #0066cc;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #0066cc;
}
```

### Duplicate Group 218 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:87` - `.shortcuts`
- `src/routes/_testing/_tiles/+page.svelte:98` - `.shortcuts`

**CSS:**
```css


	.shortcuts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
```

### Duplicate Group 219 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:111` - `.window-container`
- `src/routes/_testing/_tiles/+page.svelte:117` - `.window-container`

**CSS:**
```css


	.window-container {
		flex: 1;
		min-height: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  flex: 1;
  min-height: 0;
}
```

### Duplicate Group 220 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:116` - `:global(.wm-root)`
- `src/routes/_testing/_tiles/+page.svelte:122` - `:global(.wm-root)`

**CSS:**
```css


	
	:global(.wm-root) {
		width: 100%;
		height: 100%;
		background: #222;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  width: 100%;
  height: 100%;
  background: #222;
}
```

### Duplicate Group 221 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:123` - `:global(.wm-split)`
- `src/routes/_testing/_tiles/+page.svelte:129` - `:global(.wm-split)`

**CSS:**
```css


	:global(.wm-split) {
		display: flex;
		width: 100%;
		height: 100%;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  width: 100%;
  height: 100%;
}
```

### Duplicate Group 222 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:137` - `:global(.wm-pane)`
- `src/routes/_testing/_tiles/+page.svelte:143` - `:global(.wm-pane)`

**CSS:**
```css


	:global(.wm-pane) {
		display: flex;
		min-width: 0;
		min-height: 0;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  display: flex;
  min-width: 0;
  min-height: 0;
}
```

### Duplicate Group 223 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:143` - `:global(.wm-divider)`
- `src/routes/_testing/_tiles/+page.svelte:149` - `:global(.wm-divider)`

**CSS:**
```css


	:global(.wm-divider) {
		background: #555;
		position: relative;
		transition: background-color 0.2s;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: #555;
  position: relative;
  transition: background-color 0.2s;
}
```

### Duplicate Group 224 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:149` - `:global(.wm-divider:hover)`
- `src/routes/_testing/_tiles/+page.svelte:155` - `:global(.wm-divider:hover)`

**CSS:**
```css


	:global(.wm-divider:hover) {
		background: #777;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: #777;
}
```

### Duplicate Group 225 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:165` - `:global(.wm-tile)`
- `src/routes/_testing/_tiles/+page.svelte:169` - `:global(.wm-tile)`

**CSS:**
```css


	:global(.wm-tile) {
		width: 100%;
		height: 100%;
		border: none;
		background: #2a2a2a;
		color: inherit;
		padding: 0;
		margin: 0;
		display: flex;
		cursor: pointer;
		transition: all 0.2s;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.flex-row {
  width: 100%;
  height: 100%;
  border: none;
  background: #2a2a2a;
  color: inherit;
  padding: 0;
  margin: 0;
  display: flex;
  cursor: pointer;
  transition: all 0.2s;
}
```

### Duplicate Group 226 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:178` - `:global(.wm-tile[data-focused='true'])`
- `src/routes/_testing/_tiles/+page.svelte:182` - `:global(.wm-tile[data-focused='true'])`

**CSS:**
```css


	:global(.wm-tile[data-focused='true']) {
		background: #333;
		box-shadow: inset 0 0 0 2px #0066cc;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: #333;
  box-shadow: inset 0 0 0 2px #0066cc;
}
```

### Duplicate Group 227 (2 occurrences)

**Locations:**
- `src/routes/_testing/_session-tiles/+page.svelte:240` - `.control-btn.close-btn:hover`
- `src/routes/_testing/_session-tiles/+page.svelte:309` - `.close-empty-tile:hover`

**CSS:**
```css


	.control-btn.close-btn:hover {
		background: #cc4444;
		border-color: #cc4444;
		color: white;
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background: #cc4444;
  border-color: #cc4444;
  color: white;
}
```

### Duplicate Group 228 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:145` - `.event-card.event-connection`
- `src/routes/console/+page.svelte:324` - `.timeline-event.event-connection`

**CSS:**
```css


	.event-card.event-connection {
		border-left: 4px solid var(--ok);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-left: 4px solid var(--ok);
}
```

### Duplicate Group 229 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:149` - `.event-card.event-disconnect`
- `src/routes/console/+page.svelte:328` - `.timeline-event.event-disconnect`

**CSS:**
```css


	.event-card.event-disconnect {
		border-left: 4px solid var(--err);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-left: 4px solid var(--err);
}
```

### Duplicate Group 230 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:153` - `.event-card.event-auth`
- `src/routes/console/+page.svelte:332` - `.timeline-event.event-auth`

**CSS:**
```css


	.event-card.event-auth {
		border-left: 4px solid var(--warn);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-left: 4px solid var(--warn);
}
```

### Duplicate Group 231 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:157` - `.event-card.event-input`
- `src/routes/console/+page.svelte:336` - `.timeline-event.event-input`

**CSS:**
```css


	.event-card.event-input {
		border-left: 4px solid var(--accent);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-left: 4px solid var(--accent);
}
```

### Duplicate Group 232 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:161` - `.event-card.event-output`
- `src/routes/console/+page.svelte:340` - `.timeline-event.event-output`

**CSS:**
```css


	.event-card.event-output {
		border-left: 4px solid var(--info);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  border-left: 4px solid var(--info);
}
```

### Duplicate Group 233 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:239` - `.log-level.info,
	.badge.info`
- `src/routes/console/+page.svelte:358` - `.direction-out`

**CSS:**
```css


	.log-level.info,
	.badge.info {
		background-color: var(--info);
		color: var(--bg);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: var(--info);
  color: var(--bg);
}
```

### Duplicate Group 234 (2 occurrences)

**Locations:**
- `src/routes/console/+page.svelte:245` - `.log-level.debug,
	.badge.debug`
- `src/routes/console/+page.svelte:363` - `.direction-system`

**CSS:**
```css


	.log-level.debug,
	.badge.debug {
		background-color: var(--muted);
		color: var(--bg);
	}
```

**Suggested Refactoring:**
```css
/* Create utility class */
.utility-class {
  background-color: var(--muted);
  color: var(--bg);
}
```

## Near Duplicates

These CSS rule blocks share significant similarity (≥80%). Consider extracting common patterns.

### Near-Duplicate Pair 1 (90% similar)

**Rule 1:**
- Location: `src/lib/client/settings/sections/OAuthSettings.svelte:89`
- Selector: `.oauth-notice`

**Rule 2:**
- Location: `src/lib/client/shared/components/SettingField.svelte:79`
- Selector: `.env-fallback`

**Common Declarations:**
```css
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-1);
  font-family: var(--font-mono);
```

**Unique to Rule 2:**
```css
  line-height: 1.5;
```

### Near-Duplicate Pair 2 (90% similar)

**Rule 1:**
- Location: `src/lib/client/settings/sections/TerminalKeySettings.svelte:55`
- Selector: `.security-notice`

**Rule 2:**
- Location: `src/lib/client/shared/components/SettingField.svelte:79`
- Selector: `.env-fallback`

**Common Declarations:**
```css
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-1);
  line-height: 1.5;
```

**Unique to Rule 2:**
```css
  font-family: var(--font-mono);
```

### Near-Duplicate Pair 3 (87.5% similar)

**Rule 1:**
- Location: `src/lib/client/claude/activity-summaries/BashActivity.svelte:11`
- Selector: `.activity-badge`

**Rule 2:**
- Location: `src/lib/client/claude/activity-summaries/EditActivity.svelte:1`
- Selector: `.activity-badge`

**Common Declarations:**
```css
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
```

**Unique to Rule 2:**
```css
  margin-left: var(--space-2);
```

### Near-Duplicate Pair 4 (87.5% similar)

**Rule 1:**
- Location: `src/lib/client/claude/activity-summaries/BashActivity.svelte:11`
- Selector: `.activity-badge`

**Rule 2:**
- Location: `src/lib/client/claude/activity-summaries/WriteActivity.svelte:1`
- Selector: `.activity-badge`

**Common Declarations:**
```css
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
```

**Unique to Rule 2:**
```css
  margin-left: var(--space-2);
```

### Near-Duplicate Pair 5 (85.7% similar)

**Rule 1:**
- Location: `src/routes/settings/+page.svelte:8`
- Selector: `.loading-state`

**Rule 2:**
- Location: `src/routes/settings/+page.svelte:144`
- Selector: `.error-container`

**Common Declarations:**
```css
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: var(--space-3);
```

**Unique to Rule 2:**
```css
  text-align: center;
```

### Near-Duplicate Pair 6 (83.3% similar)

**Rule 1:**
- Location: `src/lib/client/shared/components/workspace/SingleSessionView.svelte:1`
- Selector: `.single-session-view`

**Rule 2:**
- Location: `src/lib/client/terminal/TerminalPane.svelte:1`
- Selector: `.terminal-wrapper`

**Common Declarations:**
```css
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
```

**Unique to Rule 2:**
```css
  overflow: visible;
```

### Near-Duplicate Pair 7 (81.8% similar)

**Rule 1:**
- Location: `src/routes/_testing/_session-tiles/+page.svelte:93`
- Selector: `.shortcuts kbd`

**Rule 2:**
- Location: `src/routes/_testing/_tiles/+page.svelte:104`
- Selector: `.shortcuts kbd`

**Common Declarations:**
```css
  background: #333;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-xs);
  font-size: 0.8rem;
  border: 1px solid #555;
  display: inline-block;
  min-width: 60px;
  text-align: center;
  margin-right: 0.5rem;
```

**Unique to Rule 1:**
```css
  font-family: 'JetBrains Mono', monospace;
```

**Unique to Rule 2:**
```css
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Near-Duplicate Pair 8 (80% similar)

**Rule 1:**
- Location: `src/lib/client/claude/ClaudeProjectPicker.svelte:186`
- Selector: `.empty,
	.err`

**Rule 2:**
- Location: `src/lib/client/settings/sections/HomeDirectoryManager.svelte:27`
- Selector: `.loading-state`

**Common Declarations:**
```css
  padding: var(--space-4);
  text-align: center;
  font-family: var(--font-mono);
  color: var(--text-muted);
```

**Unique to Rule 1:**
```css
  font-style: italic;
```

### Near-Duplicate Pair 9 (80% similar)

**Rule 1:**
- Location: `src/lib/client/claude/ClaudeSessionPicker.svelte:189`
- Selector: `.empty,
	.err`

**Rule 2:**
- Location: `src/lib/client/settings/sections/HomeDirectoryManager.svelte:27`
- Selector: `.loading-state`

**Common Declarations:**
```css
  padding: var(--space-4);
  text-align: center;
  font-family: var(--font-mono);
  color: var(--text-muted);
```

**Unique to Rule 1:**
```css
  font-style: italic;
```

### Near-Duplicate Pair 10 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/AuthenticationSettings.svelte:19`
- Selector: `.settings-description`

**Rule 2:**
- Location: `src/lib/client/shared/components/SettingField.svelte:21`
- Selector: `.setting-description`

**Common Declarations:**
```css
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  line-height: 1.5;
```

**Unique to Rule 1:**
```css
  margin: 0 0 var(--space-5) 0;
```

### Near-Duplicate Pair 11 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/GlobalSettings.svelte:19`
- Selector: `.settings-description`

**Rule 2:**
- Location: `src/lib/client/shared/components/SettingField.svelte:21`
- Selector: `.setting-description`

**Common Declarations:**
```css
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  line-height: 1.5;
```

**Unique to Rule 1:**
```css
  margin: 0 0 var(--space-5) 0;
```

### Near-Duplicate Pair 12 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/GlobalSettings.svelte:78`
- Selector: `.setting-description`

**Rule 2:**
- Location: `src/lib/client/settings/ThemeSettings.svelte:124`
- Selector: `.upload-hint`

**Common Declarations:**
```css
  font-size: var(--font-size-0);
  color: var(--muted);
  font-family: var(--font-mono);
  margin: 0;
```

**Unique to Rule 1:**
```css
  line-height: 1.5;
```

### Near-Duplicate Pair 13 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/PreferencesPanel.svelte:58`
- Selector: `.form-help`

**Rule 2:**
- Location: `src/lib/client/settings/RetentionSettings.svelte:54`
- Selector: `.form-help`

**Common Declarations:**
```css
  display: block;
  font-size: var(--font-size-0);
  color: var(--muted);
  margin-top: var(--space-1);
```

**Unique to Rule 1:**
```css
  font-style: italic;
```

### Near-Duplicate Pair 14 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/ThemeSettings.svelte:18`
- Selector: `.settings-description`

**Rule 2:**
- Location: `src/lib/client/shared/components/SettingField.svelte:21`
- Selector: `.setting-description`

**Common Declarations:**
```css
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  line-height: 1.5;
```

**Unique to Rule 1:**
```css
  margin: 0 0 var(--space-5) 0;
```

### Near-Duplicate Pair 15 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/ThemeSettings.svelte:51`
- Selector: `.section-description`

**Rule 2:**
- Location: `src/lib/client/settings/sections/StorageSettings.svelte:167`
- Selector: `.action-group p`

**Common Declarations:**
```css
  margin: 0 0 var(--space-4) 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
```

**Unique to Rule 1:**
```css
  line-height: 1.5;
```

### Near-Duplicate Pair 16 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/ThemeSettings.svelte:51`
- Selector: `.section-description`

**Rule 2:**
- Location: `src/lib/client/shared/components/SettingField.svelte:21`
- Selector: `.setting-description`

**Common Declarations:**
```css
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  line-height: 1.5;
```

**Unique to Rule 1:**
```css
  margin: 0 0 var(--space-4) 0;
```

### Near-Duplicate Pair 17 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/sections/OAuthSettings.svelte:23`
- Selector: `.provider-info`

**Rule 2:**
- Location: `src/lib/client/settings/sections/OAuthSettings.svelte:89`
- Selector: `.oauth-notice`

**Common Declarations:**
```css
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-1);
```

**Unique to Rule 1:**
```css
  margin-top: var(--space-2);
```

**Unique to Rule 2:**
```css
  font-family: var(--font-mono);
```

### Near-Duplicate Pair 18 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/sections/OAuthSettings.svelte:23`
- Selector: `.provider-info`

**Rule 2:**
- Location: `src/lib/client/settings/sections/TerminalKeySettings.svelte:55`
- Selector: `.security-notice`

**Common Declarations:**
```css
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-1);
```

**Unique to Rule 1:**
```css
  margin-top: var(--space-2);
```

**Unique to Rule 2:**
```css
  line-height: 1.5;
```

### Near-Duplicate Pair 19 (80% similar)

**Rule 1:**
- Location: `src/lib/client/settings/sections/OAuthSettings.svelte:89`
- Selector: `.oauth-notice`

**Rule 2:**
- Location: `src/lib/client/settings/sections/TerminalKeySettings.svelte:55`
- Selector: `.security-notice`

**Common Declarations:**
```css
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-1);
```

**Unique to Rule 1:**
```css
  font-family: var(--font-mono);
```

**Unique to Rule 2:**
```css
  line-height: 1.5;
```

### Near-Duplicate Pair 20 (80% similar)

**Rule 1:**
- Location: `src/lib/client/shared/components/workspace/SingleSessionView.svelte:1`
- Selector: `.single-session-view`

**Rule 2:**
- Location: `src/lib/client/terminal/MobileTerminalView.svelte:1`
- Selector: `.mobile-terminal-wrapper`

**Common Declarations:**
```css
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
```

**Unique to Rule 1:**
```css
  width: 100%;
```

## Common Patterns

These patterns appear frequently and could benefit from utility classes.

### Flexbox Center (48 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/buttons.css:6` - `.btn__spinner`
- `src/lib/client/shared/styles/components/buttons.css:12` - `.btn-icon-only`
- `src/lib/client/shared/styles/components/claude.css:87` - `.step-number`
- `src/lib/client/shared/styles/components/claude.css:259` - `.ai-avatar`
- `src/lib/client/shared/styles/components/claude.css:296` - `.ai-avatar-small`
- ... and 43 more

### Flex Column (89 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/claude.css:1` - `.claude-auth`
- `src/lib/client/shared/styles/components/claude.css:9` - `.auth-content`
- `src/lib/client/shared/styles/components/claude.css:65` - `.flow-setup`
- `src/lib/client/shared/styles/components/claude.css:75` - `.flow-steps`
- `src/lib/client/shared/styles/components/claude.css:120` - `.claude-settings`
- ... and 84 more

### Absolute Position (27 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/misc.css:1` - `.tile-controls`
- `src/lib/client/shared/styles/components/misc.css:124` - `.markdown-content ul li::before`
- `src/lib/client/shared/styles/components/misc.css:171` - `.markdown-content pre[class*='language-']::before`
- `src/lib/client/shared/styles/components/type-card.css:19` - `.type-card::before`
- `src/lib/client/shared/styles/retro.css:347` - `.button::before`
- ... and 22 more

### Fixed Position (11 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/modal.css:1` - `.modal-backdrop`
- `src/lib/client/shared/styles/retro.css:879` - `body::before`
- `src/lib/client/onboarding/AuthenticationStep.svelte:149` - `.loading-overlay`
- `src/lib/client/settings/ThemeSettings.svelte:198` - `.modal-overlay`
- `src/lib/client/settings/ThemeSettings.svelte:247` - `.loading-overlay`
- ... and 6 more

### Card Layout (27 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/claude.css:120` - `.claude-settings`
- `src/lib/client/shared/styles/components/claude.css:352` - `.message-text`
- `src/lib/client/shared/styles/components/misc.css:1` - `.tile-controls`
- `src/lib/client/shared/styles/retro.css:149` - `.card,
.panel`
- `src/lib/client/shared/styles/retro.css:206` - `input[type='text'],
input[type='search'],
input[type='password'],
input[type='email'],
input[type='url'],
input[type='tel'],
input[type='number'],
select,
textarea`
- ... and 22 more

### Text Truncation (5 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/menu-panel.css:98` - `.directory-path`
- `src/lib/client/shared/styles/components/session-card.css:86` - `.workspace-path`
- `src/lib/client/claude/ClaudeHeader.svelte:47` - `.project-name`
- `src/lib/client/shared/components/workspace/SessionHeader.svelte:55` - `.project-name`
- `src/lib/client/terminal/TerminalHeader.svelte:68` - `.project-name`

### Transition Effect (98 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/components/buttons.css:1` - `.btn__text--hidden`
- `src/lib/client/shared/styles/components/buttons.css:12` - `.btn-icon-only`
- `src/lib/client/shared/styles/components/buttons.css:68` - `.btn-icon-only svg`
- `src/lib/client/shared/styles/components/buttons.css:116` - `.clone-btn`
- `src/lib/client/shared/styles/components/buttons.css:152` - `.cancel-btn`
- ... and 93 more

### Transform (211 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/animations.css:1` - `@keyframes fadeInUp`
- `src/lib/client/shared/styles/animations.css:5` - `to`
- `src/lib/client/shared/styles/animations.css:36` - `}


@keyframes slideIn`
- `src/lib/client/shared/styles/animations.css:44` - `to`
- `src/lib/client/shared/styles/animations.css:49` - `}

@keyframes slideInFromLeft`
- ... and 206 more

### Grid Layout (21 occurrences)

**Example locations:**
- `src/lib/client/shared/styles/retro.css:200` - `.term-grid`
- `src/lib/client/shared/styles/retro.css:1232` - `.type-grid`
- `src/lib/client/claude/ClaudeProjectPicker.svelte:1` - `.cc-picker`
- `src/lib/client/claude/ClaudeProjectPicker.svelte:29` - `.row`
- `src/lib/client/claude/ClaudeProjectPicker.svelte:94` - `.bar`
- ... and 16 more

## Recommendations

### Quick Wins

1. **Extract 234 exact duplicates** into utility classes
   - Create reusable classes in a utilities CSS file
   - Replace duplicate rules with class references
   - Estimated reduction: ~17% of CSS
2. **Review 20 near-duplicate pairs**
   - Identify common patterns worth extracting
   - Consider CSS variables for shared values
   - Use mixins or utility classes for repeated patterns
3. **Create utility classes for common patterns**
   - Top patterns to extract:
     - Transform: 211 occurrences
     - Transition Effect: 98 occurrences
     - Flex Column: 89 occurrences
     - Flexbox Center: 48 occurrences
     - Absolute Position: 27 occurrences

### Best Practices

- Use CSS custom properties (variables) for repeated values
- Create utility classes for common patterns
- Consider a utility-first approach for frequently repeated styles
- Extract component-specific styles to component files
- Use CSS Grid/Flexbox utilities for layout patterns
