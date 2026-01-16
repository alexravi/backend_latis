// Award controller - Awards CRUD
const { body, validationResult } = require('express-validator');
const Award = require('../models/Award');

// Validation rules
const validateAward = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 255 })
    .withMessage('Title must be less than 255 characters'),
  body('award_type')
    .trim()
    .notEmpty()
    .withMessage('Award type is required'),
  body('date_received')
    .optional()
    .isISO8601()
    .withMessage('Date received must be a valid date'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Year must be a valid year'),
];

// Create award
const createAward = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const awardData = { ...req.body, user_id: req.user.id };
    const award = await Award.create(awardData);

    res.status(201).json({
      success: true,
      message: 'Award created successfully',
      data: award,
    });
  } catch (error) {
    console.error('Create award error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user's awards
const getAwards = async (req, res) => {
  try {
    const awards = await Award.findByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: awards,
    });
  } catch (error) {
    console.error('Get awards error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get award by ID
const getAwardById = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await Award.findById(id);

    if (!award) {
      return res.status(404).json({
        success: false,
        message: 'Award not found',
      });
    }

    // Verify ownership
    if (award.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    res.status(200).json({
      success: true,
      data: award,
    });
  } catch (error) {
    console.error('Get award error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update award
const updateAward = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const award = await Award.findById(id);

    if (!award) {
      return res.status(404).json({
        success: false,
        message: 'Award not found',
      });
    }

    // Verify ownership
    if (award.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const updated = await Award.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Award updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update award error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete award
const deleteAward = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await Award.findById(id);

    if (!award) {
      return res.status(404).json({
        success: false,
        message: 'Award not found',
      });
    }

    // Verify ownership
    if (award.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    await Award.remove(id);

    res.status(200).json({
      success: true,
      message: 'Award deleted successfully',
    });
  } catch (error) {
    console.error('Delete award error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  createAward,
  getAwards,
  getAwardById,
  updateAward,
  deleteAward,
  validateAward,
};
