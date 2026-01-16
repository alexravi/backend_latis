// Certification controller - Medical Certifications CRUD
const { body, validationResult } = require('express-validator');
const MedicalCertification = require('../models/MedicalCertification');

// Validation rules
const validateCertification = [
  body('certification_type')
    .trim()
    .notEmpty()
    .withMessage('Certification type is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Certification name is required')
    .isLength({ max: 255 })
    .withMessage('Certification name must be less than 255 characters'),
  body('issuing_organization')
    .trim()
    .notEmpty()
    .withMessage('Issuing organization is required'),
  body('issue_date')
    .optional()
    .isISO8601()
    .withMessage('Issue date must be a valid date'),
  body('expiration_date')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date'),
];

// Create certification
const createCertification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const certificationData = { ...req.body, user_id: req.user.id };
    const certification = await MedicalCertification.create(certificationData);

    res.status(201).json({
      success: true,
      message: 'Certification created successfully',
      data: certification,
    });
  } catch (error) {
    console.error('Create certification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user's certifications
const getCertifications = async (req, res) => {
  try {
    const certifications = await MedicalCertification.findByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: certifications,
    });
  } catch (error) {
    console.error('Get certifications error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get certification by ID
const getCertificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const certification = await MedicalCertification.findById(id);

    if (!certification) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found',
      });
    }

    // Verify ownership
    if (certification.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    res.status(200).json({
      success: true,
      data: certification,
    });
  } catch (error) {
    console.error('Get certification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get expiring certifications
const getExpiringCertifications = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    // Validate and coerce days to integer with safe default
    const parsedDays = parseInt(days, 10);
    const daysInt = isNaN(parsedDays) || parsedDays < 1 ? 90 : parsedDays;
    
    const certifications = await MedicalCertification.findExpiring(daysInt, req.user.id);

    res.status(200).json({
      success: true,
      data: certifications,
    });
  } catch (error) {
    console.error('Get expiring certifications error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update certification
const updateCertification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const certification = await MedicalCertification.findById(id);

    if (!certification) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found',
      });
    }

    // Verify ownership
    if (certification.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const updated = await MedicalCertification.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Certification updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update certification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete certification
const deleteCertification = async (req, res) => {
  try {
    const { id } = req.params;
    const certification = await MedicalCertification.findById(id);

    if (!certification) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found',
      });
    }

    // Verify ownership
    if (certification.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    await MedicalCertification.remove(id);

    res.status(200).json({
      success: true,
      message: 'Certification deleted successfully',
    });
  } catch (error) {
    console.error('Delete certification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createCertification,
  getCertifications,
  getCertificationById,
  getExpiringCertifications,
  updateCertification,
  deleteCertification,
  validateCertification,
};
