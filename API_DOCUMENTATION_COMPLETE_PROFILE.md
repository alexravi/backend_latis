# Complete Profile API Documentation
## Frontend Integration Guide

### Endpoint
```
POST /api/users/me/profile/complete
```

### Authentication
**Required:** Bearer Token (JWT)
```
Authorization: Bearer <your_jwt_token>
```

### Content-Type
```
Content-Type: application/json
```

---

## Overview

This endpoint creates a complete user profile with all sections in a single API call. It's designed for initial profile setup after signup, handling:
- Basic user information
- Extended profile details
- Professional experiences
- Education history
- Skills
- Certifications
- Publications
- Projects
- Awards

**Note:** This endpoint can only be used if the profile doesn't already exist. For updates, use `PUT /api/users/me/profile/complete`.

---

## Request Structure

All fields are **optional** except where marked as required. You can send only the sections you want to fill.

```json
{
  "user": { /* Basic user profile */ },
  "profile": { /* Extended profile */ },
  "experiences": [ /* Array of experiences */ ],
  "education": [ /* Array of education records */ ],
  "skills": [ /* Array of skills */ ],
  "certifications": [ /* Array of certifications */ ],
  "publications": [ /* Array of publications */ ],
  "projects": [ /* Array of projects */ ],
  "awards": [ /* Array of awards */ ]
}
```

---

## Field Reference

### 1. `user` Object - Basic User Profile

Stored in the `users` table. Updates basic profile information.

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `headline` | string | No | 255 | Professional headline or tagline | "Cardiologist at Mayo Clinic" |
| `summary` | string | No | 2000 | Professional summary or bio | "Experienced cardiologist with 10+ years..." |
| `location` | string | No | 255 | Location (city, state, country) | "New York, NY, USA" |
| `phone` | string | No | 20 | Phone number (validated format) | "+1-555-123-4567" |
| `website` | string | No | 255 | Personal or professional website URL | "https://drjohnsmith.com" |
| `specialization` | string | No | 255 | Medical specialization | "Cardiology" |
| `subspecialization` | string | No | 255 | Medical subspecialization | "Interventional Cardiology" |

**Note:** The following fields are **automatically derived** from `experiences` and `education` arrays and should **not** be provided in the request:

- `current_role` - Derived from the most recent current experience (`is_current: true`)
- `years_of_experience` - Calculated from all experiences (sum of years from start_date to end_date or current date)
- `medical_school_graduation_year` - Derived from education where `degree_type` is "MD" or "DO"
- `residency_completion_year` - Derived from education where `degree_type` is "Residency"
- `fellowship_completion_year` - Derived from education where `degree_type` is "Fellowship"

**Validation Rules:**
- `phone`: Must match pattern `/^[\d\s\-\+\(\)]+$/`
- `website`: Must be a valid URL

**Derived Fields:**
The following fields are automatically computed from your `experiences` and `education` data:
- `current_role` - From most recent current experience
- `years_of_experience` - Calculated from all experience dates
- `medical_school_graduation_year` - From MD/DO degree in education
- `residency_completion_year` - From residency in education
- `fellowship_completion_year` - From fellowship in education

You do not need to provide these fields - they will be computed automatically.

**Example:**
```json
{
  "user": {
    "headline": "Cardiologist specializing in interventional procedures",
    "summary": "Board-certified cardiologist with over 10 years of experience...",
    "location": "New York, NY, USA",
    "phone": "+1-555-123-4567",
    "website": "https://drjohnsmith.com",
    "specialization": "Cardiology",
    "subspecialization": "Interventional Cardiology"
    // Note: current_role, years_of_experience, and graduation years 
    // are automatically derived from experiences and education
  }
}
```

---

### 2. `profile` Object - Extended Profile

