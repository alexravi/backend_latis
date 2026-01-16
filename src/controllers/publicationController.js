// Publication controller - Medical Publications CRUD
const { body, validationResult } = require('express-validator');
const MedicalPublication = require('../models/MedicalPublication');

// Validation rules
const validatePublication = [
  body('publication_type')
    .trim()
    .notEmpty()
    .withMessage('Publication type is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 500 })
    .withMessage('Title must be less than 500 characters'),
  body('authors')
    .isArray({ min: 1 })
    .withMessage('Authors must be an array with at least one author'),
  body('publication_date')
    .optional()
    .isISO8601()
    .withMessage('Publication date must be a valid date'),
];

// Create publication
const createPublication = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const publicationData = { ...req.body, user_id: req.user.id };
    const publication = await MedicalPublication.create(publicationData);

    res.status(201).json({
      success: true,
      message: 'Publication created successfully',
      data: publication,
    });
  } catch (error) {
    console.error('Create publication error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user's publications
const getPublications = async (req, res) => {
  try {
    const publications = await MedicalPublication.findByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: publications,
    });
  } catch (error) {
    console.error('Get publications error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get publication by ID
const getPublicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const publication = await MedicalPublication.findById(id);

    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publication not found',
      });
    }

    // Verify ownership
    if (Number(publication.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    res.status(200).json({
      success: true,
      data: publication,
    });
  } catch (error) {
    console.error('Get publication error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update publication
const updatePublication = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const publication = await MedicalPublication.findById(id);

    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publication not found',
      });
    }

    // Verify ownership
    if (Number(publication.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const updated = await MedicalPublication.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Publication updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update publication error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete publication
const deletePublication = async (req, res) => {
  try {
    const { id } = req.params;
    const publication = await MedicalPublication.findById(id);

    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publication not found',
      });
    }

    // Verify ownership
    if (Number(publication.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    await MedicalPublication.remove(id);

    res.status(200).json({
      success: true,
      message: 'Publication deleted successfully',
    });
  } catch (error) {
    console.error('Delete publication error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createPublication,
  getPublications,
  getPublicationById,
  updatePublication,
  deletePublication,
  validatePublication,
};
