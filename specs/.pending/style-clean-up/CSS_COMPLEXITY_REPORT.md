# CSS Complexity Analysis Report

Generated on 10/7/2025, 3:36:14 PM

> This report analyzes CSS complexity metrics including specificity, nesting depth, and problem patterns.

## Summary

- **Total CSS Files:** 16
- **Total CSS Rules:** 442
- **Average Complexity Score:** 3.16/10
- **High Complexity Files:** 2 (threshold: 7)

## Complexity Overview

| File               | Complexity    | Avg Specificity | Max Nesting | Rules | Problems |
| ------------------ | ------------- | --------------- | ----------- | ----- | -------- |
| `buttons.css`      | **7.5**/10 ⚠️ | 21.6            | 1           | 31    | 17       |
| `type-card.css`    | **7.2**/10 ⚠️ | 23.6            | 1           | 14    | 6        |
| `retro.css`        | **6.5**/10    | 19.5            | 2           | 120   | 45       |
| `session-card.css` | **5.8**/10    | 18.1            | 0           | 16    | 7        |
| `modal.css`        | **3.8**/10    | 12.5            | 0           | 8     | 2        |
| `misc.css`         | **3.7**/10    | 13.4            | 2           | 41    | 2        |
| `claude.css`       | **3.0**/10    | 12.0            | 1           | 47    | 2        |
| `status-bar.css`   | **2.9**/10    | 12.0            | 0           | 10    | 1        |
| `utilities.css`    | **2.9**/10    | 10.4            | 2           | 84    | 1        |
| `menu-panel.css`   | **2.6**/10    | 11.3            | 0           | 16    | 1        |
| `forms.css`        | **2.2**/10    | 10.8            | 0           | 12    | 0        |
| `variables.css`    | **2.0**/10    | 10.0            | 0           | 1     | 0        |
| `animations.css`   | **0.6**/10    | 2.1             | 0           | 42    | 1        |
| `index.css`        | **0.0**/10    | 0.0             | 0           | 0     | 0        |
| `fonts.css`        | **0.0**/10    | 0.0             | 0           | 0     | 0        |
| `index.css`        | **0.0**/10    | 0.0             | 0           | 0     | 0        |

---

## ⚠️ High Complexity Files (Score > 7)

These files should be prioritized for refactoring:

### src/lib/client/shared/styles/components/buttons.css

**Complexity Score:** 7.5/10

**Metrics:**

- Average Specificity: 21.65
- Max Nesting Depth: 1
- Complex Selectors: 2
- Problem Selectors: 17
- File Size: 3.5 KB

### src/lib/client/shared/styles/components/type-card.css

**Complexity Score:** 7.2/10

**Metrics:**

- Average Specificity: 23.57
- Max Nesting Depth: 1
- Complex Selectors: 3
- Problem Selectors: 6
- File Size: 2.6 KB

---

## Problem Selectors

Found 85 selectors with potential issues:

### animations.css

**Line 505:** `.animate-slide-in:not(.animating)`

- ⚠️ High specificity (0,4,0)

### buttons.css

**Line 33:** `.btn-icon-only.primary`

- ⚠️ Qualified class selector

**Line 38:** `.btn-icon-only.warn`

- ⚠️ Qualified class selector

**Line 42:** `.btn-icon-only.danger`

- ⚠️ Qualified class selector

**Line 46:** `.btn-icon-only.danger:hover`

- ⚠️ Qualified class selector

**Line 50:** `.btn-icon-only.ghost`

- ⚠️ Qualified class selector

**Line 54:** `.btn-icon-only.ghost:hover`

- ⚠️ Qualified class selector

**Line 59:** `.btn-icon-only.active`

- ⚠️ Qualified class selector

**Line 80:** `.btn-icon-only.primary svg`

- ⚠️ Qualified class selector

**Line 84:** `.btn-icon-only.primary:hover svg`

- ⚠️ Qualified class selector

**Line 89:** `.btn-icon-only.warn svg`

- ⚠️ Qualified class selector