Stored in the `profiles` table. Additional personal and professional details.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `bio` | string | No | Detailed biographical information | "Dr. Smith has been practicing..." |
| `languages` | string[] | No | Array of languages spoken | `["English", "Spanish", "French"]` |
| `interests` | string[] | No | Array of professional or personal interests | `["Research", "Teaching", "Medical Education"]` |
| `causes` | string[] | No | Array of causes or areas of advocacy | `["Healthcare Access", "Medical Research"]` |
| `volunteer_experiences` | object | No | JSON object with volunteer work details | See example below |

**Example:**
```json
{
  "profile": {
    "bio": "Dr. Smith has been practicing cardiology for over 10 years, specializing in interventional procedures...",
    "languages": ["English", "Spanish", "French"],
    "interests": ["Research", "Teaching", "Medical Education"],
    "causes": ["Healthcare Access", "Medical Research"],
    "volunteer_experiences": {
      "organization": "Medicare Without Borders",
      "role": "Volunteer Cardiologist",
      "duration": "2018-present",
      "description": "Provided cardiac care in underserved communities"
    }
  }
}
```

---

### 3. `experiences` Array - Professional Experiences

Array of medical/professional experience records. Stored in `medical_experiences` table.

Each experience object has the following fields:

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `title` | string | **Yes** | 255 | Job title or position name | "Attending Physician" |
| `position_type` | string | **Yes** | 100 | Type of position | "Residency", "Fellowship", "Clinical Position" |
| `institution_name` | string | **Yes** | 255 | Name of institution/organization | "Mayo Clinic" |
| `organization_id` | integer | No | - | Reference to organization in database | 123 |
| `department` | string | No | 255 | Department name | "Cardiology Department" |
| `specialty` | string | No | 255 | Medical specialty | "Cardiology" |
| `subspecialty` | string | No | 255 | Medical subspecialty | "Interventional Cardiology" |
| `institution_type` | string | No | 100 | Type of institution | "Hospital", "Clinic", "University" |
| `location` | string | No | 255 | Location of institution | "Rochester, MN" |
| `start_date` | date (YYYY-MM-DD) | **Yes** | - | Start date of position | "2020-01-15" |
| `end_date` | date (YYYY-MM-DD) | No | - | End date of position | "2023-12-31" |
| `is_current` | boolean | No | - | Whether this is the current position | `true` or `false` |
| `description` | string | No | - | Detailed description of responsibilities | "Managed patient care..." |
| `patient_care_responsibilities` | string | No | - | Patient care duties | "Provided comprehensive cardiac care..." |
| `research_focus_areas` | string[] | No | - | Array of research focus areas | `["Cardiac Imaging", "Interventional Techniques"]` |

**Date Format:** `YYYY-MM-DD` (ISO 8601 date format)

**Example:**
```json
{
  "experiences": [
    {
      "title": "Attending Physician",
      "position_type": "Clinical Position",
      "institution_name": "Mayo Clinic",
      "department": "Cardiology Department",
      "specialty": "Cardiology",
      "subspecialty": "Interventional Cardiology",
      "institution_type": "Hospital",
      "location": "Rochester, MN",
      "start_date": "2020-01-15",
      "end_date": null,
      "is_current": true,
      "description": "Leading interventional cardiology procedures...",
      "patient_care_responsibilities": "Managed complex cardiac cases...",
      "research_focus_areas": ["Cardiac Imaging", "Interventional Techniques"]
    },
    {
      "title": "Fellow",
      "position_type": "Fellowship",
      "institution_name": "Johns Hopkins Hospital",
      "specialty": "Cardiology",
      "subspecialty": "Interventional Cardiology",
      "start_date": "2016-07-01",
      "end_date": "2018-06-30",
      "is_current": false,
      "description": "Completed fellowship in interventional cardiology..."
    }
  ]
}
```

---

### 4. `education` Array - Education History

Array of educational records (medical school, residency, fellowship, etc.). Stored in `medical_education` table.

