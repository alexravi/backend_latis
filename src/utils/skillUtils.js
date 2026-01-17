// Skill normalization utilities
// Normalizes skill inputs from various formats (string, number, object) to standard format

/**
 * Normalizes skill input to standard format
 * @param {string|number|object} skill - Skill input in various formats
 * @param {object} existingSkillMap - Map of existing skills by ID for lookup
 * @returns {object|null} Normalized skill object or null if invalid
 */
const normalizeSkill = (skill, existingSkillMap = {}) => {
  // Handle number (skill ID)
  if (typeof skill === 'number') {
    const existing = existingSkillMap[skill];
    if (!existing) {
      return null; // Invalid skill ID
    }
    return {
      id: skill,
      name: existing.name.toLowerCase(),
      category: existing.category,
      proficiency_level: null,
      years_of_experience: null,
    };
  }

  // Handle string (skill name)
  if (typeof skill === 'string') {
    return {
      name: skill.toLowerCase().trim(),
      category: null,
      proficiency_level: null,
      years_of_experience: null,
    };
  }

  // Handle object with id
  if (skill && typeof skill === 'object' && skill.id) {
    const existing = existingSkillMap[skill.id];
    if (!existing) {
      return null; // Invalid skill ID
    }
    return {
      id: skill.id,
      name: existing.name.toLowerCase(),
      category: skill.category || existing.category,
      proficiency_level: skill.proficiency_level ?? null,
      years_of_experience: skill.years_of_experience ?? null,
    };
  }

  // Handle object with name
  if (skill && typeof skill === 'object' && skill.name) {
    return {
      name: skill.name.toLowerCase().trim(),
      category: skill.category || null,
      proficiency_level: skill.proficiency_level ?? null,
      years_of_experience: skill.years_of_experience ?? null,
    };
  }

  return null; // Invalid format
};

/**
 * Normalizes and deduplicates array of skills
 * @param {Array} skills - Array of skill inputs in various formats
 * @param {object} existingSkillMap - Map of existing skills by ID for lookup
 * @returns {Array} Array of normalized skill objects (deduplicated by name)
 */
const normalizeSkills = (skills, existingSkillMap = {}) => {
  if (!Array.isArray(skills) || skills.length === 0) {
    return [];
  }

  const normalized = [];
  const seenNames = new Set();

  for (const skill of skills) {
    const normalizedSkill = normalizeSkill(skill, existingSkillMap);
    if (!normalizedSkill || !normalizedSkill.name) {
      continue; // Skip invalid skills
    }

    // Deduplicate by lowercase name
    if (!seenNames.has(normalizedSkill.name)) {
      seenNames.add(normalizedSkill.name);
      normalized.push(normalizedSkill);
    }
  }

  return normalized;
};

module.exports = {
  normalizeSkill,
  normalizeSkills,
};