**Line 94:** `.btn-icon-only.warn:hover svg`

- ⚠️ Qualified class selector

**Line 98:** `.btn-icon-only.danger svg`

- ⚠️ Qualified class selector

**Line 102:** `.btn-icon-only.danger:hover svg`

- ⚠️ Qualified class selector

**Line 106:** `.btn-icon-only.ghost svg`

- ⚠️ Qualified class selector

**Line 110:** `.btn-icon-only.ghost:hover svg`

- ⚠️ Qualified class selector

**Line 138:** `.clone-btn:hover:not(:disabled)`

- ⚠️ High specificity (0,5,0)

**Line 170:** `.cancel-btn:hover:not(:disabled)`

- ⚠️ High specificity (0,5,0)

### claude.css

**Line 199:** `.advanced-settings[open] > :not(summary)`

- ⚠️ High specificity (0,4,0)

**Line 257:** `.ai-status.thinking`

- ⚠️ Qualified class selector

### menu-panel.css

**Line 72:** `.status-message.error`

- ⚠️ Qualified class selector

### misc.css

**Line 169:** `.markdown-content pre[class*='language-']`

- ⚠️ Uses universal selector (\*)

**Line 173:** `.markdown-content pre[class*='language-']::before`

- ⚠️ Uses universal selector (\*)

### modal.css

**Line 21:** `.modal-backdrop.open`

- ⚠️ Qualified class selector

**Line 44:** `.modal-container.open`

- ⚠️ Qualified class selector

### session-card.css

**Line 23:** `.card-session.is-selected`

- ⚠️ Qualified class selector

**Line 29:** `.card-session.is-active`

- ⚠️ Qualified class selector

**Line 35:** `.card-session.is-active:hover`

- ⚠️ Qualified class selector

**Line 40:** `.card-session.is-active.is-selected`

- ⚠️ Qualified class selector

**Line 46:** `.card-session.is-inactive`

- ⚠️ Qualified class selector

**Line 51:** `.card-session.is-inactive:hover`

- ⚠️ Qualified class selector

**Line 55:** `.card-session.is-inactive.is-selected`

- ⚠️ Qualified class selector

### status-bar.css

**Line 71:** `.status-bar-group.status-bar-right`

- ⚠️ Qualified class selector

### type-card.css

**Line 32:** `.type-card:hover:not(:disabled)::before`

- ⚠️ High specificity (0,5,0)

**Line 36:** `.type-card:hover:not(:disabled)`

- ⚠️ High specificity (0,5,0)

**Line 49:** `.type-card.active`

- ⚠️ Qualified class selector

**Line 100:** `.type-card:hover:not(:disabled) .type-card__icon`

- ⚠️ High specificity (0,6,0)

**Line 106:** `.type-card.active .type-card__desc`

- ⚠️ Qualified class selector

**Line 111:** `.type-card.active .type-card__icon`

- ⚠️ Qualified class selector

### retro.css

**Line 34:** `*`

- ⚠️ Uses universal selector (\*)

**Line 140:** `.stack > * + *`

- ⚠️ Uses universal selector (\*)

**Line 194:** `.card.aug`

- ⚠️ Qualified class selector

**Line 198:** `.panel.aug`

- ⚠️ Qualified class selector

**Line 242:** `textarea:hover:not(:disabled):not(:focus)`

- ⚠️ High specificity (0,7,1)

**Line 262:** `textarea:active:not(:disabled)`

- ⚠️ High specificity (0,4,1)

**Line 280:** `textarea:invalid:not(:focus)`

- ⚠️ High specificity (0,4,1)

**Line 297:** `textarea:valid:not(:placeholder-shown):not(:focus)`

- ⚠️ High specificity (0,7,1)

**Line 361:** `.button:hover:not(:disabled)`

- ⚠️ High specificity (0,5,0)

**Line 369:** `.button:hover:not(:disabled)::before`

- ⚠️ High specificity (0,5,0)

**Line 373:** `.button:active:not(:disabled)`

