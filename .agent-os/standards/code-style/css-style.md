# CSS Style Guide

We use PicoCSS and modern CSS features for all styling.

### Modern CSS Practices

- Prefer semantic HTML and PicoCSS utility classes for clean, minimal markup.
- Use CSS custom properties (`--variable-name`) for theme and design tokens.
- Use nested CSS rules for better structure (supported in modern browsers).
- Scope styles to components using `:scope` or container queries when possible.
- Avoid global overrides; keep styles modular and maintainable.

**Example:**

```css
:root {
  --radius: 0.5rem;
}

.card {
  background: var(--pico-primary);
  border-radius: var(--radius);
  padding: 1rem;
  color: white;
  
  & h2 {
    margin-top: 0;
  }
}
```
