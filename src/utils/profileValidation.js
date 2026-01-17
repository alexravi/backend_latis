// Layered validation for profile data
// Layer 1: Shape validation (fast)
// Layer 2: Business rules (conditional)
// Layer 3: Referential checks (optional)

/**
 * Layer 1: Shape validation - checks types and required fields
 * @param {object} payload - Request payload
 * @returns {Array} Array of validation errors (empty if valid)
 */
const validateShape = (payload) => {
  const errors = [];

  // Validate user object shape
  if (payload.user && typeof payload.user !== 'object') {
    errors.push({ field: 'user', message: 'user must be an object' });
  }

  // Validate arrays
  const arrayFields = ['experiences', 'education', 'skills', 'certifications', 'publications', 'projects', 'awards'];
  for (const field of arrayFields) {
    if (payload[field] !== undefined && !Array.isArray(payload[field])) {
      errors.push({ field, message: `${field} must be an array` });
    }
  }

  // Validate experience shape
  if (Array.isArray(payload.experiences)) {
    payload.experiences.forEach((exp, index) => {
      if (!exp.title || typeof exp.title !== 'string') {
        errors.push({ field: `experiences[${index}].title`, message: 'title is required and must be a string' });
      }
      if (!exp.position_type || typeof exp.position_type !== 'string') {
        errors.push({ field: `experiences[${index}].position_type`, message: 'position_type is required and must be a string' });
      }
      if (!exp.institution_name || typeof exp.institution_name !== 'string') {
        errors.push({ field: `experiences[${index}].institution_name`, message: 'institution_name is required and must be a string' });
      }
      if (!exp.start_date || typeof exp.start_date !== 'string') {
        errors.push({ field: `experiences[${index}].start_date`, message: 'start_date is required and must be a string (YYYY-MM-DD)' });
      }
    });
  }

  // Validate education shape
  if (Array.isArray(payload.education)) {
    payload.education.forEach((edu, index) => {
      if (!edu.degree_type || typeof edu.degree_type !== 'string') {
        errors.push({ field: `education[${index}].degree_type`, message: 'degree_type is required and must be a string' });
      }
      if (!edu.institution_name || typeof edu.institution_name !== 'string') {
        errors.push({ field: `education[${index}].institution_name`, message: 'institution_name is required and must be a string' });
      }
    });
  }

  // Validate certification shape
  if (Array.isArray(payload.certifications)) {
    payload.certifications.forEach((cert, index) => {
      if (!cert.certification_type || typeof cert.certification_type !== 'string') {
        errors.push({ field: `certifications[${index}].certification_type`, message: 'certification_type is required and must be a string' });
      }
      if (!cert.name || typeof cert.name !== 'string') {
        errors.push({ field: `certifications[${index}].name`, message: 'name is required and must be a string' });
      }
      if (!cert.issuing_organization || typeof cert.issuing_organization !== 'string') {
        errors.push({ field: `certifications[${index}].issuing_organization`, message: 'issuing_organization is required and must be a string' });
      }
    });
  }

  // Validate publication shape
  if (Array.isArray(payload.publications)) {
    payload.publications.forEach((pub, index) => {
      if (!pub.publication_type || typeof pub.publication_type !== 'string') {
        errors.push({ field: `publications[${index}].publication_type`, message: 'publication_type is required and must be a string' });
      }
      if (!pub.title || typeof pub.title !== 'string') {
        errors.push({ field: `publications[${index}].title`, message: 'title is required and must be a string' });
      }
      if (!Array.isArray(pub.authors)) {
        errors.push({ field: `publications[${index}].authors`, message: 'authors is required and must be an array' });
      }
    });
  }

  // Validate project shape
  if (Array.isArray(payload.projects)) {
    payload.projects.forEach((proj, index) => {
      if (!proj.title || typeof proj.title !== 'string') {
        errors.push({ field: `projects[${index}].title`, message: 'title is required and must be a string' });
      }
      if (!proj.project_type || typeof proj.project_type !== 'string') {
        errors.push({ field: `projects[${index}].project_type`, message: 'project_type is required and must be a string' });
      }
    });
  }

  // Validate award shape
  if (Array.isArray(payload.awards)) {
    payload.awards.forEach((award, index) => {
      if (!award.title || typeof award.title !== 'string') {
        errors.push({ field: `awards[${index}].title`, message: 'title is required and must be a string' });
      }
      if (!award.award_type || typeof award.award_type !== 'string') {
        errors.push({ field: `awards[${index}].award_type`, message: 'award_type is required and must be a string' });
      }
    });
  }

  return errors;
};

/**
 * Layer 2: Business rules validation
 * @param {object} payload - Request payload
 * @returns {Array} Array of validation errors (empty if valid)
 */
const validateBusinessRules = (payload) => {
  const errors = [];
  const currentYear = new Date().getFullYear();

  // Note: years_of_experience, current_role, and graduation years are derived automatically
  // from experiences and education. No need to validate them if provided (they'll be overwritten).

  // Validate date ranges in experiences
  if (Array.isArray(payload.experiences)) {
    payload.experiences.forEach((exp, index) => {
      if (exp.start_date && exp.end_date && !exp.is_current) {
        const start = new Date(exp.start_date);
        const end = new Date(exp.end_date);
        if (end < start) {
          errors.push({ field: `experiences[${index}].end_date`, message: 'end_date must be after start_date' });
        }
      }
    });
  }

  // Validate date ranges in education
  if (Array.isArray(payload.education)) {
    payload.education.forEach((edu, index) => {
      if (edu.start_date && edu.end_date) {
        const start = new Date(edu.start_date);
        const end = new Date(edu.end_date);
        if (end < start) {
          errors.push({ field: `education[${index}].end_date`, message: 'end_date must be after start_date' });
        }
      }
    });
  }

  // Validate current position logic
  if (Array.isArray(payload.experiences)) {
    payload.experiences.forEach((exp, index) => {
      if (exp.is_current && exp.end_date) {
        errors.push({ field: `experiences[${index}].is_current`, message: 'current position should not have an end_date' });
      }
    });
  }

  return errors;
};

/**
 * Main validation function - combines all layers
 * @param {object} payload - Request payload
 * @returns {Array} Array of validation errors (empty if valid)
 */
const validateProfileData = (payload) => {
  const shapeErrors = validateShape(payload);
  const businessErrors = validateBusinessRules(payload);
  
  return [...shapeErrors, ...businessErrors];
};

module.exports = {
  validateShape,
  validateBusinessRules,
  validateProfileData,
};
