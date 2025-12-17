// Disable SSR for OpenCode portal
// The page uses browser-only components (OpenCodePane, Modal)
// that access browser APIs like document and window
export const ssr = false;
