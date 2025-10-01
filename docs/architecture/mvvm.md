# MVVM in Dispatch (Svelte 5)

This app uses a pragmatic MVVM pattern with Svelte 5 runes. ViewModels live in `.svelte.js` modules and co-locate reactive state (`$state`), derived values (`$derived`), and imperative methods.

## Why we do it

- Keep UI components lean and declarative
- Co-locate session/business logic with reactive state
- Test ViewModels in isolation (plain classes/functions)

## Pattern at a glance

- Location: `src/lib/client/**/**/*ViewModel.svelte.js` and `src/lib/client/**/state/*.svelte.js`
- Style: Class with runes initialized in constructor or field initializers
- Contract: expose plain fields/getters for state and plain methods for actions

### Minimal example

```js
// src/lib/client/settings/SettingsViewModel.svelte.js
export class SettingsViewModel {
  constructor(api) {
    this.isLoading = $state(false);
    this.error = $state(null);
    this.categories = $state({});
    this.canSave = $derived.by(() => Object.keys(this.categories).length > 0);
  }

  async load() {
    this.isLoading = true;
    try {
      this.categories = await api.fetchCategories();
    } catch (e) {
      this.error = e?.message || 'Failed to load';
    } finally {
      this.isLoading = false;
    }
  }
}
```

### Using it in a component

```svelte
<script>
  import { SettingsViewModel } from './SettingsViewModel.svelte.js';
  import { serviceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

  const api = await serviceContainer.get('SessionApiClient');
  const vm = new SettingsViewModel(api);

  onMount(() => vm.load());
</script>

{#if vm.isLoading}
  <p>Loading…</p>
{:else if vm.error}
  <p class="error">{vm.error}</p>
{:else}
  <!-- render categories -->
{/if}
```

## Do / Don’t

- Do: Initialize runes with `let` fields inside classes; this is supported in Svelte 5
- Do: Keep side effects in the component via `$effect`/`onMount` when they touch the DOM
- Don’t: Export Svelte stores from ViewModels; prefer runes and plain fields
- Don’t: Depend on component scope inside ViewModels; pass dependencies via constructor

## When to prefer a factory

If a class isn’t adding value, a factory function can encapsulate the same runes-backed state and return a plain object with getters/methods. Both styles are acceptable—be consistent within a feature.

## References

- Svelte 5 runes ($state, $derived, $effect)
- Existing examples: `src/lib/client/settings/SettingsViewModel.svelte.js`, `src/lib/client/shared/state/*`
