// Experience controller - Medical Experience CRUD
const { body, validationResult } = require('express-validator');
const MedicalExperience = require('../models/MedicalExperience');

// Validation rules
const validateExperience = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 255 })
    .withMessage('Title must be less than 255 characters'),
  body('position_type')
    .trim()
    .notEmpty()
    .withMessage('Position type is required'),
  body('institution_name')
    .trim()
    .notEmpty()
    .withMessage('Institution name is required')
    .isLength({ max: 255 })
    .withMessage('Institution name must be less than 255 characters'),
  body('start_date')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

// Create experience
const createExperience = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const experienceData = { ...req.body, user_id: req.user.id };
    const experience = await MedicalExperience.create(experienceData);

    res.status(201).json({
      success: true,
      message: 'Experience created successfully',
      data: experience,
    });
  } catch (error) {
    console.error('Create experience error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user's experiences
const getExperiences = async (req, res) => {
  try {
    const experiences = await MedicalExperience.findByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: experiences,
    });
  } catch (error) {
    console.error('Get experiences error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get experience by ID
const getExperienceById = async (req, res) => {
  try {
    const { id } = req.params;
    const experience = await MedicalExperience.findById(id);

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found',
      });
    }

    // Verify ownership
    if (experience.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    res.status(200).json({
      success: true,
      data: experience,
    });
  } catch (error) {
    console.error('Get experience error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update experience
const updateExperience = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const experience = await MedicalExperience.findById(id);

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found',
      });
    }

    // Verify ownership
    if (experience.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const updated = await MedicalExperience.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Experience updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update experience error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete experience
const deleteExperience = async (req, res) => {
  try {
    const { id } = req.params;
    const experience = await MedicalExperience.findById(id);

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found',
      });
    }

    // Verify ownership
    if (experience.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    await MedicalExperience.remove(id);

    res.status(200).json({
      success: true,
      message: 'Experience deleted successfully',
    });
  } catch (error) {
    console.error('Delete experience error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperience,
  deleteExperience,
  validateExperience,
};