- ⚠️ High specificity (0,5,0)

**Line 390:** `.button.disabled`

- ⚠️ Qualified class selector

**Line 402:** `.button.primary`

- ⚠️ Qualified class selector

**Line 410:** `.button.primary:hover:not(:disabled)`

- ⚠️ High specificity (0,6,0)
- ⚠️ Qualified class selector

**Line 418:** `.button.secondary`

- ⚠️ Qualified class selector

**Line 425:** `.button.secondary:hover:not(:disabled)`

- ⚠️ High specificity (0,6,0)
- ⚠️ Qualified class selector

**Line 430:** `.button.ghost`

- ⚠️ Qualified class selector

**Line 439:** `.button.ghost:hover:not(:disabled)`

- ⚠️ High specificity (0,6,0)
- ⚠️ Qualified class selector

**Line 446:** `.button.warn`

- ⚠️ Qualified class selector

**Line 452:** `.button.warn:hover:not(:disabled)`

- ⚠️ High specificity (0,6,0)
- ⚠️ Qualified class selector

**Line 457:** `.button.danger`

- ⚠️ Qualified class selector

**Line 463:** `.button.danger:hover:not(:disabled)`

- ⚠️ High specificity (0,6,0)
- ⚠️ Qualified class selector

**Line 709:** `.button.aug`

- ⚠️ Qualified class selector

**Line 739:** `.button.aug:hover`

- ⚠️ Qualified class selector

**Line 754:** `.button.aug.active`

- ⚠️ Qualified class selector

**Line 769:** `.button.aug.ghost:hover`

- ⚠️ High specificity (0,4,0)
- ⚠️ Qualified class selector

**Line 784:** `.button.aug.ghost.active`

- ⚠️ High specificity (0,4,0)
- ⚠️ Qualified class selector

**Line 799:** `.button.aug.ghost.active`

- ⚠️ High specificity (0,4,0)
- ⚠️ Qualified class selector

**Line 846:** `.badge.ok`

- ⚠️ Qualified class selector

**Line 851:** `.badge.warn`

- ⚠️ Qualified class selector

**Line 856:** `.badge.err`

- ⚠️ Qualified class selector

**Line 875:** `*:focus-visible`

- ⚠️ Uses universal selector (\*)

**Line 915:** `.session-indicator.active::before`

- ⚠️ Qualified class selector

**Line 940:** `.btn-group .button:hover:not(.active)::before`

- ⚠️ High specificity (0,6,0)

**Line 944:** `.btn-group .button.active`

- ⚠️ Qualified class selector

**Line 997:** `.workspace-selector:hover:not(:disabled)`

- ⚠️ High specificity (0,5,0)

**Line 1016:** `.workspace-selector:hover:not(:disabled) .workspace-selector__icon`

- ⚠️ High specificity (0,6,0)

**Line 1030:** `.workspace-selector:hover:not(:disabled) .workspace-selector__arrow`

- ⚠️ High specificity (0,6,0)

**Line 1117:** `.type-card:hover:not(:disabled)::before`

- ⚠️ High specificity (0,5,0)

**Line 1155:** `.type-card:hover:not(:disabled)`

- ⚠️ High specificity (0,5,0)

**Line 1168:** `.type-card:hover:not(:disabled) .type-card__icon`

- ⚠️ High specificity (0,6,0)

**Line 1173:** `.type-card.active`

- ⚠️ Qualified class selector

**Line 1185:** `.type-card.active .type-card__desc`

- ⚠️ Qualified class selector

**Line 1190:** `.type-card.active .type-card__icon`

- ⚠️ Qualified class selector

**Line 1200:** `.session-card.selected`

- ⚠️ Qualified class selector

### utilities.css

**Line 40:** `.space-y-2 > * + *`

- ⚠️ Uses universal selector (\*)

---

## Detailed File Analysis

### src/lib/client/shared/styles/components/buttons.css

**Complexity Score:** 7.5/10

**Metrics:**

