/**
 * Window Manager Type Definitions
 */

/**
 * @typedef {object} Leaf
 * @property {'leaf'} type
 * @property {string} id
 */

/**
 * @typedef {object} SplitNode
 * @property {'split'} type
 * @property {'row'|'column'} dir
 * @property {LayoutNode} a
 * @property {LayoutNode} b
 * @property {number} ratio  // 0..1 portion for "a"
 */

/**
 * @typedef {Leaf | SplitNode} LayoutNode
 */

/**
 * @typedef {object} Keymap
 * @property {string} addRight
 * @property {string} addDown
 * @property {string} close
 * @property {string} focusNext
 * @property {string} focusPrev
 * @property {string} growHeight
 * @property {string} shrinkHeight
 */

// Export empty object to make this a module
export {};
