// User controller - Profile management
const { body, validationResult } = require('express-validator');
const { withTransaction } = require('../config/database');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ProfileSettings = require('../models/ProfileSettings');
const { validateUsername, sanitizeUsername, isUsernameAvailable, generateUsername } = require('../utils/userUtils');
const MedicalExperience = require('../models/MedicalExperience');
const MedicalEducation = require('../models/MedicalEducation');
const MedicalSkill = require('../models/MedicalSkill');
const UserSkill = require('../models/UserSkill');
const MedicalCertification = require('../models/MedicalCertification');
const MedicalPublication = require('../models/MedicalPublication');
const MedicalProject = require('../models/MedicalProject');
const Award = require('../models/Award');
const Connection = require('../models/Connection');
const Follow = require('../models/Follow');
const Block = require('../models/Block');
const UserOnlineStatus = require('../models/UserOnlineStatus');
const { normalizeSkills } = require('../utils/skillUtils');
const { validateProfileData } = require('../utils/profileValidation');
const { deriveProfileFields } = require('../utils/profileDerivation');
const {
  getUserProfile: getCachedUserProfile,
  setUserProfile: setCachedUserProfile,
  getUserProfessionalData: getCachedUserProfessionalData,
  setUserProfessionalData: setCachedUserProfessionalData,
  invalidateUserCaches,
} = require('../services/cacheService');

// Validation rules for profile update
const validateProfileUpdate = [
  body('first_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('last_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  body('headline')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Headline must be less than 255 characters'),
  body('summary')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Summary must be less than 2000 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be less than 255 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('current_role')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Current role must be less than 100 characters'),
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Specialization must be less than 255 characters'),
  body('years_of_experience')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Years of experience must be between 0 and 100'),
  body('medical_school_graduation_year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Please provide a valid graduation year'),
];

// Helper: validate and parse target user ID from params
const parseTargetUserId = (req, res) => {
  const { id } = req.params;
  const targetUserId = parseInt(id, 10);

  if (isNaN(targetUserId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid user ID',
    });
    return null;
  }

  return targetUserId;
};

// Helper: ensure target user exists and is not self
const validateTargetUser = async (req, res) => {
  const currentUserId = req.user.id;
  const targetUserId = parseTargetUserId(req, res);
  if (targetUserId === null) return null;

  if (currentUserId === targetUserId) {
    res.status(400).json({
      success: false,
      message: 'You cannot perform this action on yourself',
    });
    return null;
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    res.status(404).json({
      success: false,
      message: 'Target user not found',
    });
    return null;
  }

  return { currentUserId, targetUserId, targetUser };
};

// Helper: check if users are blocked either way
const ensureNotBlockedEitherWay = async (userId1, userId2, res) => {
  const blocked = await Block.isBlockedEitherWay(userId1, userId2);
  if (blocked) {
    res.status(403).json({
      success: false,
      message: 'You cannot perform this action due to a block between users',
    });
    return false;
  }
  return true;
};

