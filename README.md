# Backend Latis

Production-grade Node.js backend with PostgreSQL database.

## Project Structure

```
backend_latis/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection configuration
│   │   └── swagger.js           # Swagger API documentation configuration
│   ├── controllers/             # Request handlers
│   ├── models/                  # Database models
│   ├── routes/                  # API routes
│   ├── middleware/              # Custom middleware
│   ├── utils/                   # Utility functions
│   ├── server.js                # Express app setup and configuration
│   └── index.js                 # Entry point - starts the server
├── .env                         # Environment variables
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies and scripts
└── README.md                    # Project documentation
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env` file:
   - Update PostgreSQL connection details
   - Set server port

3. Run the application:
```bash
# Production
npm start

# Development (with nodemon)
npm run dev
```

4. Access API documentation:
   - Swagger UI will be available at `http://localhost:3000/api-docs` (once configured)

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
