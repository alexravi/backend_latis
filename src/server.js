// Express app setup and configuration
// This file contains the Express application setup, middleware, and route configuration
// Swagger documentation will be configured here
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { swaggerSpec, swaggerUi } = require('./config/swagger');

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://latis.in'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Swagger JSON endpoint for downloading the spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const experienceRoutes = require('./routes/experienceRoutes');
const educationRoutes = require('./routes/educationRoutes');
const skillRoutes = require('./routes/skillRoutes');
const certificationRoutes = require('./routes/certificationRoutes');
const publicationRoutes = require('./routes/publicationRoutes');
const projectRoutes = require('./routes/projectRoutes');
const awardRoutes = require('./routes/awardRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/experiences', experienceRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/awards', awardRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

module.exports = app;
