// Organization controller - Medical Organizations CRUD
const { body, validationResult } = require('express-validator');
const MedicalOrganization = require('../models/MedicalOrganization');

// Validation rules
const validateOrganization = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Organization name is required')
    .isLength({ max: 255 })
    .withMessage('Organization name must be less than 255 characters'),
  body('organization_type')
    .trim()
    .notEmpty()
    .withMessage('Organization type is required'),
];

// Validation rules for partial updates (optional fields)
const validateOrganizationUpdate = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Organization name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Organization name must be less than 255 characters'),
  body('organization_type')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Organization type cannot be empty'),
];

// Create organization
const createOrganization = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const organizationData = req.body;
    const organization = await MedicalOrganization.create(organizationData);

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: organization,
    });
  } catch (error) {
    console.error('Create organization error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Search organizations
const searchOrganizations = async (req, res) => {
  try {
    const { q, type } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const organizations = await MedicalOrganization.search(q, type);

    res.status(200).json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    console.error('Search organizations error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get organization by ID
const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await MedicalOrganization.findById(id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error('Get organization error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update organization
const updateOrganization = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const organization = await MedicalOrganization.findById(id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const updated = await MedicalOrganization.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update organization error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createOrganization,
  searchOrganizations,
  getOrganizationById,
  updateOrganization,
  validateOrganization,
  validateOrganizationUpdate,
};
