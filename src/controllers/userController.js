// User controller - Profile management
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ProfileSettings = require('../models/ProfileSettings');
const MedicalExperience = require('../models/MedicalExperience');
const MedicalEducation = require('../models/MedicalEducation');
const MedicalSkill = require('../models/MedicalSkill');
const UserSkill = require('../models/UserSkill');
const MedicalCertification = require('../models/MedicalCertification');
const MedicalPublication = require('../models/MedicalPublication');
const MedicalProject = require('../models/MedicalProject');
const Award = require('../models/Award');

// Validation rules for profile update
const validateProfileUpdate = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('last_name')
    .optional()
    .trim()
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

// Get current user's profile
const getMyProfile = async (req, res) => {
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

    // Get extended profile data
    const profile = await Profile.findByUserId(userId);
    
    // Get profile settings
    const settings = await ProfileSettings.findByUserId(userId);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      user: {
        ...userWithoutPassword,
        profile: profile || null,
        settings: settings || null,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user profile by ID
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
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
    
    // Get profile settings to check visibility
    const settings = await ProfileSettings.findByUserId(userId);
    
    // Check if profile is visible (if settings exist and profile is private)
    if (settings && settings.profile_visibility === 'private' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private',
      });
    }

    // Remove sensitive fields
    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      user: {
        ...userWithoutPassword,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error.message);
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

    // Update user profile
    const updatedUser = await User.updateProfile(userId, profileData);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
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
  try {
    const userId = req.user.id;

    // Check if profile already has data
    const existingUser = await User.findById(userId);
    const existingExperiences = await MedicalExperience.findByUserId(userId);
    const existingEducation = await MedicalEducation.findByUserId(userId);

    if (existingUser.first_name || existingUser.last_name || existingExperiences.length > 0 || existingEducation.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Profile already exists. Use PUT /api/users/me/profile/complete to update.',
      });
    }

    // Use the same logic as update, but for creation
    const { user: userData, profile: profileData, experiences, education, skills, certifications, publications, projects, awards } = req.body;

    // Update user profile
    if (userData) {
      await User.updateProfile(userId, userData);
    }

    // Update extended profile
    if (profileData) {
      await Profile.upsertProfile(userId, profileData);
    }

    // Initialize default profile settings
    await ProfileSettings.upsert(userId, {});

    // Handle experiences
    if (Array.isArray(experiences)) {
      for (const exp of experiences) {
        await MedicalExperience.create({ ...exp, user_id: userId });
      }
    }

    // Handle education
    if (Array.isArray(education)) {
      for (const edu of education) {
        await MedicalEducation.create({ ...edu, user_id: userId });
      }
    }

    // Handle skills
    if (Array.isArray(skills)) {
      for (const skill of skills) {
        let skillId;
        if (typeof skill === 'number') {
          skillId = skill;
        } else if (typeof skill === 'string') {
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
      for (const cert of certifications) {
        await MedicalCertification.create({ ...cert, user_id: userId });
      }
    }

    // Handle publications
    if (Array.isArray(publications)) {
      for (const pub of publications) {
        await MedicalPublication.create({ ...pub, user_id: userId });
      }
    }

    // Handle projects
    if (Array.isArray(projects)) {
      for (const proj of projects) {
        await MedicalProject.create({ ...proj, user_id: userId });
      }
    }

    // Handle awards
    if (Array.isArray(awards)) {
      for (const award of awards) {
        await Award.create({ ...award, user_id: userId });
      }
    }

    // Return complete created profile
    const updatedUser = await User.findById(userId);
    const profile = await Profile.findByUserId(userId);
    const [createdExperiences, createdEducation, createdSkills, createdCerts, createdPubs, createdProjects, createdAwards] = await Promise.all([
      MedicalExperience.findByUserId(userId),
      MedicalEducation.findByUserId(userId),
      UserSkill.findByUserId(userId),
      MedicalCertification.findByUserId(userId),
      MedicalPublication.findByUserId(userId),
      MedicalProject.findByUserId(userId),
      Award.findByUserId(userId),
    ]);

    const { password, ...userWithoutPassword } = updatedUser;

    res.status(201).json({
      success: true,
      message: 'Complete profile created successfully',
      data: {
        user: userWithoutPassword,
        profile: profile || null,
        professional: {
          experiences: createdExperiences || [],
          education: createdEducation || [],
          skills: createdSkills || [],
          certifications: createdCerts || [],
          publications: createdPubs || [],
          projects: createdProjects || [],
          awards: createdAwards || [],
        },
      },
    });
  } catch (error) {
    console.error('Create complete profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update complete profile (unified endpoint for all fields)
const updateCompleteProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { user: userData, profile: profileData, experiences, education, skills, certifications, publications, projects, awards } = req.body;

    // Update user profile
    if (userData) {
      await User.updateProfile(userId, userData);
    }

    // Update extended profile
    if (profileData) {
      await Profile.upsertProfile(userId, profileData);
    }

    // Handle experiences
    if (Array.isArray(experiences)) {
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
      for (const id of toDelete) {
        await MedicalExperience.remove(id);
      }

      // Create or update experiences
      for (const exp of experiences) {
        if (exp.id && existingIds.has(exp.id)) {
          // Verify ownership before update
          const record = await MedicalExperience.findById(exp.id);
          if (record && record.user_id === userId) {
            await MedicalExperience.update(exp.id, { ...exp, user_id: userId });
          }
        } else {
          await MedicalExperience.create({ ...exp, user_id: userId });
        }
      }
    }

    // Handle education
    if (Array.isArray(education)) {
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
      for (const id of toDelete) {
        await MedicalEducation.remove(id);
      }

      // Create or update education
      for (const edu of education) {
        if (edu.id && existingIds.has(edu.id)) {
          const record = await MedicalEducation.findById(edu.id);
          if (record && record.user_id === userId) {
            await MedicalEducation.update(edu.id, { ...edu, user_id: userId });
          }
        } else {
          await MedicalEducation.create({ ...edu, user_id: userId });
        }
      }
    }

    // Handle skills
    if (Array.isArray(skills)) {
      const existingSkills = await UserSkill.findByUserId(userId);
      const existingSkillIds = existingSkills.map(s => s.skill_id);

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
    console.error('Update complete profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  getMyProfile,
  getUserProfile,
  updateMyProfile,
  updateExtendedProfile,
  createProfile,
  createCompleteProfile,
  getCompleteProfile,
  updateCompleteProfile,
  validateProfileUpdate,
};
