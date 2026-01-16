// Skill controller - Skills CRUD
const { body, validationResult } = require('express-validator');
const MedicalSkill = require('../models/MedicalSkill');
const UserSkill = require('../models/UserSkill');

// Validation rules
const validateSkill = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Skill name is required')
    .isLength({ max: 255 })
    .withMessage('Skill name must be less than 255 characters'),
];

// Add skill to user
const addSkill = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { name, category, description, proficiency_level, years_of_experience } = req.body;

    // Find or create skill
    let skill = await MedicalSkill.findByName(name);
    if (!skill) {
      skill = await MedicalSkill.create({ name, category, description });
    }

    // Add skill to user
    const userSkill = await UserSkill.addSkill(req.user.id, skill.id, {
      proficiency_level,
      years_of_experience,
    });

    res.status(201).json({
      success: true,
      message: 'Skill added successfully',
      data: userSkill,
    });
  } catch (error) {
    console.error('Add skill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get user's skills
const getUserSkills = async (req, res) => {
  try {
    const skills = await UserSkill.findByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: skills,
    });
  } catch (error) {
    console.error('Get skills error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get all available skills
const getAvailableSkills = async (req, res) => {
  try {
    const { category } = req.query;
    const skills = await MedicalSkill.findAll(category);

    res.status(200).json({
      success: true,
      data: skills,
    });
  } catch (error) {
    console.error('Get available skills error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Search skills
const searchSkills = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const skills = await MedicalSkill.search(q);

    res.status(200).json({
      success: true,
      data: skills,
    });
  } catch (error) {
    console.error('Search skills error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Remove skill from user
const removeSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const skillId = parseInt(id);

    if (isNaN(skillId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid skill ID',
      });
    }

    // Verify user has this skill
    const userSkills = await UserSkill.findByUserId(req.user.id);
    const hasSkill = userSkills.some(us => us.skill_id === skillId);

    if (!hasSkill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found in your profile',
      });
    }

    await UserSkill.removeSkill(req.user.id, skillId);

    res.status(200).json({
      success: true,
      message: 'Skill removed successfully',
    });
  } catch (error) {
    console.error('Remove skill error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  addSkill,
  getUserSkills,
  getAvailableSkills,
  searchSkills,
  removeSkill,
  validateSkill,
};
