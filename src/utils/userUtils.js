// Username generation and validation utilities
const { pool } = require('../config/database');

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = [
  'admin', 'administrator', 'api', 'www', 'app', 'root', 'null', 'undefined',
  'me', 'you', 'about', 'contact', 'help', 'support', 'terms', 'privacy',
  'settings', 'account', 'profile', 'login', 'logout', 'signup', 'signin',
  'signout', 'register', 'auth', 'oauth', 'callback', 'error', '404', '500',
  'posts', 'users', 'search', 'notifications', 'messages', 'connections',
  'groups', 'jobs', 'feed', 'explore', 'home', 'dashboard'
];

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  // Length check
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: 'Username must be at most 30 characters' };
  }

  // Format check: alphanumeric, underscores, hyphens only
  const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (!validPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, underscores, and hyphens. Must start and end with a letter or number.'
    };
  }

  // Reserved words check
  const lowerUsername = trimmed.toLowerCase();
  if (RESERVED_USERNAMES.includes(lowerUsername)) {
    return { valid: false, error: 'This username is reserved and cannot be used' };
  }

  return { valid: true };
};

/**
 * Sanitize username (normalize to lowercase, trim)
 * @param {string} username - Username to sanitize
 * @returns {string} Sanitized username
 */
const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return '';
  }
  return username.trim().toLowerCase();
};

/**
 * Generate a base username from first and last name
 * @param {string} firstName - User's first name
 * @param {string} lastName - User's last name
 * @returns {string} Base username
 */
const generateBaseUsername = (firstName, lastName) => {
  const first = (firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = (lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (!first && !last) {
    return 'user';
  }
  
  if (first && last) {
    return `${first}_${last}`;
  }
  
  return first || last || 'user';
};

/**
 * Check if username is available
 * @param {string} username - Username to check
 * @param {number} excludeUserId - Optional user ID to exclude from check (for updates)
 * @returns {Promise<boolean>} True if available, false if taken
 */
const isUsernameAvailable = async (username, excludeUserId = null) => {
  try {
    const sanitized = sanitizeUsername(username);
    if (!sanitized) {
      return false;
    }

    let query = 'SELECT id FROM users WHERE LOWER(username) = $1';
    const params = [sanitized];

    if (excludeUserId) {
      query += ' AND id != $2';
      params.push(excludeUserId);
    }

    const result = await pool.query(query, params);
    return result.rows.length === 0;
  } catch (error) {
    console.error('Error checking username availability:', error.message);
    return false;
  }
};

/**
 * Generate a unique username from name
 * @param {string} firstName - User's first name
 * @param {string} lastName - User's last name
 * @param {number} userId - Optional user ID to append for uniqueness
 * @returns {Promise<string>} Unique username
 */
const generateUsername = async (firstName, lastName, userId = null) => {
  const base = generateBaseUsername(firstName, lastName);
  let username = base;
  let counter = 0;

  // If userId is provided, try with ID first
  if (userId) {
    username = `${base}${userId}`;
    if (username.length > 30) {
      username = username.substring(0, 30);
    }
    const available = await isUsernameAvailable(username);
    if (available) {
      return username;
    }
  }

  // Try base username
  username = base;
  if (username.length > 30) {
    username = username.substring(0, 30);
  }
  
  let available = await isUsernameAvailable(username);
  if (available) {
    return username;
  }

  // Try with numbers appended
  do {
    counter++;
    const suffix = userId ? `${userId}${counter}` : counter;
    username = `${base}${suffix}`;
    if (username.length > 30) {
      // Truncate base to make room for suffix
      const maxBaseLength = 30 - suffix.toString().length;
      username = `${base.substring(0, maxBaseLength)}${suffix}`;
    }
    available = await isUsernameAvailable(username);
  } while (!available && counter < 1000);

  if (!available) {
    // Fallback: use timestamp-based username
    const timestamp = Date.now().toString().slice(-8);
    username = `user${timestamp}`;
  }

  return username;
};

module.exports = {
  validateUsername,
  sanitizeUsername,
  generateUsername,
  generateBaseUsername,
  isUsernameAvailable,
  RESERVED_USERNAMES,
};