// Get current user's profile
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Try to get from cache first
    const cachedProfile = await getCachedUserProfile(userId);
    if (cachedProfile) {
      // Attach counts even for cached profiles
      const [connectionsCount, followersCount, followingCount] = await Promise.all([
        Connection.getConnectionCount(userId),
        Follow.getFollowerCount(userId),
        Follow.getFollowingCount(userId),
      ]);

      const profilePayload = cachedProfile.user || cachedProfile;
      profilePayload.counts = {
        connections: connectionsCount,
        followers: followersCount,
        following: followingCount,
      };

      return res.status(200).json({
        success: true,
        user: profilePayload,
      });
    }
    
    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get extended profile data
    const profile = await Profile.findByUserId(userId);
    
    // Get profile settings
    const settings = await ProfileSettings.findByUserId(userId);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    const profileData = {
      ...userWithoutPassword,
      profile: profile || null,
      settings: settings || null,
    };

    const [connectionsCount, followersCount, followingCount] = await Promise.all([
      Connection.getConnectionCount(userId),
      Follow.getFollowerCount(userId),
      Follow.getFollowingCount(userId),
    ]);
    profileData.counts = {
      connections: connectionsCount,
      followers: followersCount,
      following: followingCount,
    };

    // Cache the profile (async, don't wait)
    setCachedUserProfile(userId, profileData).catch(err => {
      console.error('Failed to cache user profile:', err.message);
    });

    res.status(200).json({
      success: true,
      user: profileData,
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user profile by ID or username
const getUserProfile = async (req, res) => {
  try {
    // Support both /:id and /username/:username routes
    const identifier = req.params.id || req.params.username;
    let user = null;
    let userId = null;

    // Try to parse as ID first
    const parsedId = parseInt(identifier);
    if (!isNaN(parsedId)) {
      // It's a numeric ID
      userId = parsedId;
      user = await User.findById(userId);
    } else {
      // It might be a username
      user = await User.findByUsername(identifier);
      if (user) {
        userId = user.id;
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!userId) {
      userId = user.id;
    }

    const viewerId = req.user ? req.user.id : null;

    // Hard block: prevent viewing profile if there is a block either way
    if (viewerId && viewerId !== userId) {
      const isBlocked = await Block.isBlockedEitherWay(viewerId, userId);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'You cannot view this profile',
        });
      }
    }

    // Try to get from cache first (only for public profiles)
    const cachedProfile = await getCachedUserProfile(userId);
    if (cachedProfile) {
      // Still need to check visibility
      const settings = await ProfileSettings.findByUserId(userId);
      if (settings && settings.profile_visibility === 'private' && viewerId && viewerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Profile is private',
        });
      }

      const profilePayload = cachedProfile.user || cachedProfile;

      const [connectionsCount, followersCount, followingCount] = await Promise.all([
        Connection.getConnectionCount(userId),
        Follow.getFollowerCount(userId),
        Follow.getFollowingCount(userId),
      ]);
      profilePayload.counts = {
        connections: connectionsCount,
        followers: followersCount,
        following: followingCount,
      };

      // Attach relationship flags if viewer is authenticated
      if (viewerId) {
        const [connection, iFollowThem, theyFollowMe, iBlocked, blockedMe] = await Promise.all([
          Connection.findConnection(viewerId, userId),
          Follow.isFollowing(viewerId, userId),
          Follow.isFollowing(userId, viewerId),
          Block.isBlockedOneWay(viewerId, userId),
          Block.isBlockedOneWay(userId, viewerId),
        ]);

        profilePayload.relationship = {
          isConnected: !!connection && connection.status === 'connected',
          connectionStatus: connection ? connection.status : null,
          connectionRequesterId: connection ? connection.requester_id : null,
          connectionPending: !!connection && connection.status === 'pending',
          iFollowThem,
          theyFollowMe,
          iBlocked,
          blockedMe,
        };
      }

      // Record profile visit (if viewer is authenticated and not viewing own profile)
      if (viewerId && viewerId !== userId) {
        try {
          const ProfileVisitors = require('../models/ProfileVisitors');
          await ProfileVisitors.recordVisit(viewerId, userId);
        } catch (visitError) {
          // Log but don't fail the request if visit recording fails
          console.error('Error recording profile visit:', visitError.message);
        }
      }

      return res.status(200).json({
        success: true,
        user: profilePayload,
      });
    }

    // Get user data (we already have user from earlier lookup, but ensure it's fresh from DB)
    if (!user) {
      user = await User.findById(userId);
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get extended profile data
    const profile = await Profile.findByUserId(userId);
    
    // Get profile settings to check visibility
    const settings = await ProfileSettings.findByUserId(userId);
    
    // Check if profile is visible (if settings exist and profile is private)
    if (settings && settings.profile_visibility === 'private' && req.user && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private',
      });
    }

    // Remove sensitive fields
    const { password, ...userWithoutPassword } = user;

    const profileData = {
      ...userWithoutPassword,
      profile: profile || null,
    };

    const [connectionsCount, followersCount, followingCount] = await Promise.all([
      Connection.getConnectionCount(userId),
      Follow.getFollowerCount(userId),
      Follow.getFollowingCount(userId),
    ]);
    profileData.counts = {
      connections: connectionsCount,
      followers: followersCount,
      following: followingCount,
    };

    // Attach relationship flags if viewer is authenticated
    if (viewerId) {
      const [connection, iFollowThem, theyFollowMe, iBlocked, blockedMe] = await Promise.all([
        Connection.findConnection(viewerId, userId),
        Follow.isFollowing(viewerId, userId),
        Follow.isFollowing(userId, viewerId),
        Block.isBlockedOneWay(viewerId, userId),
        Block.isBlockedOneWay(userId, viewerId),
      ]);

      profileData.relationship = {
        isConnected: !!connection && connection.status === 'connected',
        connectionStatus: connection ? connection.status : null,
        connectionRequesterId: connection ? connection.requester_id : null,
        connectionPending: !!connection && connection.status === 'pending',
        iFollowThem,
        theyFollowMe,
        iBlocked,
        blockedMe,
      };
    }

    // Record profile visit (if viewer is authenticated and not viewing own profile)
    if (viewerId && viewerId !== userId) {
      try {
        const ProfileVisitors = require('../models/ProfileVisitors');
        await ProfileVisitors.recordVisit(viewerId, userId);
      } catch (visitError) {
        // Log but don't fail the request if visit recording fails
        console.error('Error recording profile visit:', visitError.message);
      }
    }

    // Cache the profile if it's public (async, don't wait)
    if (!settings || settings.profile_visibility !== 'private') {
      setCachedUserProfile(userId, profileData).catch(err => {
        console.error('Failed to cache user profile:', err.message);
      });
    }

    res.status(200).json({
      success: true,
      user: profileData,
    });
  } catch (error) {
    console.error('Get user profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Check username availability
const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
      });
    }

    // Validate format
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        available: false,
        message: validation.error,
      });
    }

    // Check availability
    const sanitized = sanitizeUsername(username);
    const available = await isUsernameAvailable(sanitized, req.user ? req.user.id : null);

    res.status(200).json({
      success: true,
      available,
      username: sanitized,
      message: available ? 'Username is available' : 'Username is already taken',
    });
  } catch (error) {
    console.error('Check username availability error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update current user's profile
const updateMyProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const profileData = req.body;

    // If username is being updated, validate it separately
    if (profileData.username !== undefined) {
      const validation = validateUsername(profileData.username);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
    }

    // Update user profile
    const updatedUser = await User.updateProfile(userId, profileData);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Invalidate user profile cache
    await invalidateUserCaches(userId).catch(err => {
      console.error('Failed to invalidate user cache:', err.message);
    });

    // Create activity for profile update (optional, can be filtered later)
    try {
      const ActivityFeed = require('../models/ActivityFeed');
      await ActivityFeed.create({
        user_id: userId,
        activity_type: 'profile_updated',
        activity_data: { updated_fields: Object.keys(profileData) },
      });
    } catch (activityError) {
      console.error('Error creating activity for profile update:', activityError.message);
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    
    // Handle username already taken error
    if (error.message && error.message.includes('already taken')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update extended profile (bio, languages, interests, etc.)
const updateExtendedProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    // Validate languages and interests are arrays if provided
    if (profileData.languages && !Array.isArray(profileData.languages)) {
      return res.status(400).json({
        success: false,
        message: 'Languages must be an array',
      });
    }

    if (profileData.interests && !Array.isArray(profileData.interests)) {
      return res.status(400).json({
        success: false,
        message: 'Interests must be an array',
      });
    }

    if (profileData.causes && !Array.isArray(profileData.causes)) {
      return res.status(400).json({
        success: false,
        message: 'Causes must be an array',
      });
    }

    // Update or create extended profile
    const profile = await Profile.upsertProfile(userId, profileData);

    // Invalidate user profile cache
    await invalidateUserCaches(userId).catch(err => {
      console.error('Failed to invalidate user cache:', err.message);
    });

    res.status(200).json({
      success: true,
      message: 'Extended profile updated successfully',
      profile,
    });
  } catch (error) {
    console.error('Update extended profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Create/Initialize profile after signup
const createProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { user: userData, profile: profileData } = req.body;

    // Check if profile already exists
    const existingUser = await User.findById(userId);
    if (existingUser.first_name || existingUser.last_name) {
      return res.status(409).json({
        success: false,
        message: 'Profile already exists. Use PUT /api/users/me/profile to update.',
      });
    }

    // Update user profile
    if (userData) {
      await User.updateProfile(userId, userData);
    }

    // Create extended profile
    if (profileData) {
      await Profile.upsertProfile(userId, profileData);
    }

    // Initialize default profile settings
    await ProfileSettings.upsert(userId, {});

    // Invalidate user profile cache
    await invalidateUserCaches(userId).catch(err => {
      console.error('Failed to invalidate user cache:', err.message);
    });

    // Get complete updated profile
    const updatedUser = await User.findById(userId);
    const profile = await Profile.findByUserId(userId);
    const { password, ...userWithoutPassword } = updatedUser;

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: {
        user: userWithoutPassword,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error('Create profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get complete profile with all professional data
const getCompleteProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get extended profile
    const profile = await Profile.findByUserId(userId);

    // Get all professional data
    const [experiences, education, userSkills, certifications, publications, projects, awards] = await Promise.all([
      MedicalExperience.findByUserId(userId),
      MedicalEducation.findByUserId(userId),
      UserSkill.findByUserId(userId),
      MedicalCertification.findByUserId(userId),
      MedicalPublication.findByUserId(userId),
      MedicalProject.findByUserId(userId),
      Award.findByUserId(userId),
    ]);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      data: {
        user: userWithoutPassword,
        profile: profile || null,
        professional: {
          experiences: experiences || [],
          education: education || [],
          skills: userSkills || [],
          certifications: certifications || [],
          publications: publications || [],
          projects: projects || [],
          awards: awards || [],
        },
      },
    });
  } catch (error) {
    console.error('Get complete profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Create complete profile (unified endpoint for all fields - initial creation)
const createCompleteProfile = async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    const userId = req.user.id;
    console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Request received - UserId: ${userId}`);

    // Layer 1 & 2: Validation (shape and business rules)
    const validationErrors = validateProfileData(req.body);
    if (validationErrors.length > 0) {
      const duration = Date.now() - startTime;
      console.warn(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Validation failed - UserId: ${userId}, Errors: ${validationErrors.length}, Duration: ${duration}ms`);
      return res.status(400).json({
        success: false,
        errors: validationErrors,
      });
    }

    // Check if profile already has substantial data (to prevent overwriting complete profiles)
    // Allow partial profiles to be extended via POST
    console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Checking existing profile - UserId: ${userId}`);
    const existingUser = await User.findById(userId);
    const existingExperiences = await MedicalExperience.findByUserId(userId);
    const existingEducation = await MedicalEducation.findByUserId(userId);
    const existingSkills = await UserSkill.findByUserId(userId);
    const existingCerts = await MedicalCertification.findByUserId(userId);

    // Only block if profile appears complete (has both user data AND professional data)
    const hasUserData = existingUser.first_name || existingUser.last_name;
    const hasProfessionalData = existingExperiences.length > 0 || existingEducation.length > 0 || existingSkills.length > 0 || existingCerts.length > 0;
    
    if (hasUserData && hasProfessionalData) {
      const duration = Date.now() - startTime;
      console.warn(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Profile already exists and appears complete - UserId: ${userId}, Duration: ${duration}ms`);
      return res.status(409).json({
        success: false,
        message: 'Profile already exists with substantial data. Use PUT /api/users/me/profile/complete to update your profile.',
        hint: 'If you want to add more details to an existing profile, use the PUT endpoint instead of POST.',
      });
    }
    
    if (hasUserData || hasProfessionalData) {
      console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Profile exists but is incomplete, allowing extension - UserId: ${userId}, HasUserData: ${hasUserData}, HasProfessionalData: ${hasProfessionalData}`);
    }

    const { user: userData, profile: profileData, experiences, education, skills, certifications, publications, projects, awards } = req.body;
    console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Starting transaction - UserId: ${userId}, Data: user=${!!userData}, profile=${!!profileData}, experiences=${experiences?.length || 0}, education=${education?.length || 0}, skills=${skills?.length || 0}, certifications=${certifications?.length || 0}, publications=${publications?.length || 0}, projects=${projects?.length || 0}, awards=${awards?.length || 0}`);

    // Remove derived fields from userData if provided (they will be computed)
    const fieldsToDerive = ['current_role', 'years_of_experience', 'medical_school_graduation_year', 'residency_completion_year', 'fellowship_completion_year'];
    const cleanUserData = userData ? { ...userData } : {};
    fieldsToDerive.forEach(field => {
      delete cleanUserData[field];
    });

    // Handle username: auto-generate if missing
    if (!existingUser.username) {
      if (cleanUserData.username) {
        // Validate username if provided
        const validation = validateUsername(cleanUserData.username);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error,
          });
        }
        const sanitized = sanitizeUsername(cleanUserData.username);
        const available = await isUsernameAvailable(sanitized, userId);
        if (!available) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken',
          });
        }
        cleanUserData.username = sanitized;
      } else {
        // Auto-generate username if not provided
        const firstName = cleanUserData.first_name || existingUser.first_name || '';
        const lastName = cleanUserData.last_name || existingUser.last_name || '';
        const generatedUsername = await generateUsername(firstName, lastName, userId);
        cleanUserData.username = generatedUsername;
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Auto-generated username - UserId: ${userId}, Username: ${generatedUsername}`);
      }
    } else if (cleanUserData.username) {
      // User already has username, validate if they want to change it
      const validation = validateUsername(cleanUserData.username);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
      const sanitized = sanitizeUsername(cleanUserData.username);
      if (sanitized !== existingUser.username) {
        // Username changed, check availability
        const available = await isUsernameAvailable(sanitized, userId);
        if (!available) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken',
          });
        }
        cleanUserData.username = sanitized;
      }
    }

    // Execute all operations within a transaction
    const result = await withTransaction(async (client) => {
      // Update user profile (without derived fields)
      if (Object.keys(cleanUserData).length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Updating user profile - UserId: ${userId}, Fields: ${Object.keys(cleanUserData).join(', ')}`);
        await User.updateProfile(userId, cleanUserData, client);
      }

      // Bulk create experiences
      let createdExperiences = [];
      if (Array.isArray(experiences) && experiences.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Creating ${experiences.length} experiences - UserId: ${userId}`);
        createdExperiences = await MedicalExperience.bulkCreate(client, userId, experiences);
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Created ${createdExperiences.length} experiences - UserId: ${userId}`);
      }

      // Bulk create education
      let createdEducation = [];
      if (Array.isArray(education) && education.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Creating ${education.length} education records - UserId: ${userId}`);
        createdEducation = await MedicalEducation.bulkCreate(client, userId, education);
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Created ${createdEducation.length} education records - UserId: ${userId}`);
      }

      // Derive fields from experiences and education
      const derivedFields = deriveProfileFields(createdExperiences, createdEducation);
      console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Derived fields - UserId: ${userId}, Fields: ${JSON.stringify(derivedFields)}`);
      
      // Update user with derived fields (only if we have values)
      const fieldsToUpdate = {};
      if (derivedFields.current_role) fieldsToUpdate.current_role = derivedFields.current_role;
      if (derivedFields.years_of_experience !== null && derivedFields.years_of_experience !== undefined) {
        fieldsToUpdate.years_of_experience = derivedFields.years_of_experience;
      }
      if (derivedFields.medical_school_graduation_year) {
        fieldsToUpdate.medical_school_graduation_year = derivedFields.medical_school_graduation_year;
      }
      if (derivedFields.residency_completion_year) {
        fieldsToUpdate.residency_completion_year = derivedFields.residency_completion_year;
      }
      if (derivedFields.fellowship_completion_year) {
        fieldsToUpdate.fellowship_completion_year = derivedFields.fellowship_completion_year;
      }

      if (Object.keys(fieldsToUpdate).length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Updating derived fields - UserId: ${userId}, Fields: ${Object.keys(fieldsToUpdate).join(', ')}`);
        await User.updateProfile(userId, fieldsToUpdate, client);
      }

      // Update extended profile
      let profile = null;
      if (profileData) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Upserting extended profile - UserId: ${userId}`);
        profile = await Profile.upsertProfile(userId, profileData, client);
      }

      // Initialize default profile settings
      console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Initializing profile settings - UserId: ${userId}`);
      await ProfileSettings.upsert(userId, {}, client);

      // Handle skills with bulk operations
      if (Array.isArray(skills) && skills.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Processing ${skills.length} skills - UserId: ${userId}`);
        // Normalize skills
        const normalizedSkills = normalizeSkills(skills);
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Normalized to ${normalizedSkills.length} unique skills - UserId: ${userId}`);
        
        // Bulk upsert skills into medical_skills
        const createdSkills = await MedicalSkill.bulkUpsertSkills(client, normalizedSkills);
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Upserted ${createdSkills.length} skills to medical_skills - UserId: ${userId}`);
        
        // Map normalized skills to include skill_id
        const skillsWithIds = normalizedSkills.map(normalized => {
          const created = createdSkills.find(s => s.name.toLowerCase() === normalized.name.toLowerCase());
          if (!created) {
            // Skip skills that couldn't be matched or created
            // This should be rare but can happen if there's a race condition or case mismatch
            console.warn(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Skill "${normalized.name}" not found in createdSkills, skipping - UserId: ${userId}`);
            return null;
          }
          return {
            skill_id: created.id,
            proficiency_level: normalized.proficiency_level,
            years_of_experience: normalized.years_of_experience,
          };
        }).filter(Boolean); // Remove null entries

        // Bulk upsert user_skills
        if (skillsWithIds.length > 0) {
          console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Upserting ${skillsWithIds.length} user skills - UserId: ${userId}`);
          await UserSkill.bulkUpsertUserSkills(client, userId, skillsWithIds);
        }
      }

      // Bulk create certifications
      if (Array.isArray(certifications) && certifications.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Creating ${certifications.length} certifications - UserId: ${userId}`);
        await MedicalCertification.bulkCreate(client, userId, certifications);
      }

      // Bulk create publications
      if (Array.isArray(publications) && publications.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Creating ${publications.length} publications - UserId: ${userId}`);
        await MedicalPublication.bulkCreate(client, userId, publications);
      }

      // Bulk create projects
      if (Array.isArray(projects) && projects.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Creating ${projects.length} projects - UserId: ${userId}`);
        await MedicalProject.bulkCreate(client, userId, projects);
      }

      // Bulk create awards
      if (Array.isArray(awards) && awards.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Creating ${awards.length} awards - UserId: ${userId}`);
        await Award.bulkCreate(client, userId, awards);
      }

      // Get profile_id if profile was created
      const createdProfile = await Profile.findByUserId(userId);
      const profileId = createdProfile ? createdProfile.id : null;

      // Calculate basic completion percentage (simplified - can be enhanced later)
      let completionScore = 0;
      if (userData) completionScore += 20;
      if (profileData) completionScore += 10;
      if (experiences?.length > 0) completionScore += 15;
      if (education?.length > 0) completionScore += 15;
      if (skills?.length > 0) completionScore += 15;
      if (certifications?.length > 0) completionScore += 10;
      if (publications?.length > 0) completionScore += 5;
      if (projects?.length > 0) completionScore += 5;
      if (awards?.length > 0) completionScore += 5;

      return {
        profile_id: profileId,
        completion_percentage: completionScore,
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Success - UserId: ${userId}, ProfileId: ${result.profile_id}, Completion: ${result.completion_percentage}%, Duration: ${duration}ms`);

    // Invalidate user profile cache
    await invalidateUserCaches(userId).catch(err => {
      console.error('Failed to invalidate user cache:', err.message);
    });

    // Return minimal response
    res.status(201).json({
      success: true,
      profile_id: result.profile_id,
      user_id: userId,
      completion_percentage: result.completion_percentage,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${timestamp}] [PROFILE] [CREATE_COMPLETE] Error - UserId: ${req.user?.id || 'N/A'}, Error: ${error.message}, Stack: ${error.stack}, Duration: ${duration}ms`);
    
    // Don't expose internal errors
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update complete profile (unified endpoint for all fields)
const updateCompleteProfile = async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    const userId = req.user.id;
    console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Request received - UserId: ${userId}`);
    
    const { user: userData, profile: profileData, experiences, education, skills, certifications, publications, projects, awards } = req.body;
    console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Update data - UserId: ${userId}, Data: user=${!!userData}, profile=${!!profileData}, experiences=${experiences?.length || 0}, education=${education?.length || 0}, skills=${skills?.length || 0}, certifications=${certifications?.length || 0}, publications=${publications?.length || 0}, projects=${projects?.length || 0}, awards=${awards?.length || 0}`);

    // Update user profile
    if (userData) {
      const existingUser = await User.findById(userId);
      const cleanUserData = { ...userData };

      // Handle username: auto-generate if missing
      if (!existingUser.username) {
        if (cleanUserData.username) {
          // Validate username if provided
          const validation = validateUsername(cleanUserData.username);
          if (!validation.valid) {
            return res.status(400).json({
              success: false,
              message: validation.error,
            });
          }
          const sanitized = sanitizeUsername(cleanUserData.username);
          const available = await isUsernameAvailable(sanitized, userId);
          if (!available) {
            return res.status(409).json({
              success: false,
              message: 'Username is already taken',
            });
          }
          cleanUserData.username = sanitized;
        } else {
          // Auto-generate username if not provided and user doesn't have one
          const firstName = cleanUserData.first_name || existingUser.first_name || '';
          const lastName = cleanUserData.last_name || existingUser.last_name || '';
          const generatedUsername = await generateUsername(firstName, lastName, userId);
          cleanUserData.username = generatedUsername;
          console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Auto-generated username - UserId: ${userId}, Username: ${generatedUsername}`);
        }
      } else if (cleanUserData.username) {
        // User already has username, validate if they want to change it
        const validation = validateUsername(cleanUserData.username);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error,
          });
        }
        const sanitized = sanitizeUsername(cleanUserData.username);
        if (sanitized !== existingUser.username) {
          // Username changed, check availability
          const available = await isUsernameAvailable(sanitized, userId);
          if (!available) {
            return res.status(409).json({
              success: false,
              message: 'Username is already taken',
            });
          }
          cleanUserData.username = sanitized;
        }
      }

      console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Updating user profile - UserId: ${userId}, Fields: ${Object.keys(cleanUserData).join(', ')}`);
      await User.updateProfile(userId, cleanUserData);
    }

    // Update extended profile
    if (profileData) {
      console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Upserting extended profile - UserId: ${userId}`);
      await Profile.upsertProfile(userId, profileData);
    }

    // Handle experiences
    if (Array.isArray(experiences)) {
      console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Processing ${experiences.length} experiences - UserId: ${userId}`);
      const existingExperiences = await MedicalExperience.findByUserId(userId);
      const existingIds = new Set(existingExperiences.map(e => e.id));
      const incomingIds = experiences.filter(e => e.id).map(e => e.id);

      // Verify all incoming IDs are owned by the user
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          // Check if this ID exists but belongs to another user
          const record = await MedicalExperience.findById(incomingId);
          if (record && record.user_id !== userId) {
            return res.status(403).json({
              success: false,
              message: `Experience with id ${incomingId} does not belong to you`,
            });
          }
        }
      }

      // Delete removed experiences (only owned ones)
      const toDelete = existingExperiences
        .filter(e => !incomingIds.includes(e.id))
        .map(e => e.id);
      if (toDelete.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Deleting ${toDelete.length} experiences - UserId: ${userId}`);
        for (const id of toDelete) {
          await MedicalExperience.remove(id);
        }
      }

      // Create or update experiences
      let createdCount = 0;
      let updatedCount = 0;
      for (const exp of experiences) {
        if (exp.id && existingIds.has(exp.id)) {
          // Verify ownership before update
          const record = await MedicalExperience.findById(exp.id);
          if (record && record.user_id === userId) {
            await MedicalExperience.update(exp.id, { ...exp, user_id: userId });
            updatedCount++;
          }
        } else {
          await MedicalExperience.create({ ...exp, user_id: userId });
          createdCount++;
        }
      }
      if (createdCount > 0 || updatedCount > 0) {
        console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Experiences updated - UserId: ${userId}, Created: ${createdCount}, Updated: ${updatedCount}`);
      }
    }

    // Handle education
    if (Array.isArray(education)) {
      console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Processing ${education.length} education records - UserId: ${userId}`);
      const existingEducation = await MedicalEducation.findByUserId(userId);
      const existingIds = new Set(existingEducation.map(e => e.id));
      const incomingIds = education.filter(e => e.id).map(e => e.id);

      // Verify all incoming IDs are owned by the user
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          const record = await MedicalEducation.findById(incomingId);
          if (record && record.user_id !== userId) {
            return res.status(403).json({
              success: false,
              message: `Education with id ${incomingId} does not belong to you`,
            });
          }
        }
      }

      // Delete removed education (only owned ones)
      const toDelete = existingEducation
        .filter(e => !incomingIds.includes(e.id))
        .map(e => e.id);
      if (toDelete.length > 0) {
        console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Deleting ${toDelete.length} education records - UserId: ${userId}`);
        for (const id of toDelete) {
          await MedicalEducation.remove(id);
        }
      }

      // Create or update education
      let createdCount = 0;
      let updatedCount = 0;
      for (const edu of education) {
        if (edu.id && existingIds.has(edu.id)) {
          const record = await MedicalEducation.findById(edu.id);
          if (record && record.user_id === userId) {
            await MedicalEducation.update(edu.id, { ...edu, user_id: userId });
            updatedCount++;
          }
        } else {
          await MedicalEducation.create({ ...edu, user_id: userId });
          createdCount++;
        }
      }
      if (createdCount > 0 || updatedCount > 0) {
        console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Education updated - UserId: ${userId}, Created: ${createdCount}, Updated: ${updatedCount}`);
      }
    }

    // Handle skills
    if (Array.isArray(skills)) {
      console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Processing ${skills.length} skills - UserId: ${userId}`);
      const existingSkills = await UserSkill.findByUserId(userId);
      const existingSkillIds = existingSkills.map(s => s.skill_id);
      console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Removing ${existingSkills.length} existing skills - UserId: ${userId}`);

      // Remove all existing skills
      for (const userSkill of existingSkills) {
        await UserSkill.removeSkill(userId, userSkill.skill_id);
      }

      // Add new skills
      for (const skill of skills) {
        let skillId;
        if (typeof skill === 'number') {
          skillId = skill;
        } else if (typeof skill === 'string') {
          // Find or create skill by name
          let skillRecord = await MedicalSkill.findByName(skill);
          if (!skillRecord) {
            skillRecord = await MedicalSkill.create({ name: skill });
          }
          skillId = skillRecord.id;
        } else if (skill.id) {
          skillId = skill.id;
        } else if (skill.name) {
          let skillRecord = await MedicalSkill.findByName(skill.name);
          if (!skillRecord) {
            skillRecord = await MedicalSkill.create(skill);
          }
          skillId = skillRecord.id;
        }

        if (skillId) {
          await UserSkill.addSkill(userId, skillId, skill);
        }
      }
    }

    // Handle certifications
    if (Array.isArray(certifications)) {
      const existingCerts = await MedicalCertification.findByUserId(userId);
      const existingIds = new Set(existingCerts.map(c => c.id));
      const incomingIds = certifications.filter(c => c.id).map(c => c.id);

      // Verify all incoming IDs are owned by the user
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          const record = await MedicalCertification.findById(incomingId);
          if (record && record.user_id !== userId) {
            return res.status(403).json({
              success: false,
              message: `Certification with id ${incomingId} does not belong to you`,
            });
          }
        }
      }

      // Delete removed certifications (only owned ones)
      const toDelete = existingCerts
        .filter(c => !incomingIds.includes(c.id))
        .map(c => c.id);
      for (const id of toDelete) {
        await MedicalCertification.remove(id);
      }

      // Create or update certifications
      for (const cert of certifications) {
        if (cert.id && existingIds.has(cert.id)) {
          const record = await MedicalCertification.findById(cert.id);
          if (record && record.user_id === userId) {
            await MedicalCertification.update(cert.id, { ...cert, user_id: userId });
          }
        } else {
          await MedicalCertification.create({ ...cert, user_id: userId });
        }
      }
    }

    // Handle publications
    if (Array.isArray(publications)) {
      const existingPubs = await MedicalPublication.findByUserId(userId);
      const existingIds = new Set(existingPubs.map(p => p.id));
      const incomingIds = publications.filter(p => p.id).map(p => p.id);

      // Verify all incoming IDs are owned by the user
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          const record = await MedicalPublication.findById(incomingId);
          if (record && record.user_id !== userId) {
            return res.status(403).json({
              success: false,
              message: `Publication with id ${incomingId} does not belong to you`,
            });
          }
        }
      }

      // Delete removed publications (only owned ones)
      const toDelete = existingPubs
        .filter(p => !incomingIds.includes(p.id))
        .map(p => p.id);
      for (const id of toDelete) {
        await MedicalPublication.remove(id);
      }

      // Create or update publications
      for (const pub of publications) {
        if (pub.id && existingIds.has(pub.id)) {
          const record = await MedicalPublication.findById(pub.id);
          if (record && record.user_id === userId) {
            await MedicalPublication.update(pub.id, { ...pub, user_id: userId });
          }
        } else {
          await MedicalPublication.create({ ...pub, user_id: userId });
        }
      }
    }

    // Handle projects
    if (Array.isArray(projects)) {
      const existingProjects = await MedicalProject.findByUserId(userId);
      const existingIds = new Set(existingProjects.map(p => p.id));
      const incomingIds = projects.filter(p => p.id).map(p => p.id);

      // Verify all incoming IDs are owned by the user
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          const record = await MedicalProject.findById(incomingId);
          if (record && record.user_id !== userId) {
            return res.status(403).json({
              success: false,
              message: `Project with id ${incomingId} does not belong to you`,
            });
          }
        }
      }

      // Delete removed projects (only owned ones)
      const toDelete = existingProjects
        .filter(p => !incomingIds.includes(p.id))
        .map(p => p.id);
      for (const id of toDelete) {
        await MedicalProject.remove(id);
      }

      // Create or update projects
      for (const proj of projects) {
        if (proj.id && existingIds.has(proj.id)) {
          const record = await MedicalProject.findById(proj.id);
          if (record && record.user_id === userId) {
            await MedicalProject.update(proj.id, { ...proj, user_id: userId });
          }
        } else {
          await MedicalProject.create({ ...proj, user_id: userId });
        }
      }
    }

    // Handle awards
    if (Array.isArray(awards)) {
      const existingAwards = await Award.findByUserId(userId);
      const existingIds = new Set(existingAwards.map(a => a.id));
      const incomingIds = awards.filter(a => a.id).map(a => a.id);

      // Verify all incoming IDs are owned by the user
      for (const incomingId of incomingIds) {
        if (!existingIds.has(incomingId)) {
          const record = await Award.findById(incomingId);
          if (record && record.user_id !== userId) {
            return res.status(403).json({
              success: false,
              message: `Award with id ${incomingId} does not belong to you`,
            });
          }
        }
      }

      // Delete removed awards (only owned ones)
      const toDelete = existingAwards
        .filter(a => !incomingIds.includes(a.id))
        .map(a => a.id);
      for (const id of toDelete) {
        await Award.remove(id);
      }

      // Create or update awards
      for (const award of awards) {
        if (award.id && existingIds.has(award.id)) {
          const record = await Award.findById(award.id);
          if (record && record.user_id === userId) {
            await Award.update(award.id, { ...award, user_id: userId });
          }
        } else {
          await Award.create({ ...award, user_id: userId });
        }
      }
    }

    // Return complete updated profile
    console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Fetching updated profile data - UserId: ${userId}`);
    const updatedUser = await User.findById(userId);
    const profile = await Profile.findByUserId(userId);
    const [updatedExperiences, updatedEducation, updatedSkills, updatedCerts, updatedPubs, updatedProjects, updatedAwards] = await Promise.all([
      MedicalExperience.findByUserId(userId),
      MedicalEducation.findByUserId(userId),
      UserSkill.findByUserId(userId),
      MedicalCertification.findByUserId(userId),
      MedicalPublication.findByUserId(userId),
      MedicalProject.findByUserId(userId),
      Award.findByUserId(userId),
    ]);

    const { password, ...userWithoutPassword } = updatedUser;

    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Success - UserId: ${userId}, Data: experiences=${updatedExperiences?.length || 0}, education=${updatedEducation?.length || 0}, skills=${updatedSkills?.length || 0}, certifications=${updatedCerts?.length || 0}, publications=${updatedPubs?.length || 0}, projects=${updatedProjects?.length || 0}, awards=${updatedAwards?.length || 0}, Duration: ${duration}ms`);

    // Invalidate user profile cache
    await invalidateUserCaches(userId).catch(err => {
      console.error('Failed to invalidate user cache:', err.message);
    });

    res.status(200).json({
      success: true,
      message: 'Complete profile updated successfully',
      data: {
        user: userWithoutPassword,
        profile: profile || null,
        professional: {
          experiences: updatedExperiences || [],
          education: updatedEducation || [],
          skills: updatedSkills || [],
          certifications: updatedCerts || [],
          publications: updatedPubs || [],
          projects: updatedProjects || [],
          awards: updatedAwards || [],
        },
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${timestamp}] [PROFILE] [UPDATE_COMPLETE] Error - UserId: ${req.user?.id || 'N/A'}, Error: ${error.message}, Stack: ${error.stack}, Duration: ${duration}ms`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// -----------------------------
// Connections / Follows / Blocks
// -----------------------------

// Send connection request
const sendConnectionRequest = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId, targetUserId } = validated;

    // Check blocks
    const allowed = await ensureNotBlockedEitherWay(currentUserId, targetUserId, res);
    if (!allowed) return;

    // Check existing connection
    const existing = await Connection.findConnection(currentUserId, targetUserId);
    if (existing) {
      if (existing.status === 'connected') {
        return res.status(400).json({
          success: false,
          message: 'You are already connected with this user',
        });
      }

      if (existing.status === 'pending') {
        if (existing.requester_id === currentUserId) {
          return res.status(400).json({
            success: false,
            message: 'Connection request already sent',
          });
        }

        return res.status(400).json({
          success: false,
          message: 'This user has already sent you a connection request',
        });
      }
    }

    const connection = await Connection.createRequest(currentUserId, targetUserId);

    res.status(201).json({
      success: true,
      message: 'Connection request sent',
      connection,
    });
  } catch (error) {
    console.error('Send connection request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Accept connection request
const acceptConnectionRequest = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId: addresseeId, targetUserId: requesterId } = validated;

    // Check blocks
    const allowed = await ensureNotBlockedEitherWay(addresseeId, requesterId, res);
    if (!allowed) return;

    // Accept the pending request
    const connection = await Connection.acceptRequest(requesterId, addresseeId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'No pending connection request from this user',
      });
    }

    // Auto-follow both ways (idempotent)
    await Promise.all([
      Follow.follow(addresseeId, requesterId),
      Follow.follow(requesterId, addresseeId),
    ]);

    // Create activity for both users
    try {
      const ActivityFeed = require('../models/ActivityFeed');
      await Promise.all([
        ActivityFeed.create({
          user_id: addresseeId,
          activity_type: 'connection_accepted',
          activity_data: { connection_id: connection.id, other_user_id: requesterId },
          related_user_id: requesterId,
          related_connection_id: connection.id,
        }),
        ActivityFeed.create({
          user_id: requesterId,
          activity_type: 'connection_accepted',
          activity_data: { connection_id: connection.id, other_user_id: addresseeId },
          related_user_id: addresseeId,
          related_connection_id: connection.id,
        }),
      ]);
    } catch (activityError) {
      console.error('Error creating activity for connection:', activityError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Connection request accepted',
      connection,
    });
  } catch (error) {
    console.error('Accept connection request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Decline connection request
const declineConnectionRequest = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId: addresseeId, targetUserId: requesterId } = validated;

    // Check existing connection
    const connection = await Connection.findConnection(requesterId, addresseeId);
    if (!connection || connection.status !== 'pending' || connection.requester_id !== requesterId) {
      return res.status(404).json({
        success: false,
        message: 'No pending connection request from this user',
      });
    }

    await Connection.removeConnection(requesterId, addresseeId);

    res.status(200).json({
      success: true,
      message: 'Connection request declined',
    });
  } catch (error) {
    console.error('Decline connection request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Remove connection or cancel outgoing request
const removeConnectionHandler = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId, targetUserId } = validated;

    const connection = await Connection.findConnection(currentUserId, targetUserId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'No connection or pending request found',
      });
    }

    // If pending, only requester can cancel
    if (connection.status === 'pending' && connection.requester_id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Only the requester can cancel a pending connection',
      });
    }

    await Connection.removeConnection(currentUserId, targetUserId);

    res.status(200).json({
      success: true,
      message: connection.status === 'pending'
        ? 'Connection request cancelled'
        : 'Connection removed',
    });
  } catch (error) {
    console.error('Remove connection error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// List my connections
const listMyConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'connected';

    const connections = await Connection.findByUserId(userId, status);

    res.status(200).json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('List connections error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// List incoming connection requests
const listIncomingConnectionRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Connection.findPendingRequests(userId);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('List incoming connection requests error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// List outgoing connection requests
const listOutgoingConnectionRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Connection.findOutgoingRequests(userId);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('List outgoing connection requests error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Follow a user
const followUser = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId, targetUserId } = validated;

    // Check blocks
    const allowed = await ensureNotBlockedEitherWay(currentUserId, targetUserId, res);
    if (!allowed) return;

    const follow = await Follow.follow(currentUserId, targetUserId);

    // Create activity
    if (follow) {
      try {
        const ActivityFeed = require('../models/ActivityFeed');
        await ActivityFeed.create({
          user_id: currentUserId,
          activity_type: 'follow',
          activity_data: { following_id: targetUserId },
          related_user_id: targetUserId,
        });
      } catch (activityError) {
        console.error('Error creating activity for follow:', activityError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Now following user',
      follow,
    });
  } catch (error) {
    console.error('Follow user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId, targetUserId } = validated;

    await Follow.unfollow(currentUserId, targetUserId);

    res.status(200).json({
      success: true,
      message: 'Unfollowed user',
    });
  } catch (error) {
    console.error('Unfollow user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// List followers of a user
const listFollowers = async (req, res) => {
  try {
    const targetUserId = parseTargetUserId(req, res);
    if (targetUserId === null) return;

    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const followers = await Follow.findFollowers(targetUserId, limit, offset);

    res.status(200).json({
      success: true,
      data: followers,
      pagination: {
        limit,
        offset,
        hasMore: followers.length === limit,
      },
    });
  } catch (error) {
    console.error('List followers error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// List users that a user is following
const listFollowing = async (req, res) => {
  try {
    const targetUserId = parseTargetUserId(req, res);
    if (targetUserId === null) return;

    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const following = await Follow.findFollowing(targetUserId, limit, offset);

    res.status(200).json({
      success: true,
      data: following,
      pagination: {
        limit,
        offset,
        hasMore: following.length === limit,
      },
    });
  } catch (error) {
    console.error('List following error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Block a user (hard block)
const blockUserHandler = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId, targetUserId } = validated;

    // Create block (idempotent)
    await Block.blockUser(currentUserId, targetUserId);

    // Remove any existing connections and follows in both directions
    await Promise.all([
      Connection.removeConnection(currentUserId, targetUserId),
      Follow.unfollow(currentUserId, targetUserId),
      Follow.unfollow(targetUserId, currentUserId),
    ]);

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
    });
  } catch (error) {
    console.error('Block user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Unblock a user
const unblockUserHandler = async (req, res) => {
  try {
    const validated = await validateTargetUser(req, res);
    if (!validated) return;
    const { currentUserId, targetUserId } = validated;

    await Block.unblockUser(currentUserId, targetUserId);

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
    });
  } catch (error) {
    console.error('Unblock user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// List users current user has blocked
const listBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const blocked = await Block.findBlockedByUser(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: blocked,
      pagination: {
        limit,
        offset,
        hasMore: blocked.length === limit,
      },
    });
  } catch (error) {
    console.error('List blocked users error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user online status
const getUserStatus = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    
    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const status = await UserOnlineStatus.getStatus(targetUserId);

    res.status(200).json({
      success: true,
      data: {
        user_id: targetUserId,
        ...status,
      },
    });
  } catch (error) {
    console.error('Get user status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update own online status (manual status updates)
const updateMyStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_online } = req.body;

    if (typeof is_online !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_online must be a boolean',
      });
    }

    let status;
    if (is_online) {
      status = await UserOnlineStatus.setOnline(userId);
    } else {
      status = await UserOnlineStatus.setOffline(userId);
    }

    // Emit status update
    const { getIO } = require('../services/socketService');
    const io = getIO();
    if (io) {
      io.emit(is_online ? 'user:online' : 'user:offline', {
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: status,
    });
  } catch (error) {
    console.error('Update my status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  getMyProfile,
  getUserProfile,
  checkUsernameAvailability,
  updateMyProfile,
  updateExtendedProfile,
  createProfile,
  createCompleteProfile,
  getCompleteProfile,
  updateCompleteProfile,
  validateProfileUpdate,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  removeConnectionHandler,
  listMyConnections,
  listIncomingConnectionRequests,
  listOutgoingConnectionRequests,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  blockUserHandler,
  unblockUserHandler,
  listBlockedUsers,
  getUserStatus,
  updateMyStatus,
};