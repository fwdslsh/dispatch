/**
 * @file Shared JSDoc type definitions for client modules
 */

/**
 * @typedef {Object} ISessionModule
 * @property {string} type - session type constant (from SESSION_TYPE)
 * @property {import('svelte').Component} component - Svelte component used to render the session pane
 * @property {import('svelte').Component} [header] - optional header component for the session
 * @property {import('svelte').Component} [settingsComponent] - optional settings component
 * @property {(session?: Record<string, any>) => Record<string, any>} prepareProps - prepare props for the session pane
 * @property {(session?: Record<string, any>, options?: Record<string, any>) => Record<string, any>} prepareHeaderProps - prepare props for the header component
 */

// Note: this file only provides JSDoc typedefs. Export a placeholder so the
// module can be imported for JSDoc `import(...)` type references.
export default {};

