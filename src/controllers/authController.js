// Authentication controller
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { validateUsername, sanitizeUsername, isUsernameAvailable } = require('../utils/userUtils');

// Helper function to mask email addresses for logging
const maskEmail = (email) => {
  if (!email || email === 'N/A') return 'N/A';
  const [localPart, domain] = email.split('@');
  if (!domain) return email; // Invalid email format
  const maskedLocal = localPart.length > 3 
    ? localPart.substring(0, 3) + '***' 
    : '***';
  return `${maskedLocal}@${domain}`;
};

// Validation rules
const validateSignUp = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .custom(async (value) => {
      if (value) {
        const validation = validateUsername(value);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        const sanitized = sanitizeUsername(value);
        const available = await isUsernameAvailable(sanitized);
        if (!available) {
          throw new Error('Username is already taken');
        }
      }
      return true;
    }),
];

const validateSignIn = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Sign up handler
const signUp = async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[${timestamp}] [AUTH] [SIGNUP] Request received - Email: ${maskEmail(req.body.email)}, IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(`[${timestamp}] [AUTH] [SIGNUP] Validation failed - Email: ${maskEmail(req.body.email)}, Errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password, first_name, last_name, username } = req.body;

    // Check if user already exists
    console.log(`[${timestamp}] [AUTH] [SIGNUP] Checking if user exists - Email: ${maskEmail(email)}`);
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.warn(`[${timestamp}] [AUTH] [SIGNUP] User already exists - Email: ${maskEmail(email)}`);
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Validate and sanitize username if provided
    let finalUsername = null;
    if (username) {
      const validation = validateUsername(username);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
      finalUsername = sanitizeUsername(username);
      const available = await isUsernameAvailable(finalUsername);
      if (!available) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    // Hash password
    console.log(`[${timestamp}] [AUTH] [SIGNUP] Hashing password for - Email: ${maskEmail(email)}`);
    const hashedPassword = await hashPassword(password);

    // Create user
    console.log(`[${timestamp}] [AUTH] [SIGNUP] Creating new user - Email: ${maskEmail(email)}, Name: ${first_name} ${last_name}, Username: ${finalUsername || 'auto-generated'}`);
    const user = await User.create(email, hashedPassword, first_name, last_name, finalUsername);
    console.log(`[${timestamp}] [AUTH] [SIGNUP] User created successfully - UserId: ${user.id}, Email: ${maskEmail(email)}, Username: ${user.username}`);

    // Generate JWT token
    console.log(`[${timestamp}] [AUTH] [SIGNUP] Generating JWT token - UserId: ${user.id}, Email: ${maskEmail(email)}`);
    const token = generateToken(user.id, user.email);
    console.log(`[${timestamp}] [AUTH] [SIGNUP] JWT token generated successfully - UserId: ${user.id}`);

    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] [AUTH] [SIGNUP] Request completed successfully - UserId: ${user.id}, Email: ${maskEmail(email)}, Duration: ${duration}ms, Status: 201`);

    // Return token and user info (without password)
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${timestamp}] [AUTH] [SIGNUP] Error occurred - Email: ${maskEmail(req.body.email)}, Error: ${error.message}, Stack: ${error.stack}, Duration: ${duration}ms`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Sign in handler
const signIn = async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[${timestamp}] [AUTH] [SIGNIN] Request received - Email: ${maskEmail(req.body.email)}, IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(`[${timestamp}] [AUTH] [SIGNIN] Validation failed - Email: ${maskEmail(req.body.email)}, Errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user by email
    console.log(`[${timestamp}] [AUTH] [SIGNIN] Looking up user - Email: ${maskEmail(email)}`);
    const user = await User.findByEmail(email);
    if (!user) {
      console.warn(`[${timestamp}] [AUTH] [SIGNIN] User not found - Email: ${maskEmail(email)}, Status: 401`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password
    console.log(`[${timestamp}] [AUTH] [SIGNIN] Validating password - UserId: ${user.id}, Email: ${maskEmail(email)}`);
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.warn(`[${timestamp}] [AUTH] [SIGNIN] Invalid password - UserId: ${user.id}, Email: ${maskEmail(email)}, Status: 401`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    console.log(`[${timestamp}] [AUTH] [SIGNIN] Generating JWT token - UserId: ${user.id}, Email: ${maskEmail(email)}`);
    const token = generateToken(user.id, user.email);
    console.log(`[${timestamp}] [AUTH] [SIGNIN] JWT token generated successfully - UserId: ${user.id}`);

    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] [AUTH] [SIGNIN] Request completed successfully - UserId: ${user.id}, Email: ${maskEmail(email)}, Duration: ${duration}ms, Status: 200`);

    // Return token and user info (without password)
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${timestamp}] [AUTH] [SIGNIN] Error occurred - Email: ${maskEmail(req.body.email)}, Error: ${error.message}, Stack: ${error.stack}, Duration: ${duration}ms`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Logout handler
const logout = async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const userId = req.user?.id || 'N/A';
  const email = req.user?.email || 'N/A';
  
  try {
    console.log(`[${timestamp}] [AUTH] [LOGOUT] Request received - UserId: ${userId}, Email: ${maskEmail(email)}, IP: ${req.ip || req.connection.remoteAddress}`);
    
    // For JWT, logout is typically handled client-side by removing the token
    // If you need server-side token blacklisting, you would implement it here
    
    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] [AUTH] [LOGOUT] Request completed successfully - UserId: ${userId}, Email: ${maskEmail(email)}, Duration: ${duration}ms, Status: 200`);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${timestamp}] [AUTH] [LOGOUT] Error occurred - UserId: ${userId}, Email: ${maskEmail(email)}, Error: ${error.message}, Stack: ${error.stack}, Duration: ${duration}ms`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  signUp,
  signIn,
  logout,
  validateSignUp,
  validateSignIn,
};
