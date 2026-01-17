// Profile derivation utilities
// Derives computed fields from experiences and education

/**
 * Derives current_role from experiences
 * @param {Array} experiences - Array of experience objects
 * @returns {string|null} Current role or null
 */
const deriveCurrentRole = (experiences) => {
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return null;
  }

  // Find the most recent current experience
  const currentExperiences = experiences.filter(exp => exp.is_current === true);
  if (currentExperiences.length > 0) {
    // Sort by start_date descending to get the most recent
    const sorted = currentExperiences.sort((a, b) => {
      const dateA = new Date(a.start_date || 0);
      const dateB = new Date(b.start_date || 0);
      return dateB - dateA;
    });
    return sorted[0].title || null;
  }

  return null;
};

/**
 * Calculates years of experience from experiences
 * @param {Array} experiences - Array of experience objects
 * @returns {number} Total years of experience (rounded)
 */
const calculateYearsOfExperience = (experiences) => {
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return 0;
  }

  const now = new Date();
  let totalDays = 0;

  experiences.forEach(exp => {
    if (!exp.start_date) return;

    const startDate = new Date(exp.start_date);
    let endDate;

    if (exp.is_current) {
      endDate = now;
    } else if (exp.end_date) {
      endDate = new Date(exp.end_date);
    } else {
      // If no end_date and not current, skip
      return;
    }

    // Calculate days difference
    const daysDiff = Math.max(0, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));
    totalDays += daysDiff;
  });

  // Convert to years (approximate: 365.25 days per year)
  const years = Math.round(totalDays / 365.25);
  return Math.min(years, 100); // Cap at 100 years
};

/**
 * Derives medical school graduation year from education
 * @param {Array} education - Array of education objects
 * @returns {number|null} Graduation year or null
 */
const deriveMedicalSchoolGraduationYear = (education) => {
  if (!Array.isArray(education) || education.length === 0) {
    return null;
  }

  // Find MD degree
  const mdDegree = education.find(edu => 
    edu.degree_type && (
      edu.degree_type.toUpperCase() === 'MD' || 
      edu.degree_type.toUpperCase() === 'DO' ||
      edu.degree_type.toLowerCase().includes('medical school')
    )
  );

  if (mdDegree) {
    if (mdDegree.graduation_date) {
      const date = new Date(mdDegree.graduation_date);
      return date.getFullYear();
    } else if (mdDegree.end_date) {
      const date = new Date(mdDegree.end_date);
      return date.getFullYear();
    }
  }

  return null;
};

/**
 * Derives residency completion year from education
 * @param {Array} education - Array of education objects
 * @returns {number|null} Completion year or null
 */
const deriveResidencyCompletionYear = (education) => {
  if (!Array.isArray(education) || education.length === 0) {
    return null;
  }

  // Find residency
  const residency = education.find(edu => 
    edu.degree_type && (
      edu.degree_type.toLowerCase() === 'residency' ||
      edu.program_name?.toLowerCase().includes('residency')
    )
  );

  if (residency) {
    if (residency.graduation_date) {
      const date = new Date(residency.graduation_date);
      return date.getFullYear();
    } else if (residency.end_date) {
      const date = new Date(residency.end_date);
      return date.getFullYear();
    }
  }

  return null;
};

/**
 * Derives fellowship completion year from education
 * @param {Array} education - Array of education objects
 * @returns {number|null} Completion year or null
 */
const deriveFellowshipCompletionYear = (education) => {
  if (!Array.isArray(education) || education.length === 0) {
    return null;
  }

  // Find fellowship
  const fellowship = education.find(edu => 
    edu.degree_type && (
      edu.degree_type.toLowerCase() === 'fellowship' ||
      edu.program_name?.toLowerCase().includes('fellowship')
    )
  );

  if (fellowship) {
    if (fellowship.graduation_date) {
      const date = new Date(fellowship.graduation_date);
      return date.getFullYear();
    } else if (fellowship.end_date) {
      const date = new Date(fellowship.end_date);
      return date.getFullYear();
    }
  }

  return null;
};

/**
 * Derives all computed fields from experiences and education
 * @param {Array} experiences - Array of experience objects
 * @param {Array} education - Array of education objects
 * @returns {object} Object with derived fields
 */
const deriveProfileFields = (experiences, education) => {
  return {
    current_role: deriveCurrentRole(experiences),
    years_of_experience: calculateYearsOfExperience(experiences),
    medical_school_graduation_year: deriveMedicalSchoolGraduationYear(education),
    residency_completion_year: deriveResidencyCompletionYear(education),
    fellowship_completion_year: deriveFellowshipCompletionYear(education),
  };
};

module.exports = {
  deriveCurrentRole,
  calculateYearsOfExperience,
  deriveMedicalSchoolGraduationYear,
  deriveResidencyCompletionYear,
  deriveFellowshipCompletionYear,
  deriveProfileFields,
};
