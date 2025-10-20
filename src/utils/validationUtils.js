/**
 * Validation Utility Functions
 * Handles configuration and input validation
 */

/**
 * Validate required configuration value
 * @param {object} config - Configuration object
 * @param {string} key - Configuration key to validate
 * @param {string} type - Expected type ('string', 'number', 'boolean', etc.)
 * @throws {Error} If configuration is invalid
 */
export function requireConfig(config, key, type = 'string') {
  const value = config[key];
  
  if (value == null) {
    throw new Error(`Configuration ${key} is required but not set`);
  }
  
  if (typeof value !== type) {
    throw new Error(
      `Configuration ${key} must be of type ${type}, got ${typeof value}`
    );
  }
  
  if (type === 'string' && value.trim() === '') {
    throw new Error(`Configuration ${key} cannot be an empty string`);
  }
}

/**
 * Validate multiple configuration keys
 * @param {object} config - Configuration object
 * @param {Array<string>} keys - Array of keys to validate
 * @param {string} type - Expected type for all keys
 */
export function validateConfig(config, keys, type = 'string') {
  keys.forEach(key => requireConfig(config, key, type));
}

/**
 * Check if a string is gibberish/nonsensical
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to be gibberish
 */
export function isGibberish(text) {
  if (!text || typeof text !== 'string') return true;
  
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  
  // Check for repeated characters (e.g., "aaaaa", "-----")
  if (/(.)\1{4,}/.test(trimmed)) return true;
  
  // Check for lack of vowels in long strings
  if (trimmed.length > 20 && !/[aeiouAEIOU]/.test(trimmed)) return true;
  
  // Check for excessive punctuation
  const punctuationCount = (trimmed.match(/[^\w\s]/g) || []).length;
  if (punctuationCount > trimmed.length * 0.5) return true;
  
  return false;
}

/**
 * Validate message text
 * @param {string} text - Message text to validate
 * @returns {boolean} True if message is valid
 */
export function isValidMessage(text) {
  if (!text || typeof text !== 'string') return false;
  
  const trimmed = text.trim();
  return trimmed.length > 0 && !isGibberish(trimmed);
}