- File Size: 3.5 KB
- Total Rules: 31
- Average Specificity: 21.65
- Max Nesting Depth: 1
- Complex Selectors: 2
- Problem Selectors: 17

<details>
<summary>Show problems</summary>

**Line 33:** `.btn-icon-only.primary`

- Qualified class selector

**Line 38:** `.btn-icon-only.warn`

- Qualified class selector

**Line 42:** `.btn-icon-only.danger`

- Qualified class selector

**Line 46:** `.btn-icon-only.danger:hover`

- Qualified class selector

**Line 50:** `.btn-icon-only.ghost`

- Qualified class selector

**Line 54:** `.btn-icon-only.ghost:hover`

- Qualified class selector

**Line 59:** `.btn-icon-only.active`

- Qualified class selector

**Line 80:** `.btn-icon-only.primary svg`

- Qualified class selector

**Line 84:** `.btn-icon-only.primary:hover svg`

- Qualified class selector

**Line 89:** `.btn-icon-only.warn svg`

- Qualified class selector

**Line 94:** `.btn-icon-only.warn:hover svg`

- Qualified class selector

**Line 98:** `.btn-icon-only.danger svg`

- Qualified class selector

**Line 102:** `.btn-icon-only.danger:hover svg`

- Qualified class selector

**Line 106:** `.btn-icon-only.ghost svg`

- Qualified class selector

**Line 110:** `.btn-icon-only.ghost:hover svg`

- Qualified class selector

**Line 138:** `.clone-btn:hover:not(:disabled)`

- High specificity (0,5,0)

**Line 170:** `.cancel-btn:hover:not(:disabled)`

- High specificity (0,5,0)

</details>

---

### src/lib/client/shared/styles/components/type-card.css

**Complexity Score:** 7.2/10

**Metrics:**

- File Size: 2.6 KB
- Total Rules: 14
- Average Specificity: 23.57
- Max Nesting Depth: 1
- Complex Selectors: 3
- Problem Selectors: 6

<details>
<summary>Show problems</summary>

**Line 32:** `.type-card:hover:not(:disabled)::before`

- High specificity (0,5,0)

**Line 36:** `.type-card:hover:not(:disabled)`

- High specificity (0,5,0)

**Line 49:** `.type-card.active`

- Qualified class selector

**Line 100:** `.type-card:hover:not(:disabled) .type-card__icon`

- High specificity (0,6,0)

**Line 106:** `.type-card.active .type-card__desc`

- Qualified class selector

**Line 111:** `.type-card.active .type-card__icon`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/retro.css

**Complexity Score:** 6.5/10

**Metrics:**

- File Size: 26.7 KB
- Total Rules: 120
- Average Specificity: 19.51
- Max Nesting Depth: 2
- Complex Selectors: 22
- Problem Selectors: 45

<details>
<summary>Show problems</summary>

**Line 34:** `*`

- Uses universal selector (\*)

**Line 140:** `.stack > * + *`

- Uses universal selector (\*)

**Line 194:** `.card.aug`

- Qualified class selector

**Line 198:** `.panel.aug`

- Qualified class selector

**Line 242:** `textarea:hover:not(:disabled):not(:focus)`

- High specificity (0,7,1)

**Line 262:** `textarea:active:not(:disabled)`

- High specificity (0,4,1)

**Line 280:** `textarea:invalid:not(:focus)`

- High specificity (0,4,1)

**Line 297:** `textarea:valid:not(:placeholder-shown):not(:focus)`

- High specificity (0,7,1)

**Line 361:** `.button:hover:not(:disabled)`

- High specificity (0,5,0)

**Line 369:** `.button:hover:not(:disabled)::before`

- High specificity (0,5,0)

**Line 373:** `.button:active:not(:disabled)`

- High specificity (0,5,0)

**Line 390:** `.button.disabled`

- Qualified class selector

**Line 402:** `.button.primary`

- Qualified class selector

**Line 410:** `.button.primary:hover:not(:disabled)`

- High specificity (0,6,0)
- Qualified class selector

**Line 418:** `.button.secondary`

