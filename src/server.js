// Express app setup and configuration
// This file contains the Express application setup, middleware, and route configuration
// Swagger documentation will be configured here
require('dotenv').config();
const express = require('express');
const { swaggerSpec, swaggerUi } = require('./config/swagger');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

module.exports = app;
