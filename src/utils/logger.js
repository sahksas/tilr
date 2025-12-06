/**
 * Simple logging utility
 */

let verboseMode = false;

/**
 * Set verbose logging mode
 * @param {boolean} enabled
 */
export function setVerbose(enabled) {
  verboseMode = enabled;
}

/**
 * Standard log output
 * @param {string} message
 */
export function log(message) {
  console.log(message);
}

/**
 * Verbose log output (only in verbose mode)
 * @param {string} message
 */
export function verbose(message) {
  if (verboseMode) {
    console.log(`  ${message}`);
  }
}

/**
 * Error log output
 * @param {string} message
 */
export function error(message) {
  console.error(`❌ ${message}`);
}

/**
 * Success log output
 * @param {string} message
 */
export function success(message) {
  console.log(`✅ ${message}`);
}

/**
 * Hint log output (colored cyan)
 * @param {string} message
 */
export function hint(message) {
  console.log(`\x1b[36m${message}\x1b[0m`);
}

/**
 * Progress display
 * @param {number} current
 * @param {number} total
 * @param {string} label
 */
export function progress(current, total, label) {
  const percent = Math.round((current / total) * 100);
  console.log(`[${current}/${total}] ${percent}% - ${label}`);
}