- Qualified class selector

**Line 425:** `.button.secondary:hover:not(:disabled)`

- High specificity (0,6,0)
- Qualified class selector

**Line 430:** `.button.ghost`

- Qualified class selector

**Line 439:** `.button.ghost:hover:not(:disabled)`

- High specificity (0,6,0)
- Qualified class selector

**Line 446:** `.button.warn`

- Qualified class selector

**Line 452:** `.button.warn:hover:not(:disabled)`

- High specificity (0,6,0)
- Qualified class selector

**Line 457:** `.button.danger`

- Qualified class selector

**Line 463:** `.button.danger:hover:not(:disabled)`

- High specificity (0,6,0)
- Qualified class selector

**Line 709:** `.button.aug`

- Qualified class selector

**Line 739:** `.button.aug:hover`

- Qualified class selector

**Line 754:** `.button.aug.active`

- Qualified class selector

**Line 769:** `.button.aug.ghost:hover`

- High specificity (0,4,0)
- Qualified class selector

**Line 784:** `.button.aug.ghost.active`

- High specificity (0,4,0)
- Qualified class selector

**Line 799:** `.button.aug.ghost.active`

- High specificity (0,4,0)
- Qualified class selector

**Line 846:** `.badge.ok`

- Qualified class selector

**Line 851:** `.badge.warn`

- Qualified class selector

**Line 856:** `.badge.err`

- Qualified class selector

**Line 875:** `*:focus-visible`

- Uses universal selector (\*)

**Line 915:** `.session-indicator.active::before`

- Qualified class selector

**Line 940:** `.btn-group .button:hover:not(.active)::before`

- High specificity (0,6,0)

**Line 944:** `.btn-group .button.active`

- Qualified class selector

**Line 997:** `.workspace-selector:hover:not(:disabled)`

- High specificity (0,5,0)

**Line 1016:** `.workspace-selector:hover:not(:disabled) .workspace-selector__icon`

- High specificity (0,6,0)

**Line 1030:** `.workspace-selector:hover:not(:disabled) .workspace-selector__arrow`

- High specificity (0,6,0)

**Line 1117:** `.type-card:hover:not(:disabled)::before`

- High specificity (0,5,0)

**Line 1155:** `.type-card:hover:not(:disabled)`

- High specificity (0,5,0)

**Line 1168:** `.type-card:hover:not(:disabled) .type-card__icon`

- High specificity (0,6,0)

**Line 1173:** `.type-card.active`

- Qualified class selector

**Line 1185:** `.type-card.active .type-card__desc`

- Qualified class selector

**Line 1190:** `.type-card.active .type-card__icon`

- Qualified class selector

**Line 1200:** `.session-card.selected`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/components/session-card.css

**Complexity Score:** 5.8/10

**Metrics:**

- File Size: 2.1 KB
- Total Rules: 16
- Average Specificity: 18.13
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 7

<details>
<summary>Show problems</summary>

**Line 23:** `.card-session.is-selected`

- Qualified class selector

**Line 29:** `.card-session.is-active`

- Qualified class selector

**Line 35:** `.card-session.is-active:hover`

- Qualified class selector

**Line 40:** `.card-session.is-active.is-selected`

- Qualified class selector

**Line 46:** `.card-session.is-inactive`

- Qualified class selector

**Line 51:** `.card-session.is-inactive:hover`

- Qualified class selector

**Line 55:** `.card-session.is-inactive.is-selected`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/components/modal.css

**Complexity Score:** 3.8/10

**Metrics:**

- File Size: 1.9 KB
- Total Rules: 8
- Average Specificity: 12.50
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 2

<details>
<summary>Show problems</summary>

**Line 21:** `.modal-backdrop.open`

- Qualified class selector

**Line 44:** `.modal-container.open`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/components/misc.css

**Complexity Score:** 3.7/10

**Metrics:**

- File Size: 5.8 KB
- Total Rules: 41
- Average Specificity: 13.41
- Max Nesting Depth: 2
- Complex Selectors: 0
- Problem Selectors: 2