Each education object has the following fields:

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `degree_type` | string | **Yes** | 50 | Type of degree | "MD", "DO", "PhD", "Residency", "Fellowship" |
| `institution_name` | string | **Yes** | 255 | Name of educational institution | "Harvard Medical School" |
| `organization_id` | integer | No | - | Reference to organization in database | 456 |
| `field_of_study` | string | No | 255 | Field or major | "Medicine" |
| `institution_type` | string | No | 100 | Type of institution | "Medical School", "Hospital", "University" |
| `location` | string | No | 255 | Location of institution | "Boston, MA" |
| `program_name` | string | No | 255 | Name of program | "Internal Medicine Residency" |
| `specialty` | string | No | 255 | Medical specialty | "Internal Medicine" |
| `subspecialty` | string | No | 255 | Medical subspecialty | "Cardiology" |
| `start_date` | date (YYYY-MM-DD) | No | - | Program start date | "2010-09-01" |
| `end_date` | date (YYYY-MM-DD) | No | - | Program end date | "2014-06-30" |
| `graduation_date` | date (YYYY-MM-DD) | No | - | Graduation date | "2014-05-15" |
| `gpa` | decimal | No | - | Grade Point Average (0.00-4.00) | 3.85 |
| `honors` | string[] | No | - | Array of honors/awards | `["Summa Cum Laude", "Alpha Omega Alpha"]` |
| `recognition` | string | No | - | Recognition or achievement | "Dean's List" |
| `description` | string | No | - | Additional description | "Completed medical degree..." |
| `is_current` | boolean | No | - | Whether currently enrolled | `false` |

**Date Format:** `YYYY-MM-DD` (ISO 8601 date format)
**GPA Format:** Decimal number (e.g., 3.85)

**Example:**
```json
{
  "education": [
    {
      "degree_type": "MD",
      "institution_name": "Harvard Medical School",
      "field_of_study": "Medicine",
      "institution_type": "Medical School",
      "location": "Boston, MA",
      "start_date": "2010-09-01",
      "graduation_date": "2014-05-15",
      "gpa": 3.85,
      "honors": ["Summa Cum Laude", "Alpha Omega Alpha"],
      "recognition": "Dean's List"
    },
    {
      "degree_type": "Residency",
      "institution_name": "Massachusetts General Hospital",
      "program_name": "Internal Medicine Residency",
      "specialty": "Internal Medicine",
      "institution_type": "Hospital",
      "start_date": "2014-07-01",
      "end_date": "2017-06-30",
      "graduation_date": "2017-06-30",
      "is_current": false
    }
  ]
}
```

---

### 5. `skills` Array - Skills and Specializations

Array of skills. Can be provided in multiple formats. Stored in `medical_skills` and `user_skills` tables.

**Skill Input Formats:**

1. **Number (Skill ID):**
```json
123
```

