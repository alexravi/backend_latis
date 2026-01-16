// Education controller - Medical Education CRUD
const { body, validationResult } = require('express-validator');
const MedicalEducation = require('../models/MedicalEducation');

// Validation rules for creation
const validateEducationCreate = [
  body('degree_type')
    .trim()
    .notEmpty()
    .withMessage('Degree type is required'),
  body('institution_name')
    .trim()
    .notEmpty()
    .withMessage('Institution name is required')
    .isLength({ max: 255 })
    .withMessage('Institution name must be less than 255 characters'),
  body('graduation_date')
    .optional()
    .isISO8601()
    .withMessage('Graduation date must be a valid date'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

// Validation rules for updates (all fields optional)
const validateEducationUpdate = [
  body('degree_type')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Degree type cannot be empty if provided'),
  body('institution_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Institution name cannot be empty if provided')
    .isLength({ max: 255 })
    .withMessage('Institution name must be less than 255 characters'),
  body('graduation_date')
    .optional()
    .isISO8601()
    .withMessage('Graduation date must be a valid date'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

// Create education
const createEducation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const educationData = { ...req.body, user_id: req.user.id };
    const education = await MedicalEducation.create(educationData);

    res.status(201).json({
      success: true,
      message: 'Education created successfully',
      data: education,
    });
  } catch (error) {
    console.error('Create education error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user's education
const getEducation = async (req, res) => {
  try {
    const education = await MedicalEducation.findByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: education,
    });
  } catch (error) {
    console.error('Get education error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get education by ID
const getEducationById = async (req, res) => {
  try {
    const { id } = req.params;
    const education = await MedicalEducation.findById(id);

    if (!education) {
      return res.status(404).json({
        success: false,
        message: 'Education not found',
      });
    }

    // Verify ownership
    if (Number(education.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    res.status(200).json({
      success: true,
      data: education,
    });
  } catch (error) {
    console.error('Get education error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update education
const updateEducation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const education = await MedicalEducation.findById(id);

    if (!education) {
      return res.status(404).json({
        success: false,
        message: 'Education not found',
      });
    }

    // Verify ownership
    if (Number(education.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const updated = await MedicalEducation.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Education updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update education error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete education
const deleteEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const education = await MedicalEducation.findById(id);

    if (!education) {
      return res.status(404).json({
        success: false,
        message: 'Education not found',
      });
    }

    // Verify ownership
    if (Number(education.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    await MedicalEducation.remove(id);

    res.status(200).json({
      success: true,
      message: 'Education deleted successfully',
    });
  } catch (error) {
    console.error('Delete education error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createEducation,
  getEducation,
  getEducationById,
  updateEducation,
  deleteEducation,
  validateEducationCreate,
  validateEducationUpdate,
};