<details>
<summary>Show problems</summary>

**Line 169:** `.markdown-content pre[class*='language-']`

- Uses universal selector (\*)

**Line 173:** `.markdown-content pre[class*='language-']::before`

- Uses universal selector (\*)

</details>

---

### src/lib/client/shared/styles/components/claude.css

**Complexity Score:** 3.0/10

**Metrics:**

- File Size: 9.6 KB
- Total Rules: 47
- Average Specificity: 12.02
- Max Nesting Depth: 1
- Complex Selectors: 1
- Problem Selectors: 2

<details>
<summary>Show problems</summary>

**Line 199:** `.advanced-settings[open] > :not(summary)`

- High specificity (0,4,0)

**Line 257:** `.ai-status.thinking`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/components/status-bar.css

**Complexity Score:** 2.9/10

**Metrics:**

- File Size: 1.4 KB
- Total Rules: 10
- Average Specificity: 12.00
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 1

<details>
<summary>Show problems</summary>

**Line 71:** `.status-bar-group.status-bar-right`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/utilities.css

**Complexity Score:** 2.9/10

**Metrics:**

- File Size: 7.4 KB
- Total Rules: 84
- Average Specificity: 10.36
- Max Nesting Depth: 2
- Complex Selectors: 0
- Problem Selectors: 1

<details>
<summary>Show problems</summary>

**Line 40:** `.space-y-2 > * + *`

- Uses universal selector (\*)

</details>

---

### src/lib/client/shared/styles/components/menu-panel.css

**Complexity Score:** 2.6/10

**Metrics:**

- File Size: 2.5 KB
- Total Rules: 16
- Average Specificity: 11.25
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 1

<details>
<summary>Show problems</summary>

**Line 72:** `.status-message.error`

- Qualified class selector

</details>

---

### src/lib/client/shared/styles/components/forms.css

**Complexity Score:** 2.2/10

**Metrics:**

- File Size: 2.1 KB
- Total Rules: 12
- Average Specificity: 10.83
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 0

---

### src/lib/client/shared/styles/variables.css

**Complexity Score:** 2.0/10

**Metrics:**

- File Size: 4.3 KB
- Total Rules: 1
- Average Specificity: 10.00
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 0

---

### src/lib/client/shared/styles/animations.css

**Complexity Score:** 0.6/10

**Metrics:**

- File Size: 8.7 KB
- Total Rules: 42
- Average Specificity: 2.14
- Max Nesting Depth: 0
- Complex Selectors: 1
- Problem Selectors: 1

<details>
<summary>Show problems</summary>

**Line 505:** `.animate-slide-in:not(.animating)`

- High specificity (0,4,0)

</details>

---

### src/lib/client/shared/styles/components/index.css

**Complexity Score:** 0.0/10

**Metrics:**

- File Size: 0.5 KB
- Total Rules: 0
- Average Specificity: 0.00
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 0

---

### src/lib/client/shared/styles/fonts.css

**Complexity Score:** 0.0/10

**Metrics:**

- File Size: 8.9 KB
- Total Rules: 0
- Average Specificity: 0.00
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 0

---

### src/lib/client/shared/styles/index.css

**Complexity Score:** 0.0/10

**Metrics:**

- File Size: 0.2 KB
- Total Rules: 0
- Average Specificity: 0.00
- Max Nesting Depth: 0
- Complex Selectors: 0
- Problem Selectors: 0

---

## Refactoring Recommendations

### Priority Actions

1. **Focus on High Complexity Files**
   - Start with files scoring > 7
   - Break down complex selectors into simpler ones

2. **Address Common Issues**
   - high-specificity: 29 occurrences
   - qualified-class: 58 occurrences
   - universal: 6 occurrences

3. **General Best Practices**
   - Keep specificity low (prefer classes over IDs)
   - Limit nesting to 3-4 levels maximum
   - Use utility classes for common patterns
   - Avoid universal selectors in production
   - Consider BEM or similar naming conventions
