// src/lib/server/symlink-manager.js
/**
 * Symlink management utilities for readable session directories
 */

import fs from 'node:fs';
import path from 'node:path';
import { sanitizeSessionName } from './name-validation.js';

/**
 * Get the current PTY_ROOT, reading from environment
 * @returns {string} Current PTY_ROOT path
 */
function getPtyRoot() {
  return process.env.PTY_ROOT || '/tmp/dispatch-sessions';
}

/**
 * Get the path to the by-name directory
 * @returns {string} Path to the by-name directory
 */
export function getByNamePath() {
  return path.join(getPtyRoot(), 'by-name');
}

/**
 * Ensure the by-name directory exists
 */
function ensureByNameDirectory() {
  const byNamePath = getByNamePath();
  if (!fs.existsSync(byNamePath)) {
    fs.mkdirSync(byNamePath, { recursive: true });
  }
}

/**
 * Get existing symlink names in by-name directory
 * @returns {Array<string>} Array of existing symlink names (without extension)
 */
function getExistingSymlinkNames() {
  const byNamePath = getByNamePath();
  
  if (!fs.existsSync(byNamePath)) {
    return [];
  }
  
  try {
    return fs.readdirSync(byNamePath, { withFileTypes: true })
      .filter(dirent => dirent.isSymbolicLink())
      .map(dirent => dirent.name);
  } catch (err) {
    console.warn('Failed to read by-name directory:', err.message);
    return [];
  }
}

/**
 * Resolve name conflicts by adding incremental suffix
 * @param {string} baseName - Base sanitized name
 * @param {Array<string>} existingNames - Existing symlink names
 * @returns {string} Unique symlink name
 */
function resolveSymlinkNameConflict(baseName, existingNames) {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  
  let counter = 2;
  let candidateName;
  
  do {
    candidateName = `${baseName}-${counter}`;
    counter++;
  } while (existingNames.includes(candidateName) && counter < 100);
  
  return candidateName;
}

/**
 * Create a symlink for a session
 * @param {string} sessionUuid - The session UUID directory name
 * @param {string} sessionName - The human-readable session name
 * @returns {string} The symlink name that was created
 */
export function createSymlink(sessionUuid, sessionName) {
  ensureByNameDirectory();
  
  // Sanitize the session name for filesystem use
  let sanitizedName = sanitizeSessionName(sessionName);
  
  // If sanitization results in empty string, use fallback
  if (!sanitizedName) {
    sanitizedName = `session-${sessionUuid.slice(0, 8)}`;
  }
  
  // Check for conflicts and resolve them
  const existingNames = getExistingSymlinkNames();
  const uniqueName = resolveSymlinkNameConflict(sanitizedName, existingNames);
  
  // Create the symlink
  const byNamePath = getByNamePath();
  const symlinkPath = path.join(byNamePath, uniqueName);
  const targetPath = path.join('..', sessionUuid); // Relative path to session directory
  
  try {
    fs.symlinkSync(targetPath, symlinkPath);
    console.log(`Created symlink: ${uniqueName} -> ${sessionUuid}`);
    return uniqueName;
  } catch (err) {
    console.error(`Failed to create symlink ${uniqueName}:`, err.message);
    throw new Error(`Failed to create session symlink: ${err.message}`);
  }
}

/**
 * Remove symlink by exact name match
 * @param {string} symlinkName - The exact symlink name to remove
 */
export function removeSymlinkByName(symlinkName) {
  const byNamePath = getByNamePath();
  const symlinkPath = path.join(byNamePath, symlinkName);
  
  if (fs.existsSync(symlinkPath)) {
    try {
      const stats = fs.lstatSync(symlinkPath);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(symlinkPath);
        console.log(`Removed symlink: ${symlinkName}`);
      }
    } catch (err) {
      console.warn(`Failed to remove symlink ${symlinkName}:`, err.message);
    }
  }
}

/**
 * Remove symlink for a session (finds the matching symlink)
 * @param {string} sessionName - The original session name
 */
export function removeSymlink(sessionName) {
  const byNamePath = getByNamePath();
  
  if (!fs.existsSync(byNamePath)) {
    return; // Nothing to remove
  }
  
  // Find the exact symlink that corresponds to this session name
  const sanitizedName = sanitizeSessionName(sessionName);
  
  // First try the exact name
  const exactPath = path.join(byNamePath, sanitizedName);
  if (fs.existsSync(exactPath)) {
    removeSymlinkByName(sanitizedName);
    return;
  }
  
  // If not found, don't try to guess - we might remove the wrong one
  console.warn(`No symlink found for session name: ${sessionName} (sanitized: ${sanitizedName})`);
}

/**
 * Clean up orphaned symlinks that point to non-existent directories
 */
export function cleanupOrphanedSymlinks() {
  const byNamePath = getByNamePath();
  
  if (!fs.existsSync(byNamePath)) {
    return;
  }
  
  try {
    const entries = fs.readdirSync(byNamePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isSymbolicLink()) {
        continue;
      }
      
      const symlinkPath = path.join(byNamePath, entry.name);
      
      try {
        // Check if the symlink target exists
        const targetExists = fs.existsSync(symlinkPath);
        
        if (!targetExists) {
          fs.unlinkSync(symlinkPath);
          console.log(`Cleaned up orphaned symlink: ${entry.name}`);
        }
      } catch (err) {
        // If we can't read the symlink, it's probably orphaned
        try {
          fs.unlinkSync(symlinkPath);
          console.log(`Cleaned up broken symlink: ${entry.name}`);
        } catch (unlinkErr) {
          console.warn(`Failed to clean up symlink ${entry.name}:`, unlinkErr.message);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to cleanup orphaned symlinks:', err.message);
  }
}

/**
 * Update symlink when session name changes
 * @param {string} sessionUuid - The session UUID
 * @param {string} oldName - The old session name
 * @param {string} newName - The new session name
 * @returns {string} The new symlink name
 */
export function updateSymlink(sessionUuid, oldName, newName) {
  // Remove old symlink
  removeSymlink(oldName);
  
  // Create new symlink
  return createSymlink(sessionUuid, newName);
}