2. **String (Skill Name - auto-creates if doesn't exist):**
```json
"Cardiology"
```

3. **Object with ID:**
```json
{
  "id": 123
}
```

4. **Object with Name (auto-creates if doesn't exist):**
```json
{
  "name": "Cardiology",
  "category": "Medical Specialty"
}
```

5. **Full Object with Proficiency:**
```json
{
  "name": "Cardiac Catheterization",
  "category": "Clinical Skill",
  "proficiency_level": "Expert",
  "years_of_experience": 5
}
```

**Skill Object Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | integer | No* | Skill ID (if skill exists) | 123 |
| `name` | string | No* | Skill name (creates new if doesn't exist) | "Cardiology" |
| `category` | string | No | Skill category | "Medical Specialty" |
| `description` | string | No | Skill description | "Diagnosis and treatment of heart conditions" |
| `proficiency_level` | string | No | Level of proficiency | "Beginner", "Intermediate", "Expert" |
| `years_of_experience` | integer | No | Years of experience with this skill | 5 |

\* Either `id` or `name` is required if using object format.

**Example:**
```json
{
  "skills": [
    "Cardiology",
    "Cardiac Catheterization",
    123,
    {
      "name": "Echocardiography",
      "category": "Clinical Skill",
      "proficiency_level": "Expert",
      "years_of_experience": 8
    },
    {
      "id": 456
    }
  ]
}
```

---

### 6. `certifications` Array - Certifications and Licenses

Array of medical certifications and licenses. Stored in `medical_certifications` table.

Each certification object has the following fields:

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `certification_type` | string | **Yes** | 100 | Type of certification | "Board Certification", "License", "Certificate" |
| `name` | string | **Yes** | 255 | Certification name | "American Board of Internal Medicine - Cardiology" |
| `issuing_organization` | string | **Yes** | 255 | Organization that issued certification | "American Board of Internal Medicine" |
| `certification_board` | string | No | 255 | Certification board name | "ABIM" |
| `license_number` | string | No | 100 | License or certification number | "MD123456" |
| `credential_id` | string | No | 100 | Credential ID | "ABIM-123456" |
| `issue_date` | date (YYYY-MM-DD) | No | - | Date certification was issued | "2018-05-15" |
| `expiration_date` | date (YYYY-MM-DD) | No | - | Expiration date | "2028-05-15" |
| `status` | string | No | 50 | Certification status (default: "Active") | "Active", "Expired", "Pending" |
| `verification_url` | string | No | 500 | URL for verification | "https://www.abim.org/verify/..." |
| `description` | string | No | - | Additional description | "Board certified in cardiovascular disease" |

**Date Format:** `YYYY-MM-DD` (ISO 8601 date format)
**Status Default:** "Active" if not provided

**Example:**
```json
{
  "certifications": [
    {
      "certification_type": "Board Certification",
      "name": "American Board of Internal Medicine - Cardiology",
      "issuing_organization": "American Board of Internal Medicine",
      "certification_board": "ABIM",
      "credential_id": "ABIM-123456",
      "issue_date": "2018-05-15",
      "expiration_date": "2028-05-15",
      "status": "Active",
      "verification_url": "https://www.abim.org/verify/123456"
    },
    {
      "certification_type": "License",
      "name": "State Medical License",
      "issuing_organization": "New York State Department of Health",
      "license_number": "MD123456",
      "issue_date": "2014-07-01",
      "status": "Active"
    }
  ]
}
```

---

### 7. `publications` Array - Research Publications

Array of research papers, journal articles, case studies. Stored in `medical_publications` table.

Each publication object has the following fields:

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `publication_type` | string | **Yes** | 100 | Type of publication | "Journal Article", "Case Study", "Review", "Book Chapter" |
| `title` | string | **Yes** | 500 | Publication title | "Novel Approaches to Cardiac Catheterization" |
| `authors` | string[] | **Yes** | - | Array of author names | `["John Smith", "Jane Doe", "Bob Johnson"]` |
| `author_order` | integer | No | - | Author's position in author list (1 = first author) | 1 |
| `journal_name` | string | No | 255 | Journal name | "New England Journal of Medicine" |
| `publisher` | string | No | 255 | Publisher name | "Massachusetts Medical Society" |
| `publication_date` | date (YYYY-MM-DD) | No | - | Publication date | "2023-03-15" |
| `doi` | string | No | 255 | Digital Object Identifier | "10.1056/NEJMoa1234567" |
| `url` | string | No | 500 | URL to publication | "https://www.nejm.org/doi/10.1056/..." |
| `abstract` | string | No | - | Publication abstract | "Background: Cardiac procedures..." |
| `keywords` | string[] | No | - | Array of keywords | `["Cardiology", "Catheterization", "Interventional"]` |
| `impact_factor` | decimal | No | - | Journal impact factor | 176.079 |
| `citation_count` | integer | No | - | Number of citations (default: 0) | 45 |
| `is_peer_reviewed` | boolean | No | - | Whether publication is peer-reviewed (default: false) | `true` |
| `volume` | string | No | 50 | Journal volume | "388" |
| `issue` | string | No | 50 | Journal issue | "12" |
| `pages` | string | No | 50 | Page numbers | "1123-1135" |
| `description` | string | No | - | Additional description | "Research on novel catheterization techniques" |

**Date Format:** `YYYY-MM-DD` (ISO 8601 date format)
**Citation Count Default:** 0 if not provided

**Example:**
```json
{
  "publications": [
    {
      "publication_type": "Journal Article",
      "title": "Novel Approaches to Cardiac Catheterization in High-Risk Patients",
      "authors": ["John Smith", "Jane Doe", "Bob Johnson"],
      "author_order": 1,
      "journal_name": "New England Journal of Medicine",
      "publisher": "Massachusetts Medical Society",
      "publication_date": "2023-03-15",
      "doi": "10.1056/NEJMoa1234567",
      "url": "https://www.nejm.org/doi/10.1056/NEJMoa1234567",
      "abstract": "Background: Cardiac catheterization procedures...",
      "keywords": ["Cardiology", "Catheterization", "Interventional"],
      "impact_factor": 176.079,
      "citation_count": 45,
      "is_peer_reviewed": true,
      "volume": "388",
      "issue": "12",
      "pages": "1123-1135"
    }
  ]
}
```

---

### 8. `projects` Array - Research Projects and Initiatives

Array of research projects, clinical trials, quality improvement initiatives. Stored in `medical_projects` table.

Each project object has the following fields:

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `title` | string | **Yes** | 255 | Project title | "Cardiac Imaging Study" |
| `project_type` | string | **Yes** | 100 | Type of project | "Research", "Clinical Trial", "Quality Improvement" |
| `organization_id` | integer | No | - | Reference to organization in database | 789 |
| `description` | string | No | - | Project description | "Multi-center study on cardiac imaging..." |
| `start_date` | date (YYYY-MM-DD) | No | - | Project start date | "2022-01-01" |
| `end_date` | date (YYYY-MM-DD) | No | - | Project end date | "2024-12-31" |
| `is_current` | boolean | No | - | Whether project is ongoing (default: false) | `true` |
| `role` | string | No | 255 | Your role in the project | "Principal Investigator" |
| `responsibilities` | string | No | - | Your responsibilities | "Led research team, designed protocol..." |
| `outcomes` | string | No | - | Project outcomes or results | "Published findings in NEJM..." |
| `technologies_used` | string[] | No | - | Array of technologies/methods used | `["Echocardiography", "MRI", "Data Analysis"]` |
| `collaborators` | string[] | No | - | Array of collaborator names or organizations | `["Dr. Jane Doe", "Mayo Clinic"]` |
| `funding_source` | string | No | 255 | Funding source | "NIH Grant" |
| `grant_number` | string | No | 100 | Grant number | "R01HL123456" |
| `url` | string | No | 500 | Project URL | "https://clinicaltrials.gov/..." |

**Date Format:** `YYYY-MM-DD` (ISO 8601 date format)

**Example:**
```json
{
  "projects": [
    {
      "title": "Cardiac Imaging Study",
      "project_type": "Research",
      "description": "Multi-center study on cardiac imaging techniques",
      "start_date": "2022-01-01",
      "end_date": "2024-12-31",
      "is_current": true,
      "role": "Principal Investigator",
      "responsibilities": "Led research team, designed protocol, analyzed data",
      "outcomes": "Published findings in NEJM, presented at AHA conference",
      "technologies_used": ["Echocardiography", "MRI", "Data Analysis"],
      "collaborators": ["Dr. Jane Doe", "Mayo Clinic"],
      "funding_source": "NIH Grant",
      "grant_number": "R01HL123456",
      "url": "https://clinicaltrials.gov/NCT12345678"
    }
  ]
}
```

---

### 9. `awards` Array - Awards and Recognitions

Array of awards, honors, grants, scholarships. Stored in `awards` table.

Each award object has the following fields:

| Field | Type | Required | Max Length | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `title` | string | **Yes** | 255 | Award title | "Physician of the Year" |
| `award_type` | string | **Yes** | 100 | Type of award | "Professional Award", "Research Grant", "Scholarship", "Recognition" |
| `organization_id` | integer | No | - | Reference to organization in database | 101 |
| `issuing_organization` | string | No | 255 | Organization that issued award | "American Medical Association" |
| `description` | string | No | - | Award description | "Recognized for excellence in patient care" |
| `date_received` | date (YYYY-MM-DD) | No | - | Date award was received | "2023-06-15" |
| `year` | integer | No | - | Year award was received | 2023 |
| `monetary_value` | decimal | No | - | Monetary value if applicable | 50000.00 |
| `currency` | string | No | 10 | Currency code (ISO 4217) | "USD", "EUR" |
| `url` | string | No | 500 | URL to award information | "https://www.ama-assn.org/awards/..." |

**Date Format:** `YYYY-MM-DD` (ISO 8601 date format)
**Currency:** ISO 4217 currency codes (e.g., "USD", "EUR", "GBP")

**Example:**
```json
{
  "awards": [
    {
      "title": "Physician of the Year",
      "award_type": "Professional Award",
      "issuing_organization": "American Medical Association",
      "description": "Recognized for excellence in patient care and medical innovation",
      "date_received": "2023-06-15",
      "year": 2023,
      "url": "https://www.ama-assn.org/awards/2023"
    },
    {
      "title": "NIH Research Grant",
      "award_type": "Research Grant",
      "issuing_organization": "National Institutes of Health",
      "description": "Grant for cardiac imaging research",
      "date_received": "2022-09-01",
      "year": 2022,
      "monetary_value": 500000.00,
      "currency": "USD"
    }
  ]
}
```

---

## Complete Request Example

```json
{
  "user": {
    "headline": "Cardiologist specializing in interventional procedures",
    "summary": "Board-certified cardiologist with over 10 years of experience...",
    "location": "New York, NY, USA",
    "phone": "+1-555-123-4567",
    "website": "https://drjohnsmith.com",
    "specialization": "Cardiology",
    "subspecialization": "Interventional Cardiology"
    // Note: current_role, years_of_experience, and graduation years are derived automatically
  },
  "profile": {
    "bio": "Dr. Smith has been practicing cardiology for over 10 years...",
    "languages": ["English", "Spanish"],
    "interests": ["Research", "Teaching"],
    "causes": ["Healthcare Access"]
  },
  "experiences": [
    {
      "title": "Attending Physician",
      "position_type": "Clinical Position",
      "institution_name": "Mayo Clinic",
      "specialty": "Cardiology",
      "start_date": "2020-01-15",
      "is_current": true
    }
  ],
  "education": [
    {
      "degree_type": "MD",
      "institution_name": "Harvard Medical School",
      "graduation_date": "2014-05-15"
    }
  ],
  "skills": [
    "Cardiology",
    {
      "name": "Cardiac Catheterization",
      "proficiency_level": "Expert"
    }
  ],
  "certifications": [
    {
      "certification_type": "Board Certification",
      "name": "American Board of Internal Medicine - Cardiology",
      "issuing_organization": "American Board of Internal Medicine",
      "issue_date": "2018-05-15",
      "status": "Active"
    }
  ],
  "publications": [],
  "projects": [],
  "awards": []
}
```

---

## Response Structure

### Success Response (201 Created)

**Note:** The API now returns a minimal response for better performance. To get the complete profile data, use `GET /api/users/me/profile/complete` after creation.

```json
{
  "success": true,
  "profile_id": 45,
  "user_id": 123,
  "completion_percentage": 72
}
```

**Response Fields:**
- `success` (boolean): Indicates successful creation
- `profile_id` (integer): ID of the created profile record (from `profiles` table)
- `user_id` (integer): ID of the user
- `completion_percentage` (integer): Basic profile completion percentage (0-100)

**To retrieve the complete profile:**
After receiving the success response, call:
```
GET /api/users/me/profile/complete
Authorization: Bearer <your_jwt_token>
```

This returns the full profile with all sections (user, profile, professional data).
```

### Error Responses

#### 409 Conflict - Profile Already Exists

```json
{
  "success": false,
  "message": "Profile already exists. Use PUT /api/users/me/profile/complete to update."
}
```

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "errors": [
    {
      "msg": "First name must be between 1 and 100 characters",
      "param": "first_name",
      "location": "body"
    }
  ]
}
```

#### 401 Unauthorized - Missing or Invalid Token

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Frontend Integration Tips

### 1. Progressive Form Submission

You can submit the form progressively (save as user fills) by only sending filled sections:

```javascript
// Initial save with just user info
await fetch('/api/users/me/profile/complete', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user: { headline: "...", location: "..." }
  })
});

// Later, add experiences
await fetch('/api/users/me/profile/complete', {
  method: 'PUT', // Use PUT for updates
  // ... same structure
});
```

### 2. Date Formatting

Always use ISO 8601 date format (`YYYY-MM-DD`):

```javascript
// Convert Date object to YYYY-MM-DD
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Example
const startDate = formatDate(new Date()); // "2024-01-15"
```

### 3. Handling Skills

Skills can be sent as strings (easiest for frontend):

```javascript
const skills = [
  "Cardiology",
  "Cardiac Catheterization",
  "Echocardiography"
];

// Or with proficiency
const skillsWithProficiency = [
  {
    name: "Cardiology",
    proficiency_level: "Expert",
    years_of_experience: 10
  }
];
```

### 4. Array Fields

Many fields accept arrays. Always send arrays, even if empty:

```javascript
{
  "languages": ["English", "Spanish"], // ✅ Good
  "languages": null, // ❌ Bad - use [] instead
  "languages": [], // ✅ Good - empty array
}
```

### 5. Error Handling

```javascript
try {
  const response = await fetch('/api/users/me/profile/complete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 409) {
      // Profile already exists - use PUT instead
      console.error('Profile exists, use PUT endpoint');
    } else if (response.status === 400) {
      // Validation errors
      data.errors.forEach(error => {
        console.error(`${error.param}: ${error.msg}`);
      });
    }
    throw new Error(data.message || 'Failed to create profile');
  }

  console.log('Profile created:', data.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

### 6. Loading States

Show loading indicators during submission:

```javascript
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async (data) => {
  setIsLoading(true);
  try {
    await submitProfile(data);
  } finally {
    setIsLoading(false);
  }
};
```

---

## Common Patterns

### Multi-Step Form

```javascript
// Step 1: Basic Info
const step1 = { user: { ... } };

// Step 2: Professional Details
const step2 = { experiences: [...], education: [...] };

// Combine all steps before final submission
const completeProfile = {
  ...step1,
  ...step2,
  // ... other steps
};

await submitCompleteProfile(completeProfile);
```

### Auto-save Drafts

```javascript
// Save draft locally
localStorage.setItem('profileDraft', JSON.stringify(formData));

// On page load, restore draft
const draft = JSON.parse(localStorage.getItem('profileDraft') || '{}');
```

### Validation Before Submit

```javascript
const validateProfile = (data) => {
  const errors = [];

  // Validate required experience fields
  if (data.experiences) {
    data.experiences.forEach((exp, index) => {
      if (!exp.title) errors.push(`Experience ${index + 1}: title required`);
      if (!exp.start_date) errors.push(`Experience ${index + 1}: start_date required`);
    });
  }

  // Validate dates
  data.experiences?.forEach((exp, index) => {
    if (exp.start_date && exp.end_date) {
      if (new Date(exp.end_date) < new Date(exp.start_date)) {
        errors.push(`Experience ${index + 1}: end_date must be after start_date`);
      }
    }
  });

  return errors;
};
```

---

## Notes

1. **All fields are optional** - Send only what the user has filled
2. **Profile validation** - The endpoint checks if profile exists before creation
3. **Auto-creation** - Skills are automatically created if they don't exist when sent by name
4. **Date formats** - Always use `YYYY-MM-DD` format for dates
5. **Arrays** - Send empty arrays `[]` instead of `null` for array fields
6. **Updates** - Use `PUT /api/users/me/profile/complete` for updating existing profiles
7. **Token required** - All requests require a valid JWT token in the Authorization header

---

## Support

For questions or issues, refer to the API documentation or contact the backend team.
