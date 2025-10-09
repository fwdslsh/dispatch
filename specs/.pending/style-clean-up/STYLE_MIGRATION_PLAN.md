# Style Migration Plan

Generated on 10/7/2025, 3:36:59 PM

> This document provides a step-by-step plan for migrating external CSS into Svelte component scoped styles.

## Overview

This migration plan organizes CSS files into phases based on complexity:

- **Phase 1 (Easy Wins):** 0 CSS files used by single components
- **Phase 2 (Moderate):** 1 CSS files shared by 2-5 components
- **Phase 3 (Complex):** 9 CSS files used by 6+ components
- **Skipped:** 6 global/foundation styles or unused files

## Migration Progress

- [ ] Phase 1: Easy Wins
- [ ] Phase 2: Moderate Complexity
- [ ] Phase 3: Complex Migrations

---

## Phase 1: Easy Wins (Single Component CSS)

**Priority:** Start here for quick wins and minimal risk.

_No single-component CSS files found._

## Phase 2: Moderate Complexity (2-5 Components)

**Priority:** Handle after Phase 1. May need to split styles or create shared components.

### status-bar

**CSS File:** `src/lib/client/shared/styles/components/status-bar.css`  
**Used by 3 components:**

- `src/lib/client/shared/components/StatusBar.svelte`
- `src/lib/client/shared/components/workspace/MobileNavigation.svelte`
- `src/lib/client/shared/components/workspace/WorkspaceStatusBar.svelte`

**Migration Strategy:**

1. **Option A (Duplicate):** Copy styles into each component's <style> block
2. **Option B (Extract):** Create a shared component with these styles
3. **Option C (Keep):** Keep as external CSS if truly shared presentation logic

**Recommended Approach:**

- If styles are identical across components: Choose Option A
- If styles represent a reusable pattern: Choose Option B
- If styles are foundational/global: Choose Option C

**Scoped Styles (Reference):**

```css
/* ==================================================================
   STATUS BAR COMPONENT STYLES
   Status bar and footer navigation utilities
   ================================================================== */

.status-bar-container {
	grid-area: footer;
}

.status-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.4rem 0.6rem;
	box-sizing: border-box;
	width: 100%;
	max-width: 100svw;
	background: var(--bg-panel);
	border-top: 1px solid var(--primary-dim);
}

.status-bar-group {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	min-width: 0;
}

.status-bar-left {
	flex: 1 1 0;
	justify-content: flex-start;
}

.status-bar-center {
	flex: 0 0 auto;
	justify-content: center;
}

.status-bar-right {
	flex: 1 1 0;
	justify-content: flex-end;
}

.desktop-navigation {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-right: 0.5rem;
}

.session-counter {
	font-family: var(--font-mono);
	font-size: 0.75rem;
	color: var(--text-secondary);
	min-width: 40px;
	text-align: center;
}

/* Mobile touch improvements */
@media (hover: none) and (pointer: coarse) {
	.bottom-btn:active {
		opacity: 0.8;
		transform: scale(0.95);
	}
}

/* Small screen adjustments */
@media (max-width: 480px) {
	.status-bar {
		padding: 0.3rem 0.5rem;
	}

	.status-bar-group.status-bar-left,
	.status-bar-group.status-bar-right {
		gap: 0.25rem;
	}
}
```

---

## Phase 3: Complex Migrations (6+ Components)

**Priority:** Handle last. These are likely shared design tokens or component libraries.

### animations

**CSS File:** `src/lib/client/shared/styles/animations.css`  
**Used by 7 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

- `src/lib/client/onboarding/OnboardingFlow.svelte`
- `src/lib/client/settings/AuthenticationSettings.svelte`
- `src/lib/client/settings/AuthenticationSettingsSection.svelte`
- `src/lib/client/shared/components/IconButton.svelte`
- `src/lib/client/shared/components/PWAInstallPrompt.svelte`
- `src/lib/client/shared/components/workspace/SessionViewport.svelte`
- `src/routes/_testing/_session-tiles/+page.svelte`

---

### buttons

**CSS File:** `src/lib/client/shared/styles/components/buttons.css`  
**Used by 80 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

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
- ... and 70 more

---

### claude

**CSS File:** `src/lib/client/shared/styles/components/claude.css`  
**Used by 50 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

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
- ... and 40 more

---

### forms

**CSS File:** `src/lib/client/shared/styles/components/forms.css`  
**Used by 9 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

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

### menu-panel

**CSS File:** `src/lib/client/shared/styles/components/menu-panel.css`  
**Used by 63 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

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
- ... and 53 more

---

### misc

**CSS File:** `src/lib/client/shared/styles/components/misc.css`  
**Used by 8 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

- `src/lib/client/claude/activity-summaries/GenericActivity.svelte`
- `src/lib/client/shared/components/DirectoryBrowser.svelte`
- `src/lib/client/shared/components/IconButton.svelte`
- `src/lib/client/shared/components/Markdown.svelte`
- `src/lib/client/shared/components/window-manager/TileControls.svelte`
- `src/lib/client/shared/components/workspace/LayoutControls.svelte`
- `src/lib/client/shared/components/workspace/SessionWindowManager.svelte`
- `src/routes/_testing/_tiles/+page.svelte`

---

### modal

**CSS File:** `src/lib/client/shared/styles/components/modal.css`  
**Used by 19 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

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
- ... and 9 more

---

### session-card

**CSS File:** `src/lib/client/shared/styles/components/session-card.css`  
**Used by 7 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

- `src/lib/client/claude/ClaudeProjectPicker.svelte`
- `src/lib/client/claude/ClaudeSessionPicker.svelte`
- `src/lib/client/onboarding/WorkspaceCreationStep.svelte`
- `src/lib/client/settings/PreferencesPanel.svelte`
- `src/lib/client/shared/components/LiveIconStrip.svelte`
- `src/lib/client/shared/components/ProjectSessionMenu.svelte`
- `src/lib/client/shared/components/SessionCard.svelte`

---

### type-card

**CSS File:** `src/lib/client/shared/styles/components/type-card.css`  
**Used by 25 components**

**Migration Strategy:**

- This CSS is widely used across the codebase
- Consider keeping as external CSS or refactoring into design tokens
- If migrating, create a comprehensive testing plan

**Components using this CSS:** _(first 10 shown)_

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
- ... and 15 more

---

## Skipped Files

**These files were not included in the migration plan:**

- `src/lib/client/shared/styles/components/index.css` - Global/foundation styles (retro.css, utilities.css, variables.css, etc.)
- `src/lib/client/shared/styles/fonts.css` - Not used by any components
- `src/lib/client/shared/styles/index.css` - Global/foundation styles (retro.css, utilities.css, variables.css, etc.)
- `src/lib/client/shared/styles/retro.css` - Global/foundation styles (retro.css, utilities.css, variables.css, etc.)
- `src/lib/client/shared/styles/utilities.css` - Global/foundation styles (retro.css, utilities.css, variables.css, etc.)
- `src/lib/client/shared/styles/variables.css` - Not used by any components

---

## Migration Tips

1. **Start with Phase 1** - These are low-risk, high-value migrations
2. **Test thoroughly** - Visual regression is the primary risk
3. **Use git** - Commit each migration separately for easy rollback
4. **Run `npm test`** after each migration
5. **Check responsive behavior** - Ensure mobile/desktop views still work
6. **Review dark/light themes** - If applicable, test both theme variants
