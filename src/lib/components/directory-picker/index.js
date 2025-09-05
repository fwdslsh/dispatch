/**
 * Directory Picker Components - Barrel Export
 * 
 * Decomposed from 498-line god component into 4 focused MVVM components:
 * - DirectoryPickerManager: Smart container with ViewModel integration (95 lines)
 * - DirectoryPickerInput: Input field with browse/clear buttons (60 lines)  
 * - DirectoryPickerDropdown: Dropdown with breadcrumbs and navigation (80 lines)
 * - DirectoryBrowser: Directory listing with selection controls (85 lines)
 * 
 * Total: 320 lines (36% reduction) with improved maintainability and testability
 */

export { default as DirectoryPickerManager } from './DirectoryPickerManager.svelte';
export { default as DirectoryPickerInput } from './DirectoryPickerInput.svelte';
export { default as DirectoryPickerDropdown } from './DirectoryPickerDropdown.svelte';
export { default as DirectoryBrowser } from './DirectoryBrowser.svelte';

// Default export is the main manager component
export { default as default } from './DirectoryPickerManager.svelte';