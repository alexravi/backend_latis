# Search API Documentation

Complete API documentation for LinkedIn-style search features across people, companies, colleges, groups, topics, posts, and jobs.

## Table of Contents

- [Authentication](#authentication)
- [Search People](#search-people)
- [Search Organizations/Companies](#search-organizationscompanies)
- [Search Colleges/Universities](#search-collegesuniversities)
- [Search Groups](#search-groups)
- [Search Hashtags/Topics](#search-hashtagstopics)
- [Autocomplete Search](#autocomplete-search)
- [Universal Search](#universal-search)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Authentication

All search endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Search People

Search for users/people with enhanced ranking and filters.

### Endpoint

```
GET /api/search/users
GET /api/v1/search/users
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"John Doe"` |
| `limit` | integer | No | Number of results (default: 20) | `20` |
| `offset` | integer | No | Pagination offset (default: 0) | `0` |
| `location` | string | No | Filter by location | `"New York"` |
| `specialization` | string | No | Filter by specialization | `"Cardiology"` |
| `current_role` | string | No | Filter by current role | `"Surgeon"` |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "first_name": "John",
      "last_name": "Doe",
      "headline": "Cardiologist at Mayo Clinic",
      "profile_image_url": "https://...",
      "specialization": "Cardiology",
      "location": "New York, NY",
      "current_role": "Cardiologist",
      "is_verified": true,
      "connection_count": 45,
      "follower_count": 120,
      "relationship": {
        "isConnected": false,
        "connectionStatus": null,
        "connectionRequesterId": null,
        "connectionPending": false,
        "iFollowThem": true,
        "theyFollowMe": false,
        "iBlocked": false,
        "blockedMe": false
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Example Request

```javascript
// Using fetch
const response = await fetch('/api/search/users?q=John&location=New York&limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Using axios
const response = await axios.get('/api/search/users', {
  params: {
    q: 'John',
    location: 'New York',
    limit: 20
  },
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Search Organizations/Companies

Search for hospitals, clinics, research institutions, and other medical organizations.

### Endpoint

```
GET /api/search/organizations
GET /api/v1/search/organizations
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"Mayo Clinic"` |
| `limit` | integer | No | Number of results (default: 20) | `20` |
| `offset` | integer | No | Pagination offset (default: 0) | `0` |
| `organization_type` | string | No | Filter by organization type | `"Hospital"` |
| `location` | string | No | Filter by location | `"Rochester, MN"` |
| `specialty` | string | No | Filter by specialty | `"Cardiology"` |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "name": "Mayo Clinic",
      "organization_type": "Hospital",
      "description": "A leading medical center...",
      "logo_url": "https://...",
      "location": "Rochester, MN",
      "city": "Rochester",
      "state": "Minnesota",
      "country": "USA",
      "employee_count": 5000,
      "is_verified": true,
      "specialties": ["Cardiology", "Oncology", "Neurology"]
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Example Request

```javascript
const response = await fetch('/api/search/organizations?q=Mayo&organization_type=Hospital&location=Minnesota', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## Search Colleges/Universities

Search for medical schools, universities, and educational institutions from both user education records and organization database.

### Endpoint

```
GET /api/search/colleges
GET /api/v1/search/colleges
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"Harvard Medical"` |
| `limit` | integer | No | Number of results (default: 20) | `20` |
| `offset` | integer | No | Pagination offset (default: 0) | `0` |
| `location` | string | No | Filter by location | `"Boston, MA"` |
| `institution_type` | string | No | Filter by institution type | `"Medical School"` |

### Response

```json
{
  "success": true,
  "data": [
    {
      "name": "Harvard Medical School",
      "institution_type": "Medical School",
      "location": "Boston, MA",
      "alumni_count": 250,
      "source": "education"
    },
    {
      "name": "Johns Hopkins University",
      "institution_type": "University",
      "location": "Baltimore, MD",
      "alumni_count": 180,
      "source": "organization"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Example Request

```javascript
const response = await fetch('/api/search/colleges?q=Harvard&location=Boston', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## Search Groups

Search for professional groups, societies, and specialty groups.

### Endpoint

```
GET /api/search/groups
GET /api/v1/search/groups
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"Cardiology Society"` |
| `limit` | integer | No | Number of results (default: 20) | `20` |
| `offset` | integer | No | Pagination offset (default: 0) | `0` |
| `group_type` | string | No | Filter by group type | `"Professional Society"` |
| `specialty` | string | No | Filter by specialty | `"Cardiology"` |
| `location` | string | No | Filter by location | `"New York"` |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "name": "American Cardiology Society",
      "description": "Professional society for cardiologists...",
      "group_type": "Professional Society",
      "specialty": "Cardiology",
      "logo_url": "https://...",
      "location": "New York, NY",
      "member_count": 5000,
      "is_verified": true
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Example Request

```javascript
const response = await fetch('/api/search/groups?q=Cardiology&group_type=Professional Society', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## Search Hashtags/Topics

Search for hashtags and topics used in posts.

### Endpoint

```
GET /api/search/hashtags
GET /api/v1/search/hashtags
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"cardiology"` |
| `limit` | integer | No | Number of results (default: 20) | `20` |
| `offset` | integer | No | Pagination offset (default: 0) | `0` |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "name": "cardiology",
      "description": "Topics related to cardiology",
      "posts_count": 1250
    },
    {
      "id": 102,
      "name": "cardiacsurgery",
      "description": null,
      "posts_count": 450
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Example Request

```javascript
const response = await fetch('/api/search/hashtags?q=cardio', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## Autocomplete Search

Get fast autocomplete suggestions across all search types. Perfect for search bars and dropdown suggestions.

### Endpoint

```
GET /api/search/autocomplete
GET /api/v1/search/autocomplete
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"John"` |
| `limit_per_type` | integer | No | Results per type (default: 5) | `5` |

### Response

```json
{
  "success": true,
  "data": {
    "people": [
      {
        "id": 123,
        "first_name": "John",
        "last_name": "Doe",
        "headline": "Cardiologist",
        "profile_image_url": "https://...",
        "specialization": "Cardiology"
      }
    ],
    "companies": [
      {
        "id": 456,
        "name": "Johns Hopkins Hospital",
        "organization_type": "Hospital",
        "logo_url": "https://..."
      }
    ],
    "colleges": [
      {
        "name": "Johns Hopkins University",
        "institution_type": "University",
        "location": "Baltimore, MD"
      }
    ],
    "groups": [],
    "topics": [
      {
        "id": 101,
        "name": "johnshopkins",
        "posts_count": 50
      }
    ]
  }
}
```

### Example Request

```javascript
// Debounce this in your frontend for better UX
const response = await fetch('/api/search/autocomplete?q=John&limit_per_type=5', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Use in search dropdown
data.data.people.forEach(person => {
  // Display person suggestion
});
```

### Frontend Implementation Tip

```javascript
// Debounced autocomplete hook example
import { useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';

function useAutocomplete(query, token, delay = 300) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Store debounced function in ref to persist across renders
  const debouncedRef = useRef(null);

  useEffect(() => {
    // Create debounced function once and store in ref
    if (!debouncedRef.current) {
      debouncedRef.current = debounce(async (searchQuery, authToken) => {
        if (!searchQuery || searchQuery.length < 2) {
          setSuggestions(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const response = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(searchQuery)}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          const data = await response.json();
          setSuggestions(data.data);
        } catch (error) {
          console.error('Autocomplete error:', error);
        } finally {
          setLoading(false);
        }
      }, delay);
    }

    if (!query || query.length < 2) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    // Call the debounced function
    debouncedRef.current(query, token);

    // Cleanup: cancel pending debounced calls
    return () => {
      if (debouncedRef.current) {
        debouncedRef.current.cancel();
      }
    };
  }, [query, token, delay]);

  return { suggestions, loading };
}
```

---

## Universal Search

Search across all types (people, companies, colleges, groups, topics, posts, jobs) in a single request.

### Endpoint

```
GET /api/search
GET /api/v1/search
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `q` | string | Yes | Search query | `"cardiology"` |
| `limit` | integer | No | Total results (default: 10) | `20` |
| `offset` | integer | No | Pagination offset (default: 0) | `0` |
| `type` | string | No | Filter by types (comma-separated) | `"people,companies"` |

**Available types:** `people`, `companies`, `colleges`, `groups`, `topics`, `posts`, `jobs`

### Response

```json
{
  "success": true,
  "data": {
    "people": [
      {
        "id": 123,
        "first_name": "John",
        "last_name": "Doe",
        "headline": "Cardiologist",
        "profile_image_url": "https://...",
        "specialization": "Cardiology"
      }
    ],
    "companies": [
      {
        "id": 456,
        "name": "Cardiology Center",
        "organization_type": "Clinic"
      }
    ],
    "colleges": [
      {
        "name": "Cardiology Medical School",
        "institution_type": "Medical School"
      }
    ],
    "groups": [
      {
        "id": 789,
        "name": "Cardiology Professionals",
        "member_count": 500
      }
    ],
    "topics": [
      {
        "id": 101,
        "name": "cardiology",
        "posts_count": 1250
      }
    ],
    "posts": [
      {
        "id": 201,
        "content": "Latest in cardiology research...",
        "user_id": 123,
        "first_name": "John",
        "last_name": "Doe"
      }
    ],
    "jobs": [
      {
        "id": 301,
        "title": "Cardiologist Position",
        "organization_name": "Mayo Clinic"
      }
    ]
  },
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 7
  }
}
```

### Example Request

```javascript
// Search all types
const response = await fetch('/api/search?q=cardiology&limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Search only people and companies
const response = await fetch('/api/search?q=cardiology&type=people,companies', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## Response Formats

### Success Response

All successful responses follow this format:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true,
    "total": 100  // Only in universal search
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message here"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (missing or invalid query parameter)
- `401` - Unauthorized (missing or invalid token)
- `500` - Internal Server Error

---

## Error Handling

### Missing Query Parameter

```json
{
  "success": false,
  "message": "Search query is required"
}
```

### Unauthorized

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### Frontend Error Handling Example

```javascript
async function searchUsers(query, filters = {}) {
  try {
    const params = new URLSearchParams({
      q: query,
      ...filters
    });

    const response = await fetch(`/api/search/users?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized - redirect to login
        window.location.href = '/login';
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }

    return data;
  } catch (error) {
    console.error('Search error:', error);
    // Show error message to user
    return { success: false, error: error.message };
  }
}
```

---

## Examples

### Complete Search Component Example (React)

```javascript
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { debounce } from 'lodash';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Get token from your auth context or storage
  const token = localStorage.getItem('token'); // Or from context/state

  const searchTypes = {
    all: 'Universal',
    people: 'People',
    companies: 'Companies',
    colleges: 'Colleges',
    groups: 'Groups',
    topics: 'Topics'
  };

  // Create stable search handler with useCallback
  const performSearchHandler = useCallback(async (searchQuery, type) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      let url = '/api/search';
      if (type !== 'all') {
        url = `/api/search/${type === 'people' ? 'users' : type}`;
      }

      const params = new URLSearchParams({ q: searchQuery });
      if (type === 'all') {
        params.append('limit', '10');
      }

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      setResults(data.data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Create stable debounced function with useMemo
  const performSearchDebounced = useMemo(
    () => debounce(performSearchHandler, 300),
    [performSearchHandler]
  );

  useEffect(() => {
    performSearchDebounced(query, activeTab);
    
    // Cleanup: cancel pending debounced calls on unmount
    return () => {
      performSearchDebounced.cancel();
    };
  }, [query, activeTab, performSearchDebounced]);

  return (
    <div className="search-container">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="search-input"
      />

      <div className="search-tabs">
        {Object.entries(searchTypes).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={activeTab === key ? 'active' : ''}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div>Loading...</div>}

      {results && (
        <div className="search-results">
          {activeTab === 'all' ? (
            <>
              {results.people?.length > 0 && (
                <section>
                  <h3>People</h3>
                  {results.people.map(person => (
                    <div key={person.id}>{person.first_name} {person.last_name}</div>
                  ))}
                </section>
              )}
              {results.companies?.length > 0 && (
                <section>
                  <h3>Companies</h3>
                  {results.companies.map(company => (
                    <div key={company.id}>{company.name}</div>
                  ))}
                </section>
              )}
              {/* Add other types... */}
            </>
          ) : (
            <div>
              {Array.isArray(results) ? (
                results.map(item => (
                  <div key={item.id || item.name}>
                    {item.name || `${item.first_name} ${item.last_name}`}
                  </div>
                ))
              ) : (
                <div>No results found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Autocomplete Dropdown Example

```javascript
function AutocompleteDropdown({ query, onSelect }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions(null);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(query)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        const data = await response.json();
        setSuggestions(data.data);
      } catch (error) {
        console.error('Autocomplete error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!suggestions && !loading) return null;

  return (
    <div className="autocomplete-dropdown">
      {loading && <div>Loading...</div>}
      
      {suggestions && (
        <>
          {suggestions.people?.length > 0 && (
            <div className="suggestion-section">
              <div className="section-header">People</div>
              {suggestions.people.map(person => (
                <div
                  key={person.id}
                  onClick={() => onSelect('people', person)}
                  className="suggestion-item"
                >
                  <img src={person.profile_image_url} alt="" />
                  <span>{person.first_name} {person.last_name}</span>
                </div>
              ))}
            </div>
          )}

          {suggestions.companies?.length > 0 && (
            <div className="suggestion-section">
              <div className="section-header">Companies</div>
              {suggestions.companies.map(company => (
                <div
                  key={company.id}
                  onClick={() => onSelect('companies', company)}
                  className="suggestion-item"
                >
                  <img src={company.logo_url} alt="" />
                  <span>{company.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add other suggestion types... */}
        </>
      )}
    </div>
  );
}
```

---

## Best Practices

1. **Debounce Search Queries**: Always debounce search inputs to avoid excessive API calls
2. **Minimum Query Length**: Wait for at least 2-3 characters before searching
3. **Loading States**: Show loading indicators during search
4. **Error Handling**: Always handle errors gracefully and show user-friendly messages
5. **Pagination**: Implement pagination for large result sets
6. **Caching**: Consider caching recent search results for better UX
7. **Type Filtering**: Use type filters to narrow down results when needed
8. **Autocomplete**: Use autocomplete for better search experience

---

## Rate Limiting

Search endpoints are rate-limited. Typical limits:
- **Development**: 500 requests per minute per user
- **Production**: 300 requests per minute per user

Handle rate limit errors (HTTP 429) by showing appropriate messages to users.

---

## Notes

- All search queries are case-insensitive
- Special characters in queries are automatically handled
- Results are ranked by relevance, popularity, verification status, and exact matches
- Relationship information (connections, follows, blocks) is included in people search results for authenticated users
- Verified entities are boosted in search rankings
